//! Immutable assessment results belong to a message version and one execution attempt.
//! The caller owns the publication transaction. Turn JSON holds execution inputs and
//! derived learning projections; correction observations are read from this repository.
use crate::model::*;
use rusqlite::{Connection, OptionalExtension, params};
use serde_json::Value;

/// Message-level judgments from the current, source-owned assessment. Numeric
/// evidence remains readable for saved attempts that used that result shape.
pub(crate) fn feedback(
    db: &Connection,
    turn: &str,
) -> Result<Option<crate::learning::coaching::conversation_support::ConversationFeedback>> {
    use crate::learning::coaching::conversation_support::ConversationFeedback;
    if let Some((_, result)) = current(db, turn, "skill_assessment")?
        && (result.get("grammar").is_some() || result.get("understandability").is_some())
    {
        let answers = ["grammar", "understandability"]
            .into_iter()
            .map(|key| Ok((key.to_owned(), serde_json::from_value(result[key].clone())?)))
            .collect::<Result<_>>()?;
        return Ok(Some(ConversationFeedback {
            grammar: None,
            conversation: None,
            answers,
        }));
    }
    // A captured combined assessment owns this view even while pending/failed.
    let combined: bool = db.query_row(
        "SELECT json_type(context,'$.messageAssessmentQuestions') IS NOT NULL FROM turns WHERE id=?1",
        [turn], |r| r.get(0),
    )?;
    if combined {
        return Ok(None);
    }
    current(db, turn, "conversation_feedback")?
        .map(|(_, result)| Ok(serde_json::from_value(result)?))
        .transpose()
}

pub(crate) fn owns(kind: &str) -> bool {
    matches!(
        kind,
        "coach_feedback" | "conversation_feedback" | "skill_assessment"
    )
}

pub(crate) fn publish(
    db: &Connection,
    turn: &str,
    kind: &str,
    attempt: &str,
    result: &Value,
) -> Result<()> {
    let message: String = db.query_row(
        "SELECT id FROM messages WHERE turn_id=?1 AND role='user'",
        [turn],
        |r| r.get(0),
    )?;
    db.execute(
        "INSERT INTO message_assessments(attempt_id,message_id,kind,result) VALUES(?1,?2,?3,?4)",
        params![attempt, message, kind, result.to_string()],
    )?;
    Ok(())
}

/// A pending/failed reassessment does not expose an older success as current.
pub(crate) fn current(db: &Connection, turn: &str, kind: &str) -> Result<Option<(String, Value)>> {
    let saved: Option<(String, String)> = db.query_row(
        "SELECT s.attempt_id,s.result FROM message_assessments s JOIN messages m ON m.id=s.message_id JOIN attempts a ON a.id=s.attempt_id JOIN operations o ON o.id=a.operation_id WHERE m.turn_id=?1 AND s.kind=?2 AND o.state='succeeded' AND a.state='succeeded' AND a.id=(SELECT id FROM attempts WHERE operation_id=o.id ORDER BY rowid DESC LIMIT 1)",
        params![turn,kind], |r| Ok((r.get(0)?,r.get(1)?)),
    ).optional()?;
    saved
        .map(|(attempt, raw)| Ok((attempt, serde_json::from_str(&raw)?)))
        .transpose()
}

/// Build the policy input from source-owned results. Disclosure belongs to the
/// producing attempt; opening an old card cannot disclose a new assessment.
pub(crate) fn context(db: &Connection, turn: &str) -> Result<Value> {
    let raw: String = db.query_row("SELECT context FROM turns WHERE id=?1", [turn], |r| {
        r.get(0)
    })?;
    let mut context: Value = serde_json::from_str(&raw)?;
    if let Some((attempt, result)) = current(db, turn, "coach_feedback")? {
        context["coachObservation"] = result["observation"].clone();
        let disclosed: Option<String> = db
            .query_row(
                "SELECT decision FROM assessment_disclosures WHERE attempt_id=?1",
                [&attempt],
                |r| r.get(0),
            )
            .optional()?;
        context["coachDecision"] = match disclosed {
            Some(raw) => serde_json::from_str(&raw)?,
            None => result["decision"].clone(),
        };
        context["coachObservationAttempt"] = Value::String(attempt);
        context["coachValidationOmissions"] = result["validationOmissions"].clone();
    } else {
        for field in [
            "coachObservation",
            "coachDecision",
            "coachObservationAttempt",
            "coachValidationOmissions",
        ] {
            context
                .as_object_mut()
                .ok_or_else(|| AppError::new(ErrorCode::Storage, "Invalid turn context."))?
                .remove(field);
        }
    }
    Ok(context)
}
