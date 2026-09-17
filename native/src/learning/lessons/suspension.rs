//! Retain saved lessons, but settle their queued work without dispatch or credit.
use super::*;
pub(crate) fn suspend_pending(db: &Connection) -> Result<()> {
    if ENABLED {
        return Ok(());
    }
    let operations: Vec<(String,String)> = db.prepare("SELECT o.id,t.id FROM operations o JOIN turns t ON t.id=o.turn_id WHERE o.state IN ('ready','waiting_dependencies','running','held','failed','unknown') AND (o.kind LIKE 'lesson_%' OR json_type(t.context,'$.lessonQuestionId')='text' OR EXISTS(SELECT 1 FROM turns lesson_owner WHERE json_extract(lesson_owner.context,'$.lesson.handoffTurnId')=t.id) OR EXISTS(SELECT 1 FROM operations generation WHERE generation.turn_id=t.id AND generation.kind='lesson_generate'))")?.query_map([],|r| Ok((r.get(0)?,r.get(1)?)))?.collect::<rusqlite::Result<_>>()?;
    for (operation, turn) in operations {
        db.execute("UPDATE attempts SET state='cancelled',error='Lessons are disabled.',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE operation_id=?1 AND state='running'",[&operation])?;
        db.execute(
            "UPDATE operations SET state='cancelled',permit=0 WHERE id=?1",
            [&operation],
        )?;
        crate::conversations::execution::refresh_turn(db, &turn)?;
    }
    Ok(())
}
