use super::*;
use crate::ai::{graph as g, graph_store};
use std::sync::Arc;

/// A retained domain-message fixture with a real native engine/Begin and no
/// legacy operations. The empty executable tests channel consumers, not coach
/// generation or publication (those have separate adapter tests).
fn graph_messages(store: &mut Store, conversation: &str, channel: &str) -> String {
    let graph = Arc::new(
        g::Registry::default()
            .compile(g::Definition {
                contract: g::Contract::new("channel-fixture", 1),
                inputs: Default::default(),
                outputs: Default::default(),
                nodes: Default::default(),
                results: Default::default(),
                compositions: Default::default(),
            })
            .unwrap(),
    );
    let partition = graph_store::Partition {
        conversation: conversation.into(),
        catalog: graph_store::catalog_id([graph.identity()]).unwrap(),
    };
    let limits = g::DurableLimits {
        record_reads: g::RecordReadLimits {
            records: 100,
            bytes: 1_000_000,
        },
        state: g::StateLimits {
            runs: 10,
            attempts: 10,
            executions: 10,
        },
        checkpoint: g::CheckpointLimits {
            bytes: 100_000,
            events: 100,
        },
        settlement_event_bytes: 8192,
        history: g::HistoryLimits {
            bytes: 1_000_000,
            events: 1000,
            segments: 100,
        },
    };
    let mut context: serde_json::Value = store
        .connection
        .query_row(
            "SELECT context FROM turns WHERE conversation_id=?1 ORDER BY rowid DESC LIMIT 1",
            [conversation],
            |r| r.get::<_, String>(0),
        )
        .optional()
        .unwrap()
        .map(|raw| serde_json::from_str(&raw).unwrap())
        .unwrap_or_else(|| serde_json::json!({}));
    context["guideContext"] = serde_json::json!({"title":"Retained guide"});
    let turn = id();
    let tx = store.connection.transaction().unwrap();
    tx.execute("INSERT INTO turns(id,conversation_id,state,paused,profile_revision,credential_id,route,model,context) VALUES(?1,?2,'succeeded',0,1,'test-credential','hosted','fixture',?3)",params![turn,conversation,context.to_string()]).unwrap();
    for (role, text) in [
        ("user", "Private graph question"),
        ("assistant", "Private graph answer"),
    ] {
        tx.execute("INSERT INTO messages(id,conversation_id,turn_id,sequence,role,text) SELECT ?1,?2,?3,coalesce(max(sequence),0)+1,?4,?5 FROM messages WHERE conversation_id=?2",params![id(),conversation,turn,role,text]).unwrap();
    }
    let callback = |db: &Connection, request: &g::CommitRequest<'_>| {
        let g::CommitIntent::Begin { authority, .. } = &request.intent else {
            panic!("expected Begin")
        };
        db.execute(
            "INSERT INTO turn_execution_owners VALUES(?1,'graph',?2,?3,?4,?5)",
            params![
                turn,
                channel,
                request.next.stamp().engine,
                authority.run,
                authority.artifact
            ],
        )
        .map_err(|_| g::Fault {
            code: "fixture_owner".into(),
            path: "owner".into(),
        })?;
        Ok(())
    };
    let mut adapter = graph_store::TransactionStore::new(tx, partition, 100_000, callback);
    g::DurableEngine::create_with_run(
        [graph.clone()],
        limits,
        g::Event::Begin {
            run: turn.clone(),
            artifact: graph.identity().into(),
            inputs: Default::default(),
            scope: "fixture".into(),
            policy: Default::default(),
        },
        &mut adapter,
    )
    .unwrap();
    drop(adapter);
    turn
}

#[test]
fn graph_coach_history_uses_declared_channel_and_keeps_guides_out_of_persona_prompts() {
    let (_dir, mut store, conversation) = setup();
    let graph_turn = graph_messages(&mut store, &conversation, "coach");
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(view.messages.is_empty());
    assert_eq!(view.coach_messages.len(), 2);
    assert_eq!(
        view.coach_messages[0].guide_context.as_ref().unwrap()["title"],
        "Retained guide"
    );
    assert!(
        store
            .message_history(&conversation, &view.coach_messages[0].id)
            .is_err()
    );
    let revision = store.snapshot().unwrap().conversations[0].revision;
    let followup = apply(
        &mut store,
        Action::AskCoach {
            conversation_id: conversation.clone(),
            text: "Why?".into(),
            expected_revision: revision,
        },
    )
    .entity_id;
    let context = wave2_context(&store, &followup);
    let history = context["messages"].as_array().unwrap();
    assert!(history.iter().any(|m| {
        m["content"]
            .as_str()
            .is_some_and(|s| s.contains("Private graph question") && s.contains("Retained guide"))
    }));
    assert!(
        history
            .iter()
            .any(|m| m["content"] == "Private graph answer")
    );
    assert!(
        context["coachSources"]
            .as_array()
            .unwrap()
            .iter()
            .any(|m| m["text"] == "Private graph answer")
    );
    finish_fixture_exchange(&mut store, &followup, "Followup reply");
    let persona = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let context = wave2_context(&store, &persona);
    assert!(context["messages"].as_array().unwrap().iter().all(|m| {
        let text = m["content"].as_str().unwrap();
        !text.contains("Private graph")
            && !text.contains("Retained guide")
            && !text.contains("Followup reply")
    }));
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM operations WHERE turn_id=?1",
                [graph_turn],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
}

