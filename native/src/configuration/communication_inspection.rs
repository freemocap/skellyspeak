//! Readable authoring inspection, separate from the learner UI and runtime scoring.
use super::{Registry, Result, error};

impl Registry {
    pub fn communication_markdown(
        &self,
        language: &str,
        variety: &str,
        explanation: &str,
        group_id: &str,
    ) -> Result<String> {
        self.resolve_pair(language, Some(variety), explanation, None)?;
        let prompt = self.skill_prompt(language, variety, group_id)?;
        let stem = group_id.replace('_', "-");
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
        let mut lines = vec![
            format!("# {} — authored guide specimen", shared.title),
            "Status: authored content for review; this is not a learner assessment.".into(),
            format!("Target: {language} / {variety}. Explanation language: {explanation}."),
            format!("Shared introduction, headings and concepts: `content/{}`. Revision: `{}`.", guide.shared_explanation, shared.revision),
            format!("Language explanations, examples and variety details: `content/{path}`. Revision: `{}`. Review: `{}`.", guide.revision, guide.provenance.review.status),
            format!("Assessment guidance: `content/languages/{language}/skills/{stem}/{language}-{stem}-assessment.yaml`."),
            format!("Definition: `content/skills/{stem}/{stem}-definition.yaml`. Subskill order: `content/skills/{stem}/{stem}-subskills.yaml`."),
            "Sections are joined by subskill_id in the authored subskill order. Assessment guidance is assembled separately from learner-facing explanations.".into(),
            format!("Authorship: {}", guide.provenance.authorship),
            "## Learner guide".into(),
        ];
        lines.push(self.skill_guide_markdown(language, variety, explanation, group_id)?);
        lines.extend([
            "## Assessment input".into(),
            "This is the saved material included in the group question. Learner messages go in the request's separate `state` object; the instructions below refer to its named fields.".into(),
            self.assessment_instructions.instructions.clone(),
            format!("### {}", prompt.name),
            prompt.overview.clone(),
            format!("Boundary: {}", prompt.boundary),
            prompt.language_guidance.clone(),
            self.assessment_instructions.question.clone(),
            "### Choice criteria".into(),
        ]);
        for (name, criterion) in &self.assessment_instructions.criteria {
            lines.push(format!("- **{name}:** {criterion}"));
        }
        lines.extend([
            "### Native credit policy".into(),
            format!("Initial rule: a direct/contextual choice and combined direct/contextual probability of at least {}. This is a decision threshold, not a proficiency percentage. XP belongs to the main group, not its teaching subskills.", self.assessment_instructions.attribution.minimum_positive_probability),
            "## Source scope".into(),
            "These references support selected content; they do not certify every example. Human review remains outstanding.".into(),
            guide.provenance.sources.iter().map(|key| format!("[@{key}]")).collect::<Vec<_>>().join(" "),
        ]);
        Ok(lines.join("\n\n") + "\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn readable_specimen_preserves_examples_and_separates_assessment() {
        let registry = Registry::bundled().unwrap();
        let text = registry
            .communication_markdown("spanish", "spanish-spain", "english", "time_events")
            .unwrap();
        assert!(text.contains("> Ayer fui al mercado."));
        assert!(text.contains("Ayer yo ir al mercado"));
        assert!(text.contains("## Assessment input"));
        assert!(text.contains("needs_review"));
        assert!(
            registry
                .communication_markdown("spanish", "spanish-spain", "english", "past_events")
                .is_err()
        );
        assert!(
            registry
                .communication_markdown("spanish", "spanish-spain", "german", "time_events")
                .is_err()
        );
    }
}
