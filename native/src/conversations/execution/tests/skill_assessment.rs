use super::*;

fn start(store: &mut Store, conversation: &str) -> (String, Dispatch, Dispatch) {
    let turn = store.execute(send(store, conversation)).unwrap().entity_id;
    store.connection.execute("DELETE FROM operations WHERE kind NOT IN ('persona_context','persona_reply','skill_assessment','skill_evidence')", []).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let persona = store.dispatch().unwrap().unwrap();
    let assessment = store.dispatch().unwrap().unwrap();
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT kind FROM operations WHERE id=?1",
                [&assessment.operation],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "skill_assessment"
    );
    (turn, persona, assessment)
}
fn finish_evidence(store: &mut Store) {
    if let Some(evidence) = store.dispatch().unwrap() {
        assert_eq!(
            store
                .connection
                .query_row(
                    "SELECT kind FROM operations WHERE id=?1",
                    [&evidence.operation],
                    |r| r.get::<_, String>(0)
                )
                .unwrap(),
            "skill_evidence"
        );
        assert!(evidence.decisions.is_none());
        let input: serde_json::Value = serde_json::from_str(&evidence.messages[1].content).unwrap();
        let items: Vec<_> = input["criteria"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| serde_json::json!({"construct":c["id"],"quote":"¿cómo estás?"}))
            .collect();
        store
            .finish(
                &evidence,
                Ok(reply(&serde_json::json!({"items":items}).to_string())),
            )
            .unwrap();
    }
}
fn judgment(quote: &str) -> Completion {
    reply(&serde_json::json!({"items":[{"construct":"question","quote":quote,"outcome":"demonstrated","rationale":"You ask how the other person is."}]}).to_string())
}
#[test]
fn independent_assessment_captures_all_criteria_and_awards_source_once() {
    let (_dir, mut store, conversation) = setup();
    let (_, persona, assessment) = start(&mut store, &conversation);
    let data: serde_json::Value = serde_json::from_str(&assessment.messages[1].content).unwrap();
    assert_eq!(data["criteria"].as_array().unwrap().len(), 45);
    assert!(
        assessment.messages[0]
            .content
            .contains("english, the learner's NATIVE language")
    );
    assert!(
        assessment.messages[0]
            .content
            .contains("cannot establish pronunciation")
    );
    store
        .finish(&assessment, Ok(judgment("¿cómo estás?")))
        .unwrap();
    let first = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert!(first["profile"]["xp"].as_u64().unwrap() > 0);
    store
        .finish(&assessment, Ok(judgment("¿cómo estás?")))
        .unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        first["profile"]["xp"]
    );
    store.finish(&persona, Ok(reply("Bien, gracias."))).unwrap();
    let (_, persona, assessment) = start(&mut store, &conversation);
    store
        .finish(&assessment, Ok(judgment("¿cómo estás?")))
        .unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        first["profile"]["xp"]
    );
    store.finish(&persona, Ok(reply("Bien."))).unwrap();
}
#[test]
fn invalid_evidence_fails_independently_and_next_voice_turn_can_start() {
    for bad in [
        r#"{"items":[{"construct":"question","quote":"partner invented this","outcome":"demonstrated","rationale":"No source"}]}"#,
        r#"{"items":[{"construct":"arabic.idafa","quote":"Hola","outcome":"demonstrated","rationale":"Excluded skill"}]}"#,
    ] {
        let (_dir, mut store, conversation) = setup();
        let (_, persona, assessment) = start(&mut store, &conversation);
        store.finish(&assessment, Ok(reply(bad))).unwrap();
        store.finish(&persona, Ok(reply("Bien."))).unwrap();
        assert_eq!(
            crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]
                ["xp"],
            0
        );
        assert!(store.execute(send(&store, &conversation)).is_ok());
    }
}

