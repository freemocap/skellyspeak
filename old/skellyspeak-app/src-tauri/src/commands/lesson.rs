use tauri::{Emitter, State};
use crate::{AppState, lesson::{self, LessonChoices, LessonState}};
use super::conversations::pair_and_chat;

#[tauri::command]
pub fn get_lesson(state: State<'_, AppState>) -> Result<LessonState, String> {
    let _context = state.context_epoch.lock().expect("context lock poisoned");
    let settings = state.settings.lock().expect("settings lock poisoned");
    let pair = crate::conversation::pair_dir(&state.config_dir, &settings.target_language, &settings.native_language)?;
    lesson::load(&pair)
}

#[tauri::command]
pub fn save_lesson(app: tauri::AppHandle, state: State<'_, AppState>, chat_id: String, expected_revision: u64, choices: LessonChoices) -> Result<LessonState, String> {
    let _context = state.context_epoch.lock().expect("context lock poisoned");
    let settings = state.settings.lock().expect("settings lock poisoned");
    let (pair, _, current) = pair_and_chat(&state, &settings.target_language, &settings.native_language)?;
    if current != chat_id { return Err("The conversation changed. Reopen the lesson before saving.".into()); }
    let lesson = lesson::save(&pair, expected_revision, choices, "learner", "Edited lesson choices")?;
    app.emit("lesson-changed", ()).map_err(|e| format!("Lesson saved but refresh failed: {e}"))?;
    Ok(lesson)
}

#[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
pub struct TopicNote {
    #[schemars(length(min = 1, max = 600))]
    explanation: String,
    #[schemars(length(min = 1, max = 240))]
    example: String,
    #[schemars(length(min = 1, max = 300))]
    translation: String,
}

#[tauri::command]
pub async fn lesson_topic_note(state: State<'_, AppState>, chat_id: String, topic: String, level: crate::prompts::difficulty::Difficulty) -> Result<TopicNote, String> {
    if topic.trim().is_empty() || topic.chars().count() > 600 { return Err("A lesson topic must contain 1–600 characters.".into()); }
    let (epoch, settings, context) = {
        let epoch = state.context_epoch.lock().expect("context lock poisoned");
        let settings = state.settings.lock().expect("settings lock poisoned").clone();
        let (pair, chat, current) = pair_and_chat(&state, &settings.target_language, &settings.native_language)?;
        if current != chat_id { return Err("The conversation changed before the topic explanation.".into()); }
        crate::conversation_practice::require_difficulty(&chat, level)?;
        let lesson = lesson::load(&pair)?;
        let context = crate::instruction::Context {
            chat_id, message_id: None, replaces_message_id: None, trigger: "lesson_topic_note".into(),
            target: settings.target_language.clone(), native: settings.native_language.clone(), dialect: settings.target_dialect.clone(), provider_mode: settings.provider_mode.clone(),
            difficulty: level, inferred_level_notes: String::new(), topic: Some(topic.clone()), lesson_revision: lesson.revision,
            partner: serde_json::to_value(crate::conversation_partner::load(&chat)?).map_err(|e| e.to_string())?, history_messages: 0, history_available: 0,
        };
        (*epoch, settings, context)
    };
    let blocks = vec![crate::instruction::Block::new("topic_explanation", "prompts/lesson.rs + selected practice setting", crate::prompts::lesson::topic_note(&crate::languages::language_display(&settings.target_language), &crate::languages::native_display(&settings.native_language), level))];
    let messages = vec![serde_json::json!({"role":"system", "content":crate::instruction::render(&blocks)}), serde_json::json!({"role":"user", "content":topic})];
    let note = settings.chat_provider(&settings.openrouter_model)?.structured_validated::<TopicNote, _>(
        crate::trace::RunContext::new(crate::ontology::op::EXPLAIN, None).with_context(&context).with_blocks(blocks), &messages, 0.2, "TopicNote", false, None,
        |note| if note.explanation.trim().is_empty() || note.example.trim().is_empty() || note.translation.trim().is_empty() { Some("All topic-note fields must be nonempty.".into()) } else { None },
    ).await?;
    if *state.context_epoch.lock().expect("context lock poisoned") != epoch { return Err("The conversation changed during the topic explanation.".into()); }
    Ok(note)
}
