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
    let (turn, conversation, state, profile, saved): (String,String,String,i32,Option<String>) = db.query_row("SELECT t.id,t.conversation_id,o.state,t.profile_revision,json_extract(t.context,CASE WHEN o.kind='user_word_gloss' THEN '$.userWordGloss' ELSE '$.wordGloss' END) FROM operations o JOIN turns t ON t.id=o.turn_id WHERE o.id=?1 AND o.kind IN ('persona_word_gloss','user_word_gloss') AND t.state NOT IN ('cancelled','invalidated')", [operation], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional()?.ok_or_else(|| fail("Word gloss operation is unavailable."))?;
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
    if config(db)?.revision != profile || active_credential(db)?.is_none() {
        return Err(fail("The connection changed. Start a new exchange."));
    }
    let attempts: i64 = db.query_row("SELECT count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE o.turn_id=?1 AND a.requested_model!='local'", [&turn], |r| r.get(0))?;
    let reserved: i64 = db.query_row("SELECT count(*) FROM operations WHERE turn_id=?1 AND state IN ('ready','waiting_dependencies') AND kind NOT IN ('persona_context','coach_context')", [&turn], |r| r.get(0))?;
    if attempts + reserved + 1 > TURN_ATTEMPT_LIMIT {
        return Err(budget_error(
            "This turn has reached its network attempt budget.",
        ));
    }
    admit_network_work(db, 1)?;
    let paused: bool = db.query_row(
        "SELECT paused OR state='unknown' FROM turns WHERE id=?1",
        [&turn],
        |r| r.get(0),
    )?;
    release_hold(db, &turn, false)?;
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