#[test]
fn repeated_skill_observations_are_validated_and_credit_is_not_multiplied() {
    let (_dir, mut store, conversation) = setup();
    let (turn, _, assessment) = start(&mut store, &conversation);
    let item = serde_json::json!({"construct":"question","quote":"¿cómo estás?","outcome":"demonstrated","rationale":"You ask a question."});
    let mut partial = item.clone();
    partial["outcome"] = serde_json::json!("partial");
    partial["rationale"] = serde_json::json!("The question is a partial attempt.");
    for entries in [
        vec![item.clone(), item.clone()],
        vec![item.clone(), partial.clone()],
        vec![partial.clone(), item.clone()],
    ] {
        let out = reply(&serde_json::json!({"items":entries}).to_string());
        let result =
            crate::learning::coaching::skill_assessment::validate(&store.connection, &turn, &out)
                .unwrap();
        assert_eq!(result["items"].as_array().unwrap().len(), 1);
        if entries.iter().any(|x| x["outcome"] == "partial") {
            assert_eq!(result["items"][0]["outcome"], "partial");
        }
    }
    let duplicate = reply(&serde_json::json!({"items":[item.clone(),item.clone()]}).to_string());
    store.finish(&assessment, Ok(duplicate)).unwrap();
    let before = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    store
        .finish(&assessment, Ok(judgment("¿cómo estás?")))
        .unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        before["profile"]["xp"]
    );
    for field in ["quote", "construct"] {
        let mut bad = item.clone();
        bad[field] = serde_json::json!("invalid sentinel");
        let out = reply(&serde_json::json!({"items":[item.clone(),bad]}).to_string());
        assert!(
            crate::learning::coaching::skill_assessment::validate(&store.connection, &turn, &out)
                .is_err()
        );
    }
}

#[test]
fn chat_default_and_experimental_adapter_switch_preserve_captured_work_and_localized_credit() {
    let dir = tempfile::tempdir().unwrap();
    let fresh = Store::open(&dir.path().join("default.sqlite3")).unwrap();
    assert_eq!(
        fresh.connection_config().unwrap().assessment_adapter,
        AssessmentAdapter::ChatModel
    );
    let (_dir, mut store, conversation) = setup();
    let p = store.connection_config().unwrap();
    store
        .set_models(
            p.revision,
            &p.standard_model,
            &p.fast_model,
            &p.audio,
            AssessmentAdapter::JevChoice,
        )
        .unwrap();
    let (turn, persona, assessment) = start(&mut store, &conversation);
    let request = assessment.decisions.as_ref().unwrap();
    assert_eq!(assessment.model, "typesafe/jev-1.13");
    assert_eq!(request["questions"].as_object().unwrap().len(), 45);
    assert!(assessment.coaching_schema.is_none());
    let detail = store.attempt_detail(&assessment.attempt).unwrap();
    assert_eq!(detail.decision_request.as_ref(), Some(request));
    assert!(detail.request_messages.is_none());
    assert!(persona.decisions.is_none());
    let p = store.connection_config().unwrap();
    store
        .set_models(
            p.revision,
            &p.standard_model,
            &p.fast_model,
            &p.audio,
            AssessmentAdapter::ChatModel,
        )
        .unwrap();
    assert!(store.attempt_active(&assessment.attempt).unwrap());
    let answers:serde_json::Map<String,serde_json::Value>=request["questions"].as_object().unwrap().keys().map(|id|{
        let yes=id=="question";
        (id.clone(),serde_json::json!({"type":"choice","choice":if yes{"demonstrated"}else{"not_observed"},"confidence":1.0,"probabilities":{"demonstrated":if yes{1.0}else{0.0},"partial":0.0,"not_demonstrated":0.0,"not_observed":if yes{0.0}else{1.0},"uncertain":0.0}}))
    }).collect();
    let mut output = reply(&serde_json::to_string(&answers).unwrap());
    output.actual_model = "typesafe/jev-1.13-20260917".into();
    store.finish(&assessment, Ok(output)).unwrap();
    finish_evidence(&mut store);
    let context: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
            r.get(0)
        })
        .unwrap();
    let context: serde_json::Value = serde_json::from_str(&context).unwrap();
    assert_eq!(context["skillAssessment"]["adapter"], "jev_choice");
    assert_eq!(
        context["skillAssessment"]["items"]
            .as_array()
            .unwrap()
            .len(),
        45
    );
    assert_eq!(context["rewardEvents"].as_array().unwrap().len(), 1);
    assert!(
        context["skillAssessment"]["items"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|i| i["outcome"] == "demonstrated")
            .all(|i| i["quote"] == "¿cómo estás?")
    );
    let snapshot = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert!(snapshot["profile"]["xp"].as_u64().unwrap() > 0);
    let record = &snapshot["records"][0];
    assert_eq!(record["assessment_adapter"], "jev_choice");
    assert_eq!(
        record["prompt_version"],
        crate::learning::coaching::assessment_adapter::VERSION
    );
    assert!(
        record["assessment"]["judgments"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|j| j["outcome"] == "demonstrated")
            .all(|j| j["quotes"] == serde_json::json!(["¿cómo estás?"]))
    );
    // Saved selection survives reopening without changing previously published provenance.
    drop(store);
    let reopened = Store::open(&_dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        reopened.connection_config().unwrap().assessment_adapter,
        AssessmentAdapter::ChatModel
    );
}

