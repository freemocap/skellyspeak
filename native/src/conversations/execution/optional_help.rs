//! Optional work is source-bound, deduplicated and only retried explicitly.
use super::*;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum MessageHelp {
    Assessment,
    Coaching,
    ReplyBrief,
    Translation,
    WordGloss,
}

pub fn request_message_help(
    db: &Connection,
    message: &str,
    help: MessageHelp,
    retry: bool,
) -> Result<(String, String)> {
    let (turn, conversation, role, captured): (String, String, String, String) = db.query_row(
        "SELECT t.id,m.conversation_id,m.role,t.context FROM messages m JOIN turns t ON t.id=m.turn_id
         JOIN conversations c ON c.id=m.conversation_id JOIN contacts p ON p.id=c.contact_id
         WHERE m.id=?1 AND c.archived=0 AND p.archived=0 AND t.state NOT IN ('cancelled','invalidated')
         AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id)
         AND EXISTS(SELECT 1 FROM operations WHERE turn_id=t.id AND kind IN ('persona_reply','persona_opening'))",
        [message], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)),
    ).optional()?.ok_or_else(|| fail("Message assistance requires an available conversation message."))?;
    let kind = match (help, role.as_str()) {
        (MessageHelp::Assessment, "user") => "skill_assessment",
        (MessageHelp::Coaching, "user") => "coach_feedback",
        (MessageHelp::ReplyBrief, "assistant") => "reply_brief",
        (MessageHelp::Translation, "user") => "user_translation",
        (MessageHelp::Translation, "assistant") => "reply_translation",
        (MessageHelp::WordGloss, "user") => "user_word_gloss",
        (MessageHelp::WordGloss, "assistant") => "persona_word_gloss",
        _ => return Err(fail("This assistance does not apply to this message.")),
    };
    let existing: Option<(String, String)> = db
        .query_row(
            "SELECT id,state FROM operations WHERE turn_id=?1 AND kind=?2",
            params![turn, kind],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    if let Some((operation, state)) = &existing {
        if !retry
            || matches!(
                state.as_str(),
                "ready" | "running" | "waiting_dependencies" | "succeeded"
            )
        {
            return Ok((conversation, operation.clone()));
        }
        if !matches!(state.as_str(), "failed" | "unknown") {
            return Err(fail("Only failed or unknown assistance can be retried."));
        }
    } else if retry {
        return Err(fail("Request this assistance before retrying it."));
    }
    let context: serde_json::Value = serde_json::from_str(&captured)?;
    if kind == "skill_assessment" && context.get("messageAssessmentQuestions").is_none() {
        return Err(fail("This message has no captured assessment criteria."));
    }
    // Dependencies may still be running. Never recreate or retry them implicitly.
    for dependency in graph::declaration_for(db, &turn, kind)?.dependencies {
        let exists: bool = db.query_row(
            "SELECT EXISTS(SELECT 1 FROM operations WHERE turn_id=?1 AND kind=?2)",
            params![turn, dependency],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(fail("Message assistance has no captured source operation."));
        }
    }
    let attribution_exists: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM operations WHERE turn_id=?1 AND kind='skill_attribution')",
        [&turn],
        |r| r.get(0),
    )?;
    let add_attribution = kind == "skill_assessment" && !attribution_exists;
    let count = 1 + i64::from(add_attribution);
    admit_network_work(db, count)?;
    let reserved: i64 = db.query_row("SELECT (SELECT count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE o.turn_id=?1 AND a.requested_model!='local') + (SELECT count(*) FROM operations WHERE turn_id=?1 AND state IN ('ready','waiting_dependencies') AND kind NOT IN ('persona_context','coach_context'))", [&turn], |r| r.get(0))?;
    if reserved + count > TURN_ATTEMPT_LIMIT {
        return Err(budget_error(
            "Message assistance exceeds the turn attempt budget.",
        ));
    }
    let operation = existing.map(|(id, _)| id).unwrap_or_else(id);
    let state = if graph::dependencies_succeeded(db, &turn, kind)? {
        "ready"
    } else {
        "waiting_dependencies"
    };
    db.execute("INSERT INTO operations(id,turn_id,kind,state) VALUES(?1,?2,?3,?4) ON CONFLICT(turn_id,kind) DO UPDATE SET state=excluded.state,permit=0", params![operation,turn,kind,state])?;
    connections::bind_retry(db, &turn, Some(&operation))?;
    if add_attribution {
        let attribution = id();
        db.execute("INSERT INTO operations(id,turn_id,kind,state) VALUES(?1,?2,'skill_attribution','waiting_dependencies')", params![attribution,turn])?;
        connections::bind_retry(db, &turn, Some(&attribution))?;
    }
    if retry {
        db.execute(
            "UPDATE turns SET context=json_remove(context,?2) WHERE id=?1",
            params![turn, format!("$.{kind}Error")],
        )?;
    }
    refresh_turn(db, &turn)?;
    Ok((conversation, operation))
}
