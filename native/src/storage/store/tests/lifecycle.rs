use super::*;

#[test]
fn startup_opens_chat_without_setup_and_does_not_duplicate_it() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("skellyspeak.sqlite3");
    let mut store = Store::open(&path).unwrap();
    store.prepare_chat().unwrap();
    let snapshot = store.snapshot().unwrap();
    assert_eq!(snapshot.personas.len(), 1);
    assert_eq!(snapshot.conversations.len(), 1);
    assert_eq!(snapshot.conversations[0].language_id, "spanish");
    let conversation = snapshot.conversations[0].id.clone();
    store.prepare_chat().unwrap();
    drop(store);
    let mut store = Store::open(&path).unwrap();
    store.prepare_chat().unwrap();
    let snapshot = store.snapshot().unwrap();
    assert_eq!(snapshot.conversations.len(), 1);
    assert_eq!(snapshot.conversations[0].id, conversation);
}

#[test]
fn one_click_persona_and_chat_creation_is_atomic_and_replay_safe() {
    let directory = tempfile::tempdir().unwrap();
    let mut store = Store::open(&directory.path().join("skellyspeak.sqlite3")).unwrap();
    let command = Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::StartChat {
            language_id: "french".into(),
        },
    };
    let receipt = store.execute(command.clone()).unwrap();
    assert_eq!(store.execute(command).unwrap().entity_id, receipt.entity_id);
    let snapshot = store.snapshot().unwrap();
    assert_eq!(snapshot.personas.len(), 1);
    assert_eq!(snapshot.conversations.len(), 1);
    assert_eq!(snapshot.conversations[0].id, receipt.entity_id);
    assert_eq!(snapshot.conversations[0].language_id, "french");
    let invalid = Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::StartChat {
            language_id: "invalid".into(),
        },
    };
    assert!(store.execute(invalid).is_err());
    assert_eq!(store.snapshot().unwrap().personas.len(), 1);
}

#[test]
fn a_generated_contact_arrives_with_its_own_conversation_or_writes_nothing() {
    let directory = tempfile::tempdir().unwrap();
    let mut store = Store::open(&directory.path().join("skellyspeak.sqlite3")).unwrap();
    let generated = PersonaDetails {
        name: "Generated".into(),
        ..crate::partners::persona::starter("spanish").unwrap()
    };
    let receipt = apply(
        &mut store,
        Action::CreateContact {
            language_id: "spanish".into(),
            details: generated.clone(),
        },
    );
    let snapshot = store.snapshot().unwrap();
    assert_eq!(snapshot.personas.len(), 1);
    assert_eq!(snapshot.personas[0].details.name, "Generated");
    assert_eq!(snapshot.conversations.len(), 1);
    assert_eq!(snapshot.conversations[0].id, receipt.entity_id);
    for rejected in [
        PersonaDetails {
            age: Some(12),
            ..generated.clone()
        },
        PersonaDetails {
            vibe: vec!["not an emoji".into()],
            ..generated.clone()
        },
        PersonaDetails {
            name: "  ".into(),
            ..generated
        },
    ] {
        let before = store.snapshot().unwrap().revision;
        let refused = command(
            &store,
            Action::CreateContact {
                language_id: "spanish".into(),
                details: rejected,
            },
        );
        assert_eq!(
            store.execute(refused).unwrap_err().code,
            ErrorCode::Validation
        );
        let after = store.snapshot().unwrap();
        assert_eq!(after.revision, before);
        assert_eq!(after.personas.len(), 1);
        assert_eq!(after.conversations.len(), 1);
    }
}

#[test]
fn deletion_cascades_without_touching_other_personas_or_profiles() {
    let directory = tempfile::tempdir().unwrap();
    let mut store = Store::open(&directory.path().join("db")).unwrap();
    let one = contact(&mut store);
    let two = contact(&mut store);
    let deleted = conversation(&mut store, &one, "Delete me");
    let kept = conversation(&mut store, &two, "Keep me");
    apply(
        &mut store,
        Action::DeleteContact {
            contact_id: one.id.clone(),
            expected_revision: 1,
        },
    );
    let state = store.snapshot().unwrap();
    assert_eq!(state.personas.len(), 1);
    // Two contacts were created, each with its own first conversation.
    assert_eq!(state.conversations.len(), 2);
    assert_eq!(state.conversations[0].id, kept.id);
    assert_eq!(state.language_profiles.len(), 1);
    let late = command(
        &store,
        Action::UpdateSettings {
            conversation_id: deleted.id,
            expected_revision: 1,
            settings: deleted.settings,
        },
    );
    assert_eq!(store.execute(late).unwrap_err().code, ErrorCode::NotFound);
    let orphans: i32 = store
        .connection
        .query_row("SELECT count(*) FROM conversation_settings", [], |r| {
            r.get(0)
        })
        .unwrap();
    // Every surviving conversation keeps exactly one settings row.
    assert_eq!(orphans, 2);
}

#[test]
fn archive_retains_conversations_and_can_be_restored() {
    let directory = tempfile::tempdir().unwrap();
    let mut store = Store::open(&directory.path().join("db")).unwrap();
    let relation = contact(&mut store);
    conversation(&mut store, &relation, "Plans");
    apply(
        &mut store,
        Action::SetContactArchived {
            contact_id: relation.id.clone(),
            expected_revision: 1,
            archived: true,
        },
    );
    // The contact's first conversation plus the one created above.
    assert_eq!(store.snapshot().unwrap().conversations.len(), 2);
    let blocked = command(
        &store,
        Action::CreateConversation {
            contact_id: relation.id.clone(),
            title: "Blocked".into(),
        },
    );
    assert_eq!(
        store.execute(blocked).unwrap_err().code,
        ErrorCode::Validation
    );
    apply(
        &mut store,
        Action::SetContactArchived {
            contact_id: relation.id,
            expected_revision: 2,
            archived: false,
        },
    );
    assert!(!store.snapshot().unwrap().contacts[0].archived);
}

#[test]
fn deleting_one_conversation_keeps_its_sibling_and_clears_receipts() {
    let directory = tempfile::tempdir().unwrap();
    let mut store = Store::open(&directory.path().join("db")).unwrap();
    let relation = contact(&mut store);
    let first = conversation(&mut store, &relation, "First");
    let second = conversation(&mut store, &relation, "Second");
    apply(
        &mut store,
        Action::DeleteConversation {
            conversation_id: first.id.clone(),
            expected_revision: 1,
        },
    );
    let snapshot = store.snapshot().unwrap();
    assert_eq!(snapshot.personas.len(), 1);
    // The contact's first conversation survives beside the one kept here.
    assert_eq!(snapshot.conversations.len(), 2);
    assert_eq!(snapshot.conversations[0].id, second.id);
    let remaining: i32 = store
        .connection
        .query_row(
            "SELECT count(*) FROM receipts WHERE conversation_id=?1",
            [&first.id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(remaining, 0);
}
