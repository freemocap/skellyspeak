//! Speech policy belongs to configuration. Consumers capture its result; transports
//! neither infer language support nor select a replacement after a request fails.
use super::{Result, error};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Preferences {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcription: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speech: Option<Vec<String>>,
}
impl Preferences {
    pub fn is_empty(&self) -> bool {
        self.transcription.is_none() && self.speech.is_none()
    }
    pub fn overlay(&self, other: &Self) -> Self {
        Self {
            transcription: other.transcription.clone().or(self.transcription.clone()),
            speech: other.speech.clone().or(self.speech.clone()),
        }
    }
    fn for_task(&self, task: Task) -> Option<&Vec<String>> {
        match task {
            Task::Transcription => self.transcription.as_ref(),
            Task::Speech => self.speech.as_ref(),
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Task {
    Transcription,
    Speech,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Model {
    pub allow_unlisted_languages: bool,
    pub provider: String,
    pub task: Task,
    pub languages: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Catalog {
    pub version: u32,
    pub defaults: Preferences,
    pub language_sets: BTreeMap<String, BTreeMap<String, String>>,
    pub models: BTreeMap<String, Model>,
    pub sources: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Resolution {
    pub requested_model: String,
    pub model: String,
    pub provider: String,
    pub language_code: String,
    pub reason: String,
}
pub fn primary(tag: &str) -> Option<&str> {
    let mut parts = tag.split('-');
    let code = parts.next()?;
    ((2..=3).contains(&code.len())
        && code.bytes().all(|b| b.is_ascii_lowercase())
        && tag.len() <= 80
        && parts
            .all(|p| !p.is_empty() && p.len() <= 8 && p.bytes().all(|b| b.is_ascii_alphanumeric())))
    .then_some(code)
}
impl Catalog {
    pub fn bundled() -> &'static Self {
        static VALUE: std::sync::OnceLock<Catalog> = std::sync::OnceLock::new();
        VALUE.get_or_init(|| {
            let value: Catalog = serde_yaml_ng::from_str(include_str!(
                "../../../content/shared/speech-routing.yaml"
            ))
            .expect("invalid bundled speech catalog");
            value.validate().expect("invalid bundled speech policy");
            value
        })
    }
    pub fn validate_preferences(&self, preferences: &Preferences) -> Result<()> {
        for task in [Task::Transcription, Task::Speech] {
            if let Some(models) = preferences.for_task(task) {
                let mut seen = BTreeSet::new();
                if models.is_empty()
                    || models.len() > 64
                    || models.iter().any(|id| {
                        !seen.insert(id) || !self.models.get(id).is_some_and(|m| m.task == task)
                    })
                {
                    return Err(error(
                        "speech_routes",
                        "models",
                        "Preferences must name distinct declared models for the correct speech task.",
                    ));
                }
            }
        }
        Ok(())
    }
    pub fn validate(&self) -> Result<()> {
        if self.version != 1
            || self.defaults.transcription.is_none()
            || self.defaults.speech.is_none()
            || self.models.is_empty()
            || self.sources.is_empty()
        {
            return Err(error(
                "shared/speech-routing.yaml",
                "catalog",
                "Invalid speech catalog version or defaults.",
            ));
        }
        for (id, model) in &self.models {
            if id.is_empty()
                || id.len() > 128
                || !id
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || b"_./-".contains(&c))
                || (model.provider == "groq" && model.task != Task::Transcription)
                || !matches!(model.provider.as_str(), "groq" | "elevenlabs")
                || !self.language_sets.get(&model.languages).is_some_and(|set| {
                    !set.is_empty()
                        && set.iter().all(|(key, value)| {
                            primary(key) == Some(key.as_str())
                                && primary(value) == Some(value.as_str())
                        })
                })
            {
                return Err(error(
                    "shared/speech-routing.yaml",
                    "capability",
                    "Invalid provider or language capability set.",
                ));
            }
        }
        self.validate_preferences(&self.defaults)
    }
    /// Preference order: variety/language, learner's global default, shared fallbacks.
    /// A supplied availability inventory restricts candidates before selection.
    pub fn resolve(
        &self,
        task: Task,
        tag: &str,
        preferred: &Preferences,
        default: &str,
        available: Option<&[String]>,
    ) -> Result<Resolution> {
        self.validate_preferences(preferred)?;
        let code = primary(tag).ok_or_else(|| {
            error(
                "speech_routes",
                "language",
                "Speech requires a valid explicit language tag.",
            )
        })?;
        let mut candidates: Vec<(&str, &str)> = preferred
            .for_task(task)
            .into_iter()
            .flatten()
            .map(|s| (s.as_str(), "language_preference"))
            .collect();
        candidates.push((default, "global_default"));
        candidates.extend(
            self.defaults
                .for_task(task)
                .into_iter()
                .flatten()
                .map(|s| (s.as_str(), "compatible_alternative")),
        );
        let mut unavailable = Vec::new();
        for &(id, reason) in &candidates {
            if let Some(model) = self.models.get(id) {
                if model.task != task {
                    continue;
                }
                if let Some(wire) = self.language_sets[&model.languages].get(code) {
                    if available.is_some_and(|list| !list.iter().any(|m| m == id)) {
                        unavailable.push(id);
                        continue;
                    }
                    return Ok(Resolution {
                        requested_model: default.into(),
                        model: id.into(),
                        provider: model.provider.clone(),
                        language_code: wire.clone(),
                        reason: reason.into(),
                    });
                }
            } else if id == default {
                if available.is_some_and(|list| !list.iter().any(|m| m == id)) {
                    unavailable.push(id);
                    continue;
                }
                // Explicit custom models retain their existing forwarding contract;
                // their capabilities are unknown, never advertised as verified support.
                return Ok(Resolution {
                    requested_model: default.into(),
                    model: id.into(),
                    provider: "custom".into(),
                    language_code: code.into(),
                    reason: "custom_model_unverified".into(),
                });
            }
        }
        // Listed support wins before a configured best-effort attempt. This is
        // selection before dispatch, never a retry after a provider failure.
        for (id, _) in candidates {
            let Some(model) = self.models.get(id) else {
                continue;
            };
            if model.task != task || !model.allow_unlisted_languages {
                continue;
            }
            if available.is_some_and(|list| !list.iter().any(|m| m == id)) {
                unavailable.push(id);
                continue;
            }
            return Ok(Resolution {
                requested_model: default.into(),
                model: id.into(),
                provider: model.provider.clone(),
                language_code: code.into(),
                reason: "unlisted_language_attempt".into(),
            });
        }
        if !unavailable.is_empty() {
            return Err(error(
                "speech_routes",
                "unavailable",
                format!(
                    "Compatible {task:?} models are not configured on this service: {}.",
                    unavailable.join(", ")
                ),
            ));
        }
        Err(error(
            "speech_routes",
            "unsupported",
            format!("No available {task:?} model supports language {tag}."),
        ))
    }
}
