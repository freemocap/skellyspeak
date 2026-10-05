//! Hooks run within the transaction that accepts the qualifying source.
use super::{
    EffortDimension, award,
    qualification::{self, Qualification},
};
use crate::model::Result;
use rusqlite::{Connection, params};
use serde_json::Value;

fn message_scope(db: &Connection, turn: &str) -> Result<(String, String, String, Value)> {
    let (language, conversation): (String,String) = db.query_row("SELECT c.language_id,c.id FROM turns t JOIN conversations c ON c.id=t.conversation_id WHERE t.id=?1 AND EXISTS(SELECT 1 FROM messages WHERE turn_id=t.id AND role='user')", [turn], |r| Ok((r.get(0)?,r.get(1)?)))?;
    let context = crate::conversations::assessments::context(db, turn)?;
    let variety = context["practiceSettings"]["varietyId"]
        .as_str()
        .ok_or_else(|| {
            crate::model::AppError::new(
                crate::model::ErrorCode::Validation,
                "Missing effort source variety.",
            )
        })?
        .to_owned();
    Ok((language, variety, conversation, context))
}
pub(crate) fn message(db: &Connection, turn: &str, kind: &str) -> Result<()> {
    if kind != "skill_assessment" {
        return Ok(());
    }
    let (language, variety, conversation, context) = message_scope(db, turn)?;
    let reaction = context
        .get("partnerReaction")
        .filter(|v| !v.is_null())
        .cloned()
        .map(serde_json::from_value)
        .transpose()?;
    if qualification::understood(reaction.as_ref()) == Qualification::Qualified {
        award(
            db,
            EffortDimension::PartnerUnderstood,
            turn,
            &language,
            &variety,
            Some(&conversation),
        )?;
    }
    Ok(())
}
pub(crate) fn revision(db: &Connection, turn: &str, predecessor: &str) -> Result<()> {
    let (before,after): (String,String) = db.query_row("SELECT old.text,new.text FROM messages old JOIN messages new ON new.turn_id=?1 AND new.role='user' WHERE old.turn_id=?2 AND old.role='user'", params![turn,predecessor], |r| Ok((r.get(0)?,r.get(1)?)))?;
    if qualification::changed_revision(&before, &after) {
        let (language, variety, conversation, _) = message_scope(db, turn)?;
        award(
            db,
            EffortDimension::RevisionsSent,
            turn,
            &language,
            &variety,
            Some(&conversation),
        )?;
    }
    Ok(())
}
pub(crate) fn practice(
    db: &Connection,
    item: &str,
    receipt: Option<&str>,
    comparison: &crate::drill::comparison::DrillComparison,
) -> Result<()> {
    if qualification::practice(comparison, receipt.is_some()) != Qualification::Qualified {
        return Ok(());
    }
    let (language, variety): (String, String) = db.query_row(
        "SELECT language_id,variety_id FROM drill_items WHERE id=?1",
        [item],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    award(
        db,
        EffortDimension::PracticeAttempts,
        receipt.expect("qualified recording"),
        &language,
        &variety,
        None,
    )
}
