use super::*;

fn reply_dispatch(store: &mut Store, conversation: &str) -> (String, Dispatch) {
    let turn = store.execute(send(store, conversation)).unwrap().entity_id;
    store.dispatch().unwrap();
    let dispatched = store.dispatch().unwrap().unwrap();
    (turn, dispatched)
}

fn revision(store: &Store) -> i32 {
    store
        .connection
        .query_row("SELECT revision FROM metadata", [], |r| r.get(0))
        .unwrap()
}

fn reply_attempt(store: &Store, conversation: &str, turn: &str) -> AttemptView {
    let snapshot = store.conversation_snapshot(conversation, None).unwrap();
    let turn = snapshot.turns.into_iter().find(|t| t.id == turn).unwrap();
    let operation = turn
        .operations
        .iter()
        .find(|o| o.kind == "persona_reply")
        .unwrap()
        .id
        .clone();
    turn.attempts
        .into_iter()
        .rfind(|a| a.operation_id == operation)
        .unwrap()
}

#[test]
fn dispatch_records_the_exact_request_for_inspection() {
    let (_dir, mut store, conversation) = setup();
    let (_, dispatched) = reply_dispatch(&mut store, &conversation);
    let detail = store.attempt_detail(&dispatched.attempt).unwrap();
    let recorded = detail.request_messages.unwrap();
    assert_eq!(recorded.len(), dispatched.messages.len());
    for (recorded, sent) in recorded.iter().zip(&dispatched.messages) {
        assert_eq!(recorded.role, sent.role);
        assert_eq!(recorded.content, sent.content);
    }
    assert!(detail.response_text.is_none());
    assert!(store.attempt_detail("missing").is_err());
}

#[test]
fn a_published_reply_keeps_its_response_but_is_not_unpublished_text() {
    let (_dir, mut store, conversation) = setup();
    let (turn, dispatched) = reply_dispatch(&mut store, &conversation);
    store
        .finish_retaining(
            &dispatched,
            Ok(reply("Hola, ¿qué tal?")),
            Some("Hola, ¿qué"),
        )
        .unwrap();
    let detail = store.attempt_detail(&dispatched.attempt).unwrap();
    assert_eq!(detail.response_text.as_deref(), Some("Hola, ¿qué tal?"));
    assert_eq!(detail.preview_text.as_deref(), Some("Hola, ¿qué"));
    assert_eq!(
        reply_attempt(&store, &conversation, &turn).unpublished_text,
        None
    );
}

#[test]
fn a_failed_reply_keeps_every_streamed_character_visible() {
    let (_dir, mut store, conversation) = setup();
    let (turn, dispatched) = reply_dispatch(&mut store, &conversation);
    store
        .finish_retaining(
            &dispatched,
            Err(fail("Provider stopped")),
            Some("Partial reply 🎉 text"),
        )
        .unwrap();
    let attempt = reply_attempt(&store, &conversation, &turn);
    assert_eq!(attempt.state, "failed");
    assert_eq!(
        attempt.unpublished_text.as_deref(),
        Some("Partial reply 🎉 text")
    );
    let messages: i32 = store
        .connection
        .query_row(
            "SELECT count(*) FROM messages WHERE turn_id=?1 AND role='assistant'",
            [&turn],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        messages, 0,
        "unvalidated text never becomes the conversation message"
    );
}

