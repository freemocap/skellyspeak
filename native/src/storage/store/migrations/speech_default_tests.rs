use super::*;

#[test]
fn speech_default_upgrades_all_supported_formats_and_preserves_history() {
    for start in 45..=51 {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("workspace");
        let mut db = baseline(&path, true);
        run_chain(&mut db, 45, start, &STEPS[..(start - 45) as usize], |_| {
            Ok(())
        })
        .unwrap();
        db.execute("UPDATE ai_config SET audio_settings=json_set(audio_settings,'$.speech.model','eleven_v3')", []).unwrap();
        let awards = rows(&db, "effort_awards");
        let topics = rows(&db, "saved_topics");
        drop(db);
        let mut db = Connection::open(&path).unwrap();
        run_chain(&mut db, start, 52, &STEPS[..7], |_| Ok(())).unwrap();
        let model: String = db
            .query_row(
                "SELECT json_extract(audio_settings,'$.speech.model') FROM ai_config",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(model, "eleven_v4_turbo");
        drop(db);
        let store = Store::open(&path).unwrap();
        let model: String = store
            .connection
            .query_row(
                "SELECT json_extract(audio_settings,'$.speech.model') FROM ai_config",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(model, "eleven_v4_turbo");
        assert_eq!(version(&store.connection), SCHEMA_VERSION);
        assert_eq!(rows(&store.connection, "effort_awards"), awards);
        assert_eq!(rows(&store.connection, "saved_topics"), topics);
        let config = rows(&store.connection, "ai_config");
        drop(store);
        let reopened = Store::open(&path).unwrap();
        assert_eq!(rows(&reopened.connection, "ai_config"), config);
    }
}

#[test]
fn speech_default_is_transactional_and_keeps_custom_models() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = baseline(&dir.path().join("workspace"), true);
    run_chain(&mut db, 45, 51, &STEPS[..6], |_| Ok(())).unwrap();
    let config = rows(&db, "ai_config");
    run_chain(&mut db, 51, 52, &STEPS[..7], |_| Ok(())).unwrap();
    assert_eq!(rows(&db, "ai_config"), config);
    db.pragma_update(None, "user_version", 51).unwrap();
    db.execute(
        "UPDATE ai_config SET audio_settings=json_set(audio_settings,'$.speech.model','eleven_v3')",
        [],
    )
    .unwrap();
    let before = rows(&db, "ai_config");
    assert!(
        run_chain(&mut db, 51, 52, &STEPS[..7], |_| Err(AppError::new(
            ErrorCode::Storage,
            "injected"
        )))
        .is_err()
    );
    assert_eq!(version(&db), 51);
    assert_eq!(rows(&db, "ai_config"), before);
}
