//! Shared recognizer execution. Recording inspection and product publication remain with owners.
use super::*;
use crate::ai::{
    audio::TranscriptionRequest,
    results::{self, Retained},
};
use serde_json::json;

impl Application {
    fn transcription_authority(
        &self,
        target: &access::ResolvedTarget,
        install: &str,
    ) -> Result<()> {
        let store = self.lock()?;
        if store.snapshot()?.learner.id != install {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Workspace changed during transcription.",
            ));
        }
        let current = access::resolve(&store.connection, access::Capability::Transcription)?;
        if current.route != target.route
            || current.url != target.url
            || current.model != target.model
            || current.credential != target.credential
        {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Transcription access changed before execution.",
            ));
        }
        if crate::ai::connections::configuration::config(&store.connection)?.paused {
            return Err(AppError::new(
                ErrorCode::AdmissionHeld,
                "Transcription stopped: AI execution is paused.",
            ));
        }
        holds::check(&store.connection, target)
    }

    pub(crate) async fn shared_transcription(
        self: &Arc<Self>,
        target: access::ResolvedTarget,
        input: TranscriptionRequest,
        install: String,
        consumer: &str,
        validate_consumer: impl Fn() -> Result<()>,
    ) -> Result<Retained> {
        validate_consumer()?;
        audio::validate_transcription_language(&target, &input.language)?;
        if input.wav.is_empty() || input.wav.len() > 25 * 1024 * 1024 {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Recording must contain audio and be at most 25 MB.",
            ));
        }
        let key = results::transcription::request_key(&target, &input, &install)?;
        let cached = results::lookup(&self.lock()?.connection, &key)?;
        if let Some(saved) = cached {
            results::associate(&self.lock()?.connection, consumer, &saved.execution)?;
            return Ok(saved);
        }
        let (subscription, producer) = self.transcription_pending.subscribe(key.clone())?;
        results::associate(&self.lock()?.connection, consumer, subscription.id())?;
        if let Some(producer) = producer {
            let state = self.clone();
            tauri::async_runtime::spawn(async move {
                let result = state
                    .produce_transcription(&target, &input, &install, &key, &producer)
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

    async fn produce_transcription(
        &self,
        target: &access::ResolvedTarget,
        input: &TranscriptionRequest,
        install: &str,
        key: &str,
        producer: &results::pending::Producer<Retained>,
    ) -> Result<Retained> {
        if let Some(saved) = results::lookup(&self.lock()?.connection, key)? {
            return Ok(saved);
        }
        let id = producer.id();
        {
            let store = self.lock()?;
            if store.snapshot()?.learner.id != install {
                return Err(AppError::new(
                    ErrorCode::SessionExpired,
                    "Workspace changed during transcription.",
                ));
            }
            results::begin(&store.connection, id, "transcription")?;
        }
        let completed = async {
            let validate = || {
                self.transcription_authority(target, install)?;
                if !producer.has_subscribers() {
                    return Err(AppError::new(
                        ErrorCode::Conflict,
                        "Recording consumers closed before dispatch.",
                    ));
                }
                Ok(())
            };
            let _permit = self.admission.audio(validate).await?;
            let token = match &target.credential {
                Some(id) => read_secret(id.clone()).await?,
                None => Zeroizing::new(String::new()),
            };
            validate()?;
            let client = provider::client()?;
            results::dispatched(&self.lock()?.connection, id)?;
            // Submitted work settles independently of recording/window lifetime.
            retry::run(
                || audio::transcribe(&client, target, &token, input.clone(), install),
                || self.transcription_authority(target, install),
                |error| results::record_retry(&self.lock()?.connection, id, error),
            )
            .await
        }
        .await;
        let diagnostics = match &completed {
            Ok(value) => value.diagnostics.as_ref(),
            Err(error) => error.diagnostics.as_ref(),
        };
        let mut metadata = json!({"requestedModel":target.model,"route":target.route.label(),"diagnostics":diagnostics});
        let payload = completed.and_then(|outcome| Ok(serde_json::to_vec(&outcome.result)?));
        if let Err(error) = &payload {
            metadata["error"] = crate::diagnostics::response::metadata(
                &json!(error),
                &[input.context.as_deref().unwrap_or("")],
            );
        }
        let store = self.lock()?;
        if store.snapshot()?.learner.id != install {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Workspace changed during transcription.",
            ));
        }
        let retained = results::finish(
            &store.connection,
            id,
            key,
            &metadata,
            payload.as_ref().ok().map(Vec::as_slice),
            payload.as_ref().err(),
        );
        if let Err(error) = retained {
            metadata["storageError"] = crate::diagnostics::response::metadata(&json!(error), &[]);
            results::finish(&store.connection, id, key, &metadata, None, Some(&error))
                .map_err(|error| transcription_error(error, id, &metadata))?;
            return Err(transcription_error(error, id, &metadata));
        }
        Ok(Retained {
            cached: false,
            execution: id.into(),
            payload: payload.map_err(|error| transcription_error(error, id, &metadata))?,
            metadata,
        })
    }
}

fn transcription_error(mut error: AppError, id: &str, metadata: &serde_json::Value) -> AppError {
    let diagnostics = error.diagnostics.get_or_insert_with(|| json!({}));
    diagnostics["sourceExecutionId"] = json!(id);
    diagnostics["sourceReceipt"] = metadata.clone();
    error
}
