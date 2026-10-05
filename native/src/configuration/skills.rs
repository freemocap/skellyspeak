//! Runtime skill projections. Authored definitions and assessments have one source owner.
use super::{Registry, Result, error, fingerprint};
use crate::learning::practice_assessment::{self, SkillPrompt};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub overview: String,
    pub boundary: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Catalog {
    pub skills: Vec<Skill>,
}

impl Registry {
    pub fn assessment_instructions(&self) -> &practice_assessment::Instructions {
        &self.assessment_instructions
    }
    pub fn message_assessment_questions(
        &self,
    ) -> Result<crate::learning::turn_assessment::MessageQuestions> {
        super::authoring::prompts::message_questions(&self.source_files)
    }
    pub fn shared_skills(&self) -> &Catalog {
        &self.skills
    }
    pub fn skills_for_language(&self, language: &str) -> Result<Vec<&Skill>> {
        self.language_config(language)?;
        Ok(self.skills.skills.iter().collect())
    }
    pub fn skill_prompt(&self, language: &str, variety: &str, id: &str) -> Result<SkillPrompt> {
        self.resolve_pair(language, Some(variety), language, Some(variety))?;
        let definition = self.skill_definition(id)?;
        let stem = id.replace('_', "-");
        let path = format!("languages/{language}/skills/{stem}/{language}-{stem}-assessment.yaml");
        let assessment = self.authored.assessments.get(&path).ok_or_else(|| {
            error(
                &path,
                "missing_skill_assessment",
                "Required authored assessment guidance is missing.",
            )
        })?;
        let local = assessment
            .varieties
            .get(variety)
            .ok_or_else(|| error(&path, "missing_skill_variety", variety))?;
        let supplement = match local {
            super::authoring::Disposition::UseCore { .. } => "",
            super::authoring::Disposition::Supplement { text, .. } => text,
        };
        Ok(SkillPrompt {
            id: id.into(),
            name: definition.name.clone(),
            overview: definition.purpose.clone(),
            boundary: definition.boundary.clone(),
            language_guidance: format!(
                "Language: {}\nVariety: {}\n\n{}\n\n{}",
                language, variety, assessment.guidance, supplement
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
        crate::learning::turn_assessment::request(
            state,
            &skills,
            &self.assessment_instructions,
            &self.message_assessment_questions()?,
        )
    }
    pub fn skill_content_hash(&self, language: &str, variety: &str) -> Result<String> {
        self.resolve_pair(language, Some(variety), language, Some(variety))?;
        Ok(fingerprint(&(
            &self.authored.definitions,
            self.authored
                .assessments
                .values()
                .filter(|d| d.language == language)
                .collect::<Vec<_>>(),
            variety,
            &self.assessment_instructions,
            self.message_assessment_questions()?,
        )))
    }
}

#[cfg(test)]
#[path = "skills_tests.rs"]
mod tests;
