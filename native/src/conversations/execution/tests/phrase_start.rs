use super::*;

fn fixture() -> (tempfile::TempDir, Store, String, String) {
    let (dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &turn, "Hola. مرحبًا. cafe\u{301}.");
    let message = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages[1]
        .id
        .clone();
    (dir, store, conversation, message)
}

fn command(store: &Store, conversation: &str, message: &str, phrase: &str) -> Command {
    let snapshot = store.snapshot().unwrap();
    Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::StartPhraseConversation {
            source_message_id: message.into(),
            phrase: phrase.into(),
            contact_id: snapshot
                .conversations
                .iter()
                .find(|c| c.id == conversation)
                .unwrap()
                .contact_id
                .clone(),
            expected_revision: snapshot.revision,
        },
    }
}

#[test]
fn phrase_start_is_atomic_idempotent_and_publishes_only_exact_partner_text() {
    let (dir, mut store, source, message) = fixture();
    let start = command(&store, &source, &message, "cafe\u{301}");
    let conversation = store.execute(start.clone()).unwrap().entity_id;
    assert_eq!(store.execute(start).unwrap().entity_id, conversation);
    assert_ne!(conversation, source);
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.phrase_seed.as_deref(), Some("cafe\u{301}"));
    assert!(snapshot.messages.is_empty());
    assert!(
        !snapshot.turns[0]
            .operations
            .iter()
            .any(|o| o.kind == "skill_assessment" || o.kind == "coach_feedback")
    );
    store.dispatch().unwrap();
    let opening = store.dispatch().unwrap().unwrap();
    assert!(
        opening
            .messages
            .iter()
            .any(|m| m.content.contains("cafe\u{301}"))
    );
    store
        .finish(&opening, Ok(reply("Un café, por favor.")))
        .unwrap();
    let failed = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(failed.messages.is_empty());
    assert!(failed.turns[0].attempts.iter().any(|a| {
        a.error
            .as_ref()
            .is_some_and(|e| e.contains("exact selected phrase"))
    }));
    let turn = failed.turns[0].id.clone();
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn,
            control: TurnControl::Retry,
        },
    );
    let retry = store.dispatch().unwrap().unwrap();
    store
        .finish(&retry, Ok(reply("Un cafe\u{301}, por favor.")))
        .unwrap();
    let complete = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(complete.messages.len(), 1);
    assert_eq!(complete.messages[0].role, "assistant");
    assert_eq!(complete.messages[0].text, "Un cafe\u{301}, por favor.");
    assert_eq!(
        store
            .conversation_snapshot(&source, None)
            .unwrap()
            .messages
            .len(),
        2
    );
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .phrase_seed,
        complete.phrase_seed
    );
}

#[test]
fn invalid_sources_and_admission_failure_leave_no_partial_conversation() {
    let (_dir, mut store, source, message) = fixture();
    for phrase in [
        "".into(),
        " ".into(),
        "not in source".into(),
        "a".repeat(2001),
        "bad\0text".into(),
    ] {
        let before = store.snapshot().unwrap().conversations.len();
        assert!(
            store
                .execute(command(&store, &source, &message, &phrase))
                .is_err()
        );
        assert_eq!(store.snapshot().unwrap().conversations.len(), before);
    }
    let mut start = command(&store, &source, &message, "مرحبا");
    assert!(store.execute(start.clone()).is_err()); // Exact combining marks are significant.
    start = command(&store, &source, &message, "مرحبًا");
    store
        .connection
        .execute("UPDATE ai_config SET hosted_credential_id=NULL", [])
        .unwrap();
    let before = store.snapshot().unwrap().conversations.len();
    assert!(store.execute(start).is_err());
    assert_eq!(store.snapshot().unwrap().conversations.len(), before);
}

#[test]
fn stale_replaced_archived_and_cross_language_sources_are_rejected() {
    let (_dir, mut store, source, message) = fixture();
    let start = command(&store, &source, &message, "Hola.");
    apply(
        &mut store,
        Action::CreateContact {
            language_id: "french".into(),
            details: crate::partners::persona::starter("french").unwrap(),
        },
    );
    assert!(store.execute(start).is_err());
    let mut mismatch = command(&store, &source, &message, "Hola.");
    if let Action::StartPhraseConversation { contact_id, .. } = &mut mismatch.action {
        let snapshot = store.snapshot().unwrap();
        *contact_id = snapshot
            .contacts
            .iter()
            .find(|c| {
                snapshot
                    .personas
                    .iter()
                    .any(|p| p.id == c.persona_id && p.language_id == "french")
            })
            .unwrap()
            .id
            .clone();
    }
    assert!(store.execute(mismatch).is_err());
    let start = command(&store, &source, &message, "Hola.");
    store
        .connection
        .execute("UPDATE conversations SET archived=1 WHERE id=?1", [&source])
        .unwrap();
    assert!(store.execute(start).is_err());
    store
        .connection
        .execute("UPDATE conversations SET archived=0 WHERE id=?1", [&source])
        .unwrap();
    let turn: String = store
        .connection
        .query_row(
            "SELECT turn_id FROM messages WHERE id=?1",
            [&message],
            |r| r.get(0),
        )
        .unwrap();
    store
        .execute(revision_command(&store, &source, &turn, "Another message"))
        .unwrap();
    let count = store.snapshot().unwrap().conversations.len();
    assert!(
        store
            .execute(command(&store, &source, &message, "Hola."))
            .is_err()
    );
    assert_eq!(store.snapshot().unwrap().conversations.len(), count);
}
