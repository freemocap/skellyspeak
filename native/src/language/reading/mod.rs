//! Explicit, ephemeral reading requests. Source text stays in memory; only
//! redacted inference receipts are durable. Never grants learning credit.
mod receipts;
#[cfg(test)]
mod tests;
use crate::{
    ai::connections::access,
    conversations::{execution, gloss},
    learning::coaching::conversation_support as support,
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
pub struct ReadingScope {
    pub language: String,
    pub variety: Option<String>,
    pub explanation: String,
    pub explanation_variety: Option<String>,
}
/// The longest selection, in UTF-16 units, one reading request accepts.
const TEXT_LIMIT: usize = 2048;
/// Which reading aid an explicit request asks for. Each aid runs the same
/// capability contract that conversation turns use for it.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, TS, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReadingAid {
    WordGloss,
    Speech,
    Translation,
    Explanations,
}
impl ReadingAid {
    /// The receipt kind recorded for this aid.
    pub fn receipt_kind(self) -> &'static str {
        match self {
            ReadingAid::WordGloss => "reading_gloss",
            ReadingAid::Speech => "token_speech",
            ReadingAid::Translation => "reading_translation",
            ReadingAid::Explanations => "reading_explanations",
        }
    }
    /// The task role that selects this aid's model, shared with conversation turns.
    fn role(self) -> &'static str {
        match self {
            ReadingAid::WordGloss => gloss::ROLE,
            ReadingAid::Speech => execution::SPEECH_ROLE,
            ReadingAid::Translation => crate::conversations::translation::ROLE,
            ReadingAid::Explanations => support::ROLE,
        }
    }
    fn capability(self) -> access::Capability {
        match self {
            ReadingAid::Speech => access::Capability::Speech,
            ReadingAid::WordGloss | ReadingAid::Translation | ReadingAid::Explanations => {
                access::Capability::Chat
            }
        }
    }
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadingInput {
    // Optional durable reference owner; ordinary reading aids remain ephemeral.
    #[serde(default)]
    #[ts(optional)]
    pub reference_item: Option<String>,
    pub text: String,
    pub language: String,
    pub variety: Option<String>,
    pub explanation: String,
    pub explanation_variety: Option<String>,
    pub aid: ReadingAid,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReadingResult {
    pub gloss: Option<WordGlossView>,
    pub audio_base64: Option<String>,
    pub translation: Option<String>,
    pub explanations: Option<support::ReplyExplanations>,
    #[ts(type = "unknown")]
    pub receipt: serde_json::Value,
}

pub struct Request {
    pub id: String,
    pub input: ReadingInput,
    pub context: crate::configuration::LanguageContext,
    pub target: access::ResolvedTarget,
    /// The model this aid runs on, selected by its task role.
    pub model: String,
    pub install: String,
    pub attempt: String,
    pub operation: String,
    pub(crate) config_hash: String,
    created: Instant,
    claimed: AtomicBool,
    cancelled: AtomicBool,
    submitted: AtomicBool,
}
impl Request {
    pub fn capture(store: &Store, input: ReadingInput) -> Result<Self> {
        if input.text.trim().is_empty()
            || input.text.encode_utf16().count() > TEXT_LIMIT
            || input.text.contains('\0')
        {
            return Err(AppError::new(
                ErrorCode::Validation,
                format!("Select between 1 and {TEXT_LIMIT} characters for reading help."),
            ));
        }
        let context = store.config.resolve_pair(
            &input.language,
            input.variety.as_deref(),
            &input.explanation,
            input.explanation_variety.as_deref(),
        )?;
        let target = crate::ai::connections::speech_routing::resolve(
            &store.connection,
            input.aid.capability(),
            &context,
        )?;
        // The model a request runs on follows the same task roles as conversation
        // turns; access validation still compares against the resolved target.
        let model = crate::ai::connections::model_routing::target(
            &target,
            input.aid.role(),
            &execution::config(&store.connection)?.fast_model,
        )
        .model;
        let request = Self {
            id: uuid::Uuid::new_v4().to_string(),
            input,
            context,
            target,
            model,
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
        crate::drill::reference::validate(store, self)?;
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
        let current = crate::ai::connections::speech_routing::resolve(
            &store.connection,
            self.input.aid.capability(),
            &self.context,
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
    fn source(&self) -> gloss::Source {
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
    /// The provider request for this aid, on the aid's routed model at the
    /// task temperature conversation turns use.
    fn dispatch(
        &self,
        messages: Vec<crate::ai::transport::provider::PromptMessage>,
        gloss_schema: Option<serde_json::Value>,
        coaching_schema: Option<serde_json::Value>,
        gloss_source: Option<gloss::Source>,
    ) -> execution::Dispatch {
        let mut target = self.target.clone();
        target.model = self.model.clone();
        execution::Dispatch {
            decisions: None,
            temperature: execution::TASK_TEMPERATURE,
            credential: self.target.credential.clone().unwrap_or_default(),
            model: self.model.clone(),
            route: self.target.route,
            target,
            attempt: self.attempt.clone(),
            operation: self.operation.clone(),
            install_id: self.install.clone(),
            messages,
            gloss_schema,
            coaching_schema,
            gloss_source,
            speech_source: None,
        }
    }
    /// The captured language scope the conversation task contracts read.
    fn captured(&self) -> serde_json::Value {
        serde_json::json!({
            "targetLanguage": self.input.language,
            "translationLanguage": self.input.explanation,
            "languageContext": self.context,
        })
    }
    /// A grammar explanation request through the conversation support
    /// contract: the same instruction, output schema, validation, task
    /// temperature and model role that explanation turns send. The source text
    /// is the explained message; it has no surrounding exchange or learner input.
    pub(crate) fn explanations_dispatch(&self) -> Result<execution::Dispatch> {
        let mut captured = self.captured();
        captured["messages"] = serde_json::json!([]);
        let schema = support::schema_for_context(support::EXPLANATIONS, &captured);
        let messages = support::prompt_for_exchange(
            self.input.text.clone(),
            None,
            support::EXPLANATIONS,
            &captured,
        )?;
        Ok(self.dispatch(messages, None, Some(schema), None))
    }
    /// A translation request through the conversation translation contract:
    /// the same prompt, output schema, task temperature and model role that
    /// translation turns send. Returns the dispatch and its output schema.
    pub(crate) fn translation_dispatch(&self) -> Result<(execution::Dispatch, serde_json::Value)> {
        let captured = self.captured();
        let schema = crate::conversations::translation::schema();
        let messages =
            crate::conversations::translation::prompt(self.input.text.clone(), &captured)?;
        Ok((
            self.dispatch(messages, None, Some(schema.clone()), None),
            schema,
        ))
    }
    /// A word-meaning request through the conversation word-gloss contract:
    /// the same source-bound prompt, output schema, task temperature and model
    /// role that word-gloss turns send.
    pub(crate) fn word_gloss_dispatch(&self) -> Result<execution::Dispatch> {
        let source = self.source();
        let prompt = crate::language::linguistics::adapter::build_word_gloss_prompt_with_context(
            &source.identity,
            &source.text,
            &self.context,
        )
        .map_err(|_| {
            AppError::new(
                ErrorCode::Validation,
                "This selection cannot be analyzed. Select a shorter passage.",
            )
        })?;
        Ok(self.dispatch(
            prompt.messages,
            Some(prompt.output_schema),
            None,
            Some(source),
        ))
    }
    /// A speech request through the persona speech contract: the same source
    /// limits, voice, language label and route validation.
    pub(crate) fn speech_input(&self) -> Result<crate::ai::audio::SpeechInput> {
        execution::speech_input(
            &self.target,
            self.input.text.clone(),
            crate::configuration::SPEECH_VOICE.into(),
            &self.context,
        )
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
        let mut entries = self
            .0
            .lock()
            .map_err(|_| crate::diagnostics::failures::poisoned(crate::application::internal()))?;
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
        if request.input.reference_item.is_some()
            && entries.values().any(|other| {
                other.input.reference_item == request.input.reference_item
                    && !other.cancelled.load(Ordering::SeqCst)
            })
        {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "This phrase already has a reference request in progress.",
            ));
        }
        receipts::begin(store, &request)?;
        let id = request.id.clone();
        entries.insert(id.clone(), request);
        Ok(id)
    }
    pub fn claim(&self, id: &str) -> Result<Arc<Request>> {
        let entries = self
            .0
            .lock()
            .map_err(|_| crate::diagnostics::failures::poisoned(crate::application::internal()))?;
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
        let mut entries = self
            .0
            .lock()
            .map_err(|_| crate::diagnostics::failures::poisoned(crate::application::internal()))?;
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
            .map_err(|_| crate::diagnostics::failures::poisoned(crate::application::internal()))?
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
pub use receipts::{activity, finish, record_retry, recover};
