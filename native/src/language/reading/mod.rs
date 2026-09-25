//! Explicit reading consumers. Generated payloads are evictable local results;
//! redacted execution receipts are durable. Never grants learning credit.
mod receipts;
pub(crate) mod saved;
#[cfg(test)]
mod tests;
pub(crate) mod text;
pub(crate) mod text_sources;
use crate::{
    ai::connections::access, ai::transport::text_request::TextRequest, language::gloss,
    learning::coaching::conversation_support as support, model::*, storage::store::Store,
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
            ReadingAid::Speech => crate::ai::connections::model_routing::SPEECH_ROLE,
            ReadingAid::Translation => crate::language::translation::ROLE,
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
    pub audio_alignment: Option<crate::speech::alignment::SpeechAlignment>,
    pub translation: Option<String>,
    pub explanations: Option<support::ReplyExplanations>,
    #[ts(type = "unknown")]
    pub receipt: serde_json::Value,
}

pub struct Request {
    pub id: String,
    pub fresh: bool,
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
        let target = access::resolve(&store.connection, input.aid.capability())?;
        // The model a request runs on follows the same task roles as conversation
        // turns; access validation still compares against the resolved target.
        let model = crate::ai::connections::model_routing::target(
            &target,
            input.aid.role(),
            &crate::ai::connections::configuration::config(&store.connection)?.fast_model,
        )
        .model;
        let (attempt, operation) = crate::ai::identity::new_execution_ids();
        let request = Self {
            id: uuid::Uuid::new_v4().to_string(),
            fresh: false,
            input,
            context,
            target,
            model,
            install: store.snapshot()?.learner.id,
            attempt,
            operation,
            config_hash: store.config.hash().into(),
            created: Instant::now(),
            claimed: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
        };
        request.validate_source(store)?;
        Ok(request)
    }
    pub fn validate_source(&self, store: &Store) -> Result<()> {
        crate::drill::reference::validate(store, self)?;
        if self.cancelled.load(Ordering::SeqCst) {
            return Err(self.stopped("cancelled"));
        }
        if self.install != store.snapshot()?.learner.id {
            return Err(self.stopped("workspace_changed"));
        }
        if self.input.aid != ReadingAid::Speech {
            self.validate_access(store)?;
        }
        Ok(())
    }
    pub(crate) fn validate_execution(&self, store: &Store) -> Result<()> {
        self.validate_access(store)?;
        if crate::ai::connections::configuration::config(&store.connection)?.paused {
            return Err(self.stopped("paused"));
        }
        crate::ai::policy::holds::check(&store.connection, &self.target)
    }
    fn validate_access(&self, store: &Store) -> Result<()> {
        if self.install != store.snapshot()?.learner.id {
            return Err(self.stopped("workspace_changed"));
        }
        if self.config_hash != store.config.hash() {
            return Err(self.stopped("configuration_changed"));
        }
        let current = access::resolve(&store.connection, self.input.aid.capability())?;
        let config = crate::ai::connections::configuration::config(&store.connection)?;
        let model = crate::ai::connections::model_routing::target(
            &current,
            self.input.aid.role(),
            &config.fast_model,
        )
        .model;
        if current.revision != self.target.revision
            || current.route != self.target.route
            || current.url != self.target.url
            || current.model != self.target.model
            || current.credential != self.target.credential
            || model != self.model
        {
            return Err(self.stopped("access_changed"));
        }
        Ok(())
    }
    fn stopped(&self, reason: &str) -> AppError {
        AppError::new(ErrorCode::Conflict, "Reading request stopped or its source/access changed. See the shared execution receipt for any submitted work.")
            .with_diagnostics(serde_json::json!({"stage":"reading_authority", "reason":reason, "dispatched":null}))
    }
    fn source(&self) -> gloss::Source {
        gloss::Source {
            identity: crate::language::linguistics::SourceIdentity {
                message_id: crate::ai::results::digest(
                    &serde_json::to_vec(&serde_json::json!([self.input.text, self.context]))
                        .expect("serializable reading source"),
                ),
                target_language_id: self.input.language.clone(),
                explanation_language_id: self.input.explanation.clone(),
                analysis_version: crate::language::linguistics::ANALYSIS_VERSION.into(),
            },
            text: self.input.text.clone(),
        }
    }
    /// The provider request for this aid, on the aid's routed model at the
    /// task temperature conversation turns use.
    fn text_request(
        &self,
        messages: Vec<crate::ai::transport::provider::PromptMessage>,
    ) -> TextRequest {
        let mut target = self.target.clone();
        target.model = self.model.clone();
        TextRequest {
            decisions: None,
            temperature: crate::ai::connections::model_routing::TASK_TEMPERATURE,
            credential: self.target.credential.clone().unwrap_or_default(),
            model: self.model.clone(),
            route: self.target.route,
            target,
            attempt: self.attempt.clone(),
            operation: self.operation.clone(),
            install_id: self.install.clone(),
            messages,
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
    pub(crate) fn explanations_dispatch(&self) -> Result<(TextRequest, serde_json::Value)> {
        let mut captured = self.captured();
        captured["messages"] = serde_json::json!([]);
        let schema = support::schema_for_context(support::EXPLANATIONS, &captured);
        let messages = support::prompt_for_exchange(
            self.input.text.clone(),
            None,
            support::EXPLANATIONS,
            &captured,
        )?;
        Ok((self.text_request(messages), schema))
    }
    /// A translation request through the conversation translation contract:
    /// the same prompt, output schema, task temperature and model role that
    /// translation turns send. Returns the dispatch and its output schema.
    pub(crate) fn translation_dispatch(&self) -> Result<(TextRequest, serde_json::Value)> {
        let captured = self.captured();
        let schema = crate::language::translation::schema();
        let messages = crate::language::translation::prompt(self.input.text.clone(), &captured)?;
        Ok((self.text_request(messages), schema))
    }
    /// A word-meaning request through the conversation word-gloss contract:
    /// the same source-bound prompt, output schema, task temperature and model
    /// role that word-gloss turns send.
    pub(crate) fn word_gloss_dispatch(
        &self,
    ) -> Result<(TextRequest, gloss::Source, serde_json::Value)> {
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
        Ok((
            self.text_request(prompt.messages),
            source,
            prompt.output_schema,
        ))
    }
    /// A speech request through the persona speech contract: the same source
    /// limits, voice, language label and route validation.
    pub(crate) fn speech_input(&self) -> Result<crate::ai::audio::SpeechInput> {
        crate::ai::audio::speech_input(
            &self.target,
            self.input.text.clone(),
            crate::configuration::SPEECH_VOICE.into(),
            &self.context,
        )
    }
}
#[derive(Default)]
pub struct Registry(Mutex<HashMap<String, Arc<Request>>>);
impl Registry {
    #[cfg(test)]
    pub fn begin(&self, store: &Store, input: ReadingInput) -> Result<String> {
        self.begin_fresh(store, input, false)
    }
    pub fn begin_fresh(&self, store: &Store, input: ReadingInput, fresh: bool) -> Result<String> {
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
        let mut request = Request::capture(store, input)?;
        request.fresh = fresh;
        let request = Arc::new(request);
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
        if request.created.elapsed().as_secs() >= 30 {
            return Err(request.stopped("expired"));
        }
        if request.cancelled.load(Ordering::SeqCst) {
            return Err(request.stopped("cancelled"));
        }
        if request.claimed.swap(true, Ordering::SeqCst) {
            return Err(request.stopped("already_claimed"));
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
pub use receipts::{activity, finish, recover};
