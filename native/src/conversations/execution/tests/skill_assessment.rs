//! Real dispatch, receipt validation, durable publication and learner projection.
use super::*;
use serde_json::{Value, json};

pub(super) fn assessment(store: &mut Store, turn: &str) -> Dispatch {
    store.connection.execute("DELETE FROM operations WHERE turn_id=?1 AND kind NOT IN ('persona_context','persona_reply','skill_assessment')",[turn]).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let persona = store.dispatch().unwrap().unwrap();
    assert!(persona.decisions.is_none());
    store
        .finish(&persona, Ok(reply("Fixture partner reply.")))
        .unwrap();
    let work = store.dispatch().unwrap().unwrap();
    assert!(work.decisions.is_some());
    work
}
pub(super) fn presence(work: &Dispatch, present: &[(&str, &str)]) -> Completion {
    let answers: serde_json::Map<_,_> = work.decisions.as_ref().unwrap()["questions"].as_object().unwrap().keys().map(|id| {
        let choice=present.iter().find(|(skill,_)| *skill == id).map(|(_,label)|*label).unwrap_or("absent");
        let probabilities: serde_json::Map<_,_> = ["absent","contextual","direct","unclear"].into_iter().map(|label|(label.into(),json!(if label==choice {1.0}else{0.0}))).collect();
        (id.clone(),json!({"type":"choice","choice":choice,"confidence":1.0,"probabilities":probabilities}))
    }).collect();
    reply(&json!(answers).to_string())
}
fn profile(store: &Store) -> Value {
    crate::learning::learner::progression::snapshot(store, "spanish").unwrap()
}
#[test]
fn presence_dispatch_publishes_experience_once_without_quote_work() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let work = assessment(&mut store, &turn);
    assert_eq!(
        work.decisions.as_ref().unwrap()["questions"]
            .as_object()
            .unwrap()
            .len(),
        12
    );
    let result = presence(
        &work,
        &[
            ("questions_answers", "direct"),
            ("past_reference", "contextual"),
            ("quantity", "unclear"),
        ],
    );
    store.finish(&work, Ok(reply(&result.text))).unwrap();
    let snapshot = profile(&store);
    assert_eq!(snapshot["profile"]["xp"], 2);
    assert_eq!(snapshot["profile"]["rules_version"], 3);
    assert_eq!(
        snapshot["catalog"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|n| n["kind"] == "skill")
            .count(),
        12
    );
    assert_eq!(snapshot["profile"]["credits"][0]["experience"], 1);
    assert_eq!(snapshot["profile"]["credits"][0]["effort"], 0);
    store.finish(&work, Ok(result)).unwrap();
    assert_eq!(profile(&store)["profile"]["xp"], 2);
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM operations WHERE kind='skill_evidence'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
    assert!(
        snapshot["records"][0]["assessment"]["judgments"]
            .as_array()
            .unwrap()
            .iter()
            .all(|j| j.get("outcome").is_none())
    );
}
#[test]
fn changed_retry_credits_retained_skills_and_new_skills_separately_then_survives_reopen() {
    let (dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let work = assessment(&mut store, &first);
    store
        .finish(
            &work,
            Ok(presence(&work, &[("questions_answers", "direct")])),
        )
        .unwrap();
    let next = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "A changed reply",
        ))
        .unwrap()
        .entity_id;
    let work = assessment(&mut store, &next);
    store
        .finish(
            &work,
            Ok(presence(
                &work,
                &[("questions_answers", "direct"), ("quantity", "contextual")],
            )),
        )
        .unwrap();
    let snapshot = profile(&store);
    assert_eq!(snapshot["profile"]["xp"], 3);
    let credits = snapshot["profile"]["credits"].as_array().unwrap();
    assert!(
        credits
            .iter()
            .any(|c| c["skill_id"] == "questions_answers" && c["effort"] == 1)
    );
    assert!(
        credits
            .iter()
            .any(|c| c["skill_id"] == "quantity" && c["experience"] == 1)
    );
    let same = store
        .execute(revision_command(
            &store,
            &conversation,
            &next,
            "A changed reply",
        ))
        .unwrap()
        .entity_id;
    let work = assessment(&mut store, &same);
    store
        .finish(
            &work,
            Ok(presence(
                &work,
                &[("questions_answers", "direct"), ("quantity", "direct")],
            )),
        )
        .unwrap();
    assert_eq!(profile(&store)["profile"]["xp"], 3);
    drop(store);
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(profile(&store)["profile"]["xp"], 3);
    let next = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let work = assessment(&mut store, &next);
    store
        .finish(
            &work,
            Ok(presence(&work, &[("questions_answers", "direct")])),
        )
        .unwrap();
    assert_eq!(profile(&store)["profile"]["xp"], 4);
}
#[test]
fn invalid_distribution_does_not_award_and_keeps_validation_diagnostics() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let work = assessment(&mut store, &turn);
    let mut result = presence(&work, &[("quantity", "direct")]);
    let mut raw: Value = serde_json::from_str(&result.text).unwrap();
    raw["quantity"]["probabilities"]["absent"] = json!(1.0);
    result.text = raw.to_string();
    store.finish(&work, Ok(result)).unwrap();
    assert_eq!(profile(&store)["profile"]["xp"], 0);
    let raw: String = store
        .connection
        .query_row(
            "SELECT diagnostics FROM attempts WHERE id=?1",
            [&work.attempt],
            |r| r.get(0),
        )
        .unwrap();
    assert!(raw.contains("skill_presence"));
    assert!(
        wave2_context(&store, &turn)
            .get("practiceObservation")
            .is_none()
    );
}
#[test]
fn replaced_turn_rejects_late_presence_without_awarding() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let work = assessment(&mut store, &turn);
    store
        .execute(revision_command(
            &store,
            &conversation,
            &turn,
            "Replacement",
        ))
        .unwrap();
    store
        .finish(
            &work,
            Ok(presence(&work, &[("questions_answers", "direct")])),
        )
        .unwrap();
    assert_eq!(profile(&store)["profile"]["xp"], 0);
    assert!(
        wave2_context(&store, &turn)
            .get("practiceObservation")
            .is_none()
    );
}
#[test]
fn jev_native_wire_contract_matches_server_fixture() {
    for modality in ["text", "speech_transcript"] {
        let (_dir, mut store, conversation) = setup();
        let config = store.connection_config().unwrap();
        store
            .set_models(
                config.revision,
                &config.standard_model,
                &config.fast_model,
                &config.audio,
                AssessmentAdapter::JevChoice,
            )
            .unwrap();
        let mut command = send(&store, &conversation);
        if let Action::SendMessage { input, .. } = &mut command.action {
            input.modality = modality.into();
        }
        store.execute(command).unwrap();
        store.connection.execute("DELETE FROM operations WHERE kind NOT IN ('persona_context','persona_reply','skill_assessment','skill_evidence')", []).unwrap();
        assert!(store.dispatch().unwrap().is_none());
        let persona = store.dispatch().unwrap().unwrap();
        let assessment = store.dispatch().unwrap().unwrap();
        assert!(persona.decisions.is_none());
        assert_eq!(
            assessment.target.url,
            format!("{}/v1/operations", crate::ai::hosted::ORIGIN)
        );
        let request = assessment.decisions.unwrap();
        assert_eq!(request["state"]["input"]["modality"], modality);
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(if modality == "text" {
            "../server/tests/inference/fixtures/jev-native-text-request.json"
        } else {
            "../server/tests/inference/fixtures/jev-native-request.json"
        });
        if std::env::var("SKELLY_WRITE_JEV_CONTRACT").as_deref() == Ok("1") {
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(
                &path,
                serde_json::to_string_pretty(&request).unwrap() + "\n",
            )
            .unwrap();
        }
        let recorded: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
        assert_eq!(
            request, recorded,
            "Native decisions contract drifted; regenerate and run server admission tests"
        );
    }
}

#[test]
fn missing_guidance_fails_only_assessment_without_a_fallback_call() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.connection.execute("UPDATE turns SET context=json_set(context,'$.presenceSkills',NULL,'$.presenceContentError',json(?2)) WHERE id=?1",params![turn,json!({"path":"languages/test/skill_guides"}).to_string()]).unwrap();
    store.connection.execute("DELETE FROM operations WHERE turn_id=?1 AND kind NOT IN ('persona_context','persona_reply','skill_assessment')",[&turn]).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let persona = store.dispatch().unwrap().unwrap();
    store
        .finish(&persona, Ok(reply("The conversation still works.")))
        .unwrap();
    assert!(store.dispatch().unwrap().is_none());
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT state FROM operations WHERE turn_id=?1 AND kind='skill_assessment'",
                [&turn],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "failed"
    );
    assert_eq!(profile(&store)["profile"]["xp"], 0);
    assert_eq!(store.connection.query_row("SELECT count(*) FROM messages WHERE turn_id=?1 AND role='assistant' AND text='The conversation still works.'",[&turn],|r|r.get::<_,i64>(0)).unwrap(),1);
}