/// Shared wire fixture comes from an actual admitted native speech turn. Python
/// admission tests consume this file, so each side cannot invent its own shape.
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
            crate::ai::transport::provider::decisions::URL
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

fn decision_completion(assessment: &Dispatch, outcome: &str) -> Completion {
    let answers: serde_json::Map<String, serde_json::Value> = assessment.decisions.as_ref().unwrap()["questions"]
        .as_object().unwrap().keys().map(|id| {
            let choice = if id == "question" { outcome } else { "not_observed" };
            let probabilities: serde_json::Map<String, serde_json::Value> =
                ["demonstrated", "partial", "not_observed", "not_demonstrated", "uncertain"]
                .into_iter().map(|category| (category.into(), serde_json::json!(if category == choice { 1.0 } else { 0.0 }))).collect();
            (id.clone(), serde_json::json!({"type":"choice","choice":choice,"probabilities":probabilities,"confidence":1.0}))
        }).collect();
    // Pass through the same normalized transport envelope the grouped server emits.
    crate::ai::transport::provider::decode(&serde_json::to_vec(&serde_json::json!({
        "id":"contract-response", "model":"typesafe/jev-1.13-20260922",
        "usage":{"input_tokens":123,"output_tokens":45,"prompt_tokens":123,"completion_tokens":45,"cost":0.0005},
        "choices":[{"finish_reason":"stop","message":{"content":serde_json::to_string(&answers).unwrap()}}]
    })).unwrap()).unwrap()
}

#[test]
fn jev_speech_and_text_publish_positive_xp_once_and_never_credit_absence_or_invalid_answers() {
    for modality in ["text", "speech_transcript"] {
        for outcome in [
            "demonstrated",
            "partial",
            "not_observed",
            "uncertain",
            "invalid",
        ] {
            let (_dir, mut store, conversation) = setup();
            store
                .connection
                .execute("UPDATE ai_config SET assessment_adapter='jev_choice'", [])
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
            let mut completion = decision_completion(
                &assessment,
                if outcome == "invalid" {
                    "demonstrated"
                } else {
                    outcome
                },
            );
            if outcome == "invalid" {
                completion.text = "{}".into();
            }
            store.finish(&assessment, Ok(completion)).unwrap();
            if outcome != "invalid" {
                finish_evidence(&mut store);
            }
            let snapshot =
                crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
            let xp = snapshot["profile"]["xp"].as_u64().unwrap();
            assert_eq!(
                xp > 0,
                matches!(outcome, "demonstrated" | "partial"),
                "{modality}/{outcome}"
            );
            assert_eq!(
                snapshot["records"][0]["status"],
                if outcome == "invalid" {
                    "failed"
                } else {
                    "complete"
                }
            );
            // A second callback for a finished attempt cannot create credit.
            store
                .finish(
                    &assessment,
                    Ok(decision_completion(&assessment, "demonstrated")),
                )
                .unwrap();
            assert_eq!(
                crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]
                    ["xp"],
                xp
            );
            store.finish(&persona, Ok(reply("Bien."))).unwrap();
        }
    }
}

