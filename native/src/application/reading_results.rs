//! Shared local reading execution; consumers retain independent publication authority.
use super::*;
use crate::{
    ai::results::{self, Retained},
    language::reading::{
        Request,
        text::{Prepared, Stored},
    },
};
use serde_json::json;

impl Application {
    pub(super) async fn shared_reading(
        self: &Arc<Self>,
        request: Arc<Request>,
    ) -> Result<Retained> {
        request.validate_source(&*self.lock()?)?;
        let prepared = request.prepare_text()?;
        let cached = if request.fresh {
            None
        } else {
            results::lookup(&self.lock()?.connection, &prepared.key)?
        };
        if let Some(saved) = cached {
            results::associate(&self.lock()?.connection, &request.id, &saved.execution)?;
            return Ok(saved);
        }
        let pending_key = if request.fresh {
            format!("{}:{}", prepared.key, request.id)
        } else {
            prepared.key.clone()
        };
        let (subscription, producer) = self.reading_pending.subscribe(pending_key)?;
        results::associate(&self.lock()?.connection, &request.id, subscription.id())?;
        if let Some(producer) = producer {
            let state = self.clone();
            let owner = request.clone();
            tauri::async_runtime::spawn(async move {
                let result = state.produce_reading(&owner, prepared, &producer).await;
                producer.finish(result);
            });
        }
        let result = subscription.wait();
        tokio::pin!(result);
        loop {
            tokio::select! {
                result = &mut result => {
                    request.validate_source(&*self.lock()?)?;
                    if let Ok(saved) = &result { results::associate(&self.lock()?.connection, &request.id, &saved.execution)?; }
                    return result;
                },
                _ = tokio::time::sleep(Duration::from_millis(50)) => request.validate_source(&*self.lock()?)?,
            }
        }
    }

    async fn produce_reading(
        &self,
        request: &Request,
        prepared: Prepared,
        producer: &results::pending::Producer<Retained>,
    ) -> Result<Retained> {
        let id = producer.id();
        {
            let store = self.lock()?;
            if store.snapshot()?.learner.id != request.install {
                return Err(AppError::new(
                    ErrorCode::SessionExpired,
                    "Workspace changed before reading execution.",
                ));
            }
            if !request.fresh
                && let Some(saved) = results::lookup(&store.connection, &prepared.key)?
            {
                return Ok(saved);
            }
            results::begin(&store.connection, id, request.input.aid.receipt_kind())?;
        }
        let result = self.execute_reading(request, prepared, producer).await;
        if let Err(mut error) = result {
            let store = self.lock()?;
            if store.snapshot()?.learner.id == request.install {
                let pending: bool = store.connection.query_row(
                    "SELECT state='pending' FROM inference_executions WHERE id=?1",
                    [id],
                    |r| r.get(0),
                )?;
                if pending {
                    // Admission, access and credential failures also receive a settled execution receipt.
                    let metadata = error.diagnostics.as_ref().and_then(|d| d.get("response")).cloned().unwrap_or_else(||
                        json!({"requestedModel":request.model,"route":request.target.route.label(),
                            "error":crate::diagnostics::response::metadata(&json!(error), &[&request.input.text])}));
                    results::finish(&store.connection, id, "", &metadata, None, Some(&error))
                        .map_err(|error| execution_error(error, id, &metadata))?;
                    error.diagnostics = Some(json!({"sourceExecutionId":id,"response":metadata}));
                }
            }
            return Err(error);
        }
        result
    }

    async fn execute_reading(
        &self,
        request: &Request,
        mut prepared: Prepared,
        producer: &results::pending::Producer<Retained>,
    ) -> Result<Retained> {
        let authority = || request.validate_execution(&*self.lock()?);
        authority()?;
        let client = provider::client()?;
        let key = match &request.target.credential {
            Some(id) => read_secret(id.clone()).await?,
            None => Zeroizing::new(String::new()),
        };
        let _permit = self.admission.try_chat().ok_or_else(|| {
            AppError::new(
                ErrorCode::AdmissionHeld,
                "AI work is at capacity. Try reading help again when pending work finishes.",
            )
        })?;
        authority()?;
        if !producer.has_subscribers() {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Reading request closed before dispatch.",
            ));
        }
        (prepared.dispatch.attempt, prepared.dispatch.operation) =
            crate::ai::identity::new_execution_ids();
        let id = producer.id();
        {
            let store = self.lock()?;
            results::dispatched(&store.connection, id)?;
        }
        // Once dispatched, cancellation of a card cannot abandon accounting or another consumer.
        let completed = retry::run(
            || provider::complete_with_output(&client, &key, &prepared.dispatch, prepared.output()),
            authority,
            |error| results::record_retry(&self.lock()?.connection, id, error),
        )
        .await;
        let mut metadata = json!({"requestedModel":request.model,"route":request.target.route.label(),
            "attemptId":prepared.dispatch.attempt,"operationId":prepared.dispatch.operation});
        // Validate, merge and retain under one store guard so concurrent repairs cannot lose spans.
        let store = self.lock()?;
        if store.snapshot()?.learner.id != request.install {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Workspace changed during reading execution.",
            ));
        }
        let outcome = completed.and_then(|completed| {
            metadata["actualModel"] = json!(completed.actual_model);
            metadata["providerId"] = json!(completed.provider_id);
            metadata["finishReason"] = json!(completed.finish_reason);
            metadata["inputTokens"] = json!(completed.input_tokens);
            metadata["outputTokens"] = json!(completed.output_tokens);
            metadata["diagnostics"] = json!(completed.diagnostics);
            let previous = results::lookup(&store.connection, &prepared.key)?;
            if let Some(saved) = &previous {
                metadata["repairSourceExecutionId"] = json!(saved.execution);
            }
            let previous = previous
                .as_ref()
                .map(|saved| Stored::decode(&saved.payload))
                .transpose()?;
            let stored =
                request.validate_text(&prepared, &completed, &mut metadata, previous.as_ref())?;
            request.validate_execution(&store)?;
            Ok(serde_json::to_vec(&stored)?)
        });
        if let Err(error) = &outcome {
            metadata["error"] =
                crate::diagnostics::response::metadata(&json!(error), &[&request.input.text, &key]);
        }
        results::finish(
            &store.connection,
            id,
            &prepared.key,
            &metadata,
            outcome.as_ref().ok().map(Vec::as_slice),
            outcome.as_ref().err(),
        )
        .map_err(|error| execution_error(error, id, &metadata))?;
        let payload = outcome.map_err(|mut error| {
            error.diagnostics = Some(json!({"sourceExecutionId":id,"response":metadata}));
            error
        })?;
        Ok(Retained {
            cached: false,
            execution: id.into(),
            payload,
            metadata,
        })
    }
}

fn execution_error(mut error: AppError, id: &str, metadata: &serde_json::Value) -> AppError {
    let mut metadata = metadata.clone();
    metadata["storageError"] = crate::diagnostics::response::metadata(&json!(error), &[]);
    error.diagnostics = Some(json!({"sourceExecutionId":id,"response":metadata}));
    error
}
