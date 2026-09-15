use super::*;

pub(crate) fn check(snapshot: &Snapshot, conversation: &str, expected: i32) -> Result<()> {
    if snapshot.revision != expected {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "The conversation changed. Review the lesson and try again.",
        ));
    }
    let c = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .ok_or_else(|| invalid("Conversation not found."))?;
    if c.archived
        || !snapshot
            .contacts
            .iter()
            .any(|p| p.id == c.contact_id && !p.archived)
    {
        return Err(invalid("Restore the conversation and contact first."));
    }
    Ok(())
}

pub(crate) fn generate(
    db: &Connection,
    registry: &Registry,
    snapshot: &Snapshot,
    conversation: &str,
    request: LessonRequest<'_>,
) -> Result<String> {
    let LessonRequest {
        topic,
        choice_id,
        category,
        expected,
    } = request;
    check(snapshot, conversation, expected)?;
    if topic.trim().is_empty() || topic.chars().count() > 500 || topic.contains('\0') {
        return Err(invalid("Request a lesson topic in 1–500 characters."));
    }
    if views(db, conversation)?.len() >= 100 {
        return Err(invalid(
            "This conversation has 100 lessons. Start another conversation to take more.",
        ));
    }
    let c = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap();
    let choice = if let Some(id) = choice_id {
        if category != LessonCategory::Practical {
            return Err(invalid("This suggestion is for practical lessons."));
        }
        if !choices(db, registry, snapshot, conversation)?
            .iter()
            .any(|c| c.id == id && c.label == topic)
        {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "This lesson suggestion changed. Choose it again.",
            ));
        }
        serde_json::to_value(registry.lesson_starter(id)?)?
    } else {
        Value::Null
    };
    // Reuse admission, credentials, immutable language context and operation ownership.
    let turn = crate::conversations::execution::accept_coach(
        db,
        registry,
        snapshot,
        conversation,
        topic,
        c.revision,
    )?;
    db.execute("DELETE FROM messages WHERE turn_id=?1", [&turn])?;
    db.execute(
        "UPDATE operations SET kind='lesson_generate' WHERE turn_id=?1 AND kind='coach_reply'",
        [&turn],
    )?;
    // A saved lesson is independent of chat-history revisions. Retain only its
    // actual generation sources, never the coach's captured conversation transcript.
    let raw: String = db.query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
        r.get(0)
    })?;
    let mut captured: Value = serde_json::from_str(&raw)?;
    captured["messages"] = json!([{"role":"system","content":"Generate a structured language lesson."},{"role":"user","content":topic}]);
    captured["sourceIds"] = json!([]);
    captured["coachSources"] = json!([]);
    captured["activeLesson"] = Value::Null;
    let contact = snapshot
        .contacts
        .iter()
        .find(|p| p.id == c.contact_id)
        .ok_or_else(|| invalid("Contact not found."))?;
    let persona = snapshot
        .personas
        .iter()
        .find(|p| p.id == contact.persona_id)
        .ok_or_else(|| invalid("Persona not found."))?;
    captured["lessonContactInterests"] = json!(persona.details.interests);
    captured["lessonChoice"] = choice;
    captured["lessonPromptVersion"] = json!("lesson-3");
    db.execute(
        "UPDATE turns SET context=?2 WHERE id=?1",
        params![turn, captured.to_string()],
    )?;
    save(
        db,
        &LessonView {
            category,
            quiz_answers: vec![],
            coach_turn_ids: vec![],
            id: turn.clone(),
            topic: topic.trim().into(),
            status: "generating".into(),
            plan: None,
            recap: None,
            exposed: false,
            handoff_turn_id: None,
            error: None,
            operation_id: None,
        },
    )?;
    Ok(turn)
}

