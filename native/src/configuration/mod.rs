//! App-owned teaching content, parsed and validated into one resolved registry.
//! Invalid bundled content blocks startup with ConfigLoadError.
pub mod appearance;
mod citations;
mod documents;
pub(crate) use documents::ConversationPromptContent;
mod identity;
mod inspection;
mod linking;
mod loading;
mod resolution;
mod types;
pub use inspection::{
    ContentRule, ContentSource, ContentValue, LanguageInspection, SchemeInspection,
};
mod lexical_hints;
mod schemas;
use crate::model;
pub use schemas::schemas;
use serde::{Serialize, de::DeserializeOwned};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
};
pub use types::*;

impl From<ConfigLoadError> for model::AppError {
    fn from(e: ConfigLoadError) -> Self {
        Self::new(
            model::ErrorCode::Validation,
            format!("Configuration {}: {} [{}]", e.path, e.message, e.code),
        )
    }
}
fn error(path: impl ToString, code: &str, message: impl ToString) -> ConfigLoadError {
    ConfigLoadError {
        path: path.to_string(),
        code: code.into(),
        message: message.to_string(),
    }
}
fn fingerprint<T: Serialize>(value: &T) -> String {
    let bytes = serde_json::to_vec(value).expect("serializable validated configuration");
    format!("{:x}", Sha256::digest(bytes))
}
#[derive(Debug, Clone, Serialize)]
pub struct Registry {
    pub languages: Vec<Language>,
    pub scripts: Vec<Script>,
    pub orthographies: Vec<Orthography>,
    pub romanizations: Vec<Romanization>,
    pub traits: Vec<Trait>,
    pub families: Vec<Family>,
    pub universal: Vec<Guidance>,
    constructs: Vec<Construct>,
    navigation: Vec<NavigationNode>,
    feedback: FeedbackPolicy,
    estimator: EstimatorPolicy,
    game: GamePolicy,
    topics: Vec<documents::ConversationTopic>,
    conversation_prompt: documents::ConversationPromptContent,
    hash: String,
    #[serde(skip)]
    documents: BTreeMap<String, documents::LanguageDocument>,
    #[serde(skip)]
    source_files: BTreeMap<String, String>,
    goal_material: BTreeMap<String, BTreeMap<String, documents::GoalMaterial>>,
}
include!(concat!(env!("OUT_DIR"), "/config_seeds.rs"));

