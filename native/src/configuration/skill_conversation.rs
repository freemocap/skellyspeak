//! Bounded teaching context for learner-selected conversation targets.
use super::*;
use crate::conversations::direction::TopicChoice;

impl Registry {
    pub(crate) fn skill_conversation_focus(
        &self,
        language: &str,
        settings: &model::PracticeSettings,
    ) -> model::Result<Option<String>> {
        let Some(TopicChoice::Skill {
            skill_id,
            subskill_id,
        }) = &settings.direction.topic
        else {
            return Ok(None);
        };
        self.resolve_pair(
            language,
            Some(&settings.variety_id),
            language,
            Some(&settings.variety_id),
        )?;
        let definition = self.skill_definition(skill_id)?;
        let edition = self.guide_source(language, skill_id)?;
        let mut sections = Vec::new();
        for section in edition.guide.sections_for(&settings.variety_id) {
            if subskill_id
                .as_ref()
                .is_some_and(|id| id != &section.subskill_id)
            {
                continue;
            }
            let concept = edition
                .shared
                .sections
                .iter()
                .find(|c| c.subskill_id == section.subskill_id)
                .expect("validated guide concept");
            sections.push(format!(
                "### {}\n{}\n{}",
                concept.title, concept.concept, section.explanation
            ));
        }
        if sections.is_empty() {
            return Err(model::AppError::new(
                model::ErrorCode::Validation,
                "The subskill does not belong to the selected skill.",
            ));
        }
        if let authoring::Disposition::Supplement { text, .. } =
            &edition.guide.varieties[&settings.variety_id]
        {
            sections.push(text.clone());
        }
        let block = format!(
            "## Practice focus\n{}\n\n### {}\n{}\n\n{}\n\nSource: {} (revision {})",
            self.conversation_prompt().coach_focus,
            definition.name,
            definition.purpose,
            sections.join("\n\n"),
            edition.paths.join(", "),
            edition.guide.revision
        );
        if block.len() > 16000 {
            return Err(model::AppError::new(
                model::ErrorCode::Validation,
                "The selected skill guidance exceeds the 16 KB conversation budget.",
            ));
        }
        Ok(Some(block))
    }
}
