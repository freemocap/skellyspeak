use super::*;

pub(crate) fn answer_quiz(
    db: &Connection,
    conversation: &str,
    id: &str,
    question: u32,
    option: u32,
) -> Result<String> {
    let mut lesson = owned(db, conversation, id)?;
    let plan = lesson
        .plan
        .as_ref()
        .ok_or_else(|| invalid("Lesson is not ready."))?;
    let q = plan
        .quiz
        .get(question as usize)
        .ok_or_else(|| invalid("Quiz question is unavailable."))?;
    if option as usize >= q.options.len() {
        return Err(invalid("Quiz option is unavailable."));
    }
    if let Some(answer) = lesson
        .quiz_answers
        .iter()
        .find(|a| a.question_index == question)
    {
        if answer.option_index != option {
            return Err(invalid("This question has already been answered."));
        }
        return Ok(id.into());
    }
    let correct = q.correct_option == option;
    lesson.quiz_answers.push(LessonQuizAnswer {
        question_index: question,
        option_index: option,
        correct,
        xp: u32::from(correct),
    });
    save(db, &lesson)?;
    Ok(id.into())
}

pub(crate) fn quiz_credits(db: &Connection, target: &str) -> Result<Vec<LessonQuizCredit>> {
    let rows = db.prepare("SELECT t.conversation_id,json_extract(t.context,'$.lesson') FROM turns t JOIN conversations c ON c.id=t.conversation_id WHERE c.language_id=?1 AND json_type(t.context,'$.lesson')='object'")?.query_map([target], |r| Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
    let mut credits = vec![];
    for (conversation, raw) in rows {
        let lesson: LessonView = serde_json::from_str(&raw)?;
        for answer in lesson.quiz_answers {
            credits.push(LessonQuizCredit {
                lesson_id: lesson.id.clone(),
                conversation_id: conversation.clone(),
                question_index: answer.question_index,
                xp: answer.xp,
            });
        }
    }
    Ok(credits)
}
