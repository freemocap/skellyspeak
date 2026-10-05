use super::*;

pub(super) fn populated(path: &Path) -> Connection {
    let db = baseline(path, true);
    upgrade_46(&db).unwrap();
    db.pragma_update(None, "user_version", 47).unwrap();
    db.execute_batch(
        "INSERT INTO personas VALUES('p','learner','spanish',1,'{}');
         INSERT INTO contacts VALUES('c','learner','p',0,1);
         INSERT INTO conversations(id,contact_id,language_id,title,archived,revision,last_used)
            VALUES('chat','c','spanish','Fixture',0,1,1);
         INSERT INTO turns(id,conversation_id,state,paused,profile_revision,credential_id,route,model,context)
            VALUES('turn','chat','assisting',0,1,'fixture','hosted','fixture','{\"retained\":true}');
         INSERT INTO messages(id,conversation_id,turn_id,sequence,role,text)
            VALUES('source','chat','turn',1,'user','Source text');
         INSERT INTO operations VALUES('complete','turn','conversation_feedback','succeeded',0);
         INSERT INTO operations VALUES('running','turn','skill_assessment','running',1);
         INSERT INTO operations VALUES('waiting','turn','skill_attribution','waiting_dependencies',0);
         INSERT INTO operations VALUES('reaction','turn','coach_reaction','failed',0);
         INSERT INTO operations VALUES('reading','turn','user_translation','ready',0);
         INSERT INTO attempts(id,operation_id,state,requested_model,diagnostics,response_text)
            VALUES('saved','complete','succeeded','fixture','{\"request_id\":\"retained\"}','Saved response');
         INSERT INTO message_assessments VALUES('saved','source','conversation_feedback','{\"grammar\":8}');
         INSERT INTO attempts(id,operation_id,state,requested_model,diagnostics)
            VALUES('interrupted','running','running','fixture','{\"request_id\":\"pending\"}');",
    ).unwrap();
    db
}

#[test]
fn format_47_preserves_completed_evidence_and_cancels_only_assessment_execution() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = populated(&dir.path().join("fixture"));
    let evidence = rows(&db, "message_assessments");
    let messages = rows(&db, "messages");
    let awards = rows(&db, "effort_awards");
    run_chain(&mut db, 47, 48, &STEPS[..3], validate_current_schema).unwrap();
    assert_eq!(version(&db), 48);
    assert_eq!(rows(&db, "message_assessments"), evidence);
    assert_eq!(rows(&db, "messages"), messages);
    assert_eq!(rows(&db, "effort_awards"), awards);
    for (id, expected) in [
        ("complete", "succeeded"),
        ("running", "cancelled"),
        ("waiting", "cancelled"),
        ("reaction", "cancelled"),
        ("reading", "ready"),
    ] {
        assert_eq!(
            db.query_row("SELECT state FROM operations WHERE id=?1", [id], |r| r
                .get::<_, String>(
                0
            ))
            .unwrap(),
            expected
        );
    }
    let saved: (String, String, String) = db
        .query_row(
            "SELECT state,diagnostics,response_text FROM attempts WHERE id='saved'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();
    assert_eq!(
        saved,
        (
            "succeeded".into(),
            "{\"request_id\":\"retained\"}".into(),
            "Saved response".into()
        )
    );
    assert_eq!(
        db.query_row(
            "SELECT state FROM attempts WHERE id='interrupted'",
            [],
            |r| r.get::<_, String>(0)
        )
        .unwrap(),
        "unknown"
    );
    let after = rows(&db, "attempts");
    run_chain(&mut db, 48, 48, &STEPS[..3], validate_current_schema).unwrap();
    assert_eq!(rows(&db, "attempts"), after);
}

#[test]
fn assessment_migration_failure_rolls_back_execution_states_and_notices() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = populated(&dir.path().join("fixture"));
    let before = [
        "turns",
        "operations",
        "attempts",
        "message_assessments",
        "effort_awards",
    ]
    .map(|table| (table, rows(&db, table)));
    assert!(
        run_chain(&mut db, 47, 48, &STEPS[..3], |_| Err(AppError::new(
            ErrorCode::Storage,
            "Injected validation failure"
        )))
        .is_err()
    );
    assert_eq!(version(&db), 47);
    for (table, expected) in before {
        assert_eq!(rows(&db, table), expected, "{table}");
    }
}

#[test]
fn malformed_captured_context_is_rejected_without_cancelling_work() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = populated(&dir.path().join("fixture"));
    db.execute("UPDATE turns SET context='[]'", []).unwrap();
    let operations = rows(&db, "operations");
    assert!(run_chain(&mut db, 47, 48, &STEPS[..3], validate_current_schema).is_err());
    assert_eq!(version(&db), 47);
    assert_eq!(rows(&db, "operations"), operations);
}

#[test]
fn every_supported_start_reopens_with_one_recovery_copy() {
    for start in [45, 46, 47, 48, 49] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("fixture");
        let db = baseline(&path, start > 45);
        if start >= 47 {
            upgrade_46(&db).unwrap();
        }
        if start >= 49 {
            v49_execution::apply(&db).unwrap();
        }
        db.pragma_update(None, "user_version", start).unwrap();
        drop(db);
        let store = Store::open(&path).unwrap();
        assert_eq!(version(&store.connection), SCHEMA_VERSION);
        let awards = rows(&store.connection, "effort_awards");
        drop(store);
        let store = Store::open(&path).unwrap();
        assert_eq!(rows(&store.connection, "effort_awards"), awards);
        assert_eq!(
            std::fs::read_dir(dir.path().join("migration-backups"))
                .unwrap()
                .count(),
            1
        );
    }
}
