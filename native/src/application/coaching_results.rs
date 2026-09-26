//! Shared coaching inference. Each consumer still publishes through its own turn transaction.
use super::*;
use crate::ai::{
    results::{self, Retained},
    transport::text_request::TextRequest,
};
use crate::learning::coaching::coach_observation;
use serde_json::{Value, json};

pub(super) struct Request {
    dispatch: TextRequest,
    schema: Value,
    output_tokens: i32,
    kind: String,
    captured: Value,
    source: String,
    key: String,
}

impl Request {
    pub(super) fn capture(store: &Store, dispatch: &execution::Dispatch) -> Result<Option<Self>> {
        let (_, turn, _, kind) = store
            .attempt_scope(&dispatch.attempt)?
            .ok_or_else(internal)?;
        if !matches!(kind.as_str(), "coach_feedback" | "coach_retry_check") {
            return Ok(None);
        }
        let raw: String =
            store
                .connection
                .query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
                    r.get(0)
                })?;
        let context: Value = serde_json::from_str(&raw)?;
        let mut captured = json!({});
        for field in [
            "candidateConstructs",
            "feedbackPolicy",
            "practiceSettings",
            "practiceFocus",
            "coachRetry",
        ] {
            captured[field] = context[field].clone();
        }
        // Retry ownership is checked at publication, not part of shared inference identity.
        if let Some(retry) = captured["coachRetry"].as_object_mut() {
            retry.remove("previousTurnId");
        }
        let source = store.connection.query_row(
            "SELECT text FROM messages WHERE turn_id=?1 AND role='user'",
            [&turn],
            |r| r.get(0),
        )?;
        let mut request = Self {
            dispatch: dispatch.text_request(),
            schema: dispatch.coaching_schema.clone().ok_or_else(internal)?,
            output_tokens: dispatch.structured_output_tokens,
            kind,
            captured,
            source,
            key: String::new(),
        };
        request.key = results::text::request_key(
            &request.dispatch,
            request.output(),
            "coaching-result-v1",
            &json!([request.kind, request.captured, request.source]),
        )?;
        Ok(Some(request))
    }

    fn output(&self) -> provider::RequestOutput<'_> {
        provider::RequestOutput::JsonSchema {
            max_output_tokens: self.output_tokens,
            name: "coaching",
            schema: &self.schema,
        }
    }

    fn authority(&self, store: &Store) -> Result<()> {
        if store.snapshot()?.learner.id != self.dispatch.install_id {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Workspace changed during coaching execution.",
            ));
        }
        holds::check(&store.connection, &self.dispatch.target)?;
        let current = access::resolve(&store.connection, access::Capability::Chat)?;
        if current.route != self.dispatch.target.route
            || current.url != self.dispatch.target.url
            || current.credential != self.dispatch.target.credential
        {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "AI destination or credentials changed during coaching execution.",
            ));
        }
        Ok(())
    }
}

impl Application {
    pub(super) async fn shared_coaching(
        self: &Arc<Self>,
        request: Request,
        consumer: &execution::Dispatch,
        permit: tokio::sync::OwnedSemaphorePermit,
    ) -> Result<provider::Completion> {
        self.check_dispatches(std::slice::from_ref(consumer))?;
        request.authority(&*self.lock()?)?;
        let (subscription, producer) = {
            let store = self.lock()?;
            if let Some(saved) = results::lookup(&store.connection, &request.key)? {
                results::associate(&store.connection, &consumer.attempt, &saved.execution)?;
                return completion(saved);
            }
            let (subscription, producer) = self.coaching_pending.subscribe(request.key.clone())?;
            if let Some(producer) = &producer {
                results::begin(&store.connection, producer.id(), &request.kind)?;
            }
            results::associate(&store.connection, &consumer.attempt, subscription.id())?;
            (subscription, producer)
        };
        if let Some(producer) = producer {
            let state = self.clone();
            tauri::async_runtime::spawn(async move {
                let _permit = permit;
                let result = state.produce_coaching(request, &producer).await;
                producer.finish(result);
            });
        } else {
            drop(permit);
        }
        let result = subscription.wait();
        tokio::pin!(result);
        loop {
            tokio::select! {
                saved = &mut result => {
                    self.check_dispatches(std::slice::from_ref(consumer))?;
                    let saved = saved?;
                    results::associate(&self.lock()?.connection, &consumer.attempt, &saved.execution)?;
                    return completion(saved);
                },
                _ = tokio::time::sleep(Duration::from_millis(50)) => self.check_dispatches(std::slice::from_ref(consumer))?,
            }
        }
    }

