//! Language-owned explanations and compact assessment material for the replacement.
use super::{Registry, Result, error, fingerprint, guides::GuideOrigin, identity::ReviewStatus};
use crate::learning::practice_assessment::{self, SkillPrompt};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Document {
    pub schema_version: u32,
    pub language: String,
    pub explanation_language: String,
    pub revision: String,
    pub origin: GuideOrigin,
    pub review: ReviewStatus,
    pub authorship: String,
    pub sources: Vec<String>,
    pub groups: BTreeMap<String, Guide>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Guide {
    /// Written offline, not a runtime summary of learner-facing prose.
    pub assessment: String,
    pub sections: Vec<Section>,
    pub varieties: BTreeMap<String, Variety>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Section {
    pub subskill: String,
    pub explanation: String,
    pub examples: Vec<Example>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Example {
    pub text: String,
    pub meaning: String,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Variety {
    pub assessment: String,
    /// Explicit null means no additional learner-facing detail beyond the core.
    #[serde(deserialize_with = "deserialize_detail")]
    pub detail: Option<String>,
    pub origin: GuideOrigin,
    pub review: ReviewStatus,
    pub authorship: String,
}

#[derive(Debug, Serialize)]
pub struct Coverage {
    pub language: String,
    pub explanation_language: String,
    pub missing_groups: Vec<String>,
}

fn deserialize_detail<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<String>, D::Error> {
    Option::<String>::deserialize(deserializer)
}

fn text(path: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() || value.contains('\0') || value.len() > 16000 {
        return Err(error(
            path,
            "communication_guide",
            "Expected nonempty, NUL-free text up to 16000 bytes.",
        ));
    }
    Ok(())
}

impl Registry {
    pub(super) fn validate_communication_guides(&self, citations: &BTreeSet<String>) -> Result<()> {
        for (path, doc) in &self.communication_guides {
            self.language_config(&doc.language)?;
            self.language_config(&doc.explanation_language)?;
            if *path
                != format!(
                    "communication/{}/{}.yaml",
                    doc.language, doc.explanation_language
                )
                || doc.schema_version != 1
                || doc.groups.is_empty()
            {
                return Err(error(
                    path,
                    "communication_guide",
                    "Expected matching language/locale path, version 1 and nonempty groups.",
                ));
            }
            text(path, &doc.revision)?;
            text(path, &doc.authorship)?;
            let mut sources = BTreeSet::new();
            if doc.sources.is_empty()
                || doc
                    .sources
                    .iter()
                    .any(|s| !citations.contains(s) || !sources.insert(s))
            {
                return Err(error(
                    path,
                    "communication_guide",
                    "Expected known, distinct citations.",
                ));
            }
            let varieties: BTreeSet<_> = self
                .language_config(&doc.language)?
                .varieties
                .iter()
                .map(|v| v.id.to_string())
                .collect();
            for (id, guide) in &doc.groups {
                let path = format!("{path}#groups.{id}");
                let group = self
                    .communication
                    .groups
                    .iter()
                    .find(|g| &g.id == id)
                    .ok_or_else(|| error(&path, "communication_group", "Unknown main skill."))?;
                text(&path, &guide.assessment)?;
                let expected: BTreeSet<_> = group.subskills.iter().map(|s| s.id.as_str()).collect();
                let actual: BTreeSet<_> =
                    guide.sections.iter().map(|s| s.subskill.as_str()).collect();
                if actual != expected || guide.sections.len() != expected.len() {
                    return Err(error(
                        &path,
                        "communication_sections",
                        "Each teaching subskill needs exactly one section.",
                    ));
                }
                if guide.varieties.keys().cloned().collect::<BTreeSet<_>>() != varieties {
                    return Err(error(
                        &path,
                        "communication_varieties",
                        "Every offered variety needs explicit coverage.",
                    ));
                }
                for section in &guide.sections {
                    text(&path, &section.explanation)?;
                    if section.examples.is_empty() {
                        return Err(error(
                            &path,
                            "communication_examples",
                            "Each teaching section needs examples.",
                        ));
                    }
                    for example in &section.examples {
                        for value in [&example.text, &example.meaning, &example.note] {
                            text(&path, value)?;
                        }
                    }
                }
                for local in guide.varieties.values() {
                    text(&path, &local.assessment)?;
                    text(&path, &local.authorship)?;
                    if let Some(detail) = &local.detail {
                        text(&path, detail)?;
                    }
                }
            }
        }
        Ok(())
    }

    /// Offline report: never used to turn missing content into a normal UI state.
    pub fn communication_coverage(&self) -> Vec<Coverage> {
        self.languages
            .iter()
            .flat_map(|language| {
                self.languages.iter().map(move |explanation| {
                    let doc = self.communication_guides.get(&format!(
                        "communication/{}/{}.yaml",
                        language.id, explanation.id
                    ));
                    Coverage {
                        language: language.id.clone(),
                        explanation_language: explanation.id.clone(),
                        missing_groups: self
                            .communication
                            .groups
                            .iter()
                            .filter(|g| doc.is_none_or(|d| !d.groups.contains_key(&g.id)))
                            .map(|g| g.id.clone())
                            .collect(),
                    }
                })
            })
            .collect()
    }

    pub fn require_complete_communication_content(&self) -> Result<()> {
        let missing: Vec<_> = self
            .communication_coverage()
            .into_iter()
            .filter(|r| !r.missing_groups.is_empty())
            .collect();
        if !missing.is_empty() {
            return Err(error(
                "communication",
                "incomplete_communication",
                format!(
                    "{} language/explanation pairs are incomplete; inspect --communication-coverage.",
                    missing.len()
                ),
            ));
        }
        Ok(())
    }

    pub fn communication_prompts(
        &self,
        language: &str,
        variety: &str,
        explanation: &str,
    ) -> Result<Vec<SkillPrompt>> {
        let context = self.resolve_pair(language, Some(variety), explanation, None)?;
        let path = format!("communication/{language}/{explanation}.yaml");
        let doc = self.communication_guides.get(&path).ok_or_else(|| {
            error(
                &path,
                "missing_communication",
                "No authored language guide for this explanation language.",
            )
        })?;
        self.communication
            .groups
            .iter()
            .map(|group| {
                let guide = doc
                    .groups
                    .get(&group.id)
                    .ok_or_else(|| error(&path, "missing_communication_group", &group.id))?;
                let local = guide
                    .varieties
                    .get(variety)
                    .ok_or_else(|| error(&path, "missing_communication_variety", variety))?;
                Ok(SkillPrompt {
                    id: group.id.clone(),
                    name: group.name.clone(),
                    overview: group.purpose.clone(),
                    boundary: group.boundary.clone(),
                    language_guidance: format!(
                        "Language: {}\nVariety: {}\n\n{}\n\n{}",
                        context.target_name,
                        context.variety_name,
                        guide.assessment,
                        local.assessment
                    ),
                })
            })
            .collect()
    }

    /// Offline request specimen. No transport, publication or XP side effects.
    pub fn communication_request(
        &self,
        language: &str,
        variety: &str,
        explanation: &str,
        state: serde_json::Value,
    ) -> crate::model::Result<serde_json::Value> {
        let prompts = self.communication_prompts(language, variety, explanation)?;
        practice_assessment::request(state, &prompts, &self.demonstration_instructions)
    }

    pub fn communication_content_hash(&self) -> String {
        fingerprint(&(
            &self.communication,
            &self.communication_guides,
            &self.demonstration_instructions,
        ))
    }
}

#[cfg(test)]
#[path = "communication_guides_tests.rs"]
mod tests;
