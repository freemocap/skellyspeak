use super::*;

fn fixture() -> (Value, BTreeSet<String>) {
    let registry = crate::configuration::Registry::bundled().unwrap();
    let ids: BTreeSet<String> = registry
        .shared_skills()
        .skills
        .iter()
        .map(|s| s.id.clone())
        .collect();
    let mut raw = json!({});
    for id in &ids {
        raw[id] = json!({"type":"choice", "choice":"direct", "confidence":0.8,
            "probabilities":{"absent":0.1,"contextual":0.1,"direct":0.7,"unclear":0.1}});
    }
    for (name, labels) in [
        ("grammar", GRAMMAR_LABELS),
        ("understandability", UNDERSTANDABILITY_LABELS),
    ] {
        let probabilities: BTreeMap<_, _> = labels.iter().map(|s| (*s, 0.25)).collect();
        raw[name] = json!({"type":"choice", "choice":labels[0], "confidence":0.8, "probabilities":probabilities});
    }
    (raw, ids)
}

#[test]
fn complete_result_keeps_message_judgments_separate_from_skill_credit() {
    let (mut raw, ids) = fixture();
    raw["grammar"]["choice"] = json!("major_errors");
    raw["understandability"]["choice"] = json!("understandable");
    let result = validate(&raw, &ids).unwrap();
    assert_eq!(result.grammar.choice, "major_errors");
    assert_eq!(result.understandability.choice, "understandable");
    assert!(
        result
            .skills
            .values()
            .all(|a| a.choice == crate::learning::practice::Presence::Direct)
    );
}

#[test]
fn incomplete_extra_and_malformed_results_fail_before_publication() {
    let (raw, ids) = fixture();
    for key in raw.as_object().unwrap().keys() {
        let mut broken = raw.clone();
        broken.as_object_mut().unwrap().remove(key);
        assert!(validate(&broken, &ids).is_err(), "missing {key}");
    }
    let mut extra = raw.clone();
    extra["extra"] = json!({});
    assert!(validate(&extra, &ids).is_err());
    for name in ["grammar", "understandability"] {
        for (field, value) in [
            ("choice", json!("unknown")),
            ("type", json!("score")),
            ("confidence", json!(1.1)),
            ("probabilities", json!({})),
        ] {
            let mut broken = raw.clone();
            broken[name][field] = value;
            assert!(validate(&broken, &ids).is_err(), "{name}.{field}");
        }
        let mut broken = raw.clone();
        let probabilities = broken[name]["probabilities"].as_object_mut().unwrap();
        *probabilities.values_mut().next().unwrap() = json!(-0.01);
        assert!(validate(&broken, &ids).is_err());
    }
}

#[test]
fn abstention_and_unreconciled_distributions_are_preserved() {
    let (mut raw, ids) = fixture();
    for name in ["grammar", "understandability"] {
        raw[name]["choice"] = json!("insufficient_evidence");
        raw[name]["confidence"] = json!(0);
        for value in raw[name]["probabilities"]
            .as_object_mut()
            .unwrap()
            .values_mut()
        {
            *value = json!(0.9);
        }
    }
    let result = validate(&raw, &ids).unwrap();
    assert_eq!(result.understandability.choice, "insufficient_evidence");
    assert_eq!(result.grammar.confidence, 0.0);
    assert_eq!(result.grammar.probabilities["acceptable"], 0.9);
}

#[test]
fn authored_request_is_bounded_and_contains_exactly_the_ten_validated_questions() {
    let files = crate::configuration::content_files::read(
        &std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../content"),
    )
    .unwrap();
    let shared = crate::configuration::authoring::prompts::instructions(&files).unwrap();
    let mut message = crate::configuration::authoring::prompts::message_questions(&files).unwrap();
    let registry = crate::configuration::Registry::bundled().unwrap();
    let skills: Vec<_> = registry
        .shared_skills()
        .skills
        .iter()
        .map(|s| SkillPrompt {
            id: s.id.clone(),
            name: s.name.clone(),
            overview: s.overview.clone(),
            boundary: s.boundary.clone(),
            language_guidance: "Synthetic guidance for contract validation.".into(),
        })
        .collect();
    let state = json!({"currentLearnerMessage":"原文", "precedingExchange":[]});
    let body = request(state.clone(), &skills, &shared, &message).unwrap();
    assert_eq!(body["questions"].as_object().unwrap().len(), 10);
    assert_eq!(body["state"], state);
    assert!(request(state.clone(), &skills[..7], &shared, &message).is_err());
    message.grammar.instructions = "a".repeat(28000);
    assert!(request(state.clone(), &skills, &shared, &message).is_err());
    message.grammar.instructions = "Assess grammar".into();
    message.understandability.criteria.remove("understandable");
    assert!(request(state, &skills, &shared, &message).is_err());
}
