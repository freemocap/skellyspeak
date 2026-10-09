use super::*;
use crate::ai::graph::EvidenceLimits;

#[tokio::test]
async fn editing_removes_native_suffix_ownership_without_rewriting_graph_history() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "Original response");
    let later = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let tx = store.connection.transaction().unwrap();
    tx.execute("DELETE FROM operations WHERE turn_id=?1", [&later])
        .unwrap();
    tx.execute(
        "DELETE FROM turn_execution_owners WHERE turn_id=?1",
        [&later],
    )
    .unwrap();
    store
        .graph_runtime
        .admit(
            tx,
            &later,
            graph_runtime::Admission::Partner(context::Kind::Reply),
        )
        .unwrap();
    let claim = store
        .graph_runtime
        .next(
            &mut store.connection,
            true,
            &store.config,
            &store.session_id,
        )
        .unwrap()
        .unwrap();
    assert_eq!(claim.run, later);
    let before: Vec<u8> = store
        .connection
        .query_row(
            "SELECT checkpoint FROM graph_engines WHERE conversation_id=?1",
            [&conversation],
            |r| r.get(0),
        )
        .unwrap();
    let command = revision_command(&store, &conversation, &first, "Texto corregido");
    let replacement = store.execute(command.clone()).unwrap();
    assert_eq!(
        store.execute(command).unwrap().entity_id,
        replacement.entity_id
    );
    let after: Vec<u8> = store
        .connection
        .query_row(
            "SELECT checkpoint FROM graph_engines WHERE conversation_id=?1",
            [&conversation],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(before, after);
    for table in ["turns", "messages", "turn_execution_owners"] {
        let key = if table == "turns" { "id" } else { "turn_id" };
        assert_eq!(
            store
                .connection
                .query_row(
                    &format!("SELECT count(*) FROM {table} WHERE {key}=?1"),
                    [&later],
                    |r| r.get::<_, i64>(0)
                )
                .unwrap(),
            0
        );
    }
    // A response to an already claimed operation may finish in retained history,
    // but has no product owner to publish to or schedule further work for.
    let report = claim
        .invocation
        .execute(EvidenceLimits {
            observations: 16,
            bytes: 65536,
        })
        .await;
    store
        .graph_runtime
        .finish(&mut store.connection, &conversation, &later, report)
        .unwrap();
    assert!(
        store
            .graph_runtime
            .next(
                &mut store.connection,
                true,
                &store.config,
                &store.session_id
            )
            .unwrap()
            .is_none()
    );
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM messages WHERE turn_id=?1",
                [&later],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT replaces_turn_id FROM turns WHERE id=?1",
                [&replacement.entity_id],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        first
    );
}
