//! Transactional self-repair. Retain exact predecessor wording, remove only the
//! dependent later suffix, and never reuse a superseded operation's authority.
use crate::{coaching::InputEvidence, model::*};
use rusqlite::{Connection, OptionalExtension, params};

pub(crate) fn suffix_counts(
    db: &Connection,
    conversation: &str,
    messages: &[ChatMessage],
) -> Result<Vec<RevisionSuffixCount>> {
    let targets: Vec<&str> = messages
        .iter()
        .filter(|m| m.role == "user" && m.replaced_by.is_none())
        .map(|m| m.turn_id.as_str())
        .collect();
    // One ordered scan computes suffix totals; only the bounded visible page is returned.
    Ok(db.prepare("WITH active AS (SELECT t.id,t.rowid AS ordering,EXISTS(SELECT 1 FROM operations WHERE turn_id=t.id AND kind='persona_reply') AS exchange,EXISTS(SELECT 1 FROM operations WHERE turn_id=t.id AND kind='coach_reply') AS coach FROM turns t WHERE conversation_id=?1 AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id)), counts AS (SELECT id,exchange,coalesce(sum(exchange) OVER (ORDER BY ordering ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING),0) AS exchanges,coalesce(sum(coach) OVER (ORDER BY ordering ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING),0) AS coaches FROM active) SELECT id,exchanges,coaches FROM counts WHERE exchange AND id IN (SELECT value FROM json_each(?2))")?.query_map(params![conversation,serde_json::to_string(&targets)?], |r| Ok(RevisionSuffixCount { turn_id:r.get(0)?, exchange_count:r.get(1)?, coach_turn_count:r.get(2)? }))?.collect::<rusqlite::Result<Vec<_>>>()?)
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn accept(
    db: &Connection,
    snapshot: &Snapshot,
    conversation: &str,
    turn: &str,
    text: &str,
    mut input: InputEvidence,
    expected: i32,
) -> Result<String> {
    if snapshot.revision != expected {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Conversation history changed. Review the revision again.",
        ));
    }
    let order: Option<i64> = db.query_row("SELECT rowid FROM turns t WHERE id=?1 AND conversation_id=?2 AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id) AND EXISTS(SELECT 1 FROM operations WHERE turn_id=t.id AND kind='persona_reply')", params![turn,conversation], |r| r.get(0)).optional()?;
    let order = order.ok_or_else(|| {
        AppError::new(
            ErrorCode::Conflict,
            "Only the current version of a conversation exchange can be revised.",
        )
    })?;
    if db.query_row(
        "SELECT EXISTS(SELECT 1 FROM turns WHERE conversation_id=?1 AND state='pending')",
        [conversation],
        |r| r.get::<_, bool>(0),
    )? {
        return Err(AppError::new(
            ErrorCode::PendingTurn,
            "Wait for or cancel the pending reply before revising.",
        ));
    }
    if !matches!(input.modality.as_str(), "text" | "speech_transcript") {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Invalid input modality.",
        ));
    }
    // Mark attempts first: a late provider result cannot publish. Suffix deletion cascades through messages, operations and attempts.
    db.execute("UPDATE attempts SET state='invalidated',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),error='Source revised.' WHERE state='running' AND operation_id IN (SELECT id FROM operations WHERE turn_id=?1)", [turn])?;
    db.execute("UPDATE operations SET state='invalidated',permit=0 WHERE turn_id=?1 AND state IN ('ready','running','waiting_dependencies','unknown','failed')", [turn])?;
    db.execute("UPDATE turns SET state='invalidated' WHERE id=?1", [turn])?;
    // Action receipts contain submitted text too; suffix removal must remove
    // those source-owned copies, not merely their visible messages.
    db.execute("DELETE FROM receipts WHERE conversation_id=?1 AND (json_extract(receipt,'$.entityId') IN (SELECT id FROM turns WHERE conversation_id=?1 AND rowid>?2) OR json_extract(request,'$.turnId') IN (SELECT id FROM turns WHERE conversation_id=?1 AND rowid>?2))",params![conversation,order])?;
    // Exclusions are choices about retained observations. Remove only references
    // whose evidence is deleted with this suffix; keep predecessor exclusions.
    db.execute("UPDATE skill_choices SET excluded=(SELECT coalesce(json_group_array(value),'[]') FROM json_each(skill_choices.excluded) WHERE value NOT IN (SELECT coalesce(json_extract(context,'$.coachFeedbackAttempt'),id) FROM turns WHERE conversation_id=?1 AND rowid>?2)),revision=revision+1 WHERE language_id=(SELECT language_id FROM conversations WHERE id=?1) AND EXISTS(SELECT 1 FROM json_each(skill_choices.excluded) WHERE value IN (SELECT coalesce(json_extract(context,'$.coachFeedbackAttempt'),id) FROM turns WHERE conversation_id=?1 AND rowid>?2))",params![conversation,order])?;
    db.execute(
        "DELETE FROM turns WHERE conversation_id=?1 AND rowid>?2",
        params![conversation, order],
    )?;
    let current = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .ok_or_else(|| AppError::new(ErrorCode::NotFound, "Conversation no longer exists."))?;
    let replacement = crate::execution::accept_revision_send(
        db,
        snapshot,
        conversation,
        text,
        current.revision,
        turn,
    )?;
    input.revision = true;
    db.execute("UPDATE turns SET replaces_turn_id=?2,context=json_set(context,'$.input',json(?3)) WHERE id=?1", params![replacement,turn,serde_json::to_string(&input)?])?;
    Ok(replacement)
}
