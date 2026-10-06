//! App-owned teaching content, parsed and validated into one resolved registry.
//! Invalid bundled content blocks startup with ConfigLoadError.
pub mod appearance;
pub mod authoring;
mod citations;
pub mod communication;
pub mod communication_guides;
mod communication_inspection;
pub(crate) mod content_files;
pub mod difficulty;
mod documents;
pub mod execution;
pub(crate) mod guide_translation;
pub mod guides;
pub mod practice;
mod skill_conversation;
mod skill_navigation;
pub mod skills;
pub mod speech;
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
    skills: skills::Catalog,
    communication: communication::Catalog,
    authored: authoring::Content,
    assessment_instructions: crate::learning::practice_assessment::Instructions,
    feedback: FeedbackPolicy,
    estimator: EstimatorPolicy,
    game: GamePolicy,
    topics: Vec<documents::ConversationTopic>,
    conversation_prompt: documents::ConversationPromptContent,
    drill_instruction: String,
    hash: String,
    #[serde(skip)]
    documents: BTreeMap<String, documents::LanguageDocument>,
    #[serde(skip)]
    source_files: BTreeMap<String, String>,
}
include!(concat!(env!("OUT_DIR"), "/config_seeds.rs"));

impl Registry {
    /// Shared definitions of the eight main groups and their teaching subskills.
    pub fn communication_catalog(&self) -> &communication::Catalog {
        &self.communication
    }

