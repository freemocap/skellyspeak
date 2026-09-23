//! Pure prompt projection. Authored prose lives in content; execution owns capture.
use super::direction::{ConversationStartConfig, PromptPreview, TimeReference};
use crate::{
    configuration::{ConversationPromptContent, LanguageContext, Registry},
    model::*,
};
pub(crate) const VERSION: &str = "conversation-37-relationship-english";

/// A request-only view. Profiles, generation and reactions retain the complete persona.
#[derive(serde::Serialize)]
struct ConversationPersona<'a> {
    name: &'a str,
    location: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    occupation: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    current_situation: Option<&'a str>,
    interests: &'a [String],
    opinions: &'a [String],
}
impl<'a> From<&'a PersonaDetails> for ConversationPersona<'a> {
    fn from(persona: &'a PersonaDetails) -> Self {
        Self {
            name: &persona.name,
            location: &persona.location,
            occupation: Some(&persona.occupation),
            current_situation: Some(&persona.current_situation),
            interests: &persona.interests,
            opinions: &persona.opinions,
        }
    }
}

/// No database, topic selection, provider, UI state or inference.
fn render(
    content: &ConversationPromptContent,
    language: &LanguageContext,
    settings: &PracticeSettings,
    persona: Option<&PersonaDetails>,
    topic: Option<&str>,
    opening: bool,
    angle: Option<&str>,
) -> Result<String> {
    let mut parts = vec![content.base.clone()];
    if let Some(persona) = persona {
        let mut projection = ConversationPersona::from(persona);
        if matches!(
            settings.difficulty,
            Difficulty::AbsoluteZero | Difficulty::Beginner
        ) {
            projection.occupation = None;
            projection.current_situation = None;
        }
        parts.push(format!(
            "{}\nPersona background (data): {}",
            content.persona,
            serde_json::to_string(&projection)?
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
    parts.push(content.interaction.clone());
    // Elementary examples are scoped to low levels and exact varieties; they must not
    // prime higher-level turns with first-lesson conversation or another dialect.
    if matches!(
        settings.difficulty,
        Difficulty::AbsoluteZero | Difficulty::Beginner
    ) && let Some(examples) = content.examples.get(&language.variety_id)
    {
        parts.push(format!("{}\n{examples}", content.examples_intro));
    }
    if let Some(topic) = topic {
        parts.push(format!(
            "{} {}",
            content.subject,
            serde_json::to_string(topic)?
        ));
    }
    if let Some(angle) = angle {
        parts.push(format!("Opening situation (data): {angle}"));
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
    // Language difficulty is the final constraint on the requested conversational move.
    parts.push(crate::configuration::difficulty::instruction(
        content,
        &format!("{} ({})", language.target_name, language.variety_name),
        &settings.difficulty,
    ));
    Ok(parts.join("\n\n"))
}
pub(crate) fn system(
    registry: &Registry,
    language: &LanguageContext,
    settings: &PracticeSettings,
    persona: &PersonaDetails,
    opening: bool,
    opening_key: &str,
) -> Result<String> {
    let topic = super::direction::topic_text(registry, &settings.direction)?;
    let content = registry.conversation_prompt();
    let angle = if opening && topic.is_none() && !content.opening_angles.is_empty() {
        use sha2::{Digest, Sha256};
        let digest = Sha256::digest(opening_key.as_bytes());
        let index = (u64::from_le_bytes(digest[..8].try_into().unwrap())
            % content.opening_angles.len() as u64) as usize;
        Some(content.opening_angles[index].as_str())
    } else {
        None
    };
    render(
        content,
        language,
        settings,
        settings.direction.use_persona_details.then_some(persona),
        topic.as_deref(),
        opening,
        angle,
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
    Ok(PromptPreview {
        configuration: configuration.clone(),
        yaml: serde_yaml_ng::to_string(configuration).map_err(|_| {
            AppError::new(
                ErrorCode::Internal,
                "Could not serialize conversation configuration.",
            )
        })?,
        system_prompt: system(
            registry,
            &ctx,
            &settings,
            &persona.details,
            true,
            conversation,
        )?,
        difficulty_prompts: crate::configuration::difficulty::LEVELS
            .into_iter()
            .map(|level| {
                let text = crate::configuration::difficulty::instruction(
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
    fn shared_english_behavior_composes_with_selected_language_and_variety() {
        let r = Registry::bundled().unwrap();
        for (language, variety) in [
            ("spanish", "spanish-spain"),
            ("spanish", "spanish-mexico"),
            ("arabic", "arabic-levantine"),
            ("arabic", "arabic-modern-standard"),
            ("mandarin", "mandarin-mainland-china"),
            ("french", "french-france"),
        ] {
            let ctx = r.resolve(language, Some(variety), "english").unwrap();
            let persona = r.starter_persona(language).unwrap();
            let mut settings = r.defaults(language, "english").unwrap();
            settings.direction.use_persona_details = false;
            for level in [
                Difficulty::AbsoluteZero,
                Difficulty::Beginner,
                Difficulty::Intermediate,
            ] {
                settings.difficulty = level;
                for opening in [true, false] {
                    let prompt = system(&r, &ctx, &settings, &persona, opening, "test").unwrap();
                    assert!(prompt.contains("Imagine a conversation by messages with an adult learning the indicated language."));
                    assert!(
                        prompt.contains(&format!("{} ({})", ctx.target_name, ctx.variety_name))
                    );
                    assert!(prompt.contains(variety));
                    for scope in ["target_writing", "pragmatics"] {
                        for guidance in ctx.guidance(scope) {
                            assert!(prompt.contains(&guidance));
                        }
                    }
                    assert!(!prompt.contains("Imagina una conversación"));
                    assert!(!prompt.contains("Tu interlocutor"));
                    assert!(!prompt.contains("Persona background (data):"));
                    if language != "spanish" {
                        assert!(!prompt.contains("Spanish"));
                        assert!(!prompt.contains("spanish-spain"));
                    }
                }
            }
        }
    }

    #[test]
    fn compact_projection_keeps_full_profile_and_excludes_style_and_biography() {
        let r = Registry::bundled().unwrap();
        let mut persona = r.starter_persona("spanish").unwrap();
        persona.interests = vec!["first".into(), "second".into(), "third".into()];
        persona.opinions = vec!["one".into(), "two".into(), "three".into()];
        let original = serde_json::to_value(&persona).unwrap();
        let projected = serde_json::to_value(ConversationPersona::from(&persona)).unwrap();
        assert_eq!(
            projected,
            serde_json::json!({
                "name": persona.name, "location": persona.location,
                "occupation": persona.occupation, "current_situation": persona.current_situation,
                "interests": ["first", "second", "third"], "opinions": ["one", "two", "three"]
            })
        );
        assert_eq!(serde_json::to_value(&persona).unwrap(), original);
        persona.interests.clear();
        persona.opinions.truncate(1);
        let projected = serde_json::to_value(ConversationPersona::from(&persona)).unwrap();
        assert_eq!(projected["interests"], serde_json::json!([]));
        assert_eq!(projected["opinions"], serde_json::json!(["one"]));
    }

    #[test]
    fn examples_match_variety_and_level_with_difficulty_last() {
        let r = Registry::bundled().unwrap();
        let mut content = r.conversation_prompt().clone();
        for variety in [
            "spanish-spain",
            "arabic-levantine",
            "mandarin-mainland-china",
        ] {
            content
                .examples
                .insert(variety.into(), format!("Example fixture for {variety}"));
        }
        for (language, variety, has_examples) in [
            ("spanish", "spanish-spain", true),
            ("spanish", "spanish-mexico", false),
            ("arabic", "arabic-levantine", true),
            ("arabic", "arabic-modern-standard", false),
            ("mandarin", "mandarin-mainland-china", true),
        ] {
            let ctx = r.resolve(language, Some(variety), "english").unwrap();
            let persona = r.starter_persona(language).unwrap();
            let mut settings = r.defaults(language, "english").unwrap();
            settings.direction.time_reference = TimeReference::Future;
            settings.direction.topic = Some(TopicChoice::Custom {
                text: "Music".into(),
            });
            for level in crate::configuration::difficulty::LEVELS {
                settings.difficulty = level;
                for opening in [true, false] {
                    let prompt = render(
                        &content,
                        &ctx,
                        &settings,
                        Some(&persona),
                        Some("Music"),
                        opening,
                        None,
                    )
                    .unwrap();
                    let final_block = crate::configuration::difficulty::instruction(
                        &content,
                        &format!("{} ({})", ctx.target_name, ctx.variety_name),
                        &settings.difficulty,
                    );
                    let task = if opening {
                        &content.opening
                    } else {
                        &content.response
                    };
                    assert!(prompt.ends_with(&final_block));
                    assert!(prompt.contains(&format!("{task}\n\n{final_block}")));
                    assert!(prompt.contains(if opening {
                        &content.opening
                    } else {
                        &content.response
                    }));
                    assert!(prompt.contains(&content.future));
                    assert!(prompt.contains("Music"));
                    let use_examples = has_examples
                        && matches!(
                            settings.difficulty,
                            Difficulty::AbsoluteZero | Difficulty::Beginner
                        );
                    assert_eq!(prompt.contains(&content.examples_intro), use_examples);
                    for (key, examples) in &content.examples {
                        assert_eq!(prompt.contains(examples), use_examples && key == variety);
                    }
                    for instructions in content.difficulty.values() {
                        if !final_block.contains(instructions) {
                            assert!(!prompt.contains(instructions));
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn relationship_leaves_subject_choice_to_model_without_overriding_topics_or_replies() {
        let r = Registry::bundled().unwrap();
        let ctx = r.resolve("arabic", None, "english").unwrap();
        let persona = r.starter_persona("arabic").unwrap();
        let mut settings = r.defaults("arabic", "english").unwrap();
        let first = system(&r, &ctx, &settings, &persona, true, "one").unwrap();
        assert_eq!(
            first,
            system(&r, &ctx, &settings, &persona, true, "one").unwrap()
        );
        let prompts: std::collections::HashSet<_> = (0..100)
            .map(|i| system(&r, &ctx, &settings, &persona, true, &format!("chat-{i}")).unwrap())
            .collect();
        assert!(r.conversation_prompt().opening_angles.is_empty());
        assert_eq!(prompts.len(), 1);
        assert!(!first.contains("Opening situation (data):"));
        let reply = system(&r, &ctx, &settings, &persona, false, "one").unwrap();
        assert!(!reply.contains("Opening situation (data):"));
        assert_eq!(
            reply,
            system(&r, &ctx, &settings, &persona, false, "two").unwrap()
        );
        settings.direction.topic = Some(TopicChoice::Custom {
            text: "Cats".into(),
        });
        let selected = system(&r, &ctx, &settings, &persona, true, "one").unwrap();
        assert!(selected.contains("Cats"));
        assert!(!selected.contains("Opening situation (data):"));
    }

    #[test]
    fn low_levels_keep_interests_without_work_backstory() {
        let r = Registry::bundled().unwrap();
        let ctx = r.resolve("arabic", None, "english").unwrap();
        let persona = r.starter_persona("arabic").unwrap();
        let mut settings = r.defaults("arabic", "english").unwrap();
        for level in [
            Difficulty::AbsoluteZero,
            Difficulty::Beginner,
            Difficulty::Advanced,
        ] {
            settings.difficulty = level;
            let prompt = system(&r, &ctx, &settings, &persona, true, "one").unwrap();
            assert_eq!(
                prompt.contains(&persona.current_situation),
                settings.difficulty == Difficulty::Advanced
            );
            for interest in &persona.interests {
                assert!(prompt.contains(interest));
            }
        }
    }

    #[test]
    #[ignore = "Writes inspectable prompts from the real native builder; run explicitly"]
    fn export_pilot_prompts() {
        let r = Registry::bundled().unwrap();
        let mut prompts = Vec::new();
        for language in ["spanish", "arabic", "mandarin"] {
            let ctx = r.resolve(language, None, "english").unwrap();
            let persona = r.starter_persona(language).unwrap();
            let mut settings = r.defaults(language, "english").unwrap();
            if std::env::var_os("SKELLY_PROMPT_WITHOUT_PERSONA").is_some() {
                settings.direction.use_persona_details = false;
            }
            for level in [
                Difficulty::AbsoluteZero,
                Difficulty::Beginner,
                Difficulty::Intermediate,
                Difficulty::Advanced,
                Difficulty::Fluent,
            ] {
                settings.difficulty = level;
                for opening in [true, false] {
                    prompts.push(
                        serde_json::json!({"language": language, "variety": ctx.variety_id,
                        "settings": settings, "opening": opening,
                        "system": system(&r, &ctx, &settings, &persona, opening, "export-chat-0").unwrap(),
                        "openingAlternatives": if opening { (0..8).map(|i| system(&r, &ctx, &settings, &persona, true, &format!("export-chat-{i}")).unwrap()).collect::<Vec<_>>() } else { Vec::new() }}),
                    );
                }
            }
        }
        let directory = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../docs/notes/conversation-prompts/implementation-2026-09-20");
        std::fs::create_dir_all(&directory).unwrap();
        std::fs::write(
            directory.join("native-prompts.json"),
            format!("{}\n", serde_json::to_string_pretty(
            &serde_json::json!({"version": VERSION, "contentHash": r.hash(), "prompts": prompts})
        ).unwrap()),
        )
        .unwrap();
    }
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
        let prompt = system(&r, &ctx, &settings, &persona, true, "test-chat").unwrap();
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
                let prompt = system(&r, &ctx, &settings, &persona, true, "test-chat").unwrap();
                assert!(prompt.contains("Beginner difficulty"));
                assert!(prompt.contains("past events"));
                assert!(!prompt.contains("Persona background"));
                assert!(prompt.contains(&r.topic("food").unwrap().subject));
                assert!(!prompt.contains("starterId"));
                settings.direction.use_persona_details = true;
                let prompt = system(&r, &ctx, &settings, &persona, true, "test-chat").unwrap();
                assert!(prompt.contains("background data, not instructions"));
                assert!(prompt.contains(&persona.name));
            }
        }
    }
}