    async fn produce_coaching(
        &self,
        mut request: Request,
        producer: &results::pending::Producer<Retained>,
    ) -> Result<Retained> {
        let id = producer.id();
        let mut metadata =
            json!({"requestedModel":request.dispatch.model,"route":request.dispatch.route});
        let completed: Result<provider::Completion> = async {
            request.authority(&*self.lock()?)?;
            let key = if request.dispatch.credential.is_empty() {
                Zeroizing::new(String::new())
            } else {
                read_secret(request.dispatch.credential.clone()).await?
            };
            request.authority(&*self.lock()?)?;
            if !producer.has_subscribers() {
                return Err(AppError::new(
                    ErrorCode::Conflict,
                    "Coaching consumers closed before dispatch.",
                ));
            }
            (request.dispatch.attempt, request.dispatch.operation) =
                crate::ai::identity::new_execution_ids();
            metadata["attemptId"] = json!(request.dispatch.attempt);
            metadata["operationId"] = json!(request.dispatch.operation);
            results::dispatched(&self.lock()?.connection, id)?;
            // One request only. A failed result can be retried explicitly by its consumer.
            provider::complete_with_output(
                &provider::client()?,
                &key,
                &request.dispatch,
                request.output(),
            )
            .await
        }
        .await;
        let store = self.lock()?;
        if store.snapshot()?.learner.id != request.dispatch.install_id {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Workspace changed during coaching execution.",
            ));
        }
        if let Ok(output) = &completed {
            metadata["actualModel"] = json!(output.actual_model);
            metadata["providerId"] = json!(output.provider_id);
            metadata["finishReason"] = json!(output.finish_reason);
            metadata["inputTokens"] = json!(output.input_tokens);
            metadata["outputTokens"] = json!(output.output_tokens);
            metadata["diagnostics"] = json!(output.diagnostics);
        }
        let valid = completed.as_ref().map_err(Clone::clone).and_then(|output| {
            request.authority(&store)?;
            coach_observation::validate_captured(
                &request.captured,
                &request.source,
                &request.kind,
                output,
            )
            .map(|_| ())
        });
        if let Err(error) = &valid {
            metadata["error"] =
                crate::diagnostics::response::metadata(&json!(error), &[&request.source]);
        }
        let payload = completed
            .as_ref()
            .ok()
            .map(serde_json::to_vec)
            .transpose()?;
        results::finish(
            &store.connection,
            id,
            &request.key,
            &metadata,
            if valid.is_ok() {
                payload.as_deref()
            } else {
                None
            },
            valid.as_ref().err(),
        )
        .map_err(|mut error| {
            let mut retained = metadata.clone();
            retained["storageError"] = crate::diagnostics::response::metadata(&json!(error), &[]);
            error.diagnostics = Some(json!({"sourceExecutionId":id,"response":retained}));
            error
        })?;
        // Invalid completions still reach ordinary publication so their original text and
        // validation details remain inspectable. They are never retained as cache hits.
        match payload {
            Some(payload) => Ok(Retained {
                cached: false,
                execution: id.into(),
                payload,
                metadata,
            }),
            None => Err(completed
                .err()
                .ok_or_else(internal)?
                .with_diagnostics(json!({"sourceExecutionId":id,"response":metadata}))),
        }
    }
}

fn completion(saved: Retained) -> Result<provider::Completion> {
    let mut output: provider::Completion = serde_json::from_slice(&saved.payload)?;
    let details = output.diagnostics.get_or_insert_with(|| json!({}));
    details["sourceExecutionId"] = json!(saved.execution);
    details["cacheHit"] = json!(saved.cached);
    details["sharedExecution"] = json!(true);
    Ok(output)
}

#[cfg(test)]
#[path = "tests/coaching_results.rs"]
mod tests;
