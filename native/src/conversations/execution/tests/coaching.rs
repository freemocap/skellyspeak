use super::*;

#[test]
fn coach_is_durable_and_excluded_from_persona_context() {
    let (_dir, mut store, conversation) = setup();
    let revision = store.snapshot().unwrap().conversations[0].revision;
    apply(
        &mut store,
        Action::AskCoach {
            conversation_id: conversation.clone(),
            text: "Private coach question".into(),
            expected_revision: revision,
        },
    );
    assert!(store.dispatch().unwrap().is_none());
    let coach = store.dispatch().unwrap().unwrap();
    store
        .finish(&coach, Ok(reply("Private coach explanation")))
        .unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 0);
    assert_eq!(snapshot.coach_messages.len(), 2);
    let persona = begin(&mut store, &conversation);
    assert!(
        !persona
            .messages
            .iter()
            .any(|m| m.content.contains("Private coach"))
    );
    store.finish(&persona, Ok(reply("Hola."))).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 2);
    assert_eq!(snapshot.coach_messages.len(), 2);
    let profile = store.profile().unwrap();
    assert_eq!(profile.global.persona_messages, 1);
    assert_eq!(profile.global.attempts, 2);
}

#[test]
fn coaching_is_independent_source_bound_and_xp_is_idempotent() {
    let (_dir, mut store, conversation) = setup();
    let cmd = send(&store, &conversation);
    store.execute(cmd).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let persona = store.dispatch().unwrap().unwrap();
    let feedback = store.dispatch().unwrap().unwrap();
    assert!(feedback.coaching_schema.is_some());
    let candidate = r#"{"meaning_recovered":"full","items":[{"construct":"question","quote":"¿cómo estás?","outcome":"demonstrated","error":null,"rationale":"Asks about the listener's state."}]}"#;
    store.finish(&feedback, Ok(reply(candidate))).unwrap();
    store.finish(&feedback, Ok(reply(candidate))).unwrap();
    let first = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(first["profile"]["xp"], 30);
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .len(),
        1
    );
    store.finish(&persona, Ok(reply("Bien, gracias."))).unwrap();
    let message = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "assistant")
        .unwrap()
        .id
        .clone();
    request_suggestions(&store.connection, &message).unwrap();
    store.connection.execute("UPDATE operations SET state='cancelled' WHERE state='ready' AND kind NOT IN ('coach_suggestions','persona_reply','persona_context')", []).unwrap();
    let suggestions = store.dispatch().unwrap().unwrap();
    assert!(suggestions.coaching_schema.is_some());
    store
        .finish(&suggestions, Ok(reply(r#"{"replies":[{"text":"Me alegro."}],"tokens":[{"reply":0,"text":"Me","gloss":"myself","romanization":null,"pronunciation":null},{"reply":0,"text":"alegro","gloss":"am glad","romanization":null,"pronunciation":"ah-LEH-groh"}]}"#)))
        .unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(view.messages.len(), 2);
    assert!(view.messages[0].feedback.is_some());
    let replies = view.messages[1].suggested_replies.as_ref().unwrap();
    assert_eq!(replies.len(), 1);
    assert_eq!(replies[0].text, "Me alegro.");
    let spans: Vec<_> = replies[0]
        .segments
        .iter()
        .map(|s| (s.start, s.end, s.gloss.as_deref()))
        .collect();
    assert_eq!(spans, vec![(0, 2, Some("myself")), (3, 9, Some("am glad"))]);
    assert_eq!(
        view.messages[1].suggestions_state.as_deref(),
        Some("succeeded")
    );
    assert!(view.messages[1].suggestions_error.is_none());
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        30
    );
    let next = send(&store, &conversation);
    store.execute(next).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let next_persona = store.dispatch().unwrap().unwrap();
    assert!(next_persona.coaching_schema.is_none());
}

#[test]
fn rejected_suggestions_surface_their_state_and_error() {
    let (_dir, mut store, conversation) = setup();
    store.execute(send(&store, &conversation)).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let persona = store.dispatch().unwrap().unwrap();
    let feedback = store.dispatch().unwrap().unwrap();
    store
        .finish(
            &feedback,
            Ok(reply(r#"{"meaning_recovered":"full","items":[]}"#)),
        )
        .unwrap();
    store.finish(&persona, Ok(reply("Bien, gracias."))).unwrap();
    let message = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages[1]
        .id
        .clone();
    assert!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages[1]
            .suggestions_state
            .is_none()
    );
    request_suggestions(&store.connection, &message).unwrap();
    let waiting = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(
        waiting.messages[1].suggestions_state.as_deref(),
        Some("ready")
    );
    let message = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "assistant")
        .unwrap()
        .id
        .clone();
    request_suggestions(&store.connection, &message).unwrap();
    store.connection.execute("UPDATE operations SET state='cancelled' WHERE state='ready' AND kind NOT IN ('coach_suggestions','persona_reply','persona_context')", []).unwrap();
    let suggestions = store.dispatch().unwrap().unwrap();
    assert!(suggestions.coaching_schema.is_some());
    store.finish(&suggestions, Ok(reply("not json"))).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(
        view.messages[1].suggestions_state.as_deref(),
        Some("failed")
    );
    assert!(
        view.messages[1]
            .suggestions_error
            .as_deref()
            .unwrap()
            .contains("suggestions_schema")
    );
    assert!(view.messages[1].suggested_replies.is_none());
}

#[test]
fn invalid_coach_evidence_never_awards_xp() {
    for quote in ["not in the learner message", ""] {
        let (_dir, mut store, conversation) = setup();
        store.execute(send(&store, &conversation)).unwrap();
        store.dispatch().unwrap();
        store.dispatch().unwrap();
        let feedback = store.dispatch().unwrap().unwrap();
        let body = serde_json::json!({"meaning_recovered":"full","items":[{"construct":"question","quote":quote,"outcome":"demonstrated","error":null,"rationale":"Test"}]}).to_string();
        store.finish(&feedback, Ok(reply(&body))).unwrap();
        let view = store.conversation_snapshot(&conversation, None).unwrap();
        assert!(view.messages[0].feedback.is_none());
        assert!(view.messages[0].feedback_error.is_some());
        assert_eq!(
            crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]
                ["xp"],
            0
        );
    }
}

