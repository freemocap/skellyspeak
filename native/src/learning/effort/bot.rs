//! Steering and deliberate inspection, independent of learning evidence.
use super::{EffortDimension, award};
use crate::model::Result;
use rusqlite::{Connection, params};

pub(crate) fn persona(db: &Connection, request: &crate::ai::generation::Request) -> Result<()> {
    award(
        db,
        EffortDimension::Bot,
        &format!("persona:{}", request.id),
        &request.language_context.language_id,
        &request.language_context.variety_id,
        None,
    )
}

pub(crate) fn steering(
    db: &Connection,
    conversation: &str,
    configuration: &crate::conversations::direction::ConversationStartConfig,
) -> Result<()> {
    use crate::conversations::direction::TopicChoice;
    if configuration.prompt_editor != Some(true)
        && !matches!(
            configuration.direction.topic,
            Some(TopicChoice::Builtin { .. } | TopicChoice::Custom { .. })
        )
    {
        return Ok(());
    }
    let language: String = db.query_row(
        "SELECT language_id FROM conversations WHERE id=?1",
        [conversation],
        |r| r.get(0),
    )?;
    award(
        db,
        EffortDimension::Bot,
        &format!("steering:{conversation}"),
        &language,
        &configuration.variety_id,
        Some(conversation),
    )
}

/// Only called after an explicitly selected attempt's details were displayed.
/// IDs resolve their own attribution; the caller never supplies a language or count.
pub(crate) fn inspect(db: &mut Connection, attempt: &str) -> Result<Option<super::EffortAward>> {
    let tx = db.transaction()?;
    let (conversation, language, variety, available): (String, String, String, bool) = tx.query_row(
        "SELECT t.conversation_id,c.language_id,json_extract(t.context,'$.practiceSettings.varietyId'),a.request_messages IS NOT NULL OR a.response_text IS NOT NULL OR a.preview_text IS NOT NULL FROM attempts a JOIN operations o ON o.id=a.operation_id JOIN turns t ON t.id=o.turn_id JOIN conversations c ON c.id=t.conversation_id WHERE a.id=?1",
        [attempt], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)))?;
    let mut earned = None;
    if available {
        award(
            &tx,
            EffortDimension::Bot,
            &format!("inspection:{attempt}"),
            &language,
            &variety,
            Some(&conversation),
        )?;
        // Refresh other windows through the existing revision polling path.
        if tx.changes() != 0 {
            earned = super::read_scoped(&tx, &language, Some(&conversation))?
                .recent
                .into_iter()
                .find(|item| item.source_id == format!("inspection:{attempt}"));
            tx.execute("UPDATE metadata SET revision=revision+1", params![])?;
        }
    }
    tx.commit()?;
    Ok(earned)
}

#[tauri::command]
pub(crate) fn record_bot_inspection(
    state: tauri::State<'_, std::sync::Arc<crate::application::Application>>,
    attempt_id: String,
) -> Result<Option<super::EffortAward>> {
    inspect(&mut state.lock()?.connection, &attempt_id)
}
