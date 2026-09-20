use super::*;

pub(super) fn analysis_role(kind: &str) -> &'static str {
    if kind.starts_with("user_") {
        "user"
    } else {
        "assistant"
    }
}

pub(super) fn gloss_path(kind: &str) -> &'static str {
    if kind == "user_word_gloss" {
        "$.userWordGloss"
    } else {
        "$.wordGloss"
    }
}

pub(super) fn gloss_error_path(kind: &str) -> &'static str {
    if kind == "user_word_gloss" {
        "$.userWordGlossError"
    } else {
        "$.wordGlossError"
    }
}

pub(super) fn translation_path(kind: &str) -> &'static str {
    if kind == "user_translation" {
        "$.userTranslation"
    } else {
        "$.translation"
    }
}

pub fn retry_gloss(db: &Connection, operation: &str) -> Result<String> {
    let (turn, conversation, state, saved): (String,String,String,Option<String>) = db.query_row("SELECT t.id,t.conversation_id,o.state,json_extract(t.context,CASE WHEN o.kind='user_word_gloss' THEN '$.userWordGloss' ELSE '$.wordGloss' END) FROM operations o JOIN turns t ON t.id=o.turn_id WHERE o.id=?1 AND o.kind IN ('persona_word_gloss','user_word_gloss') AND t.state NOT IN ('cancelled','invalidated')", [operation], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).optional()?.ok_or_else(|| fail("Word gloss operation is unavailable."))?;
    let available: bool = db.query_row("SELECT EXISTS(SELECT 1 FROM turns t JOIN conversations c ON c.id=t.conversation_id JOIN contacts r ON r.id=c.contact_id JOIN messages m ON m.turn_id=t.id JOIN operations o ON o.turn_id=t.id WHERE t.id=?1 AND o.id=?2 AND c.archived=0 AND r.archived=0 AND m.role=CASE WHEN o.kind='user_word_gloss' THEN 'user' ELSE 'assistant' END)", params![turn,operation], |r| r.get(0))?;
    if !available {
        return Err(fail("Word gloss source is unavailable."));
    }
    let retryable = if state == "succeeded" {
        let value: Option<WordGlossView> = saved.map(|s| serde_json::from_str(&s)).transpose()?;
        value.is_none_or(|v| {
            v.coverage == GlossCoverage::Partial
                || !v.segments.iter().any(|s| s.kind == GlossSegmentKind::Gloss)
        })
    } else {
        state == "failed" || state == "unknown"
    };
    if !retryable {
        return Err(fail("This word gloss cannot be retried."));
    }
    admit_network_work(db, 1)?;
    let paused: bool = db.query_row(
        "SELECT paused OR state='unknown' FROM turns WHERE id=?1",
        [&turn],
        |r| r.get(0),
    )?;
    connections::bind_retry(db, &turn, Some(operation))?;
    // Explicit retry grants just this operation a permit on a paused turn.
    // Clearing a service hold must not implicitly resume sibling work.
    if paused {
        db.execute("UPDATE turns SET paused=1 WHERE id=?1", [&turn])?;
    }
    db.execute(
        "UPDATE operations SET state='ready',permit=?2 WHERE id=?1",
        params![operation, paused],
    )?;
    refresh_turn(db, &turn)?;
    Ok(conversation)
}

/// At most one automatic repair, only after a successful partial result. Never
/// release holds or grant paused work a permit as an explicit user retry does.
pub(super) fn queue_gloss_repair(
    db: &Connection,
    turn: &str,
    dispatch: &Dispatch,
) -> Result<&'static str> {
    let attempts: i64 = db.query_row(
        "SELECT count(*) FROM attempts WHERE operation_id=?1",
        [&dispatch.operation],
        |r| r.get(0),
    )?;
    if attempts != 1 {
        return Ok("not_first_attempt");
    }
    let settings = config(db)?;
    let paused: bool =
        db.query_row("SELECT paused FROM turns WHERE id=?1", [turn], |r| r.get(0))?;
    if paused || settings.paused || settings.revision != dispatch.target.revision {
        return Ok("paused_or_connection_changed");
    }
    let admission = (|| -> Result<()> {
        crate::ai::policy::holds::check(db, &dispatch.target)?;
        let used: i64 = db.query_row("SELECT count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE o.turn_id=?1 AND a.requested_model!='local'", [turn], |r| r.get(0))?;
        let reserved: i64 = db.query_row("SELECT count(*) FROM operations WHERE turn_id=?1 AND state IN ('ready','waiting_dependencies') AND kind NOT IN ('persona_context','coach_context')", [turn], |r| r.get(0))?;
        if used + reserved + 1 > TURN_ATTEMPT_LIMIT {
            return Err(budget_error("No remaining word-repair attempt budget."));
        }
        admit_network_work(db, 1)
    })();
    match admission {
        Ok(()) => {}
        Err(error)
            if matches!(
                error.code,
                ErrorCode::Storage | ErrorCode::Internal | ErrorCode::ConfigLoad
            ) =>
        {
            return Err(error);
        }
        Err(_) => return Ok("admission_blocked"),
    }
    db.execute(
        "UPDATE operations SET state='ready',permit=0 WHERE id=?1",
        [&dispatch.operation],
    )?;
    Ok("queued")
}
