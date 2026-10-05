//! Retire unfinished assessment execution without rewriting evidence or awards.
use super::*;

pub(super) fn apply(db: &Connection) -> Result<()> {
    let invalid_context: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM turns t JOIN operations o ON o.turn_id=t.id
         WHERE o.kind IN ('conversation_feedback','coach_reaction','skill_assessment','skill_attribution')
         AND o.state NOT IN ('succeeded','cancelled','invalidated') AND json_type(t.context)!='object')",
        [], |r| r.get(0),
    )?;
    if invalid_context {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Assessment migration requires object-shaped turn context.",
        ));
    }
    db.execute_batch(
        "UPDATE attempts SET state='unknown',
            finished_at=COALESCE(finished_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            error=COALESCE(error,'Assessment execution interrupted. Provider outcome and cost are unknown.')
         WHERE state='running' AND operation_id IN (
            SELECT id FROM operations WHERE kind IN
            ('conversation_feedback','coach_reaction','skill_assessment','skill_attribution')
            AND state NOT IN ('succeeded','cancelled','invalidated'));
         UPDATE turns SET context=json_set(context,'$.assessmentExecutionNotice',
            'Unfinished assessment work was cancelled during the workspace update. Saved evidence and awards were retained.')
         WHERE id IN (SELECT turn_id FROM operations WHERE kind IN
            ('conversation_feedback','coach_reaction','skill_assessment','skill_attribution')
            AND state NOT IN ('succeeded','cancelled','invalidated'));
         UPDATE operations SET state='cancelled',permit=0 WHERE kind IN
            ('conversation_feedback','coach_reaction','skill_assessment','skill_attribution')
            AND state NOT IN ('succeeded','cancelled','invalidated');",
    )?;
    // Refresh only affected active turns; keep cancelled and invalidated sources terminal.
    db.execute_batch("UPDATE turns SET state=CASE
        WHEN EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=turns.id AND o.state IN ('ready','waiting_dependencies','running')) THEN
            CASE WHEN EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=turns.id AND o.kind IN ('persona_reply','persona_opening','coach_reply') AND o.state IN ('ready','waiting_dependencies','running')) THEN 'pending' ELSE 'assisting' END
        WHEN EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=turns.id AND o.state='unknown') THEN 'unknown'
        WHEN EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=turns.id AND o.state='failed') THEN 'failed'
        ELSE 'succeeded' END
        WHERE json_extract(context,'$.assessmentExecutionNotice') IS NOT NULL AND state NOT IN ('cancelled','invalidated');")?;
    let unfinished: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM operations WHERE kind IN
         ('conversation_feedback','coach_reaction','skill_assessment','skill_attribution')
         AND state NOT IN ('succeeded','cancelled','invalidated'))",
        [],
        |r| r.get(0),
    )?;
    if unfinished {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Assessment migration left unfinished execution.",
        ));
    }
    Ok(())
}

pub(super) fn validate(db: &Connection) -> Result<()> {
    super::validate_47(db)
}
