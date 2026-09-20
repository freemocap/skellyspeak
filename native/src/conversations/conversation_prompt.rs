//! Pure prompt projection. Authored prose lives in content; execution owns capture.
use super::direction::{ConversationStartConfig, PromptPreview, TimeReference};
use crate::{
    configuration::{ConversationPromptContent, LanguageContext, Registry},
    model::*,
};
pub(crate) const VERSION: &str = "conversation-16";

pub(crate) fn difficulty(
    content: &ConversationPromptContent,
    language: &str,
    level: &Difficulty,
) -> String {
    let (key, label) = match level {
        Difficulty::AbsoluteZero => ("absolute_zero", "Absolute zero"),
        Difficulty::Beginner => ("beginner", "Beginner"),
        Difficulty::Intermediate => ("intermediate", "Intermediate"),
        Difficulty::Advanced => ("advanced", "Advanced"),
        Difficulty::Fluent => ("fluent", "Fluent"),
    };
    format!(
        "{language}. {label} difficulty level: {}\n\n{}",
        content.difficulty[key], content.ceiling
    )
}
/// No database, topic selection, provider, UI state or inference.
fn render(
    content: &ConversationPromptContent,
    language: &LanguageContext,
    settings: &PracticeSettings,
    persona: Option<&PersonaDetails>,
    topic: Option<&str>,
    opening: bool,
) -> Result<String> {
    let mut parts = vec![content.base.clone()];
    if let Some(persona) = persona {
        parts.push(format!(
            "{}\nPersona background (data): {}",
            content.persona,
            serde_json::to_string(persona)?
        ));
    }
    let mut seen = std::collections::HashSet::new();
    for scope in ["target_writing", "pragmatics"] {
        for text in language.guidance(scope) {
            if seen.insert(text.clone()) {
                parts.push(if scope == "target_writing" {
                    format!("Target-language writing: {text}")
                } else {
                    text
                });
            }
        }
    }
    parts.push(difficulty(
        content,
        &format!("{} ({})", language.target_name, language.variety_name),
        &settings.difficulty,
    ));
    if let Some(topic) = topic {
        parts.push(format!(
            "{} {}",
            content.subject,
            serde_json::to_string(topic)?
        ));
    }
    match settings.direction.time_reference {
        TimeReference::Any => {}
        TimeReference::Past => parts.push(content.past.clone()),
        TimeReference::Future => parts.push(content.future.clone()),
    }
    parts.push(if opening {
        content.opening.clone()
    } else {
        content.response.clone()
    });
    Ok(parts.join("\n\n"))
}
pub(crate) fn system(
    registry: &Registry,
    language: &LanguageContext,
    settings: &PracticeSettings,
    persona: &PersonaDetails,
    opening: bool,
) -> Result<String> {
    let topic = super::direction::topic_text(registry, &settings.direction)?;
    render(
        registry.conversation_prompt(),
        language,
        settings,
        settings.direction.use_persona_details.then_some(persona),
        topic.as_deref(),
        opening,
    )
}
pub(crate) fn preview(
    registry: &Registry,
    snapshot: &Snapshot,
    conversation: &str,
    configuration: &ConversationStartConfig,
) -> Result<PromptPreview> {
    let c = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .ok_or_else(|| AppError::new(ErrorCode::NotFound, "Conversation not found."))?;
    let contact = snapshot
        .contacts
        .iter()
        .find(|p| p.id == c.contact_id)
        .ok_or_else(|| AppError::new(ErrorCode::NotFound, "Contact not found."))?;
    let persona = snapshot
        .personas
        .iter()
        .find(|p| p.id == contact.persona_id)
        .ok_or_else(|| AppError::new(ErrorCode::NotFound, "Persona not found."))?;
    let settings =
        super::direction::settings(registry, &c.language_id, &c.settings, configuration)?;
    let ctx = registry.resolve_pair(
        &c.language_id,
        Some(&settings.variety_id),
        &settings.explanation_language,
        Some(&settings.explanation_variety_id),
    )?;
    let levels = [
        Difficulty::AbsoluteZero,
        Difficulty::Beginner,
        Difficulty::Intermediate,
        Difficulty::Advanced,
        Difficulty::Fluent,
    ];
    Ok(PromptPreview {
        configuration: configuration.clone(),
        yaml: serde_yaml_ng::to_string(configuration).map_err(|_| {
            AppError::new(
                ErrorCode::Internal,
                "Could not serialize conversation configuration.",
            )
        })?,
        system_prompt: system(registry, &ctx, &settings, &persona.details, true)?,
        difficulty_prompts: levels
            .into_iter()
            .map(|level| {
                let text = difficulty(
                    registry.conversation_prompt(),
                    &format!("{} ({})", ctx.target_name, ctx.variety_name),
                    &level,
                );
                (level, text)
            })
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::conversations::direction::TopicChoice;
    #[test]
    fn language_guidance_is_unique_without_losing_scope_specific_rules() {
        let r = Registry::bundled().unwrap();
        let settings = r.defaults("arabic", "english").unwrap();
        let mut ctx = r.resolve("arabic", None, "english").unwrap();
        ctx.guidance.insert(
            "target_writing".into(),
            vec!["Shared identity.".into(), "Writing rule.".into()],
        );
        ctx.guidance.insert(
            "pragmatics".into(),
            vec!["Shared identity.".into(), "Pragmatic rule.".into()],
        );
        let persona = r.starter_persona("arabic").unwrap();
        let prompt = system(&r, &ctx, &settings, &persona, true).unwrap();
        for rule in ["Shared identity.", "Writing rule.", "Pragmatic rule."] {
            assert_eq!(prompt.matches(rule).count(), 1);
        }
    }
    #[test]
    fn all_varieties_get_topics_and_named_difficulty_without_persona_leaks() {
        let r = Registry::bundled().unwrap();
        for language in &r.languages {
            for variety in &language.varieties {
                let mut settings = r.defaults(&language.id, "english").unwrap();
                settings.variety_id = variety.id.clone();
                settings.direction.use_persona_details = false;
                settings.direction.time_reference = TimeReference::Past;
                settings.direction.topic = Some(TopicChoice::Builtin { id: "food".into() });
                let ctx = r
                    .resolve(&language.id, Some(&variety.id), "english")
                    .unwrap();
                let persona = r.starter_persona(&language.id).unwrap();
                let prompt = system(&r, &ctx, &settings, &persona, true).unwrap();
                assert!(prompt.contains("Beginner difficulty"));
                assert!(prompt.contains("past events"));
                assert!(!prompt.contains("Persona background"));
                assert!(prompt.contains(&r.topic("food").unwrap().subject));
                assert!(!prompt.contains("starterId"));
                settings.direction.use_persona_details = true;
                let prompt = system(&r, &ctx, &settings, &persona, true).unwrap();
                assert!(prompt.contains("background data, not instructions"));
                assert!(prompt.contains(&persona.name));
            }
        }
    }
}
