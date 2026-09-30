//! Composition of shared speech execution and workspace storage. No product ownership.
use super::*;
use crate::ai::results::{self, Retained};
use serde_json::json;

use crate::ai::results::speech::{lookup as retained_speech, request_key, scope};

impl Application {
    fn speech_authority(&self, target: &access::ResolvedTarget, install: &str) -> Result<()> {
        let store = self.lock()?;
        let current_install: String =
            store
                .connection
                .query_row("SELECT id FROM learner LIMIT 1", [], |r| r.get(0))?;
        if current_install != install {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Workspace changed during speech execution.",
            ));
        }
        crate::ai::connections::speech_routing::validate_access(
            &store.connection,
            access::Capability::Speech,
            target,
        )?;
        if crate::ai::connections::configuration::config(&store.connection)?.paused {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Speech access changed before execution.",
            ));
        }
        Ok(())
    }

    pub(super) async fn shared_speech(
        self: &Arc<Self>,
        target: access::ResolvedTarget,
        input: audio::SpeechInput,
        install: String,
        consumer: &str,
        validate_consumer: impl Fn() -> Result<()>,
    ) -> Result<Retained> {
        validate_consumer()?;
        audio::validate_speech(&target, &input)?;
        {
            let store = self.lock()?;
            if let Some(saved) = retained_speech(&store.connection, &target, &input, &install)? {
                results::associate(&store.connection, consumer, &saved.execution)?;
                return Ok(saved);
            }
        }
        let service_scope = scope(&target, &install)?;
        // Pending work shares the same local identity as retained results.
        let pending_key = request_key(&service_scope, &input)?;
        let (subscription, producer) = self.speech_pending.subscribe(pending_key)?;
        results::associate(&self.lock()?.connection, consumer, subscription.id())?;
        if let Some(producer) = producer {
            let state = self.clone();
            tauri::async_runtime::spawn(async move {
                let result = state
                    .produce_speech(&target, &input, &install, &service_scope, &producer)
                    .await;
                producer.finish(result);
            });
        }
        let result = subscription.wait();
        tokio::pin!(result);
        loop {
            tokio::select! {
                result = &mut result => {
                    validate_consumer()?;
                    if let Ok(saved) = &result { results::associate(&self.lock()?.connection,consumer,&saved.execution)?; }
                    return result;
                },
                _ = tokio::time::sleep(Duration::from_millis(50)) => validate_consumer()?,
            }
        }
    }

    async fn produce_speech(
        &self,
        target: &access::ResolvedTarget,
        input: &audio::SpeechInput,
        install: &str,
        service_scope: &str,
        producer: &results::pending::Producer<Retained>,
    ) -> Result<Retained> {
        let id = producer.id();
        {
            let store = self.lock()?;
            if store.snapshot()?.learner.id != install {
                return Err(AppError::new(
                    ErrorCode::SessionExpired,
                    "Workspace changed before speech execution.",
                ));
            }
            if let Some(saved) = retained_speech(&store.connection, target, input, install)? {
                return Ok(saved);
            }
            results::begin(&store.connection, id, "speech")?;
        }
        let result = self
            .execute_speech(target, input, install, service_scope, producer)
            .await;
        if let Err(mut error) = result {
            let store = self.lock()?;
            if store.snapshot()?.learner.id == install {
                let pending: bool = store.connection.query_row(
                    "SELECT state='pending' FROM inference_executions WHERE id=?1",
                    [id],
                    |r| r.get(0),
                )?;
                if pending {
                    let metadata = error.diagnostics.as_ref().and_then(|d| d.get("response")).cloned().unwrap_or_else(|| json!({
                        "requestedModel":target.model,"route":target.route.label(),
                        "error":crate::diagnostics::response::error_metadata(&error, &[&input.text])
                    }));
                    if let Err(receipt_error) =
                        results::finish(&store.connection, id, "", &metadata, None, Some(&error))
                    {
                        error.diagnostics = Some(
                            json!({"sourceExecutionId":id,"response":metadata,
                            "receiptStorageError":crate::diagnostics::response::error_metadata(&receipt_error, &[])}),
                        );
                    } else {
                        error.diagnostics =
                            Some(json!({"sourceExecutionId":id,"response":metadata}));
                    }
                }
            }
            return Err(error);
        }
        result
    }

    async fn execute_speech(
        &self,
        target: &access::ResolvedTarget,
        input: &audio::SpeechInput,
        install: &str,
        service_scope: &str,
        producer: &results::pending::Producer<Retained>,
    ) -> Result<Retained> {
        self.speech_authority(target, install)?;
        let client = provider::client()?;
        let key = match &target.credential {
            Some(id) => read_secret(id.clone()).await?,
            None => Zeroizing::new(String::new()),
        };
        self.speech_authority(target, install)?;
        if !producer.has_subscribers() {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Speech request closed before dispatch.",
            ));
        }
        let cache_key = request_key(service_scope, input)?;
        let _permit = self.admission.try_chat().ok_or_else(|| {
            AppError::new(
                ErrorCode::AdmissionHeld,
                "AI work is at capacity. Try speech again when pending work finishes.",
            )
        })?;
        if !producer.has_subscribers() {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Speech request closed before dispatch.",
            ));
        }
        let id = producer.id();
        {
            let store = self.lock()?;
            results::dispatched(&store.connection, id)?;
        }
        // Once submitted, settlement is independent of consumer cancellation.
        self.speech_streams
            .lock()
            .map_err(|_| crate::diagnostics::failures::poisoned(internal()))?
            .begin(id);
        let progress = Mutex::new(None);
        let emit = |pcm: &[u8],
                    alignment: Option<&crate::speech::alignment::SpeechAlignment>,
                    outcome: &audio::SpeechOutcome| {
            *progress
                .lock()
                .map_err(|_| crate::diagnostics::failures::poisoned(internal()))? = Some((
                outcome
                    .provider_id
                    .as_ref()
                    .map(|id| crate::diagnostics::response::scrub(id, &[&key, &input.text])),
                outcome.diagnostics.as_ref().map(|details| {
                    crate::diagnostics::response::metadata(details, &[&key, &input.text])
                }),
            ));
            self.speech_streams
                .lock()
                .map_err(|_| crate::diagnostics::failures::poisoned(internal()))?
                .append(id, pcm, alignment)
        };
        let mut completed = retry::run(
            || audio::synthesize_stream(&client, target, &key, input, install, &emit),
            || self.speech_authority(target, install),
            |error| results::record_retry(&self.lock()?.connection, id, error),
        )
        .await;
        // Authority revocation can drop the transport future. Keep the validated
        // receipt already observed with audio even when that future cannot return.
        if completed.audio.is_err()
            && let Some((provider_id, diagnostics)) = progress
                .into_inner()
                .map_err(|_| crate::diagnostics::failures::poisoned(internal()))?
        {
            if completed.provider_id.is_none() {
                completed.provider_id = provider_id;
            }
            if let Some(diagnostics) = diagnostics {
                completed.diagnostics.get_or_insert_with(|| json!({}))["streamProgress"] =
                    diagnostics;
            }
        }
        let mut metadata = json!({"requestedModel":target.model,"route":target.route.label(),"actualModel":completed.actual_model,"providerId":completed.provider_id,
            "inputTokens":completed.input_tokens,"outputTokens":completed.output_tokens,"costMicros":completed.cost_micros,
            "finishReason":completed.finish_reason,
            "diagnostics":completed.diagnostics,"error":completed.audio.as_ref().err()});
        let payload = completed
            .audio
            .as_ref()
            .ok()
            .map(|wav| {
                serde_json::to_vec(&crate::speech::alignment::SpeechAudio::new(
                    wav,
                    completed.alignment.clone(),
                ))
            })
            .transpose()?;
        {
            let store = self.lock()?;
            let current_install: String =
                store
                    .connection
                    .query_row("SELECT id FROM learner LIMIT 1", [], |r| r.get(0))?;
            if current_install != install {
                return Err(AppError::new(
                    ErrorCode::SessionExpired,
                    "Workspace changed during speech execution.",
                ));
            }
            let retained = results::finish(
                &store.connection,
                id,
                &cache_key,
                &metadata,
                payload.as_deref(),
                completed.audio.as_ref().err(),
            );
            if let Err(mut error) = retained {
                metadata["storageError"] =
                    crate::diagnostics::response::error_metadata(&error, &[]);
                let receipt = results::finish(
                    &store.connection,
                    id,
                    &cache_key,
                    &metadata,
                    None,
                    Some(&error),
                );
                if let Err(receipt_error) = receipt {
                    metadata["receiptStorageError"] =
                        crate::diagnostics::response::error_metadata(&receipt_error, &[]);
                }
                error.diagnostics = Some(json!({"sourceExecutionId":id,"response":metadata}));
                return Err(error);
            }
        }
        completed.audio.map_err(|mut error| {
            error.diagnostics = Some(json!({"sourceExecutionId":id,"response":metadata}));
            error
        })?;
        Ok(Retained {
            cached: false,
            execution: id.into(),
            payload: payload.ok_or_else(|| {
                AppError::new(ErrorCode::Internal, "Speech result has no payload.")
            })?,
            metadata,
        })
    }
}

pub(super) fn reused_outcome(saved: Retained) -> audio::SpeechOutcome {
    // Provider billing stays on the shared execution, never copied into a consumer attempt.
    let mut outcome = audio::SpeechOutcome::empty();
    outcome.diagnostics = Some(
        json!({"sourceExecutionId":saved.execution,"cacheHit":saved.cached,"sourceReceipt":saved.metadata}),
    );
    outcome.finish_reason = Some("stop".into());
    match crate::speech::alignment::SpeechAudio::decode(&saved.payload) {
        Ok(result) => {
            outcome.audio = result.wav();
            outcome.alignment = result.alignment;
        }
        Err(error) => outcome.audio = Err(error),
    }
    outcome
}

#[cfg(test)]
#[path = "tests/shared_speech.rs"]
mod tests;