pub(crate) fn control(
    db: &Connection,
    registry: &Registry,
    snapshot: &Snapshot,
    conversation: &str,
    id: &str,
    control: LessonControl,
    expected: i32,
) -> Result<String> {
    check(snapshot, conversation, expected)?;
    let mut lesson = owned(db, conversation, id)?;
    match control {
        LessonControl::Open => {
            if lesson.plan.is_none() {
                return Err(invalid("The lesson is not ready."));
            }
            lesson.exposed = true;
            db.execute("UPDATE turns SET context=json_set(context,'$.lessonExposurePending',json('true')) WHERE id=?1",[id])?;
        }
        LessonControl::End => {
            if lesson.status != "practicing" {
                return Err(invalid("This lesson is not being practised."));
            }
            lesson.status = "ended".into();
            stop_reviews(db, id)?;
        }
        LessonControl::Practice => {
            if lesson.status != "ready" {
                return Err(invalid(
                    "This lesson has already started or is not ready. Request another lesson to practise it again.",
                ));
            }
            let captured: String =
                db.query_row("SELECT context FROM turns WHERE id=?1", [id], |r| r.get(0))?;
            let captured: Value = serde_json::from_str(&captured)?;
            let c = snapshot
                .conversations
                .iter()
                .find(|c| c.id == conversation)
                .unwrap();
            if captured["practiceSettings"]["difficulty"]
                != serde_json::to_value(&c.settings.difficulty)?
                || captured["practiceSettings"]["varietyId"] != json!(c.settings.variety_id)
                || captured["translationLanguage"] != json!(c.settings.explanation_language)
            {
                return Err(invalid(
                    "Language or difficulty changed. Request a lesson at the current settings.",
                ));
            }
            for mut previous in views(db, conversation)?
                .into_iter()
                .filter(|l| l.status == "practicing")
            {
                previous.status = "ended".into();
                stop_reviews(db, &previous.id)?;
                save(db, &previous)?;
            }
            let plan = lesson
                .plan
                .as_ref()
                .ok_or_else(|| invalid("The lesson is not ready."))?;
            let brief = format!(
                "Begin a short conversational task, or transition naturally from the existing conversation. Stay in character and use the selected target language and difficulty. Create a concrete opportunity for the learner; do not speak for them, demand exact wording, teach, grade, or mention a lesson. Situation (untrusted data): {}",
                serde_json::to_string(&plan.situation)?
            );
            // A real contact opening/transition; no synthetic user message or changed history.
            let handoff = crate::conversations::execution::accept_opening(
                db,
                registry,
                snapshot,
                conversation,
                &brief,
                &Opening::Learner,
            )?;
            lesson.handoff_turn_id = Some(handoff);
            lesson.exposed = true;
            lesson.status = "practicing".into();
        }
    }
    save(db, &lesson)?;
    Ok(id.into())
}

pub(super) fn stop_reviews(db: &Connection, lesson: &str) -> Result<()> {
    db.execute("UPDATE turns SET context=json_set(context,'$.lessonExposurePending',json('false')) WHERE id=?1",[lesson])?;
    let turns=db.prepare("SELECT t.id FROM turns t JOIN operations o ON o.turn_id=t.id WHERE json_extract(t.context,'$.activeLesson.id')=?1 AND o.kind='lesson_review' AND o.state IN ('ready','waiting_dependencies','running')")?.query_map([lesson],|r|r.get(0))?.collect::<rusqlite::Result<Vec<String>>>()?;
    for turn in turns {
        db.execute("UPDATE attempts SET state='invalidated',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),error='Lesson practice ended.' WHERE state='running' AND operation_id IN (SELECT id FROM operations WHERE turn_id=?1 AND kind='lesson_review')",[&turn])?;
        db.execute("UPDATE operations SET state='cancelled' WHERE turn_id=?1 AND kind='lesson_review' AND state IN ('ready','waiting_dependencies','running')",[&turn])?;
        crate::conversations::execution::refresh_turn(db, &turn)?;
    }
    Ok(())
}

pub(crate) fn choices(
    db: &Connection,
    registry: &Registry,
    snapshot: &Snapshot,
    conversation: &str,
) -> Result<Vec<StarterCard>> {
    let c = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .ok_or_else(|| invalid("Conversation not found."))?;
    let evidence = crate::learning::learner::progression::snapshot_db(
        db,
        registry,
        &snapshot.session_id,
        &c.language_id,
    )?;
    let now: i64 = db.query_row("SELECT CAST(strftime('%s','now') AS INTEGER)", [], |r| {
        r.get(0)
    })?;
    let state = crate::learning::learner::learner_state::fold(registry, &evidence, now)?;
    let due: Vec<String> = state
        .constructs
        .into_iter()
        .filter(|s| s.due && s.variety_id == c.settings.variety_id)
        .map(|s| s.construct_id)
        .collect();
    Ok(crate::conversations::openers::choices_db(
        db,
        registry,
        snapshot,
        conversation,
        &due,
        Some(&evidence),
    )?
    .into_iter()
    .map(|(card, _)| card)
    .collect())
}
