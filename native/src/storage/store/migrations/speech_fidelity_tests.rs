use super::*;

fn speech_model(db: &Connection) -> String {
    db.query_row(
        "SELECT json_extract(audio_settings,'$.speech.model') FROM ai_config",
        [],
        |r| r.get(0),
    )
    .unwrap()
}

#[test]
fn fidelity_default_preserves_other_data_and_rolls_back_on_failure() {
    for model in ["eleven_v3", "eleven_v4_turbo", "custom-speech"] {
        let dir = tempfile::tempdir().unwrap();
        let mut db = baseline(&dir.path().join("workspace"), true);
        run_chain(&mut db, 45, 53, &STEPS[..8], |_| Ok(())).unwrap();
        db.execute(
            "UPDATE ai_config SET audio_settings=json_set(audio_settings,'$.speech.model',?1)",
            [model],
        )
        .unwrap();
        let before = rows(&db, "ai_config");
        let tables: Vec<String> = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='ai_config' ORDER BY name").unwrap().query_map([], |r| r.get(0)).unwrap().map(|r| r.unwrap()).collect();
        let history: Vec<_> = tables.iter().map(|t| rows(&db, t)).collect();
        assert!(
            run_chain(&mut db, 53, 54, &STEPS[..9], |_| Err(AppError::new(
                ErrorCode::Storage,
                "injected"
            )))
            .is_err()
        );
        assert_eq!(version(&db), 53);
        assert_eq!(rows(&db, "ai_config"), before);
        run_chain(&mut db, 53, 54, &STEPS[..9], v52_speech_default::validate).unwrap();
        for (table, expected) in tables.iter().zip(&history) {
            assert_eq!(&rows(&db, table), expected, "{table}");
        }
        let expected = if model == "eleven_v3" {
            "eleven_v4_turbo"
        } else {
            model
        };
        assert_eq!(speech_model(&db), expected);
        if model == "eleven_v3" {
            // Reverse precisely the two intended fields to compare the entire row.
            db.execute("UPDATE ai_config SET audio_settings=json_set(audio_settings,'$.speech.model','eleven_v3'),revision=revision-1", []).unwrap();
        }
        assert_eq!(rows(&db, "ai_config"), before);
    }
}

#[test]
fn fidelity_upgrade_covers_every_supported_start_and_later_choices_survive() {
    for start in 45..=53 {
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
        let store = Store::open(&path).unwrap();
        let fresh = Store::open(&dir.path().join("fresh")).unwrap();
        assert_eq!(
            speech_model(&store.connection),
            speech_model(&fresh.connection)
        );
        assert_eq!(speech_model(&store.connection), "eleven_v4_turbo");
        assert_eq!(version(&store.connection), SCHEMA_VERSION);
        assert_eq!(rows(&store.connection, "effort_awards"), awards);
        assert_eq!(rows(&store.connection, "saved_topics"), topics);
        let settings = rows(&store.connection, "ai_config");
        drop(store);
        let store = Store::open(&path).unwrap();
        assert_eq!(rows(&store.connection, "ai_config"), settings);
        store.connection.execute("UPDATE ai_config SET audio_settings=json_set(audio_settings,'$.speech.model','eleven_v3'),revision=revision+1", []).unwrap();
        let chosen = rows(&store.connection, "ai_config");
        drop(store);
        let reopened = Store::open(&path).unwrap();
        assert_eq!(rows(&reopened.connection, "ai_config"), chosen);
        assert_eq!(speech_model(&reopened.connection), "eleven_v3");
    }
}