impl Registry {
    pub fn hash(&self) -> &str {
        &self.hash
    }
    pub fn learning_content_hash(&self) -> String {
        fingerprint(&(&self.constructs, &self.goal_material))
    }
    pub fn constructs(&self) -> &[Construct] {
        &self.constructs
    }
    pub fn construct(&self, id: &str) -> Result<&Construct> {
        self.constructs
            .iter()
            .find(|c| c.id == id)
            .ok_or_else(|| error("constructs", "unknown_construct", id))
    }
    pub fn game_policy(&self) -> &GamePolicy {
        &self.game
    }
    pub fn game_hash(&self) -> String {
        fingerprint(&self.game)
    }
    pub fn estimator_policy(&self) -> &EstimatorPolicy {
        &self.estimator
    }
    pub fn estimator_hash(&self) -> String {
        fingerprint(&self.estimator)
    }
    pub fn feedback_policy(&self) -> &FeedbackPolicy {
        &self.feedback
    }
    pub fn catalog(&self) -> serde_json::Value {
        let mut nodes = self.navigation.clone();
        for c in &self.constructs {
            let node = nodes
                .iter_mut()
                .find(|n| n.id == c.id)
                .expect("validated navigation entry");
            node.label = c.label.clone();
            node.criterion = c.criterion.clone();
            node.description = c.opportunity.clone();
        }
        serde_json::to_value(nodes).expect("catalog is serializable")
    }
    fn language_config(&self, id: &str) -> Result<&Language> {
        self.languages
            .iter()
            .find(|l| l.id == id)
            .ok_or_else(|| error("languages", "unknown_language", id))
    }
    pub fn language(&self, id: &str) -> model::Result<model::Language> {
        let l = self.language_config(id)?;
        let transcription = |variety: &Variety| {
            variety
                .external_tags
                .get("transcription")
                .or_else(|| l.external_tags.get("transcription"))
                .cloned()
        };
        Ok(model::Language {
            transcription_language: transcription(
                l.varieties
                    .iter()
                    .find(|v| v.id == l.default_variety)
                    .unwrap(),
            ),
            id: l.id.clone(),
            language_tag: l.external_tags.get("language_tag").cloned(),
            name: l.name.clone(),
            native_name: l.native_name.clone(),
            default_variety: l.default_variety.clone(),
            font_scale: self.resolved_scalars(l, &l.default_variety).1,
            direction: self.resolved_scalars(l, &l.default_variety).0,
            romanization: Self::variety_romanization(
                l,
                l.varieties
                    .iter()
                    .find(|v| v.id == l.default_variety)
                    .unwrap(),
            )
            .cloned(),
            varieties: l
                .varieties
                .iter()
                .map(|v| model::Variety {
                    transcription_language: transcription(v),
                    id: v.id.clone(),
                    direction: self.resolved_scalars(l, &v.id).0,
                    font_scale: self.resolved_scalars(l, &v.id).1,
                    romanization: Self::variety_romanization(l, v).cloned(),
                    name: v.name.clone(),
                    description: v.description.clone(),
                })
                .collect(),
        })
    }
    pub fn starter_persona(&self, id: &str) -> model::Result<model::PersonaDetails> {
        Ok(self.language_config(id)?.starter_persona.clone())
    }
    pub fn language_projection(&self) -> Vec<model::Language> {
        self.languages
            .iter()
            .map(|l| self.language(&l.id).expect("validated language"))
            .collect()
    }
    pub fn defaults(
        &self,
        language: &str,
        explanation: &str,
    ) -> model::Result<model::PracticeSettings> {
        let l = self.language_config(language)?;
        self.language_config(explanation)?;
        Ok(model::PracticeSettings {
            direction: Default::default(),
            difficulty: model::Difficulty::Beginner,
            explanation_language: explanation.into(),
            variety_id: l.default_variety.clone(),
            explanation_variety_id: self.language_config(explanation)?.default_variety.clone(),
            composing_help: model::HelpAmount::Balanced,
            coach_proactivity: model::CoachProactivity::OnRequest,
            translation: false,
            pronunciation: false,
            romanization: false,
            auto_send: true,
            read_aloud: true,
            speech_voice: "alloy".into(),
        })
    }
    pub fn preference_defaults(
        &self,
        language: &str,
        preferences: &model::Preferences,
    ) -> model::Result<model::PracticeSettings> {
        let mut settings = self.defaults(language, &preferences.explanation_language)?;
        settings.explanation_variety_id = preferences.explanation_variety_id.clone();
        if let Some(variety) = preferences.target_varieties.get(language) {
            settings.variety_id = variety.clone();
        }
        self.validate_settings(language, &settings)?;
        Ok(settings)
    }
    pub fn validate_preferences(&self, preferences: &model::Preferences) -> model::Result<()> {
        preferences.appearance.validate()?;
        if let Some(language) = &preferences.onboarding_language {
            self.language(language)?;
            if !preferences.my_languages.contains(language)
                || !preferences.target_varieties.contains_key(language)
            {
                return Err(error(
                    "preferences.onboarding_language",
                    "invalid_setup_language",
                    "Choose a saved language and variety for setup.",
                )
                .into());
            }
        }
        if preferences.onboarding_required
            && matches!(preferences.onboarding, model::OnboardingStatus::InProgress)
            && preferences.onboarding_language.is_none()
        {
            return Err(error(
                "preferences.onboarding_language",
                "missing_setup_language",
                "Choose a language before continuing setup.",
            )
            .into());
        }
        if !INTERFACE_LOCALES.contains(&preferences.interface_locale.as_str()) {
            return Err(error(
                "preferences.interface_locale",
                "unknown_locale",
                "Choose an available interface translation.",
            )
            .into());
        }
        self.resolve_pair(
            &preferences.explanation_language,
            None,
            &preferences.explanation_language,
            Some(&preferences.explanation_variety_id),
        )?;
        let mut seen = std::collections::HashSet::new();
        for language in &preferences.my_languages {
            self.language(language)?;
            if !seen.insert(language) {
                return Err(error(
                    "preferences.my_languages",
                    "duplicate_language",
                    "Choose each language only once.",
                )
                .into());
            }
        }
        for (language, variety) in &preferences.target_varieties {
            self.resolve(language, Some(variety), &preferences.explanation_language)?;
        }
        Ok(())
    }
    pub fn validate_settings(
        &self,
        language: &str,
        settings: &model::PracticeSettings,
    ) -> model::Result<()> {
        crate::conversations::direction::topic_text(self, &settings.direction)
            .map_err(|e| error("conversation.direction", "invalid_topic", e.message))?;
        self.resolve_pair(
            language,
            Some(&settings.variety_id),
            &settings.explanation_language,
            Some(&settings.explanation_variety_id),
        )?;
        if settings.speech_voice != "alloy" {
            return Err(model::AppError::new(
                model::ErrorCode::Validation,
                "Choose a supported speech voice.",
            ));
        }
        Ok(())
    }
    /// Mandatory focus/prerequisites, due, function and interaction constructs
    /// are never silently truncated. Optional neighboring-band/token matches fill
    /// up to 25 optional matches beyond required members. Hints match contiguous Unicode
    /// words, including multiword expressions; this is retrieval, not proficiency evidence.
    pub fn candidates(
        &self,
        ctx: &LanguageContext,
        band: &str,
        focus: &[String],
        due: &[String],
        tokens: &[String],
    ) -> Result<Vec<Construct>> {
        let band_index = BANDS
            .iter()
            .position(|b| *b == band)
            .ok_or_else(|| error("constructs", "unknown_band", band))?;
        let hints = lexical_hints::LexicalHints::new(tokens);
        let mut selected = BTreeSet::new();
        for id in focus.iter().chain(due) {
            self.add_required(id, &ctx.language_id, &mut selected)?;
        }
        for c in &self.constructs {
            if self.applies(c, &ctx.language_id)
                && ["function", "interaction"].contains(&c.lens.as_str())
            {
                selected.insert(c.id.clone());
            }
        }
        let mut optional = 0;
        for c in &self.constructs {
            if optional >= 25 {
                break;
            }
            if !selected.contains(&c.id)
                && self.applies(c, &ctx.language_id)
                && BANDS
                    .iter()
                    .position(|b| *b == c.band)
                    .expect("validated band")
                    .abs_diff(band_index)
                    <= 1
                && (!c.traits.is_empty()
                    && c.traits.iter().any(|t| {
                        self.language_config(&ctx.language_id)
                            .expect("resolved language")
                            .traits
                            .contains(t)
                    })
                    || self
                        .goal_material
                        .get(&ctx.language_id)
                        .and_then(|m| m.get(&c.id))
                        .map(|m| m.tokens.as_slice())
                        .unwrap_or(&c.tokens)
                        .iter()
                        .any(|phrase| hints.contains(phrase)))
            {
                selected.insert(c.id.clone());
                optional += 1;
            }
        }
        Ok(self
            .constructs
            .iter()
            .filter(|c| selected.contains(&c.id))
            .cloned()
            .collect())
    }
    fn applies(&self, _c: &Construct, _language: &str) -> bool {
        true
    }
    fn add_required(&self, id: &str, language: &str, out: &mut BTreeSet<String>) -> Result<()> {
        let c = self.construct(id)?;
        if !self.applies(c, language) {
            return Err(error("constructs", "language_mismatch", id));
        }
        if out.insert(id.into()) {
            for dep in &c.requires {
                self.add_required(dep, language, out)?;
            }
        }
        Ok(())
    }
    pub fn conversation_prompt(&self) -> &documents::ConversationPromptContent {
        &self.conversation_prompt
    }
    pub fn topics(&self) -> &[documents::ConversationTopic] {
        &self.topics
    }
    pub fn topic(&self, id: &str) -> Result<&documents::ConversationTopic> {
        self.topics
            .iter()
            .find(|t| t.id == id)
            .ok_or_else(|| error("topics", "unknown_topic", "Unknown topic identity."))
    }
}
const SCOPES: &[&str] = &[
    "target_writing",
    "explanation_writing",
    "segmentation",
    "reading",
    "romanization",
    "assessment",
    "pragmatics",
];
const BANDS: &[&str] = &["PreA1", "A1", "A2", "B1", "B2", "C1", "C2"];
#[cfg(test)]
mod tests;
mod validation;

#[cfg(test)]
mod baseline_tests;

/// Interface translations are independent of the learning-language catalog.
pub const INTERFACE_LOCALES: &[&str] = &[
    "english",
    "spanish",
    "arabic",
    "mandarin",
    "french",
    "german",
    "portuguese",
];
#[cfg(test)]
mod document_tests;

#[cfg(test)]
mod language_audit_tests;

#[cfg(test)]
mod latin_language_tests;
