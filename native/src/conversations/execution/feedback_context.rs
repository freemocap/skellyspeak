//! Explicit, source-bound reassessment. The command coordinator owns the transaction.
use super::*;

pub fn reassess_feedback(db: &Connection, turn: &str, note: &str) -> Result<String> {
    let note = note.trim();
    if note.is_empty() || note.chars().count() > 2000 || note.contains('\0') {
        return Err(fail("Context must contain 1–2000 characters."));
    }
    let (conversation, operation, state, paused): (String, String, String, bool) = db.query_row(
        "SELECT t.conversation_id,o.id,o.state,t.paused FROM turns t JOIN conversations c ON c.id=t.conversation_id JOIN contacts p ON p.id=c.contact_id JOIN operations o ON o.turn_id=t.id WHERE t.id=?1 AND o.kind IN ('coach_feedback','coach_retry_check') AND t.state NOT IN ('cancelled','invalidated') AND c.archived=0 AND p.archived=0 AND EXISTS(SELECT 1 FROM messages WHERE turn_id=t.id AND role='user') AND NOT EXISTS(SELECT 1 FROM turns WHERE replaces_turn_id=t.id)",
        [turn], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)),
    ).optional()?.ok_or_else(|| fail("Message assessment is unavailable."))?;
    if !matches!(state.as_str(), "succeeded" | "failed" | "unknown") {
        return Err(fail("Wait for the current assessment to finish."));
    }
    if !graph::dependencies_succeeded(db, turn, "coach_feedback")? {
        return Err(fail("Message context is not ready."));
    }
    admit_network_work(db, 1)?;
    connections::bind_retry(db, turn, Some(&operation))?;
    db.execute("UPDATE turns SET context=json_set(json_remove(context,'$.coachObservation','$.coachDecision','$.coach_feedbackError','$.coach_retry_checkError'),'$.feedbackContext',?2) WHERE id=?1", params![turn,note])?;
    db.execute(
        "UPDATE operations SET state='ready',permit=?2 WHERE id=?1",
        params![operation, paused],
    )?;
    refresh_turn(db, turn)?;
    Ok(conversation)
}
