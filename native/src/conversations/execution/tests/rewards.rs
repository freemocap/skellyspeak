use super::*;

#[test]
fn reward_difficulty_and_calendar_week_novelty_use_captured_evidence() {
    let (_dir, mut store, conversation) = setup();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.difficulty','advanced') WHERE conversation_id=?1",[&conversation]).unwrap();
    for (wording, date, expected) in [
        ("¿Dónde está Ana?", "2026-09-07T12:00:00Z", 42),
        ("¿Dónde está Luis?", "2026-09-08T12:00:00Z", 21),
        ("¿Dónde está Juan?", "2026-09-14T12:00:00Z", 25),
    ] {
        let mut command = send(&store, &conversation);
        if let Action::SendMessage { text, .. } = &mut command.action {
            *text = wording.into();
        }
        let turn = store.execute(command).unwrap().entity_id;
        finish_fixture_exchange(&mut store, &turn, "En casa.");
        store
            .connection
            .execute(
                "UPDATE messages SET created_at=?2 WHERE turn_id=?1 AND role='user'",
                params![turn, date],
            )
            .unwrap();
        fixture_evidence(&store, &turn, wording);
        let snapshot = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
        let credits = snapshot["profile"]["credits"].as_array().unwrap();
        let credit = credits
            .iter()
            .find(|credit| credit["attempt_id"] == format!("evidence-{turn}"))
            .unwrap();
        assert_eq!(credit["xp"], expected);
    }
}

#[test]
fn reward_awards_and_claims_are_durable_source_bound_and_idempotent() {
    let (dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "Hello.");
    fixture_evidence(&store, &first, "¿cómo estás?");
    let before = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(before["profile"]["xp"], 30);
    let id = before["profile"]["credits"][0]["event"]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    assert!(
        crate::learning::rewards::claim(&mut store.connection, "arabic", std::slice::from_ref(&id))
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        crate::learning::rewards::claim(
            &mut store.connection,
            "spanish",
            std::slice::from_ref(&id)
        )
        .unwrap()
        .len(),
        1
    );
    assert!(
        crate::learning::rewards::claim(
            &mut store.connection,
            "spanish",
            std::slice::from_ref(&id)
        )
        .unwrap()
        .is_empty()
    );
    let duplicate = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &duplicate, "Hello again.");
    fixture_evidence(&store, &duplicate, "¿cómo estás?");
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        30
    );
    // A changed current policy cannot rewrite a captured earned award.
    store.connection.execute("UPDATE turns SET context=json_set(context,'$.gamePolicy.base.demonstrated',99) WHERE id=?1",[&first]).unwrap();
    crate::learning::rewards::publish(&store.connection, &first, "replay").unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        30
    );
    drop(store);
    let mut reopened = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert!(
        crate::learning::rewards::claim(&mut reopened.connection, "spanish", &[id])
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        crate::learning::learner::progression::snapshot(&reopened, "spanish").unwrap()["profile"]["xp"],
        30
    );
}

#[test]
fn learner_projection_reads_published_evidence_without_new_work_and_survives_restart() {
    let (dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    finish_fixture_exchange(&mut store, &turn, "Reply.");
    fixture_evidence(&store, &turn, "¿cómo estás?");
    let revision = store.snapshot().unwrap().revision;
    let at = 2000000000;
    let before = crate::learning::learner::learner_state::snapshot(&store, "spanish", at).unwrap();
    assert_eq!(before.constructs.len(), 1);
    assert_eq!(before.constructs[0].independent_n, 1);
    assert_eq!(revision, store.snapshot().unwrap().revision);
    drop(store);
    let reopened = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    let after =
        crate::learning::learner::learner_state::snapshot(&reopened, "spanish", at).unwrap();
    assert_eq!(
        serde_json::to_value(before.constructs).unwrap(),
        serde_json::to_value(after.constructs).unwrap()
    );
}
