use super::*;

#[test]
fn skill_direction_contract_upgrades_every_supported_format_without_rewriting_history() {
    for start in 45..=50 {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("workspace");
        let mut db = baseline(&path, true);
        run_chain(&mut db, 45, start, &STEPS[..(start - 45) as usize], |_| {
            Ok(())
        })
        .unwrap();
        let awards = rows(&db, "effort_awards");
        let topics = rows(&db, "saved_topics");
        drop(db);
        let store = Store::open(&path).unwrap();
        assert_eq!(version(&store.connection), 51);
        assert_eq!(rows(&store.connection, "effort_awards"), awards);
        assert_eq!(rows(&store.connection, "saved_topics"), topics);
        validate_current_schema(&store.connection).unwrap();
        drop(store);
        let reopened = Store::open(&path).unwrap();
        assert_eq!(version(&reopened.connection), 51);
        assert_eq!(
            std::fs::read_dir(dir.path().join("migration-backups"))
                .unwrap()
                .count(),
            1
        );
    }
}

#[test]
fn skill_direction_step_preserves_populated_records_and_rolls_back_on_failure() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = super::assessment::populated(&dir.path().join("workspace"));
    run_chain(&mut db, 47, 50, &STEPS[..5], validate_current_schema).unwrap();
    let settings = serde_json::json!({"difficulty":"beginner","direction":{"topic":{"kind":"custom","text":"A family meal"},"timeReference":"past","usePersonaDetails":true},"explanationLanguage":"english","varietyId":"spanish-spain","explanationVarietyId":"english-united-states","composingHelp":"balanced","coachProactivity":"on_request","translation":true,"pronunciation":false,"romanization":false,"autoSend":true,"readAloud":false,"speechVoice":"alloy"});
    db.execute(
        "INSERT INTO conversation_settings VALUES('chat',3,?1)",
        [settings.to_string()],
    )
    .unwrap();
    let tables = [
        "conversation_settings",
        "messages",
        "turns",
        "message_assessments",
        "effort_awards",
        "learner",
        "receipts",
    ];
    let before: Vec<_> = tables.iter().map(|table| rows(&db, table)).collect();
    assert!(
        run_chain(&mut db, 50, 51, STEPS, |_| Err(AppError::new(
            ErrorCode::Storage,
            "Injected final failure"
        )))
        .is_err()
    );
    assert_eq!(version(&db), 50);
    run_chain(&mut db, 50, 51, STEPS, validate_current_schema).unwrap();
    run_chain(&mut db, 51, 51, STEPS, validate_current_schema).unwrap();
    for (table, expected) in tables.iter().zip(before) {
        assert_eq!(rows(&db, table), expected, "{table}");
    }
}