#[test]
fn failed_assessment_retry_uses_current_adapter_in_both_directions() {
    for original in [AssessmentAdapter::JevChoice, AssessmentAdapter::ChatModel] {
        let (_dir, mut store, conversation) = setup();
        let p = store.connection_config().unwrap();
        store
            .set_models(
                p.revision,
                &p.standard_model,
                &p.fast_model,
                &p.audio,
                original,
            )
            .unwrap();
        let (turn, persona, assessment) = start(&mut store, &conversation);
        store
            .finish(&assessment, Err(fail("Synthetic failed assessment")))
            .unwrap();
        store.finish(&persona, Ok(reply("Bien."))).unwrap();
        let next = if original == AssessmentAdapter::JevChoice {
            AssessmentAdapter::ChatModel
        } else {
            AssessmentAdapter::JevChoice
        };
        let p = store.connection_config().unwrap();
        store
            .set_models(p.revision, &p.standard_model, &p.fast_model, &p.audio, next)
            .unwrap();
        control_turn(&store.connection, &turn, TurnControl::Retry).unwrap();
        let retried = store.dispatch().unwrap().unwrap();
        assert_eq!(
            retried.decisions.is_some(),
            next == AssessmentAdapter::JevChoice
        );
        let result = if next == AssessmentAdapter::JevChoice {
            decision_completion(&retried, "demonstrated")
        } else {
            judgment("¿cómo estás?")
        };
        store.finish(&retried, Ok(result)).unwrap();
        finish_evidence(&mut store);
        let snapshot = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
        assert_eq!(snapshot["records"][0]["assessment_adapter"], next.label());
        assert!(snapshot["profile"]["xp"].as_u64().unwrap() > 0);
        assert!(
            store.dispatch().unwrap().is_none(),
            "Retry must not rerun successful siblings"
        );
    }
}

#[test]
#[ignore = "explicit replay of a live synthetic server receipt, no network or user workspace writes"]
fn replay_live_jev_speech_receipt_through_xp() {
    let path = std::env::var("SKELLY_JEV_RESPONSE")
        .expect("Set SKELLY_JEV_RESPONSE to the synthetic server response");
    let (_dir, mut store, conversation) = setup();
    store
        .connection
        .execute("UPDATE ai_config SET assessment_adapter='jev_choice'", [])
        .unwrap();
    let mut command = send(&store, &conversation);
    if let Action::SendMessage { input, .. } = &mut command.action {
        input.modality = "speech_transcript".into();
    }
    store.execute(command).unwrap();
    store.connection.execute("DELETE FROM operations WHERE kind NOT IN ('persona_context','persona_reply','skill_assessment','skill_evidence')", []).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let _persona = store.dispatch().unwrap().unwrap();
    let assessment = store.dispatch().unwrap().unwrap();
    let fixture: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../server/tests/inference/fixtures/jev-native-request.json"),
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(
        assessment.decisions.as_ref().unwrap(),
        &fixture,
        "Live request must match this native turn"
    );
    let bytes = std::fs::read(path).unwrap();
    let completion = crate::ai::transport::provider::decode(&bytes).unwrap();
    store.finish(&assessment, Ok(completion)).unwrap();
    finish_evidence(&mut store);
    let snapshot = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(snapshot["records"][0]["status"], "complete");
    let xp = snapshot["profile"]["xp"].as_u64().unwrap();
    assert!(
        xp > 0,
        "Synthetic greeting/question must yield positive evidence: {snapshot}"
    );
    store
        .finish(
            &assessment,
            Ok(crate::ai::transport::provider::decode(&bytes).unwrap()),
        )
        .unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        xp
    );
    println!(
        "Validated live speech receipt: {xp} XP; duplicate publication unchanged; temporary workspace only."
    );
}

