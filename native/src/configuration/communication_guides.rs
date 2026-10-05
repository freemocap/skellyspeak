//! Composed skill content, backed by the validated authored files.
use super::{Registry, Result, error, fingerprint};
use crate::learning::practice_assessment::SkillPrompt;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Example {
    pub text: String,
    pub meaning: String,
    pub note: String,
}

#[derive(Debug, Serialize)]
pub struct Coverage {
    pub language: String,
    pub explanation_language: String,
    pub missing_groups: Vec<String>,
}
impl Registry {
    /// Learner-facing Markdown contains only authored teaching in the selected explanation language.
    pub fn skill_guide_markdown(
        &self,
        language: &str,
        variety: &str,
        explanation: &str,
        skill_id: &str,
    ) -> Result<String> {
        self.resolve_pair(language, Some(variety), explanation, None)?;
        self.skill_definition(skill_id)?;
        let stem = skill_id.replace('_', "-");
        let path = format!(
            "languages/{language}/skills/{stem}/{language}-{stem}-explained-in-{explanation}.yaml"
        );
        let guide = self.authored.guides.get(&path).ok_or_else(|| {
            error(
                &path,
                "missing_guide",
                "Required authored guide is missing.",
            )
        })?;
        let shared = &self.authored.explanations[&guide.shared_explanation];
        Ok(render_guide(shared, guide, variety))
    }

    /// Offline completeness report, not a learner progress metric.
    pub fn communication_coverage(&self) -> Vec<Coverage> {
        self.languages
            .iter()
            .flat_map(|language| {
                self.authored
                    .guide_policy
                    .bundled_explanation_languages
                    .iter()
                    .map(move |explanation| Coverage {
                        language: language.id.clone(),
                        explanation_language: explanation.clone(),
                        missing_groups: self
                            .skills
                            .skills
                            .iter()
                            .filter(|skill| {
                                let stem = skill.id.replace('_', "-");
                                !self.authored.guides.contains_key(&format!(
                                    "languages/{0}/skills/{stem}/{0}-{stem}-explained-in-{1}.yaml",
                                    language.id, explanation
                                ))
                            })
                            .map(|s| s.id.clone())
                            .collect(),
                    })
            })
            .collect()
    }
    pub fn require_complete_communication_content(&self) -> Result<()> {
        self.authored.require_complete()
    }
    pub fn communication_prompts(
        &self,
        language: &str,
        variety: &str,
        explanation: &str,
    ) -> Result<Vec<SkillPrompt>> {
        self.resolve_pair(language, Some(variety), explanation, None)?;
        self.skills
            .skills
            .iter()
            .map(|s| self.skill_prompt(language, variety, &s.id))
            .collect()
    }
    /// Complete offline request: eight skills, grammar and understandability.
    pub fn communication_request(
        &self,
        language: &str,
        variety: &str,
        explanation: &str,
        state: serde_json::Value,
    ) -> crate::model::Result<serde_json::Value> {
        self.resolve_pair(language, Some(variety), explanation, None)?;
        Ok(self
            .authored
            .assessment_specimen(language, variety, state)?
            .request)
    }
    pub fn communication_content_hash(&self) -> String {
        fingerprint(&(&self.authored, &self.assessment_instructions))
    }
}
#[cfg(test)]
#[path = "communication_guides_tests.rs"]
mod tests;

pub(crate) fn render_guide(
    shared: &super::authoring::Explanation,
    guide: &super::authoring::Guide,
    variety: &str,
) -> String {
    let mut lines = vec![format!("# {}", shared.title), shared.introduction.clone()];
    for section in &guide.sections {
        let concept = shared
            .sections
            .iter()
            .find(|s| s.subskill_id == section.subskill_id)
            .expect("validated concept reference");
        lines.extend([
            format!("### {}", concept.title),
            concept.concept.clone(),
            section.explanation.clone(),
        ]);
        for example in &section.examples {
            lines.push(
                example
                    .text
                    .lines()
                    .map(|line| format!("> {line}"))
                    .collect::<Vec<_>>()
                    .join("\n"),
            );
            lines.extend([example.meaning.clone(), example.note.clone()]);
        }
    }
    if let super::authoring::Disposition::Supplement { text, .. } = &guide.varieties[variety] {
        lines.push(text.clone());
    }
    lines.join("\n\n") + "\n"
}