#[test]
fn a_cancelled_attempt_keeps_its_text_and_wakes_readers_once() {
    let (_dir, mut store, conversation) = setup();
    let (turn, dispatched) = reply_dispatch(&mut store, &conversation);
    // Cancel the way the turn control does, before the transport finishes.
    store
        .connection
        .execute("UPDATE turns SET state='cancelled' WHERE id=?1", [&turn])
        .unwrap();
    store.connection.execute("UPDATE operations SET state='cancelled',permit=0 WHERE turn_id=?1 AND state!='succeeded'", [&turn]).unwrap();
    store.connection.execute("UPDATE attempts SET state='cancelled',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1", [&dispatched.attempt]).unwrap();
    let before = revision(&store);
    let watched = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(
        watched
            .turns
            .iter()
            .all(|t| t.attempts.iter().all(|a| a.unpublished_text.is_none()))
    );
    store
        .finish_retaining(
            &dispatched,
            Err(fail("Cancelled locally")),
            Some("Cut off mid"),
        )
        .unwrap();
    assert_eq!(
        revision(&store),
        before + 1,
        "the retained text wakes readers exactly once"
    );
    // A watcher that already saw the cancellation is woken and sees the text.
    let woken = store
        .conversation_snapshot_since(&conversation, None, watched.revision, false)
        .unwrap()
        .expect("the revision moved");
    let attempt = woken
        .turns
        .iter()
        .find(|t| t.id == turn)
        .unwrap()
        .attempts
        .iter()
        .find(|a| a.id == dispatched.attempt)
        .unwrap();
    assert_eq!(attempt.unpublished_text.as_deref(), Some("Cut off mid"));
    // Nothing to retain on the early-return path: no bump.
    let after = revision(&store);
    store
        .finish_retaining(&dispatched, Err(fail("again")), None)
        .unwrap();
    assert_eq!(revision(&store), after);
}

#[test]
fn retained_text_is_bounded_on_a_character_boundary() {
    let long = "é".repeat(200_000);
    let bounded = crate::conversations::execution::publication::bounded_text(&long);
    assert!(bounded.len() <= crate::conversations::execution::publication::RETAINED_TEXT_LIMIT);
    assert!(long.starts_with(bounded));
}

#[test]
fn periodic_saves_never_move_the_revision_and_survive_a_crash() {
    let (_dir, mut store, conversation) = setup();
    let (turn, dispatched) = reply_dispatch(&mut store, &conversation);
    let before = revision(&store);
    store
        .save_previews(&[(dispatched.attempt.clone(), "Hola, ¿qu".into())])
        .unwrap();
    assert_eq!(
        revision(&store),
        before,
        "saving streamed text is not a snapshot change"
    );
    assert_eq!(
        store
            .attempt_detail(&dispatched.attempt)
            .unwrap()
            .preview_text
            .as_deref(),
        Some("Hola, ¿qu")
    );
    // The process ends abruptly: the next launch reconciles interrupted work.
    store.reconcile_execution().unwrap();
    let attempt = reply_attempt(&store, &conversation, &turn);
    assert_eq!(attempt.state, "unknown");
    assert_eq!(attempt.unpublished_text.as_deref(), Some("Hola, ¿qu"));
    // Ended attempts are never overwritten by a late save.
    store
        .save_previews(&[(dispatched.attempt.clone(), "late".into())])
        .unwrap();
    assert_eq!(
        store
            .attempt_detail(&dispatched.attempt)
            .unwrap()
            .preview_text
            .as_deref(),
        Some("Hola, ¿qu")
    );
}

#[test]
fn inspection_bodies_survive_while_diagnostics_redact_content_and_credentials() {
    let (_dir, mut store, conversation) = setup();
    let (_, dispatched) = reply_dispatch(&mut store, &conversation);
    let mut output = reply("INSPECTION_RESPONSE");
    output.diagnostics = Some(crate::diagnostics::response::metadata(
        &serde_json::json!({
            "id": "provider-request-id", "model": "actual-model",
            "choices": [{"message": {"content": "INSPECTION_RESPONSE"}, "finish_reason": "stop"}],
            "authorization": "Bearer private-credential"
        }),
        &["private-credential"],
    ));
    store.finish(&dispatched, Ok(output)).unwrap();
    let detail = store.attempt_detail(&dispatched.attempt).unwrap();
    assert_eq!(detail.response_text.as_deref(), Some("INSPECTION_RESPONSE"));
    assert_eq!(
        detail.request_messages.unwrap()[0].content,
        dispatched.messages[0].content
    );
    let saved: String = store
        .connection
        .query_row(
            "SELECT diagnostics FROM attempts WHERE id=?1",
            [&dispatched.attempt],
            |r| r.get(0),
        )
        .unwrap();
    assert!(!saved.contains("INSPECTION_RESPONSE"));
    assert!(!saved.contains("private-credential"));
    assert!(saved.contains("provider-request-id"));
    assert!(saved.contains("actual-model"));
}
