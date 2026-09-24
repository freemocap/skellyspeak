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
        let current = access::resolve(&store.connection, access::Capability::Speech)?;
        if scope(&current, install)? != scope(target, install)?
            || crate::ai::connections::configuration::config(&store.connection)?.paused
        {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Speech access changed before execution.",
            ));
        }
        holds::check(&store.connection, target)
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
        // Profile discovery is shared too; no product identifiers participate.
        let pending_key = request_key(&service_scope, &input, "")?;
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
        if let Some(saved) = retained_speech(&self.lock()?.connection, target, input, install)? {
            return Ok(saved);
        }
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
        let profile = audio::synthesis_profile(&client, target, &key, install).await?;
        self.speech_authority(target, install)?;
        let cache_key = request_key(service_scope, input, &profile)?;
        {
            let store = self.lock()?;
            results::remember_profile(&store.connection, service_scope, &profile)?;
            if let Some(saved) = results::lookup(&store.connection, &cache_key)? {
                return Ok(saved);
            }
        }
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
            results::begin(&store.connection, id, "speech")?;
            results::dispatched(&store.connection, id)?;
        }
        // Once submitted, settlement is independent of consumer cancellation.
        let completed = retry::run(
            || audio::synthesize_profiled(&client, target, &key, input, install, &profile),
            || self.speech_authority(target, install),
            |error| results::record_retry(&self.lock()?.connection, id, error),
        )
        .await;
        let metadata = json!({"requestedModel":target.model,"route":target.route.label(),"actualModel":completed.actual_model,"providerId":completed.provider_id,
            "inputTokens":completed.input_tokens,"outputTokens":completed.output_tokens,"costMicros":completed.cost_micros,
            "synthesisProfile":completed.synthesis_profile,"finishReason":completed.finish_reason,
            "diagnostics":completed.diagnostics,"error":completed.audio.as_ref().err()});
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
            results::finish(
                &store.connection,
                id,
                &cache_key,
                &metadata,
                completed.audio.as_ref().ok().map(Vec::as_slice),
                completed.audio.as_ref().err(),
            )?;
        }
        let payload = completed.audio.map_err(|mut error| {
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

pub(super) fn reused_outcome(saved: Retained) -> audio::SpeechOutcome {
    // Provider billing stays on the shared execution, never copied into a consumer attempt.
    let mut outcome = audio::SpeechOutcome::empty();
    outcome.synthesis_profile = saved.metadata["synthesisProfile"]
        .as_str()
        .map(str::to_owned);
    outcome.diagnostics = Some(
        json!({"sourceExecutionId":saved.execution,"cacheHit":saved.cached,"sourceReceipt":saved.metadata}),
    );
    outcome.finish_reason = Some("stop".into());
    outcome.audio = Ok(saved.payload);
    outcome
}

#[cfg(test)]
#[path = "tests/shared_speech.rs"]
mod tests;
