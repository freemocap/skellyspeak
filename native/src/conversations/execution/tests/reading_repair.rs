use super::*;

#[test]
fn repair_publishes_partial_then_only_fills_gaps_using_fast_model_once() {
    let (_dir, mut store, conversation) = setup();
    let (gloss, translation) = gloss_children(&mut store, &conversation, "Hola tú?");
    store.finish(&gloss, Ok(gloss_reply())).unwrap();
    store
        .finish(
            &translation,
            Ok(translation_reply(&translation, "Hello you?")),
        )
        .unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    let first = snapshot.messages[1].word_gloss.as_ref().unwrap();
    assert_eq!(first.coverage, GlossCoverage::Partial);
    assert_eq!(snapshot.messages[1].gloss_state.as_deref(), Some("ready"));
    assert_eq!(first.segments[0].gloss.as_deref(), Some("hello"));
    let repair = store.dispatch().unwrap().unwrap();
    assert_eq!(repair.operation, gloss.operation);
    assert_eq!(repair.model, "google/gemini-2.5-flash-lite");
    let instruction = &repair.messages.last().unwrap().content;
    assert!(instruction.contains("g0005"));
    assert!(instruction.contains("g0006"));
    // Attempting to replace an accepted gloss is ignored; only the gap is filled.
    store.finish(&repair, Ok(reply(r#"{"spans":[{"first":"g0000","last":"g0003","kind":"gloss","gloss":"wrong replacement"},{"first":"g0005","last":"g0006","kind":"gloss","gloss":"you"}]}"#))).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    let saved = snapshot.messages[1].word_gloss.as_ref().unwrap();
    assert_eq!(saved.coverage, GlossCoverage::Complete);
    assert_eq!(saved.segments[0].gloss.as_deref(), Some("hello"));
    assert!(
        saved
            .segments
            .iter()
            .any(|s| s.gloss.as_deref() == Some("you"))
    );
    assert!(!store.has_ready_work().unwrap());
    let diagnostics: String = store
        .connection
        .query_row(
            "SELECT diagnostics FROM attempts WHERE id=?1",
            [&repair.attempt],
            |r| r.get(0),
        )
        .unwrap();
    let diagnostics: serde_json::Value = serde_json::from_str(&diagnostics).unwrap();
    assert_eq!(
        diagnostics["word_gloss_validation"]["preserved_from_attempt"],
        gloss.attempt
    );
}

#[test]
fn second_partial_does_not_loop_and_cancelled_repair_cannot_publish() {
    for cancel in [false, true] {
        let (_dir, mut store, conversation) = setup();
        let (gloss, translation) = gloss_children(&mut store, &conversation, "Hola tú?");
        store.finish(&gloss, Ok(gloss_reply())).unwrap();
        store
            .finish(
                &translation,
                Ok(translation_reply(&translation, "Hello you?")),
            )
            .unwrap();
        let repair = store.dispatch().unwrap().unwrap();
        let before = store.conversation_snapshot(&conversation, None).unwrap();
        if cancel {
            control_turn(&store.connection, &before.turns[0].id, TurnControl::Cancel).unwrap();
        }
        store.finish(&repair, Ok(gloss_reply())).unwrap();
        assert!(!store.has_ready_work().unwrap());
        let after = store.conversation_snapshot(&conversation, None).unwrap();
        let saved = after.messages[1].word_gloss.as_ref().unwrap();
        assert_eq!(saved.coverage, GlossCoverage::Partial);
        if cancel {
            assert_eq!(saved, before.messages[1].word_gloss.as_ref().unwrap());
        }
    }
}

#[test]
fn punctuation_gap_and_rejected_whitespace_need_no_network_repair() {
    let (_dir, mut store, conversation) = setup();
    let (gloss, translation) = gloss_children(&mut store, &conversation, "Hola ?");
    store.finish(&gloss, Ok(reply(r#"{"spans":[{"first":"g0000","last":"g0003","kind":"gloss","gloss":"hello"},{"first":"g0004","last":"g0004","kind":"gloss","gloss":"bad"}]}"#))).unwrap();
    store
        .finish(&translation, Ok(translation_reply(&translation, "Hello?")))
        .unwrap();
    assert!(!store.has_ready_work().unwrap());
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(
        snapshot.messages[1].word_gloss.as_ref().unwrap().coverage,
        GlossCoverage::Complete
    );
    let diagnostics: String = store
        .connection
        .query_row(
            "SELECT diagnostics FROM attempts WHERE id=?1",
            [&gloss.attempt],
            |r| r.get(0),
        )
        .unwrap();
    assert!(diagnostics.contains("gloss_whitespace_target"));
}

#[test]
fn automatic_repair_cannot_bypass_pause_or_turn_attempt_budget() {
    for paused in [true, false] {
        let (_dir, mut store, conversation) = setup();
        let (gloss, translation) = gloss_children(&mut store, &conversation, "Hola tú?");
        if paused {
            store
                .connection
                .execute("UPDATE turns SET paused=1", [])
                .unwrap();
        } else {
            for _ in 3..TURN_ATTEMPT_LIMIT {
                store.connection.execute("INSERT INTO attempts(id,operation_id,state,requested_model) VALUES(?1,?2,'succeeded','fixture')", params![id(),translation.operation]).unwrap();
            }
        }
        store.finish(&gloss, Ok(gloss_reply())).unwrap();
        store
            .finish(
                &translation,
                Ok(translation_reply(&translation, "Hello you?")),
            )
            .unwrap();
        assert!(!store.has_ready_work().unwrap());
        let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
        assert_eq!(
            snapshot.messages[1].word_gloss.as_ref().unwrap().coverage,
            GlossCoverage::Partial
        );
        assert_eq!(
            snapshot.messages[1].gloss_state.as_deref(),
            Some("succeeded")
        );
        let diagnostics: String = store
            .connection
            .query_row(
                "SELECT diagnostics FROM attempts WHERE id=?1",
                [&gloss.attempt],
                |r| r.get(0),
            )
            .unwrap();
        assert!(diagnostics.contains(if paused {
            "paused_or_connection_changed"
        } else {
            "admission_blocked"
        }));
    }
}
