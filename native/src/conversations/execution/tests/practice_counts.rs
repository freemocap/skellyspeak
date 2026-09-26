//! Exercises the new publication boundary against the real store and revision path.
//! Until the graph is switched, invoke presence publication explicitly in the fixture.
use super::*;
use crate::learning::practice::{self, Presence};
use std::collections::BTreeMap;
fn observe(store: &mut Store, turn: &str) -> practice::Observation {
    assert!(store.dispatch().unwrap().is_none());
    loop {
        let work = store.dispatch().unwrap().expect("ready fixture work");
        let kind: String = store
            .connection
            .query_row(
                "SELECT kind FROM operations WHERE id=?1",
                [&work.operation],
                |r| r.get(0),
            )
            .unwrap();
        if kind == "skill_assessment" {
            let tx = store.connection.transaction().unwrap();
            let presence = BTreeMap::from([("past_reference".into(), Presence::Direct)]);
            let result = practice::publish(
                &tx,
                turn,
                &work.attempt,
                presence.clone(),
                &presence.keys().cloned().collect(),
            )
            .unwrap();
            tx.commit().unwrap();
            return result;
        }
        // Leave the persona request running; no provider calls occur in this fixture.
    }
}
#[test]
fn practice_credits_survive_real_revision_and_store_reopen() {
    let (dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let original = observe(&mut store, &first);
    assert_eq!(original.credits[0].experience, 1);
    finish_fixture_exchange(&mut store, &first, "fixture reply");
    let second = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "A changed attempt",
        ))
        .unwrap()
        .entity_id;
    let revised = observe(&mut store, &second);
    assert_eq!(revised.credits[0].effort, 1);
    finish_fixture_exchange(&mut store, &second, "fixture reply");
    let third = store
        .execute(revision_command(
            &store,
            &conversation,
            &second,
            "A changed attempt",
        ))
        .unwrap()
        .entity_id;
    assert!(observe(&mut store, &third).credits.is_empty());
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    let sum:i64=store.connection.query_row("SELECT sum(json_extract(c.value,'$.xp')) FROM turns t,json_each(t.context,'$.practiceObservation.credits') c",[],|r|r.get(0)).unwrap();
    assert_eq!(sum, 2);
}