#[test]
fn reopening_shelved_jev_preserves_receipts_and_retries_with_chat_quotes_and_xp() {
    let (dir, mut store, conversation) = setup();
    let p = store.connection_config().unwrap();
    store
        .set_models(
            p.revision,
            &p.standard_model,
            &p.fast_model,
            &p.audio,
            AssessmentAdapter::JevChoice,
        )
        .unwrap();
    let (turn, persona, assessment) = start(&mut store, &conversation);
    store.finish(&persona, Ok(reply("Bien, gracias."))).unwrap();
    let attempt = assessment.attempt.clone();
    drop(store);
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        store.connection_config().unwrap().assessment_adapter,
        AssessmentAdapter::ChatModel
    );
    assert!(
        store
            .attempt_detail(&attempt)
            .unwrap()
            .decision_request
            .is_some()
    );
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT state FROM operations WHERE id=?1",
                [&assessment.operation],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "failed"
    );
    control_turn(&store.connection, &turn, TurnControl::Retry).unwrap();
    let retry = store.dispatch().unwrap().unwrap();
    assert_eq!(retry.operation, assessment.operation);
    assert!(retry.decisions.is_none());
    assert_eq!(retry.model, p.fast_model);
    store.finish(&retry, Ok(judgment("¿cómo estás?"))).unwrap();
    let xp = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]
        ["xp"]
        .as_u64()
        .unwrap();
    assert!(xp > 0);
    assert!(store.dispatch().unwrap().is_none());
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        xp
    );
    assert!(
        store
            .attempt_detail(&attempt)
            .unwrap()
            .decision_request
            .is_some()
    );
}

#[test]
fn reopening_after_failed_jev_quotes_reassesses_before_publishing_chat_xp() {
    let (dir, mut store, conversation) = setup();
    let p = store.connection_config().unwrap();
    store
        .set_models(
            p.revision,
            &p.standard_model,
            &p.fast_model,
            &p.audio,
            AssessmentAdapter::JevChoice,
        )
        .unwrap();
    let (turn, persona, assessment) = start(&mut store, &conversation);
    store.finish(&persona, Ok(reply("Bien, gracias."))).unwrap();
    let answers: serde_json::Map<String,serde_json::Value> = assessment.decisions.as_ref().unwrap()["questions"].as_object().unwrap().keys().map(|id| {
        let yes = id == "question";
        (id.clone(), serde_json::json!({"type":"choice","choice":if yes {"demonstrated"} else {"not_observed"},"confidence":1.0,"probabilities":{"demonstrated":if yes {1.0} else {0.0},"partial":0.0,"not_demonstrated":0.0,"not_observed":if yes {0.0} else {1.0},"uncertain":0.0}}))
    }).collect();
    let mut output = reply(&serde_json::to_string(&answers).unwrap());
    output.actual_model = "typesafe/jev-1.13".into();
    store.finish(&assessment, Ok(output)).unwrap();
    let evidence = store.dispatch().unwrap().unwrap();
    store
        .finish(
            &evidence,
            Ok(reply(r#"{"items":[{"construct":"question","quote":""}]}"#)),
        )
        .unwrap();
    drop(store);
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    control_turn(&store.connection, &turn, TurnControl::Retry).unwrap();
    let retry = store.dispatch().unwrap().unwrap();
    assert_eq!(retry.operation, assessment.operation);
    assert!(retry.decisions.is_none());
    store.finish(&retry, Ok(judgment("¿cómo estás?"))).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let context: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
            r.get(0)
        })
        .unwrap();
    let context: serde_json::Value = serde_json::from_str(&context).unwrap();
    assert_eq!(context["skillAssessment"]["adapter"], "chat_model");
    assert_eq!(
        context["skillAssessment"]["items"][0]["quote"],
        "¿cómo estás?"
    );
    assert!(
        store
            .attempt_detail(&assessment.attempt)
            .unwrap()
            .decision_request
            .is_some()
    );
    assert!(
        store
            .attempt_detail(&evidence.attempt)
            .unwrap()
            .response_text
            .is_some()
    );
}
