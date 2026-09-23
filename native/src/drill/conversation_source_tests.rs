use super::*;
fn command(store: &mut Store, action: Action) -> Receipt {
    store
        .execute(Command {
            session_id: store.session_id.clone(),
            action_id: uuid::Uuid::new_v4().to_string(),
            action,
        })
        .unwrap()
}
fn setup() -> (tempfile::TempDir, Store, ReadingScope, String) {
    let dir = tempfile::tempdir().unwrap();
    let mut store = Store::open(&dir.path().join("source.sqlite3")).unwrap();
    store
        .set_connection(1, Some("fixture"), "standard", "fast")
        .unwrap();
    store
        .select_route(
            store.connection_config().unwrap().revision,
            ConnectionRoute::Openrouter,
        )
        .unwrap();
    command(
        &mut store,
        Action::CreateContact {
            language_id: "spanish".into(),
            details: crate::partners::persona::starter("spanish").unwrap(),
        },
    );
    let contact = store.snapshot().unwrap().contacts[0].id.clone();
    let conversation = command(
        &mut store,
        Action::CreateConversation {
            contact_id: contact,
            title: "Source".into(),
        },
    )
    .entity_id;
    let current = store
        .snapshot()
        .unwrap()
        .conversations
        .into_iter()
        .find(|c| c.id == conversation)
        .unwrap();
    let scope = ReadingScope {
        language: "spanish".into(),
        variety: Some(current.settings.variety_id.clone()),
        explanation: current.settings.explanation_language.clone(),
        explanation_variety: Some(current.settings.explanation_variety_id.clone()),
    };
    command(
        &mut store,
        Action::SendMessage {
            conversation_id: conversation.clone(),
            text: "¡Hola, café!  ¿Qué tal?".into(),
            expected_revision: current.revision,
            input: crate::learning::coaching::InputEvidence::default(),
        },
    );
    (dir, store, scope, conversation)
}
#[test]
fn extraction_preserves_spans_pages_and_provenance_without_inference() {
    let (_dir, mut store, scope, _) = setup();
    let before = store.profile().unwrap().global.attempts;
    let first = store
        .conversation_drill_candidates(ConversationDrillInput {
            scope: scope.clone(),
            cursor: None,
            limit: 1,
        })
        .unwrap();
    assert!(first.preview.receipt_id.is_none());
    assert!(first.preview.requested.is_none());
    assert_eq!(first.preview.candidates[0].text, "¡Hola, café!");
    let second = store
        .conversation_drill_candidates(ConversationDrillInput {
            scope: scope.clone(),
            cursor: first.next_cursor,
            limit: 1,
        })
        .unwrap();
    assert_eq!(second.preview.candidates[0].text, "¿Qué tal?");
    let selected = &second.preview.candidates[0];
    let items = store
        .accept_drill_items(
            &second.preview.request_id,
            std::slice::from_ref(&selected.candidate_id),
        )
        .unwrap();
    assert_eq!(items[0].text, "¿Qué tal?");
    assert!(matches!(items[0].source, DrillSource::Conversation { .. }));
    assert_eq!(store.profile().unwrap().global.attempts, before);
    let source = &first.preview.candidates[0];
    if let DrillSource::Conversation { source_ref, .. } = &source.source {
        store
            .connection
            .execute(
                "UPDATE messages SET text='Changed text' WHERE id=?1",
                [&source_ref.message_id],
            )
            .unwrap();
    } else {
        panic!("source reference missing")
    }
    assert!(
        store
            .accept_drill_items(
                &first.preview.request_id,
                std::slice::from_ref(&source.candidate_id)
            )
            .is_err()
    );
    // Already accepted snapshots survive later edits and repeat acceptance.
    assert_eq!(
        store
            .accept_drill_items(
                &second.preview.request_id,
                std::slice::from_ref(&selected.candidate_id)
            )
            .unwrap()[0]
            .id,
        items[0].id
    );
}
#[test]
fn expired_unaccepted_or_deleted_conversation_sources_cannot_be_adopted() {
    let (_dir, mut store, scope, conversation) = setup();
    let page = store
        .conversation_drill_candidates(ConversationDrillInput {
            scope,
            cursor: None,
            limit: 2,
        })
        .unwrap();
    let ids = page
        .preview
        .candidates
        .iter()
        .map(|c| c.candidate_id.clone())
        .collect::<Vec<_>>();
    store
        .connection
        .execute(
            "UPDATE drill_previews SET expires_at='2000-01-01' WHERE id=?1",
            [&page.preview.request_id],
        )
        .unwrap();
    assert!(
        store
            .accept_drill_items(&page.preview.request_id, &ids)
            .is_err()
    );
    store
        .connection
        .execute(
            "UPDATE drill_previews SET expires_at='2999-01-01' WHERE id=?1",
            [&page.preview.request_id],
        )
        .unwrap();
    store
        .connection
        .execute("DELETE FROM conversations WHERE id=?1", [conversation])
        .unwrap();
    assert!(
        store
            .accept_drill_items(&page.preview.request_id, &ids)
            .is_err()
    );
    assert!(store.drill_items("spanish").unwrap().is_empty());
}

#[test]
fn discard_releases_unaccepted_candidates_but_keeps_acceptance_idempotent() {
    let (_dir, mut store, scope, _) = setup();
    let page = store
        .conversation_drill_candidates(ConversationDrillInput {
            scope,
            cursor: None,
            limit: 2,
        })
        .unwrap();
    let first = &page.preview.candidates[0].candidate_id;
    let second = &page.preview.candidates[1].candidate_id;
    let items = store
        .accept_drill_items(&page.preview.request_id, std::slice::from_ref(first))
        .unwrap();
    store
        .discard_drill_preview(&page.preview.request_id)
        .unwrap();
    assert_eq!(
        store
            .drill_preview(&page.preview.request_id)
            .unwrap()
            .candidates
            .len(),
        1
    );
    assert_eq!(
        store
            .accept_drill_items(&page.preview.request_id, std::slice::from_ref(first))
            .unwrap()[0]
            .id,
        items[0].id
    );
    assert!(
        store
            .accept_drill_items(&page.preview.request_id, std::slice::from_ref(second))
            .is_err()
    );
    assert_eq!(store.drill_items("spanish").unwrap().len(), 1);
}
