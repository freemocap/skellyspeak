//! Source-bound, explicitly requested help. Store commands own the transaction.
use super::*;
use crate::learning::coaching::conversation_support::ReplyHelpKind;

fn source(db: &Connection, message: &str) -> Result<(String, String)> {
    db.query_row("SELECT m.turn_id,m.conversation_id FROM messages m JOIN turns t ON t.id=m.turn_id JOIN conversations c ON c.id=m.conversation_id JOIN contacts contact ON contact.id=c.contact_id WHERE m.id=?1 AND m.role='assistant' AND c.archived=0 AND contact.archived=0 AND t.state NOT IN ('cancelled','invalidated') AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id)", [message], |r| Ok((r.get(0)?,r.get(1)?))).optional()?.ok_or_else(|| fail("Reply help requires an available partner message."))
}

fn request(db: &Connection, message: &str, kind: ReplyHelpKind) -> Result<(String, String)> {
    let (turn, conversation) = source(db, message)?;
    if let Some(operation) = db
        .query_row(
            "SELECT id FROM operations WHERE turn_id=?1 AND kind=?2",
            params![turn, kind.operation()],
            |r| r.get::<_, String>(0),
        )
        .optional()?
    {
        return Ok((conversation, operation));
    }
    if !super::graph::dependencies_succeeded(db, &turn, kind.operation())? {
        return Err(fail("Reply help requires its declared source result."));
    }
    admit_network_work(db, 1)?;
    let operation = id();
    db.execute(
        "INSERT INTO operations(id,turn_id,kind,state) VALUES(?1,?2,?3,'ready')",
        params![operation, turn, kind.operation()],
    )?;
    connections::bind_retry(db, &turn, Some(&operation))?;
    refresh_turn(db, &turn)?;
    Ok((conversation, operation))
}

pub fn request_suggestions(db: &Connection, message: &str) -> Result<(String, String)> {
    request(db, message, ReplyHelpKind::Replies)
}
pub fn request_explanations(db: &Connection, message: &str) -> Result<(String, String)> {
    request(db, message, ReplyHelpKind::Grammar)
}
pub fn retry_reply_help(
    db: &Connection,
    message: &str,
    kind: ReplyHelpKind,
) -> Result<(String, String)> {
    let (turn, conversation) = source(db, message)?;
    let (operation, state): (String, String) = db
        .query_row(
            "SELECT id,state FROM operations WHERE turn_id=?1 AND kind=?2",
            params![turn, kind.operation()],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| fail("Request this help before retrying it."))?;
    if matches!(state.as_str(), "ready" | "running" | "waiting_dependencies") {
        return Ok((conversation, operation));
    }
    if !matches!(state.as_str(), "failed" | "unknown") {
        return Err(fail("Only failed or unknown reply help can be retried."));
    }
    if !super::graph::dependencies_succeeded(db, &turn, kind.operation())? {
        return Err(fail("Reply help requires its declared source result."));
    }
    admit_network_work(db, 1)?;
    connections::bind_retry(db, &turn, Some(&operation))?;
    db.execute(
        "UPDATE operations SET state='ready',permit=0 WHERE id=?1",
        [&operation],
    )?;
    db.execute(
        "UPDATE turns SET context=json_remove(context,?2) WHERE id=?1",
        params![turn, format!("$.{}Error", kind.operation())],
    )?;
    refresh_turn(db, &turn)?;
    Ok((conversation, operation))
}
