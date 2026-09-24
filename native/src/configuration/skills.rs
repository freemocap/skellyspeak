//! Composable skill content. Progression and recorded practice have separate owners.
use super::{Registry, Result, error, fingerprint, identity::ReviewStatus};
use crate::learning::practice_assessment::{self, SkillPrompt};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Category {
    pub id: String,
    pub name: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub overview: String,
    pub boundary: String,
    pub category: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Catalog {
    pub categories: Vec<Category>,
    pub skills: Vec<Skill>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Example {
    pub text: String,
    pub translation: String,
    pub context: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Guidance {
    pub assessment: String,
    /// Human-readable Markdown; excluded from the assessor projection.
    pub explanation: String,
    #[serde(default)]
    pub examples: Vec<Example>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Guide {
    pub core: Guidance,
    /// Explicit coverage. Missing varieties never inherit another variety's guide.
    pub varieties: BTreeMap<String, Guidance>,
    pub review: ReviewStatus,
    pub authorship: String,
    pub sources: Vec<String>,
}
#[derive(Debug, Serialize)]
pub struct Coverage {
    pub skill_id: String,
    pub name: String,
    pub owner: String,
    pub guide_available: bool,
}

fn text(path: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() || value.contains('\0') || value.len() > 16000 {
        return Err(error(
            path,
            "skill_content",
            "Expected nonempty, NUL-free text up to 16000 bytes.",
        ));
    }
    Ok(())
}
fn identifier(path: &str, value: &str) -> Result<()> {
    if !value.as_bytes().first().is_some_and(u8::is_ascii_lowercase)
        || value.split('_').any(|part| {
            part.is_empty()
                || !part
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
        })
    {
        return Err(error(
            path,
            "skill_id",
            "Use lowercase identifiers separated by underscores.",
        ));
    }
    Ok(())
}
impl Registry {
    pub fn presence_instructions(&self) -> &practice_assessment::Instructions {
        &self.presence_instructions
    }
    pub fn shared_skills(&self) -> &Catalog {
        &self.skills
    }

    pub fn skills_for_language(&self, language: &str) -> Result<Vec<&Skill>> {
        self.language_config(language)?;
        Ok(self
            .skills
            .skills
            .iter()
            .chain(&self.documents[language].learning.skills)
            .collect())
    }

    pub(super) fn validate_skills(&self, citations: &BTreeSet<String>) -> Result<()> {
        let mut categories = BTreeSet::new();
        for category in &self.skills.categories {
            identifier("shared/skills.yaml#categories", &category.id)?;
            text(&category.id, &category.name)?;
            if !categories.insert(&category.id) {
                return Err(error(
                    &category.id,
                    "duplicate_category",
                    "Duplicate category.",
                ));
            }
        }
        if categories.is_empty() || self.skills.skills.is_empty() {
            return Err(error(
                "shared/skills.yaml",
                "empty_catalog",
                "Categories and shared skills are required.",
            ));
        }
        let mut all_ids = BTreeSet::new();
        // Global uniqueness makes recorded IDs unambiguous across languages.
        for skill in self
            .skills
            .skills
            .iter()
            .chain(self.documents.values().flat_map(|d| &d.learning.skills))
        {
            identifier(&skill.id, &skill.id)?;
            for value in [&skill.name, &skill.overview, &skill.boundary] {
                text(&skill.id, value)?;
            }
            if !all_ids.insert(&skill.id) || !categories.contains(&skill.category) {
                return Err(error(
                    &skill.id,
                    "skill_reference",
                    "Duplicate skill or unknown category.",
                ));
            }
        }
        for (language, document) in &self.documents {
            let ids: BTreeSet<_> = self
                .skills_for_language(language)?
                .iter()
                .map(|s| s.id.as_str())
                .collect();
            let varieties: BTreeSet<_> = document
                .varieties
                .iter()
                .map(|v| v.id.to_string())
                .collect();
            for (id, guide) in &document.learning.skill_guides {
                let path = format!("languages/{language}.yaml#learning.skill_guides.{id}");
                if !ids.contains(id.as_str()) || guide.varieties.is_empty() {
                    return Err(error(
                        &path,
                        "skill_guide",
                        "Guide needs an applicable skill and explicit variety coverage.",
                    ));
                }
                for variety in guide.varieties.keys() {
                    if !varieties.contains(variety) {
                        return Err(error(&path, "skill_variety", "Unknown or foreign variety."));
                    }
                }
                text(&path, &guide.authorship)?;
                let mut seen = BTreeSet::new();
                for source in &guide.sources {
                    if !citations.contains(source) || !seen.insert(source) {
                        return Err(error(
                            &path,
                            "skill_source",
                            "Unknown or duplicate citation.",
                        ));
                    }
                }
                if matches!(guide.review, ReviewStatus::Reviewed) && guide.sources.is_empty() {
                    return Err(error(
                        &path,
                        "skill_review",
                        "Reviewed guidance requires sources.",
                    ));
                }
                for guidance in std::iter::once(&guide.core).chain(guide.varieties.values()) {
                    text(&path, &guidance.assessment)?;
                    text(&path, &guidance.explanation)?;
                    for example in &guidance.examples {
                        text(&path, &example.text)?;
                        text(&path, &example.translation)?;
                        if let Some(context) = &example.context {
                            text(&path, context)?;
                        }
                    }
                }
            }
        }
        // Validate shared instructions independently of incomplete pilot-guide coverage.
        let skill = &self.skills.skills[0];
        practice_assessment::request(
            serde_json::json!({}),
            &[SkillPrompt {
                id: skill.id.clone(),
                name: skill.name.clone(),
                overview: skill.overview.clone(),
                boundary: skill.boundary.clone(),
                language_guidance: "Content validation only.".into(),
            }],
            &self.presence_instructions,
        )
        .map_err(|e| error("prompts/skills/presence.yaml", "skill_prompt", e.message))?;
        Ok(())
    }

    pub fn skill_coverage(&self, language: &str, variety: &str) -> Result<Vec<Coverage>> {
        self.resolve_pair(language, Some(variety), language, Some(variety))?;
        let document = &self.documents[language];
        Ok(self
            .skills_for_language(language)?
            .into_iter()
            .map(|skill| Coverage {
                skill_id: skill.id.clone(),
                name: skill.name.clone(),
                owner: if self.skills.skills.iter().any(|s| s.id == skill.id) {
                    "shared".into()
                } else {
                    language.into()
                },
                guide_available: document
                    .learning
                    .skill_guides
                    .get(&skill.id)
                    .is_some_and(|g| g.varieties.contains_key(variety)),
            })
            .collect())
    }

    /// A focused content inspection; a live full-catalog request must require every skill.
    pub fn skill_prompt(&self, language: &str, variety: &str, id: &str) -> Result<SkillPrompt> {
        let (skill, guide, local) = self.skill_content(language, variety, id)?;
        Ok(SkillPrompt {
            id: skill.id.clone(),
            name: skill.name.clone(),
            overview: skill.overview.clone(),
            boundary: skill.boundary.clone(),
            language_guidance: format!(
                "Language: {}\nVariety: {}\n\n{}\n\n{}",
                self.language_config(language)?.name,
                self.language_config(language)?
                    .varieties
                    .iter()
                    .find(|v| v.id == variety)
                    .expect("validated variety")
                    .name,
                guide.core.assessment,
                local.assessment
            ),
        })
    }

    pub fn skill_presence_request(
        &self,
        language: &str,
        variety: &str,
        state: serde_json::Value,
    ) -> crate::model::Result<serde_json::Value> {
        let skills = self
            .skills_for_language(language)?
            .iter()
            .map(|s| self.skill_prompt(language, variety, &s.id))
            .collect::<Result<Vec<_>>>()?;
        practice_assessment::request(state, &skills, &self.presence_instructions)
    }

    pub fn skill_content_hash(&self, language: &str, variety: &str) -> Result<String> {
        self.skill_coverage(language, variety)?;
        Ok(fingerprint(&(
            self.skills_for_language(language)?,
            &self.documents[language].learning.skill_guides,
            variety,
            &self.presence_instructions,
        )))
    }

    fn skill_content(
        &self,
        language: &str,
        variety: &str,
        id: &str,
    ) -> Result<(&Skill, &Guide, &Guidance)> {
        self.resolve_pair(language, Some(variety), language, Some(variety))?;
        let skill = self
            .skills_for_language(language)?
            .into_iter()
            .find(|s| s.id == id)
            .ok_or_else(|| {
                error(
                    id,
                    "unknown_skill",
                    "Skill is not available for this language.",
                )
            })?;
        let path = format!("languages/{language}.yaml#learning.skill_guides.{id}");
        let guide = self.documents[language]
            .learning
            .skill_guides
            .get(id)
            .ok_or_else(|| {
                error(
                    &path,
                    "missing_skill_guide",
                    "No authored guidance for this skill.",
                )
            })?;
        let local = guide.varieties.get(variety).ok_or_else(|| {
            error(
                &path,
                "missing_skill_variety",
                format!("No authored guidance for {variety}."),
            )
        })?;
        Ok((skill, guide, local))
    }

    pub fn skill_markdown(&self, language: &str, variety: &str, id: &str) -> Result<String> {
        let (skill, guide, local) = self.skill_content(language, variety, id)?;
        let context = self.resolve_pair(language, Some(variety), language, Some(variety))?;
        let mut lines = vec![
            format!("# {}", skill.name),
            format!("{} · {}", context.target_name, context.variety_name),
            skill.overview.clone(),
            format!("**Boundary:** {}", skill.boundary),
            "## Shared language guidance".into(),
            guide.core.explanation.clone(),
            "## Selected variety".into(),
            local.explanation.clone(),
        ];
        let examples: Vec<_> = guide.core.examples.iter().chain(&local.examples).collect();
        if !examples.is_empty() {
            lines.push("## Examples".into());
        }
        for example in examples {
            if let Some(context) = &example.context {
                lines.push(format!("**Context:** {context}"));
            }
            lines.push(
                example
                    .text
                    .lines()
                    .map(|l| format!("> {l}"))
                    .collect::<Vec<_>>()
                    .join("\n"),
            );
            lines.push(example.translation.clone());
        }
        lines.extend([
            "## Content review".into(),
            format!("Review: {}\n\n{}", guide.review, guide.authorship),
        ]);
        Ok(lines.join("\n\n") + "\n")
    }
}

#[cfg(test)]
#[path = "skills_tests.rs"]
mod tests;
