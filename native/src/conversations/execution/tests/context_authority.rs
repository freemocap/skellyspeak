use super::*;

#[test]
fn context_refinement_does_not_replace_transactional_source_authorization() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let mut captured = wave2_context(&store, &turn);
    // Structurally valid context with a source that the owner cannot read.
    captured["sourceIds"] = serde_json::json!(["unavailable-source"]);
    store
        .connection
        .execute(
            "UPDATE turns SET context=?2 WHERE id=?1",
            params![turn, captured.to_string()],
        )
        .unwrap();
    let revision = store.snapshot().unwrap().revision;
    let error = store
        .dispatch()
        .err()
        .expect("source authorization must fail");
    assert_eq!(
        error.message,
        "A captured conversation source is unavailable or outside this turn's scope."
    );
    let (state, attempts): (String, i32) = store.connection.query_row(
        "SELECT state,(SELECT count(*) FROM attempts WHERE operation_id=o.id) FROM operations o WHERE turn_id=?1 AND kind='persona_context'",
        [&turn], |r| Ok((r.get(0)?, r.get(1)?)),
    ).unwrap();
    assert_eq!(state, "ready");
    assert_eq!(attempts, 0);
    assert_eq!(store.snapshot().unwrap().revision, revision);
}
