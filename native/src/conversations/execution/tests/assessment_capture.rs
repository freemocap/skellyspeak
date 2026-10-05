//! Captured authored inputs and latency-sensitive routing, without provider calls.
use super::*;
use serde_json::{Value, json};

#[test]
fn message_criteria_are_saved_with_the_turn_and_survive_reopen() {
    let (dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let captured = wave2_context(&store, &turn);
    let expected =
        serde_json::to_value(store.config.message_assessment_questions().unwrap()).unwrap();
    assert_eq!(captured["messageAssessmentQuestions"], expected);
    let messages =
        crate::learning::coaching::skill_assessment::prompt(&store.connection, &turn, &captured)
            .unwrap();
    let state: Value = serde_json::from_str(&messages[1].content).unwrap();
    let request = crate::learning::turn_assessment::request(
        state,
        &serde_json::from_value::<Vec<crate::learning::practice_assessment::SkillPrompt>>(
            captured["presenceSkills"].clone(),
        )
        .unwrap(),
        &serde_json::from_value(captured["presenceInstructions"].clone()).unwrap(),
        &serde_json::from_value(captured["messageAssessmentQuestions"].clone()).unwrap(),
    )
    .unwrap();
    assert_eq!(request["questions"].as_object().unwrap().len(), 10);
    assert_eq!(
        request["questions"]["grammar"]["criteria"],
        expected["grammar"]["criteria"]
    );
    assert_eq!(
        request["state"]["currentLearnerMessage"],
        "Hola, ¿cómo estás?"
    );
    assert_eq!(request["state"]["precedingExchange"], json!([]));
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        wave2_context(&store, &turn)["messageAssessmentQuestions"],
        expected
    );
}

#[test]
fn persona_and_brief_use_the_captured_fast_model_and_record_it() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    // Isolate these routing edges; assessment publication has its own fixtures.
    store.connection.execute("DELETE FROM operations WHERE turn_id=?1 AND kind NOT IN ('persona_context','persona_reply','reply_brief')", [&turn]).unwrap();
    store
        .connection
        .execute(
            "UPDATE turns SET context=json_set(context,'$.fastModel','fixture-fast') WHERE id=?1",
            [&turn],
        )
        .unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let persona = store.dispatch().unwrap().unwrap();
    assert_eq!(persona.model, "fixture-fast");
    assert_eq!(persona.target.model, persona.model);
    store
        .finish(&persona, Ok(reply("¿Qué quieres hacer?")))
        .unwrap();
    let brief = store.dispatch().unwrap().unwrap();
    assert_eq!(brief.model, "fixture-fast");
    assert_eq!(brief.target.model, brief.model);
    for work in [&persona, &brief] {
        let saved: String = store
            .connection
            .query_row(
                "SELECT requested_model FROM attempts WHERE id=?1",
                [&work.attempt],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(saved, "fixture-fast");
    }
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT kind FROM operations WHERE id=?1",
                [&brief.operation],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "reply_brief"
    );
}
