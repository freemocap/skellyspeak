use super::*;

#[test]
fn wave2_explicit_answer_is_durable_terminal_and_retry_uncertainty_is_honest() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "Reply");
    wave2_observe(
        &store,
        &first,
        "coach_feedback",
        serde_json::json!({"meaning_recovered":"partial","items":[wave2_error("¿cómo estás?")]}),
    );
    let safe = crate::learning::coaching::coach_policy::view(&wave2_context(&store, &first))
        .unwrap()
        .unwrap();
    assert!(
        !serde_json::to_string(&safe)
            .unwrap()
            .contains("target_hypothesis")
    );
    assert!(safe.items[0].rationale.is_empty());
    let control = Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::CoachControl {
            turn_id: first.clone(),
            control: crate::learning::coaching::CoachControl::ShowAnswer,
            expected_revision: store.snapshot().unwrap().revision,
        },
    };
    store.execute(control.clone()).unwrap();
    store.execute(control).unwrap();
    assert_eq!(
        wave2_context(&store, &first)["coachDecision"]["shown"]["move"],
        "explicit"
    );
    let second = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "¿Cómo tu hermana?",
        ))
        .unwrap()
        .entity_id;
    let checked = wave2_observe(
        &store,
        &second,
        "coach_retry_check",
        serde_json::json!({"repaired":false,"meaning_recovered":"partial","items":[wave2_error("¿Cómo tu hermana?")]}),
    );
    assert_eq!(checked["decision"]["shown"]["move"], "explicit");
    assert_eq!(checked["decision"]["retryInvited"], false);
    let uncertain = wave2_observe(
        &store,
        &second,
        "coach_retry_check",
        serde_json::json!({"repaired":false,"meaning_recovered":"partial","items":[]}),
    );
    assert_eq!(uncertain["decision"]["repairStatus"], "uncertain");
    assert!(uncertain["decision"]["fixed"].is_null());
    assert!(uncertain["decision"]["shown"].is_null());
}

#[test]
fn wave2_checked_repair_retains_exact_support_without_direct_credit() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "Reply");
    wave2_observe(
        &store,
        &first,
        "coach_feedback",
        serde_json::json!({"meaning_recovered":"partial","items":[wave2_error("¿cómo estás?")]}),
    );
    let second = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "¿Cómo está tu hermana?",
        ))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &second, "Reply");
    let checked = wave2_observe(
        &store,
        &second,
        "coach_retry_check",
        serde_json::json!({"repaired":true,"meaning_recovered":"full","items":[{"construct":"question","quote":"¿Cómo está tu hermana?","outcome":"demonstrated","error":null,"rationale":"The question now includes its linking verb."}]}),
    );
    assert!(checked["nativeRepair"]["support_step"].is_null());
    let record =
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["records"]
            .as_array()
            .unwrap()
            .iter()
            .find(|r| {
                r["assessment"]["judgments"]
                    .as_array()
                    .is_some_and(|j| j.iter().any(|j| j["source"] == "native_repair_check"))
            })
            .unwrap()
            .clone();
    assert_eq!(
        record["assessment"]["judgments"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|j| j["skill_id"] == "question" && j["source"] == "native_repair_check")
            .count(),
        1
    );
    assert_eq!(checked["decision"]["repairStatus"], "repaired");
    assert!(
        checked["decision"]["fixed"]
            .as_str()
            .unwrap()
            .contains("linking verb")
    );
    let profile = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(profile["profile"]["xp"], 18);
}

#[test]
fn direct_retry_and_keep_going_do_not_block_chat() {
    let (_dir, mut store, conversation) = setup();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.coachProactivity','occasional')",[]).unwrap();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "Reply");
    wave2_observe(
        &store,
        &first,
        "coach_feedback",
        serde_json::json!({"meaning_recovered":"partial","items":[wave2_error("¿cómo estás?")]}),
    );
    let revision = store.snapshot().unwrap().revision;
    apply(
        &mut store,
        Action::CoachControl {
            turn_id: first.clone(),
            control: crate::learning::coaching::CoachControl::OpenCard,
            expected_revision: revision,
        },
    );
    let second = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "¿Cómo tu hermana?",
        ))
        .unwrap()
        .entity_id;
    assert_eq!(
        wave2_context(&store, &second)["coachRetry"]["supportStep"],
        "explicit"
    );
    // Retained disclosure decisions still work; new revisions use independent
    // conversational feedback rather than scheduling the retired retry grader.
    finish_fixture_exchange(&mut store, &second, "Reply");
    wave2_observe(
        &store,
        &second,
        "coach_retry_check",
        serde_json::json!({"repaired":false,"meaning_recovered":"partial","items":[wave2_error("¿Cómo tu hermana?")]}),
    );
    let command = Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::CoachControl {
            turn_id: second.clone(),
            control: crate::learning::coaching::CoachControl::KeepGoing,
            expected_revision: store.snapshot().unwrap().revision,
        },
    };
    store.execute(command).unwrap();
    assert_eq!(
        wave2_context(&store, &second)["coachDecision"]["keptGoing"],
        true
    );
    assert!(store.execute(send(&store, &conversation)).is_ok());
}

