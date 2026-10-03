use super::*;
use serde_json::json;

fn citations() -> BTreeSet<String> {
    super::super::citations::parse_bib(include_str!("../../../references.bib"))
        .unwrap()
        .into_keys()
        .collect()
}

#[test]
fn assembled_request_has_eight_groups_and_real_language_guidance() {
    let registry = Registry::bundled().unwrap();
    let state = json!({"currentLearnerMessage":"Ayer fui al mercado.","precedingExchange":[{"role":"assistant","content":"¿Qué hiciste ayer?"}],"input":{}});
    let body = registry
        .communication_request("spanish", "spanish-spain", "english", state.clone())
        .unwrap();
    assert_eq!(body["state"], state);
    let questions = body["questions"].as_object().unwrap();
    assert_eq!(questions.len(), 8);
    assert!(!questions.contains_key("past_events"));
    let instructions = questions["time_events"]["instructions"].as_str().unwrap();
    assert!(instructions.contains("Ayer yo ir al mercado"));
    assert!(instructions.contains("compound past"));
    assert!(instructions.contains("Language: Spanish"));
    assert!(instructions.contains("Does the learner use this skill correctly"));
    assert_eq!(questions["time_events"]["type"], "choice");
    // Eight questions share the existing four-category validation and probability gate.
    let answers = registry
        .communication
        .groups
        .iter()
        .map(|g| {
            (
                g.id.clone(),
                json!({
                    "type":"choice", "choice":"direct", "confidence":0.8,
                    "probabilities":{"direct":0.7,"contextual":0.1,"absent":0.1,"unclear":0.1}
                }),
            )
        })
        .collect::<serde_json::Map<_, _>>();
    let expected = registry
        .communication
        .groups
        .iter()
        .map(|g| g.id.clone())
        .collect();
    let accepted = practice_assessment::validate(&json!(answers), &expected).unwrap();
    assert!(
        accepted
            .values()
            .all(|a| registry.demonstration_instructions.attribution.accepts(a))
    );
}

#[test]
fn content_and_locale_gaps_fail_without_fallback() {
    let mut registry = Registry::bundled().unwrap();
    assert!(
        registry
            .communication_prompts("spanish", "arabic-levantine", "english")
            .is_err()
    );
    assert!(
        registry
            .communication_prompts("spanish", "spanish-spain", "french")
            .is_err()
    );
    assert!(registry.require_complete_communication_content().is_err());
    let report = registry.communication_coverage();
    assert_eq!(report.len(), registry.languages.len().pow(2));
    assert!(
        report
            .iter()
            .find(|r| r.language == "spanish" && r.explanation_language == "english")
            .unwrap()
            .missing_groups
            .is_empty()
    );
    registry
        .communication_guides
        .get_mut("communication/spanish/english.yaml")
        .unwrap()
        .groups
        .remove("time_events");
    assert!(
        registry
            .communication_prompts("spanish", "spanish-spain", "english")
            .is_err()
    );
}

#[test]
fn guide_validator_checks_varieties_sections_and_examples() {
    let registry = Registry::bundled().unwrap();
    let mutate = |change: fn(&mut Guide)| {
        let mut bad = registry.clone();
        let guide = bad
            .communication_guides
            .get_mut("communication/spanish/english.yaml")
            .unwrap()
            .groups
            .get_mut("time_events")
            .unwrap();
        change(guide);
        assert!(bad.validate_communication_guides(&citations()).is_err());
    };
    mutate(|guide| {
        guide.varieties.remove("spanish-mexico");
    });
    mutate(|guide| {
        guide.sections.pop();
    });
    mutate(|guide| {
        guide.sections[0].examples.clear();
    });
    mutate(|guide| {
        guide.sections[0].subskill = "not_in_catalog".into();
    });
    mutate(|guide| {
        guide.assessment.clear();
    });
}

#[test]
fn prose_edits_change_provenance_but_do_not_leak_into_assessment() {
    let mut registry = Registry::bundled().unwrap();
    let hash = registry.communication_content_hash();
    registry
        .communication_guides
        .get_mut("communication/spanish/english.yaml")
        .unwrap()
        .groups
        .get_mut("time_events")
        .unwrap()
        .sections[0]
        .explanation
        .push_str(" Learner-only sentinel.");
    assert_ne!(hash, registry.communication_content_hash());
    let body = registry
        .communication_request("spanish", "spanish-spain", "english", json!({}))
        .unwrap();
    assert!(!body.to_string().contains("Learner-only sentinel"));
}

#[test]
fn no_additional_detail_is_an_explicit_authored_decision() {
    let registry = Registry::bundled().unwrap();
    let doc = &registry.communication_guides["communication/spanish/english.yaml"];
    let mut value = serde_json::to_value(doc).unwrap();
    assert!(serde_json::from_value::<Document>(value.clone()).is_ok());
    value["groups"]["time_events"]["varieties"]["spanish-spain"]
        .as_object_mut()
        .unwrap()
        .remove("detail");
    assert!(serde_json::from_value::<Document>(value).is_err());
}
