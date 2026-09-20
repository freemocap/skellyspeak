use super::*;

#[test]
fn declared_dependencies_control_release_dispatch_and_inspection() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let plan = crate::conversations::turn_plan::PLAN;
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    let run = view.turns.iter().find(|item| item.id == turn).unwrap();
    for operation in &run.operations {
        let declaration = plan
            .iter()
            .find(|node| node.kind == operation.kind)
            .unwrap();
        let parents: Vec<_> = operation
            .dependencies
            .iter()
            .map(|parent| {
                run.operations
                    .iter()
                    .find(|node| &node.id == parent)
                    .unwrap()
                    .kind
                    .as_str()
            })
            .collect();
        assert_eq!(parents, declaration.dependencies);
    }
    // A ready flag cannot bypass the declared source prerequisite.
    store
        .connection
        .execute(
            "UPDATE operations SET state='waiting_dependencies' WHERE turn_id=?1",
            [&turn],
        )
        .unwrap();
    store
        .connection
        .execute(
            "UPDATE operations SET state='ready' WHERE turn_id=?1 AND kind='reply_brief'",
            [&turn],
        )
        .unwrap();
    assert!(
        store
            .dispatch()
            .err()
            .expect("dispatch must enforce dependencies")
            .message
            .contains("unsatisfied declared dependencies")
    );
    assert_eq!(
        store
            .connection
            .query_row("SELECT count(*) FROM attempts", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
    store
        .connection
        .execute(
            "UPDATE operations SET state='waiting_dependencies' WHERE turn_id=?1",
            [&turn],
        )
        .unwrap();
    store
        .connection
        .execute(
            "UPDATE operations SET state='succeeded' WHERE turn_id=?1 AND kind='persona_reply'",
            [&turn],
        )
        .unwrap();
    super::super::graph::release_dependents(&store.connection, &turn).unwrap();
    for node in plan
        .iter()
        .filter(|node| node.dependencies == ["persona_reply"])
    {
        let state: Option<String> = store
            .connection
            .query_row(
                "SELECT state FROM operations WHERE turn_id=?1 AND kind=?2",
                params![turn, node.kind],
                |row| row.get(0),
            )
            .optional()
            .unwrap();
        if let Some(state) = state {
            assert_eq!(state, "ready", "{}", node.kind);
        }
    }
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT state FROM operations WHERE turn_id=?1 AND kind='skill_assessment'",
                [&turn],
                |row| row.get::<_, String>(0)
            )
            .unwrap(),
        "waiting_dependencies"
    );
}