#[test]
fn wave2_bundled_content_update_reaches_capture_and_hash_mismatch_retains_evidence() {
    let (dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "Reply");
    fixture_evidence(&store, &first, "¿cómo estás?");
    let before_catalog = store.config.catalog();
    drop(store);
    let content = dir.path().join("content");
    std::fs::create_dir(&content).unwrap();
    for folder in ["languages", "shared"] {
        std::fs::create_dir(content.join(folder)).unwrap();
        let original = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../content")
            .join(folder);
        for entry in std::fs::read_dir(original).unwrap() {
            let entry = entry.unwrap();
            std::fs::copy(entry.path(), content.join(folder).join(entry.file_name())).unwrap();
        }
    }
    std::fs::copy(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../references.bib"),
        dir.path().join("references.bib"),
    )
    .unwrap();
    let path = content.join("languages/spanish.yaml");
    let mut document: serde_json::Value =
        serde_yaml_ng::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    document["learning"]["goal_material"]["greeting"] =
        serde_json::json!({"tokens":["custom_semantic_token"]});
    document["guidance"] = serde_json::json!([{"scope":"assessment","text":"Preserve CUSTOM_ASSESSMENT_GUIDANCE.","sources":["cefr2020"]}]);
    std::fs::write(path, serde_yaml_ng::to_string(&document).unwrap()).unwrap();
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    // Simulate an app content update; workspaces no longer own editable definitions.
    store.config = crate::configuration::Registry::load(&content).unwrap();
    assert_eq!(store.config.catalog(), before_catalog);
    let profile = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(profile["profile"]["xp"], 0);
    assert!(profile["records"][0]["mapping_error"].is_string());
    assert!(profile["records"][0]["assessment"].is_object());
    let next = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let captured = wave2_context(&store, &next);
    assert!(
        captured["languageContext"]
            .to_string()
            .contains("CUSTOM_ASSESSMENT_GUIDANCE")
    );
    let prompt = crate::learning::coaching::prompt(
        &store.connection,
        &next,
        crate::learning::coaching::FEEDBACK,
        &captured,
    )
    .unwrap();
    assert!(
        serde_json::to_string(&prompt)
            .unwrap()
            .contains("CUSTOM_ASSESSMENT_GUIDANCE")
    );
}

#[test]
fn wave2_unseen_retries_do_not_escalate_assistance() {
    let (_dir, mut store, conversation) = setup();
    let mut previous = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &previous, "Reply");
    wave2_observe(
        &store,
        &previous,
        "coach_feedback",
        serde_json::json!({"meaning_recovered":"partial","items":[wave2_error("¿cómo estás?")]}),
    );
    for text in [
        "¿Cómo tu hermana?",
        "¿Cómo tu hermana? Otra vez",
        "¿Cómo tu hermana? Sigo",
    ] {
        let next = store
            .execute(revision_command(&store, &conversation, &previous, text))
            .unwrap()
            .entity_id;
        finish_fixture_exchange(&mut store, &next, "Reply");
        let observed = wave2_observe(
            &store,
            &next,
            "coach_retry_check",
            serde_json::json!({"repaired":false,"meaning_recovered":"partial","items":[wave2_error("¿Cómo tu hermana?")]}),
        );
        assert_eq!(observed["decision"]["shown"]["move"], "explicit");
        assert_eq!(wave2_context(&store, &next)["coachRetry"]["depth"], 0);
        assert!(wave2_context(&store, &next)["coachRetry"]["supportStep"].is_null());
        previous = next;
    }
}

#[test]
fn direct_correction_is_not_hidden_by_speculative_error_cause() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    let mut item = wave2_error("¿cómo estás?");
    item["error"]["source"] = serde_json::json!("developmental");
    item["error"]["blocks_meaning"] = serde_json::json!(false);
    wave2_observe(
        &store,
        &turn,
        "coach_feedback",
        serde_json::json!({"meaning_recovered":"full","items":[item]}),
    );
    assert_eq!(
        wave2_context(&store, &turn)["coachDecision"]["shown"]["move"],
        "explicit"
    );
    let snapshot = store.snapshot().unwrap();
    crate::learning::coaching::coach_policy::control(
        &store.connection,
        &snapshot,
        &turn,
        crate::learning::coaching::CoachControl::OpenCard,
        snapshot.revision,
    )
    .unwrap();
    let shown = wave2_context(&store, &turn);
    assert_eq!(shown["coachDecision"]["exposedMove"], "explicit");
    assert_eq!(
        shown["coachDecision"]["shown"]["explanation"],
        "Use está to ask how someone is."
    );
    let snapshot = store.snapshot().unwrap();
    crate::learning::coaching::coach_policy::control(
        &store.connection,
        &snapshot,
        &turn,
        crate::learning::coaching::CoachControl::ShowAnswer,
        snapshot.revision,
    )
    .unwrap();
    assert_eq!(
        wave2_context(&store, &turn)["coachDecision"]["shown"]["explanation"],
        "Use está to ask how someone is."
    );
}
