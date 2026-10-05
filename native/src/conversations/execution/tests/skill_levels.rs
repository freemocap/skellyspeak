use super::*;
use crate::learning::{learner::progression, rewards::skill_level_events as events};

#[test]
fn receipt_failure_rolls_back_credit_publication_and_retry_remains_possible() {
    let (_dir, mut store, chat) = setup();
    let turn = store.execute(send(&store, &chat)).unwrap().entity_id;
    let work = skill_assessment::assessment(&mut store, &turn);
    let result = skill_assessment::presence(&work, &[("information_exchange", "direct")]);
    store.connection.execute_batch("CREATE TRIGGER reject_level BEFORE INSERT ON skill_level_events BEGIN SELECT RAISE(ABORT,'fixture'); END;").unwrap();
    assert!(store.finish(&work, Ok(result.clone())).is_err());
    let snapshot = progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(snapshot["profile"]["xp"], 0);
    assert!(
        snapshot["profile"]["pendingLevelEvents"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    store
        .connection
        .execute_batch("DROP TRIGGER reject_level;")
        .unwrap();
    store.finish(&work, Ok(result)).unwrap();
    assert_eq!(
        progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        1
    );
}

#[test]
fn upgrades_preserve_actual_skill_awards_and_claims_from_both_supported_formats() {
    for version in [45, 46] {
        let (dir, mut store, chat) = setup();
        let turn = store.execute(send(&store, &chat)).unwrap().entity_id;
        finish_fixture_exchange(&mut store, &turn, "Reply.");
        fixture_evidence(&store, &turn, "Question?");
        let snapshot = progression::snapshot(&store, "spanish").unwrap();
        let id = snapshot["profile"]["credits"][0]["event"]["id"]
            .as_str()
            .unwrap()
            .to_owned();
        crate::learning::rewards::claim(&mut store.connection, "spanish", &[id]).unwrap();
        let before =
            progression::snapshot(&store, "spanish").unwrap()["profile"]["credits"].clone();
        store
            .connection
            .execute_batch("DROP TABLE skill_level_events; UPDATE learner SET preferences=json_remove(preferences,'$.execution');")
            .unwrap();
        store
            .connection
            .pragma_update(None, "user_version", version)
            .unwrap();
        drop(store);
        let mut reopened = Store::open(&dir.path().join("test.sqlite3")).unwrap();
        let after = progression::snapshot(&reopened, "spanish").unwrap();
        assert_eq!(after["profile"]["credits"], before);
        assert_eq!(after["profile"]["xp"], 1);
        assert_eq!(
            events::initialize(&mut reopened, "spanish").unwrap().len(),
            1
        );
    }
}

#[test]
fn successful_publication_exposes_live_source_and_does_not_duplicate_on_replay() {
    let (_dir, mut store, chat) = setup();
    let turn = store.execute(send(&store, &chat)).unwrap().entity_id;
    let work = skill_assessment::assessment(&mut store, &turn);
    let result = skill_assessment::presence(&work, &[("information_exchange", "direct")]);
    store.finish(&work, Ok(result.clone())).unwrap();
    let snapshot = progression::snapshot(&store, "spanish").unwrap();
    let pending: Vec<events::SkillLevelEvent> =
        serde_json::from_value(snapshot["profile"]["pendingLevelEvents"].clone()).unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(
        pending[0].source_attempt_id.as_deref(),
        Some(work.attempt.as_str())
    );
    assert_eq!(pending[0].chat_id.as_deref(), Some(chat.as_str()));
    assert_eq!(
        pending[0].message_id,
        snapshot["records"][0]["message_id"]
            .as_i64()
            .map(|n| n as i32)
    );
    store.finish(&work, Ok(result)).unwrap();
    assert_eq!(events::initialize(&mut store, "spanish").unwrap(), pending);
    assert_eq!(
        progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        1
    );
}

#[test]
fn level_claims_follow_real_evidence_exclusions_deletion_and_restart() {
    let (dir, mut store, chat) = setup();
    for _ in 0..2 {
        let turn = store.execute(send(&store, &chat)).unwrap().entity_id;
        finish_fixture_exchange(&mut store, &turn, "Reply.");
        fixture_evidence(&store, &turn, "Question?");
    }
    let snapshot = progression::snapshot(&store, "spanish").unwrap();
    assert!(
        snapshot["profile"]["pendingLevelEvents"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(snapshot["profile"]["xp"], 2);
    assert_eq!(snapshot["profile"]["levels"]["level"], 0);
    let pending = events::initialize(&mut store, "spanish").unwrap();
    assert_eq!(pending.len(), 2);
    assert!(pending.iter().all(|e| e.source_attempt_id.is_none()));
    assert_eq!(pending, events::initialize(&mut store, "spanish").unwrap());
    let ids: Vec<_> = pending.iter().map(|e| e.id.clone()).collect();
    assert!(events::claim(&mut store, "arabic", &ids).is_err());
    assert!(events::claim(&mut store, "spanish", &ids[1..]).is_err());
    assert!(events::claim(&mut store, "spanish", &[ids[0].clone(), ids[0].clone()]).is_err());
    assert!(events::claim(&mut store, "spanish", &vec!["invalid".into(); 101]).is_err());
    let excluded: Vec<_> = snapshot["profile"]["credits"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["attempt_id"].clone())
        .collect();
    store
        .connection
        .execute(
            "INSERT INTO skill_choices VALUES('spanish',1,NULL,?1)",
            [serde_json::to_string(&excluded).unwrap()],
        )
        .unwrap();
    assert!(events::claim(&mut store, "spanish", &ids).is_err());
    assert!(
        events::initialize(&mut store, "spanish")
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        0
    );
    store
        .connection
        .execute("UPDATE skill_choices SET excluded='[]'", [])
        .unwrap();
    assert_eq!(
        events::claim(&mut store, "spanish", &ids[..1]).unwrap(),
        pending[..1]
    );
    assert!(
        events::claim(&mut store, "spanish", &ids[..1])
            .unwrap()
            .is_empty()
    );
    drop(store);
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    // A second claimant may replay the first claim but cannot consume it twice.
    assert_eq!(
        events::claim(&mut store, "spanish", &ids).unwrap(),
        pending[1..]
    );
    store
        .connection
        .execute("DELETE FROM conversations WHERE id=?1", [&chat])
        .unwrap();
    assert_eq!(
        progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        0
    );
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM skill_level_events WHERE claimed=1",
                [],
                |r| r.get::<_, i32>(0)
            )
            .unwrap(),
        2
    );
    assert!(
        events::initialize(&mut store, "spanish")
            .unwrap()
            .is_empty()
    );
}
