use super::*;

#[test]
fn reliability_default_changes_only_settings_and_is_transactional() {
    for model in ["eleven_v4_turbo", "eleven_v3", "custom-speech"] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("workspace");
        let mut db = baseline(&path, true);
        run_chain(&mut db, 45, 52, &STEPS[..7], |_| Ok(())).unwrap();
        db.execute(
            "UPDATE ai_config SET audio_settings=json_set(audio_settings,'$.speech.model',?1)",
            [model],
        )
        .unwrap();
        let before = rows(&db, "ai_config");
        let tables: Vec<String> = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='ai_config' ORDER BY name").unwrap().query_map([], |r| r.get(0)).unwrap().map(|r| r.unwrap()).collect();
        let history: Vec<_> = tables.iter().map(|t| rows(&db, t)).collect();
        assert!(
            run_chain(&mut db, 52, 53, &STEPS[..8], |_| Err(AppError::new(
                ErrorCode::Storage,
                "injected"
            )))
            .is_err()
        );
        assert_eq!(version(&db), 52);
        assert_eq!(rows(&db, "ai_config"), before);
        run_chain(&mut db, 52, 53, &STEPS[..8], validate_current_schema).unwrap();
        // Compare immediately after migration: ordinary Store startup separately
        // increments the workspace metadata revision during recovery.
        for (table, expected) in tables.iter().zip(&history) {
            assert_eq!(&rows(&db, table), expected, "{table}");
        }
        if model != "eleven_v4_turbo" {
            assert_eq!(rows(&db, "ai_config"), before);
        }
        let audio: String = db
            .query_row("SELECT audio_settings FROM ai_config", [], |r| r.get(0))
            .unwrap();
        let audio: serde_json::Value = serde_json::from_str(&audio).unwrap();
        assert_eq!(
            audio["speech"]["model"],
            if model == "eleven_v4_turbo" {
                "eleven_v3"
            } else {
                model
            }
        );
        assert_eq!(audio["transcription"]["model"], "fixture");
        drop(db);
        let store = Store::open(&path).unwrap();
        let after = rows(&store.connection, "ai_config");
        drop(store);
        let reopened = Store::open(&path).unwrap();
        assert_eq!(rows(&reopened.connection, "ai_config"), after);
    }
}
