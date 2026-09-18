//! Starts capture selected direction atomically, without manufacturing learner evidence.
use crate::configuration::Registry;
use crate::{conversations::direction::*, model::*};
use rusqlite::{Connection, OptionalExtension, params};
pub(crate) fn selected(db: &Connection, conversation: &str) -> Result<Option<Opening>> {
    let raw: Option<String> = db
        .query_row(
            "SELECT opening FROM conversation_openings WHERE conversation_id=?1",
            [conversation],
            |r| r.get(0),
        )
        .optional()?;
    raw.map(|s| serde_json::from_str(&s).map_err(Into::into))
        .transpose()
}
pub(crate) fn band(difficulty: &Difficulty) -> &'static str {
    match difficulty {
        Difficulty::AbsoluteZero => "PreA1",
        Difficulty::Beginner => "A1",
        Difficulty::Intermediate => "B1",
        Difficulty::Advanced => "B2",
        Difficulty::Fluent => "C1",
    }
}
pub(crate) fn choices(registry: &Registry, locale: &str) -> Result<Vec<TopicCard>> {
    registry
        .topics()
        .iter()
        .map(|t| {
            Ok(TopicCard {
                id: t.id.clone(),
                label: t
                    .labels
                    .get(locale)
                    .ok_or_else(|| AppError::new(ErrorCode::Validation, "Topic label is missing."))?
                    .clone(),
            })
        })
        .collect()
}
pub(crate) fn accept(
    db: &Connection,
    snapshot: &Snapshot,
    registry: &Registry,
    conversation: &str,
    configuration: ConversationStartConfig,
    learner_message: Option<(String, crate::learning::coaching::InputEvidence)>,
    expected: i32,
) -> Result<String> {
    if snapshot.revision != expected {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "The conversation changed. Review it before starting.",
        ));
    }
    let occupied:bool=db.query_row("SELECT EXISTS(SELECT 1 FROM turns WHERE conversation_id=?1 AND (state='pending' OR EXISTS(SELECT 1 FROM operations WHERE turn_id=turns.id AND kind IN ('persona_reply','persona_opening'))))",[conversation],|r|r.get(0))?;
    if occupied || selected(db, conversation)?.is_some() {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "This conversation has already started.",
        ));
    }
    let mut captured = snapshot.clone();
    let current = captured
        .conversations
        .iter_mut()
        .find(|c| c.id == conversation)
        .ok_or_else(|| AppError::new(ErrorCode::NotFound, "Conversation not found."))?;
    current.settings = settings(
        registry,
        &current.language_id,
        &current.settings,
        &configuration,
    )?;
    db.execute(
        "UPDATE conversation_settings SET settings=?2,revision=revision+1 WHERE conversation_id=?1",
        params![conversation, serde_json::to_string(&current.settings)?],
    )?;
    current.settings_revision += 1;
    let revision = current.revision;
    let opening = if learner_message.is_some() {
        Opening::Learner
    } else {
        Opening::Partner
    };
    let turn = if let Some((text, input)) = learner_message {
        let turn = crate::conversations::execution::accept_send(
            db,
            registry,
            &captured,
            conversation,
            &text,
            revision,
        )?;
        if !matches!(input.modality.as_str(), "text" | "speech_transcript") {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Invalid input modality.",
            ));
        }
        db.execute(
            "UPDATE turns SET context=json_set(context,'$.input',json(?2)) WHERE id=?1",
            params![turn, serde_json::to_string(&input)?],
        )?;
        turn
    } else {
        crate::conversations::execution::accept_opening(
            db,
            registry,
            &captured,
            conversation,
            "Begin the conversation.",
            &opening,
        )?
    };
    db.execute(
        "INSERT INTO conversation_openings(conversation_id,opening,turn_id) VALUES(?1,?2,?3)",
        params![conversation, serde_json::to_string(&opening)?, turn],
    )?;
    Ok(turn)
}