#[test]
fn persona_revision_preserves_graph_coach_messages_receipts_and_native_storage() {
    let (dir, mut store, conversation) = setup();
    let original = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &original, "Original reply");
    // Channel identity survives removal of execution-detail rows.
    store
        .connection
        .execute("DELETE FROM operations WHERE turn_id=?1", [&original])
        .unwrap();
    let coach = graph_messages(&mut store, &conversation, "coach");
    store.connection.execute("INSERT INTO receipts(action_id,request,receipt,conversation_id) VALUES('graph-receipt',?1,?2,?3)",params![serde_json::json!({"turnId":coach}).to_string(),serde_json::json!({"entityId":coach}).to_string(),conversation]).unwrap();
    let checkpoint: Vec<u8> = store
        .connection
        .query_row("SELECT checkpoint FROM graph_engines", [], |r| r.get(0))
        .unwrap();
    let later = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &later, "Later reply");
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    let count = view
        .revision_suffix_counts
        .iter()
        .find(|c| c.turn_id == original)
        .unwrap();
    assert_eq!((count.exchange_count, count.coach_turn_count), (1, 0));
    let replacement = store
        .execute(revision_command(
            &store,
            &conversation,
            &original,
            "Revised wording",
        ))
        .unwrap()
        .entity_id;
    assert!(
        !store
            .connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM turns WHERE id=?1)",
                [later],
                |r| r.get::<_, bool>(0)
            )
            .unwrap()
    );
    assert_eq!(
        store
            .connection
            .query_row("SELECT checkpoint FROM graph_engines", [], |r| r
                .get::<_, Vec<u8>>(0))
            .unwrap(),
        checkpoint
    );
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM receipts WHERE action_id='graph-receipt'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        1
    );
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(view.coach_messages.len(), 2);
    assert!(view.coach_messages.iter().all(|m| m.turn_id == coach));
    let source = view
        .messages
        .iter()
        .find(|m| m.turn_id == original && m.role == "user")
        .unwrap();
    let history = store.message_history(&conversation, &source.id).unwrap();
    assert_eq!(history.versions.len(), 2);
    assert_eq!(history.versions[1].turn_id, replacement);
    assert_eq!(
        store
            .execute(revision_command(
                &store,
                &conversation,
                &coach,
                "Wrong channel"
            ))
            .unwrap_err()
            .code,
        ErrorCode::Conflict
    );
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .coach_messages
            .len(),
        2
    );
    assert_eq!(
        store
            .connection
            .query_row("SELECT checkpoint FROM graph_engines", [], |r| r
                .get::<_, Vec<u8>>(0))
            .unwrap(),
        checkpoint
    );
}

#[test]
fn graph_persona_target_remains_unsupported_but_suffix_can_be_discarded() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "First reply");
    let graph_turn = graph_messages(&mut store, &conversation, "persona_reply");
    let revision = store.snapshot().unwrap().revision;
    assert_eq!(
        store
            .execute(revision_command(
                &store,
                &conversation,
                &graph_turn,
                "Revision"
            ))
            .unwrap_err()
            .code,
        ErrorCode::Conflict
    );
    assert_eq!(store.snapshot().unwrap().revision, revision);
    assert_eq!(
        store
            .connection
            .query_row("SELECT count(*) FROM turns", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        2
    );
    assert_eq!(
        store
            .connection
            .query_row("SELECT state FROM turns WHERE id=?1", [&first], |r| r
                .get::<_, String>(0))
            .unwrap(),
        "succeeded"
    );
    store
        .execute(revision_command(&store, &conversation, &first, "Revision"))
        .unwrap();
    for table in ["turns", "messages", "turn_execution_owners"] {
        let column = if table == "turns" { "id" } else { "turn_id" };
        let count: i64 = store
            .connection
            .query_row(
                &format!("SELECT count(*) FROM {table} WHERE {column}=?1"),
                [&graph_turn],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "discarded suffix remains in {table}");
    }
}

#[test]
fn unknown_historical_channel_is_retained_without_guessing_a_prompt_channel() {
    let (_dir, mut store, conversation) = setup();
    store.connection.execute("INSERT INTO turns(id,conversation_id,state,paused,profile_revision,credential_id,route,model,context) VALUES('unknown',?1,'unknown',1,1,'fixture','hosted','fixture','{}')",[&conversation]).unwrap();
    store
        .connection
        .execute(
            "INSERT INTO turn_execution_owners VALUES('unknown','legacy','unknown',NULL,NULL,NULL)",
            [],
        )
        .unwrap();
    store.connection.execute("INSERT INTO messages(id,conversation_id,turn_id,sequence,role,text) VALUES('unknown-message',?1,'unknown',1,'user','Unclassified historical text')",[&conversation]).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(view.messages.is_empty());
    assert!(view.coach_messages.is_empty());
    assert!(
        store
            .turn_history(&conversation, None, 100)
            .unwrap()
            .turns
            .iter()
            .any(|t| t.id == "unknown")
    );
    assert!(
        store
            .message_history(&conversation, "unknown-message")
            .is_err()
    );
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let captured = wave2_context(&store, &turn);
    assert!(
        !captured["messages"]
            .to_string()
            .contains("Unclassified historical text")
    );
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT text FROM messages WHERE id='unknown-message'",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "Unclassified historical text"
    );
}
