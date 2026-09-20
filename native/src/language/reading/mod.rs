//! Explicit, ephemeral reading requests. Source text stays in memory; only
//! redacted inference receipts are durable. Never grants learning credit.
mod receipts;
#[cfg(test)]
mod tests;
use crate::{
    ai::connections::access,
    conversations::{execution, gloss},
    model::*,
    storage::store::Store,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::Instant,
};
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadingInput {
    pub text: String,
    pub language: String,
    pub variety: Option<String>,
    pub explanation: String,
    pub explanation_variety: Option<String>,
    pub speech: bool,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReadingResult {
    pub gloss: Option<WordGlossView>,
    pub audio_base64: Option<String>,
    #[ts(type = "unknown")]
    pub receipt: serde_json::Value,
}

pub struct Request {
    pub id: String,
    pub input: ReadingInput,
    pub context: crate::configuration::LanguageContext,
    pub target: access::ResolvedTarget,
    pub install: String,
    pub attempt: String,
    pub operation: String,
    config_hash: String,
    created: Instant,
    claimed: AtomicBool,
    cancelled: AtomicBool,
    submitted: AtomicBool,
}
impl Request {
    pub fn capture(store: &Store, input: ReadingInput) -> Result<Self> {
        let limit = if input.speech { 256 } else { 2048 };
        if input.text.trim().is_empty()
            || input.text.encode_utf16().count() > limit
            || input.text.contains('\0')
        {
            return Err(AppError::new(
                ErrorCode::Validation,
                format!("Select between 1 and {limit} characters for reading help."),
            ));
        }
        let context = store.config.resolve_pair(
            &input.language,
            input.variety.as_deref(),
            &input.explanation,
            input.explanation_variety.as_deref(),
        )?;
        let target = access::resolve(
            &store.connection,
            if input.speech {
                access::Capability::Speech
            } else {
                access::Capability::Chat
            },
        )?;
        if input.speech && target.route == ConnectionRoute::Openrouter {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Token read-aloud requires the ElevenLabs speech route through hosted or custom AI access.",
            ));
        }
        let request = Self {
            id: uuid::Uuid::new_v4().to_string(),
            input,
            context,
            target,
            install: store.snapshot()?.learner.id,
            attempt: execution::new_attempt_id(),
            operation: uuid::Uuid::new_v4().simple().to_string(),
            config_hash: store.config.hash().into(),
            created: Instant::now(),
            claimed: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
            submitted: AtomicBool::new(false),
        };
        request.validate(store)?;
        Ok(request)
    }
    pub fn validate(&self, store: &Store) -> Result<()> {
        if self.cancelled.load(Ordering::SeqCst) {
            return Err(self.stopped());
        }
        let config = execution::config(&store.connection)?;
        if config.paused
            || self.config_hash != store.config.hash()
            || self.install != store.snapshot()?.learner.id
        {
            return Err(self.stopped());
        }
        let current = access::resolve(
            &store.connection,
            if self.input.speech {
                access::Capability::Speech
            } else {
                access::Capability::Chat
            },
        )
        .map_err(|error| {
            if self.submitted.load(Ordering::SeqCst) {
                self.stopped()
            } else {
                error
            }
        })?;
        if self.cancelled.load(Ordering::SeqCst)
            || config.paused
            || self.config_hash != store.config.hash()
            || self.install != store.snapshot()?.learner.id
            || current.revision != self.target.revision
            || current.route != self.target.route
            || current.url != self.target.url
            || current.model != self.target.model
            || current.credential != self.target.credential
        {
            return Err(self.stopped());
        }
        crate::ai::policy::holds::check(&store.connection, &self.target).map_err(|error| {
            if self.submitted.load(Ordering::SeqCst) {
                self.stopped()
            } else {
                error
            }
        })?;
        Ok(())
    }
    fn stopped(&self) -> AppError {
        AppError::new(
            if self.submitted.load(Ordering::SeqCst) {
                ErrorCode::UnknownOutcome
            } else {
                ErrorCode::Conflict
            },
            "Reading request stopped or its source/access changed. A submitted request may have incurred usage; no automatic retry was made.",
        )
    }
    pub fn source(&self) -> gloss::Source {
        gloss::Source {
            identity: crate::language::linguistics::SourceIdentity {
                message_id: self.id.clone(),
                target_language_id: self.input.language.clone(),
                explanation_language_id: self.input.explanation.clone(),
                analysis_version: crate::language::linguistics::ANALYSIS_VERSION.into(),
            },
            text: self.input.text.clone(),
        }
    }
    pub fn submitted(&self, store: &Store) -> Result<()> {
        self.validate(store)?;
        receipts::dispatch(store, &self.id)?;
        self.submitted.store(true, Ordering::SeqCst);
        Ok(())
    }
}
#[derive(Default)]
pub struct Registry(Mutex<HashMap<String, Arc<Request>>>);
impl Registry {
    pub fn begin(&self, store: &Store, input: ReadingInput) -> Result<String> {
        let mut entries = self.0.lock().map_err(|_| crate::application::internal())?;
        let expired: Vec<_> = entries
            .values()
            .filter(|r| !r.claimed.load(Ordering::SeqCst) && r.created.elapsed().as_secs() >= 30)
            .map(|r| r.id.clone())
            .collect();
        for id in expired {
            receipts::cancel(store, &id)?;
            entries.remove(&id);
        }
        if entries.len() >= 8 {
            return Err(AppError::new(
                ErrorCode::AdmissionHeld,
                "Finish or close pending reading requests first.",
            ));
        }
        let request = Arc::new(Request::capture(store, input)?);
        receipts::begin(store, &request)?;
        let id = request.id.clone();
        entries.insert(id.clone(), request);
        Ok(id)
    }
    pub fn claim(&self, id: &str) -> Result<Arc<Request>> {
        let entries = self.0.lock().map_err(|_| crate::application::internal())?;
        let request = entries.get(id).ok_or_else(|| {
            AppError::new(
                ErrorCode::Conflict,
                "Reading request expired or was closed.",
            )
        })?;
        if request.created.elapsed().as_secs() >= 30
            || request.cancelled.load(Ordering::SeqCst)
            || request.claimed.swap(true, Ordering::SeqCst)
        {
            return Err(request.stopped());
        }
        Ok(request.clone())
    }
    pub fn cancel(&self, store: &Store, id: &str) -> Result<()> {
        let mut entries = self.0.lock().map_err(|_| crate::application::internal())?;
        if let Some(request) = entries.get(id) {
            request.cancelled.store(true, Ordering::SeqCst);
            receipts::cancel(store, id)?;
            if !request.claimed.load(Ordering::SeqCst) {
                entries.remove(id);
            }
        }
        Ok(())
    }
    pub fn remove(&self, id: &str) -> Result<()> {
        self.0
            .lock()
            .map_err(|_| crate::application::internal())?
            .remove(id);
        Ok(())
    }
}
pub async fn checked<T>(
    _request: &Request,
    future: impl std::future::Future<Output = T>,
    validate: impl Fn() -> Result<()>,
) -> Result<T> {
    validate()?;
    tokio::pin!(future);
    loop {
        tokio::select! {
            biased;
            _ = tokio::time::sleep(std::time::Duration::from_millis(100)) => { validate()?; },
            result = &mut future => return Ok(result)
        }
    }
}
pub use receipts::{activity, finish, recover};