    pub fn hash(&self) -> &str {
        &self.hash
    }
    pub fn learning_content_hash(&self) -> String {
        fingerprint(&self.authored.definitions)
    }
    pub fn skill_definition(&self, id: &str) -> Result<&authoring::Definition> {
        self.authored
            .definitions
            .get(id)
            .ok_or_else(|| error("skills", "unknown_skill", id))
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
        self.shared_practice_catalog()
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
            greeting: self.starter_greeting(&l.id, None)?,
            partner: model::LanguagePartner {
                name: l.starter_persona.name.clone(),
                romanized_name: l.starter_persona.romanized_name.clone(),
                vibe: l.starter_persona.vibe.clone(),
            },
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
    /// Every starter card and greeting must be authored for every language a
    /// learner can reach, and for every scheme any variety resolves to.
    ///
    /// `deny_unknown_fields` rejects unknown FIELDS; it does not require a map
    /// to hold a given KEY. Without this pass, a missing label or transliteration
    /// would reach the start surface as a blank line instead of refusing to load.
    pub(super) fn validate_starter_content(&self) -> Result<()> {
        let mut schemes: Vec<(String, String)> = vec![];
        for language in &self.languages {
            for variety in &language.varieties {
                if let Some(key) = Self::variety_romanization(language, variety) {
                    schemes.push((variety.id.clone(), key.clone()));
                }
            }
        }
        for topic in &self.topics {
            let path = format!("conversation-topics/conversation-topics.yaml#{}", topic.id);
            if topic.glyph.trim().is_empty() {
                return Err(error(&path, "missing_glyph", "Give the topic a glyph."));
            }
            for language in &self.languages {
                match topic.labels.get(&language.id) {
                    Some(label) if !label.trim().is_empty() => {}
                    _ => {
                        return Err(error(
                            format!("{path}.labels.{}", language.id),
                            "missing_label",
                            "Every language needs this topic's name; it is shown as both the target label and its translation.",
                        ));
                    }
                }
            }
            for (variety, key) in &schemes {
                match topic.romanizations.get(key) {
                    Some(value) if !value.trim().is_empty() => {}
                    _ => {
                        return Err(error(
                            format!("{path}.romanizations.{key}"),
                            "missing_romanization",
                            format!("Variety {variety} romanizes with {key}."),
                        ));
                    }
                }
            }
        }
        for language in &self.languages {
            let greeting = &self
                .documents
                .get(&language.id)
                .expect("added language document")
                .conversation
                .greeting;
            let path = format!(
                "languages/{0}/{0}-language.yaml#conversation.greeting",
                language.id
            );
            if greeting.text.trim().is_empty() {
                return Err(error(
                    &path,
                    "missing_greeting",
                    "Give the language a greeting.",
                ));
            }
            for variety in &language.varieties {
                let Some(key) = Self::variety_romanization(language, variety) else {
                    continue;
                };
                match greeting.romanizations.get(key) {
                    Some(value) if !value.trim().is_empty() => {}
                    _ => {
                        return Err(error(
                            format!("{path}.romanizations.{key}"),
                            "missing_romanization",
                            format!("Variety {} romanizes with {key}.", variety.id),
                        ));
                    }
                }
            }
        }
        Ok(())
    }
    /// The romanization scheme key in force for a language, or its named variety
    /// when one is given. `None` when the variety writes in Latin script or
    /// disables romanization. The key is the same one topic and greeting
    /// romanizations are stored under.
    pub fn active_romanization_scheme(
        &self,
        language: &str,
        variety: Option<&str>,
    ) -> model::Result<Option<String>> {
        let config = self.language_config(language)?;
        let chosen = variety.unwrap_or(&config.default_variety);
        let variety = config
            .varieties
            .iter()
            .find(|v| v.id == chosen)
            .ok_or_else(|| error("languages", "unknown_variety", chosen))?;
        Ok(Self::variety_romanization(config, variety).cloned())
    }
    /// The greeting the start surface offers, with the transliteration that the
    /// same variety resolves to.
    pub fn starter_greeting(
        &self,
        language: &str,
        variety: Option<&str>,
    ) -> model::Result<model::StarterGreeting> {
        let greeting = &self
            .documents
            .get(language)
            .ok_or_else(|| error("languages", "unknown_language", language))?
            .conversation
            .greeting;
        let romanized = match self.active_romanization_scheme(language, variety)? {
            Some(key) => Some(greeting.romanizations.get(&key).cloned().ok_or_else(|| {
                error(
                    format!("languages/{language}/{language}-language.yaml#conversation.greeting.romanizations"),
                    "missing_romanization",
                    format!("The greeting has no {key} romanization."),
                )
            })?),
            None => None,
        };
        Ok(model::StarterGreeting {
            text: greeting.text.clone(),
            romanized,
        })
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
            speech_voice: SPEECH_VOICE.into(),
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
        if let Some(scales) = &preferences.script_scales {
            for (language, scale) in scales {
                self.language(language)?;
                if !scale.is_finite() || !(0.5..=3.0).contains(scale) {
                    return Err(error(
                        "preferences.script_scales",
                        "invalid_scale",
                        "Script size must be between 0.5 and 3.0.",
                    )
                    .into());
                }
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
        if settings.speech_voice != SPEECH_VOICE {
            return Err(model::AppError::new(
                model::ErrorCode::Validation,
                "Choose a supported speech voice.",
            ));
        }
        Ok(())
    }
    pub(crate) fn drill_instruction(&self) -> &str {
        &self.drill_instruction
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
#[cfg(test)]
mod tests;
mod validation;

#[cfg(test)]
mod baseline_tests;

/// The one supported speech voice, for conversations and reading requests.
pub const SPEECH_VOICE: &str = "alloy";
/// Interface translations are independent of the learning-language catalog.
pub const INTERFACE_LOCALES: &[&str] = &[
    "english",
    "spanish",
    "arabic",
    "mandarin",
    "cantonese",
    "french",
    "german",
    "portuguese",
];
#[cfg(test)]
mod document_tests;
#[cfg(test)]
mod practice_tests;

#[cfg(test)]
mod language_audit_tests;

#[cfg(test)]
mod variety_tests;

#[cfg(test)]
mod latin_language_tests;

#[cfg(test)]
mod added_language_tests;

#[cfg(test)]
mod speech_tests;

#[cfg(test)]
mod guides_tests;