#[test]
fn assisted_speech_credit_retains_provenance() {
    let (_dir, mut store, conversation) = setup();
    let mut command = send(&store, &conversation);
    if let Action::SendMessage { input, .. } = &mut command.action {
        input.modality = "speech_transcript".into();
        input.scaffold = true;
    }
    store.execute(command).unwrap();
    store.dispatch().unwrap();
    store.dispatch().unwrap();
    let feedback = store.dispatch().unwrap().unwrap();
    store.finish(&feedback,Ok(reply(r#"{"meaning_recovered":"full","items":[{"construct":"question","quote":"¿cómo estás?","outcome":"demonstrated","error":null,"rationale":"Test"}]}"#))).unwrap();
    let view = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(view["profile"]["xp"], 10);
    assert_eq!(view["records"][0]["input"]["modality"], "speech_transcript");
    assert_eq!(view["records"][0]["input"]["scaffold"], true);
}

#[test]
fn failed_persona_does_not_hold_send_or_discard_running_coach() {
    let (_dir, mut store, conversation) = setup();
    let cmd = send(&store, &conversation);
    store.execute(cmd).unwrap();
    store.dispatch().unwrap();
    let persona = store.dispatch().unwrap().unwrap();
    let coach = store.dispatch().unwrap().unwrap();
    store
        .finish(&persona, Err(fail("Synthetic reply failure")))
        .unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .turns[0]
            .state,
        "assisting"
    );
    let next = send(&store, &conversation);
    store.execute(next).unwrap();
    store
        .finish(
            &coach,
            Ok(reply(r#"{"meaning_recovered":"full","items":[]}"#)),
        )
        .unwrap();
    assert!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages[0]
            .feedback
            .is_some()
    );
    let suggestions:i64=store.connection.query_row("SELECT count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE o.kind='coach_suggestions'",[],|r|r.get(0)).unwrap();
    assert_eq!(suggestions, 0);
}
