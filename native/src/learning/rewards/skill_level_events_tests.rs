use super::*;
use serde_json::json;

fn snapshot(points: usize) -> Value {
    let catalog = json!([{"kind":"skill","id":"b"},{"kind":"skill","id":"a"}]);
    let credits: Vec<_> = (0..points)
        .flat_map(|n| ["b", "a"].map(|skill| json!({"attempt_id":n.to_string(),"skill_id":skill})))
        .collect();
    json!({"learner_id":"learner","target":"spanish","profile":{
        "levels":crate::learning::learner::skill_levels::project(&catalog,&credits).unwrap()}})
}

fn database() -> Connection {
    let db = Connection::open_in_memory().unwrap();
    db.execute_batch(
        "CREATE TABLE learner(id TEXT PRIMARY KEY); INSERT INTO learner VALUES('learner');",
    )
    .unwrap();
    db.execute_batch(include_str!("../../storage/schemas/skill_level_events.sql"))
        .unwrap();
    db
}

#[test]
fn catch_up_is_ordered_source_free_idempotent_and_transactional() {
    let mut db = database();
    let value = snapshot(3);
    {
        let tx = db.transaction().unwrap();
        synchronize(&tx, &value, None).unwrap();
    }
    assert!(pending(&db, &value).unwrap().is_empty());
    let tx = db.transaction().unwrap();
    synchronize(&tx, &value, None).unwrap();
    tx.commit().unwrap();
    let events = pending(&db, &value).unwrap();
    assert_eq!(events.len(), 9);
    for (n, group) in events.chunks(3).enumerate() {
        assert_eq!(group[0].skill_id.as_deref(), Some("b"));
        assert_eq!(group[1].skill_id.as_deref(), Some("a"));
        assert_eq!(group[2].kind, SkillLevelEventKind::LanguageLevel);
        assert_eq!(group[2].to_level, n as u32 + 1);
        assert!(group.iter().all(|event| event.source_attempt_id.is_none()));
    }
    let tx = db.transaction().unwrap();
    synchronize(&tx, &value, None).unwrap();
    tx.commit().unwrap();
    assert_eq!(events, pending(&db, &value).unwrap());
    assert!(pending(&db, &snapshot(0)).unwrap().is_empty());
    assert_eq!(events, pending(&db, &value).unwrap());
    let mut other = value.clone();
    other["target"] = json!("arabic");
    assert!(pending(&db, &other).unwrap().is_empty());
    other["target"] = json!("spanish");
    other["learner_id"] = json!("other");
    assert!(pending(&db, &other).unwrap().is_empty());
}

#[test]
fn live_source_applies_only_to_new_milestones_and_claims_bound_results() {
    let mut db = database();
    let tx = db.transaction().unwrap();
    synchronize(&tx, &snapshot(1), None).unwrap();
    synchronize(
        &tx,
        &snapshot(2),
        Some(Source {
            attempt: "new",
            chat: "chat",
            message: 9,
        }),
    )
    .unwrap();
    tx.commit().unwrap();
    let events = pending(&db, &snapshot(2)).unwrap();
    assert!(events[..3].iter().all(|e| e.source_attempt_id.is_none()));
    assert!(
        events[3..]
            .iter()
            .all(|e| e.source_attempt_id.as_deref() == Some("new") && e.message_id == Some(9))
    );
    db.execute("UPDATE skill_level_events SET claimed=1", [])
        .unwrap();
    let tx = db.transaction().unwrap();
    synchronize(&tx, &snapshot(0), None).unwrap();
    synchronize(&tx, &snapshot(2), None).unwrap();
    tx.commit().unwrap();
    assert!(pending(&db, &snapshot(2)).unwrap().is_empty());
}

#[test]
fn pending_batches_are_bounded_and_resume_in_sequence() {
    let mut db = database();
    let catalog: Vec<_> = (0..12)
        .map(|n| json!({"kind":"skill","id":n.to_string()}))
        .collect();
    let credits: Vec<_> = (0..89)
        .flat_map(|n| {
            (0..12)
                .map(move |skill| json!({"attempt_id":n.to_string(),"skill_id":skill.to_string()}))
        })
        .collect();
    let value = json!({"learner_id":"learner","target":"spanish","profile":{
        "levels":crate::learning::learner::skill_levels::project(&json!(catalog),&credits).unwrap()}});
    let tx = db.transaction().unwrap();
    synchronize(&tx, &value, None).unwrap();
    tx.commit().unwrap();
    let first = pending(&db, &value).unwrap();
    assert_eq!(first.len(), 100);
    db.execute(
        "UPDATE skill_level_events SET claimed=1 WHERE sequence<=?1",
        [first.last().unwrap().sequence],
    )
    .unwrap();
    let second = pending(&db, &value).unwrap();
    assert_eq!(second.len(), 30);
    assert!(second[0].sequence > first.last().unwrap().sequence);
}
