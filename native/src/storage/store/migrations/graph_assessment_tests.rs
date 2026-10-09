use super::*;

#[test]
fn native_assessment_receipts_preserve_historical_results_and_disclosures() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = baseline(&dir.path().join("source"), true);
    run_chain(
        &mut db,
        45,
        62,
        &STEPS[..17],
        v62_graph_reply_sources::validate,
    )
    .unwrap();
    db.execute_batch("PRAGMA foreign_keys=ON;
        INSERT INTO personas VALUES('p','learner','english',1,'{}');
        INSERT INTO contacts VALUES('c','learner','p',0,1);
        INSERT INTO conversations VALUES('conversation','c','english','retained',0,1,'then',1);
        INSERT INTO turns(id,conversation_id,state,paused,profile_revision,credential_id,route,model,context) VALUES('turn','conversation','succeeded',0,1,'reference','hosted','captured','{}');
        INSERT INTO turn_execution_owners VALUES('turn','legacy','persona_reply',NULL,NULL,NULL);
        INSERT INTO messages(id,conversation_id,turn_id,sequence,role,text) VALUES('message','conversation','turn',1,'user','Retained café 日本語');
        INSERT INTO operations(id,turn_id,kind,state) VALUES('op','turn','coach_feedback','succeeded');
        INSERT INTO attempts(id,operation_id,state,requested_model) VALUES('attempt','op','succeeded','captured');
        INSERT INTO message_assessments VALUES('attempt','message','coach_feedback','{\"observation\":{}}');
        INSERT INTO assessment_disclosures VALUES('attempt','{\"keptGoing\":true}');").unwrap();
    let tables = [
        "messages",
        "message_assessments",
        "assessment_disclosures",
        "effort_awards",
        "turns",
        "operations",
        "attempts",
    ];
    let before: Vec<_> = tables.iter().map(|t| rows(&db, t)).collect();
    assert!(
        run_chain(&mut db, 62, 63, &STEPS[..18], |_| Err(AppError::new(
            ErrorCode::Storage,
            "injected"
        )))
        .is_err()
    );
    assert_eq!(version(&db), 62);
    assert!(
        db.prepare("SELECT * FROM conversation_graph_assessments")
            .is_err()
    );
    run_chain(
        &mut db,
        62,
        63,
        &STEPS[..18],
        v63_graph_assessments::validate,
    )
    .unwrap();
    assert_eq!(
        tables.iter().map(|t| rows(&db, t)).collect::<Vec<_>>(),
        before
    );
    assert!(rows(&db, "conversation_graph_assessments").is_empty());
    assert!(rows(&db, "conversation_graph_disclosures").is_empty());
    assert!(db.execute("INSERT INTO conversation_graph_assessments VALUES('native','turn','feedback','1','2','message','coach_feedback','{}')",[]).is_err());
    db.execute_batch("INSERT INTO graph_engines VALUES('engine','conversation',printf('%064d',1),'{}',X'010203');
        INSERT INTO turns(id,conversation_id,state,paused,profile_revision,credential_id,route,model,context) VALUES('native-turn','conversation','pending',0,1,'reference','hosted','captured','{}');
        INSERT INTO turn_execution_owners VALUES('native-turn','graph','persona_reply','engine','run','artifact');
        INSERT INTO messages(id,conversation_id,turn_id,sequence,role,text) VALUES('native-source','conversation','native-turn',2,'user','New source');").unwrap();
    assert!(db.execute("INSERT INTO conversation_graph_assessments VALUES('native','native-turn','feedback','1','2','message','coach_feedback','{}')",[]).is_err());
    db.execute("INSERT INTO conversation_graph_assessments VALUES('native','native-turn','feedback','1','2','native-source','coach_feedback','{}')",[]).unwrap();
    db.execute(
        "INSERT INTO conversation_graph_disclosures VALUES('native','{}')",
        [],
    )
    .unwrap();
    assert!(
        db.execute(
            "UPDATE conversation_graph_assessments SET result='null'",
            []
        )
        .is_err()
    );
    db.execute("DELETE FROM messages WHERE id='native-source'", [])
        .unwrap();
    assert!(rows(&db, "conversation_graph_assessments").is_empty());
    assert!(rows(&db, "conversation_graph_disclosures").is_empty());
    assert_eq!(rows(&db, "assessment_disclosures"), before[2]);
    assert!(
        !db.prepare("PRAGMA foreign_key_check")
            .unwrap()
            .exists([])
            .unwrap()
    );
    assert_eq!(
        include_str!("v63_graph_assessments.sql").replace("\r\n", "\n"),
        include_str!("../../schemas/graph_assessments.sql").replace("\r\n", "\n")
    );
}
