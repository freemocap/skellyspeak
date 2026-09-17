use super::*;

pub(super) fn save(db: &Connection, lesson: &LessonView) -> Result<()> {
    db.execute(
        "UPDATE turns SET context=json_set(context,'$.lesson',json(?2)) WHERE id=?1",
        params![lesson.id, serde_json::to_string(lesson)?],
    )?;
    Ok(())
}

pub(crate) fn views(db: &Connection, conversation: &str) -> Result<Vec<LessonView>> {
    let rows=db.prepare("SELECT t.id,json_extract(t.context,'$.lesson'),o.state,o.id,(SELECT error FROM attempts WHERE operation_id=o.id ORDER BY rowid DESC LIMIT 1) FROM turns t JOIN operations o ON o.turn_id=t.id AND o.kind='lesson_generate' WHERE t.conversation_id=?1 ORDER BY t.rowid DESC")?.query_map([conversation],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?,r.get::<_,Option<String>>(4)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
    rows.into_iter().map(|(id,raw,state,op,error)| {
        let mut lesson: LessonView = serde_json::from_str(&raw)?;
        lesson.id=id; lesson.operation_id=Some(op);
        lesson.coach_turn_ids=db.prepare("SELECT id FROM turns WHERE conversation_id=?1 AND json_extract(context,'$.lessonQuestionId')=?2 ORDER BY rowid")?.query_map(params![conversation,lesson.id],|r|r.get(0))?.collect::<rusqlite::Result<Vec<String>>>()?;
        if lesson.plan.is_none() { lesson.status=if matches!(state.as_str(),"ready"|"running"|"waiting_dependencies") {"generating".into()} else {state}; lesson.error=error; }
        if let Some(recap)=&lesson.recap && !evidence_valid(db, conversation, recap)? { lesson.recap=None; lesson.status="ended".into(); }
        if lesson.status=="practicing" && let Some(handoff)=&lesson.handoff_turn_id {
                let exists=db.query_row("SELECT EXISTS(SELECT 1 FROM turns WHERE id=?1 AND state NOT IN ('cancelled','invalidated'))",[handoff],|r|r.get::<_,bool>(0))?;
                if !exists { lesson.status="ended".into(); }
        }
        if lesson.plan.is_some() {
            lesson.error=None;
            if lesson.status=="practicing" {
                lesson.error=db.query_row("SELECT (SELECT error FROM attempts WHERE operation_id=o.id ORDER BY rowid DESC LIMIT 1) FROM turns t JOIN operations o ON o.turn_id=t.id WHERE t.conversation_id=?1 AND ((t.id=?2 AND o.kind='persona_opening') OR (json_extract(t.context,'$.activeLesson.id')=?3 AND o.kind='lesson_review')) ORDER BY t.rowid DESC LIMIT 1",params![conversation,lesson.handoff_turn_id,lesson.id],|r|r.get::<_,Option<String>>(0)).optional()?.flatten();
            }
        }
        Ok(lesson)
    }).collect()
}

pub(crate) fn owned(db: &Connection, conversation: &str, id: &str) -> Result<LessonView> {
    views(db, conversation)?
        .into_iter()
        .find(|l| l.id == id)
        .ok_or_else(|| invalid("Lesson is unavailable in this conversation."))
}

pub(crate) fn active(db: &Connection, conversation: &str) -> Result<Option<LessonView>> {
    Ok(views(db, conversation)?
        .into_iter()
        .find(|l| l.status == "practicing"))
}

pub(crate) fn has_exposure(db: &Connection, conversation: &str) -> Result<bool> {
    Ok(active(db,conversation)?.is_some() || db.query_row("SELECT EXISTS(SELECT 1 FROM turns WHERE conversation_id=?1 AND json_extract(context,'$.lessonExposurePending')=1)",[conversation],|r|r.get::<_,bool>(0))?)
}

pub(crate) fn capture_exposure(db: &Connection, conversation: &str, turn: &str) -> Result<bool> {
    if !ENABLED {
        return Ok(false);
    }
    let assisted = has_exposure(db, conversation)?;
    let mut ids=db.prepare("SELECT id FROM turns WHERE conversation_id=?1 AND json_extract(context,'$.lessonExposurePending')=1")?.query_map([conversation],|r|r.get(0))?.collect::<rusqlite::Result<Vec<String>>>()?;
    if let Some(active) = active(db, conversation)?
        && !ids.contains(&active.id)
    {
        ids.push(active.id);
    }
    db.execute(
        "UPDATE turns SET context=json_set(context,'$.lessonExposureIds',json(?2)) WHERE id=?1",
        params![turn, serde_json::to_string(&ids)?],
    )?;
    db.execute("UPDATE turns SET context=json_set(context,'$.lessonExposurePending',json('false')) WHERE conversation_id=?1 AND json_extract(context,'$.lessonExposurePending')=1",[conversation])?;
    Ok(assisted)
}
