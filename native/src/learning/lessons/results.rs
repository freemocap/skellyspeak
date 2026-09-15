use super::*;

fn prose(value: &str, max: usize) -> Result<()> {
    if value.trim().is_empty() || value.chars().count() > max || value.contains('\0') {
        return Err(invalid(
            "Lesson output contains an empty or oversized field.",
        ));
    }
    crate::ai::transport::provider::validate_prose(value)
}

pub(super) fn evidence_valid(
    db: &Connection,
    conversation: &str,
    recap: &LessonRecap,
) -> Result<bool> {
    for e in &recap.evidence {
        let text:Option<String>=db.query_row("SELECT text FROM messages m WHERE id=?1 AND conversation_id=?2 AND role='user' AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=m.turn_id) AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=m.turn_id AND o.kind='persona_reply')",params![e.message_id,conversation],|r|r.get(0)).optional()?;
        if e.quote.trim().is_empty() || !text.is_some_and(|s| s.contains(&e.quote)) {
            return Ok(false);
        }
    }
    Ok(true)
}

pub(crate) fn validate(
    db: &Connection,
    turn: &str,
    kind: &str,
    output: &Completion,
) -> Result<Value> {
    if output.finish_reason != "stop" || output.text.len() > 16000 {
        return Err(invalid("Lesson output was incomplete or too large."));
    }
    if kind == "lesson_generate" {
        let plan: LessonPlan = serde_json::from_str(&output.text)
            .map_err(|_| invalid("Lesson output did not match the lesson structure."))?;
        for (text, max) in [
            (&plan.title, 100),
            (&plan.objective, 200),
            (&plan.explanation, 1000),
            (&plan.exercise, 300),
            (&plan.feedback_guidance, 600),
            (&plan.situation, 500),
            (&plan.completion_criteria, 400),
        ] {
            prose(text, max)?;
        }
        if plan.examples.len() != 2 {
            return Err(invalid("A lesson must contain two examples."));
        }
        if plan.quiz.len() != 2 {
            return Err(invalid("A lesson must contain two quiz questions."));
        }
        for q in &plan.quiz {
            prose(&q.question, 300)?;
            prose(&q.explanation, 300)?;
            if q.options.len() != 3 || q.correct_option >= 3 {
                return Err(invalid("Quiz options or answer key are invalid."));
            }
            let mut unique = std::collections::HashSet::new();
            for option in &q.options {
                prose(option, 200)?;
                if !unique.insert(option.trim().to_lowercase()) {
                    return Err(invalid("Quiz options must be distinct."));
                }
            }
        }
        for e in &plan.examples {
            prose(&e.text, 300)?;
            prose(&e.translation, 400)?;
            if let Some(text) = &e.romanization {
                prose(text, 400)?;
            }
            if let Some(text) = &e.pronunciation {
                prose(text, 400)?;
            }
        }
        Ok(serde_json::to_value(plan)?)
    } else {
        let recap: LessonRecap = serde_json::from_str(&output.text)
            .map_err(|_| invalid("Lesson review did not match its structure."))?;
        if recap.completed {
            prose(&recap.text, 500)?;
            if recap.evidence.is_empty() || recap.evidence.len() > 3 {
                return Err(invalid("Lesson recap requires quoted learner evidence."));
            }
            let raw: String =
                db.query_row("SELECT context FROM turns WHERE id=?1", [turn], |r| {
                    r.get(0)
                })?;
            let sources = review_sources(db, turn, &serde_json::from_str(&raw)?)?;
            for e in &recap.evidence {
                prose(&e.quote, 1000)?;
                if !sources.as_array().unwrap().iter().any(|s| {
                    s["id"] == e.message_id
                        && s["role"] == "user"
                        && s["text"].as_str().is_some_and(|t| t.contains(&e.quote))
                }) {
                    return Err(invalid("Lesson recap quoted unavailable learner evidence."));
                }
            }
        } else if !recap.text.is_empty() || !recap.evidence.is_empty() {
            return Err(invalid(
                "An incomplete task must not publish a completion recap.",
            ));
        }
        Ok(serde_json::to_value(recap)?)
    }
}

pub(crate) fn publish(db: &Connection, turn: &str, kind: &str, value: &Value) -> Result<()> {
    let (conversation, raw): (String, String) = db.query_row(
        "SELECT conversation_id,context FROM turns WHERE id=?1",
        [turn],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    if kind == "lesson_generate" {
        let mut lesson = owned(db, &conversation, turn)?;
        lesson.plan = Some(serde_json::from_value(value.clone())?);
        lesson.status = "ready".into();
        lesson.error = None;
        save(db, &lesson)
    } else {
        let captured: Value = serde_json::from_str(&raw)?;
        let id = captured["activeLesson"]["id"]
            .as_str()
            .ok_or_else(|| invalid("Lesson review has no owner."))?;
        let mut lesson = owned(db, &conversation, id)?;
        if lesson.status == "practicing" && value["completed"] == true {
            lesson.recap = Some(serde_json::from_value(value.clone())?);
            lesson.status = "completed".into();
            save(db, &lesson)?;
            stop_reviews(db, id)?;
        }
        Ok(())
    }
}
