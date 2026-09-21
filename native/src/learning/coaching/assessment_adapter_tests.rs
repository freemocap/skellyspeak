use super::*;
fn fixture() -> (Vec<Value>, Completion) {
    let criteria: Vec<_> = (0..45)
        .map(|i| json!({"id":format!("skill_{i}")}))
        .collect();
    let answers:serde_json::Map<_,_>=criteria.iter().map(|c|(c["id"].as_str().unwrap().to_owned(),json!({"type":"choice","choice":"demonstrated","confidence":0.9,"probabilities":{"demonstrated":0.79,"partial":0.15,"not_observed":0.04,"not_demonstrated":0.01,"uncertain":0.01}}))).collect();
    (
        criteria,
        Completion {
            diagnostics: None,
            text: serde_json::to_string(&answers).unwrap(),
            finish_reason: "stop".into(),
            actual_model: "typesafe/jev-1.13-20260917".into(),
            provider_id: "fixture".into(),
            input_tokens: Some(100),
            output_tokens: Some(50),
        },
    )
}
#[test]
fn thresholds_and_evidence_are_explicit_not_provider_argmax() {
    let (criteria, output) = fixture();
    let v = validate_choices(&output, &criteria).unwrap();
    assert_eq!(v["items"][0]["outcome"], "partial");
    assert_eq!(v["items"][0]["answer"]["choice"], "demonstrated");
    assert_eq!(v["items"][0]["evidenceKind"], "whole_message");
    assert!(v["items"][0].get("quote").is_none());
    assert_eq!(v["policy"]["fullThreshold"], 0.8);
}
#[test]
fn missing_extra_and_inconsistent_answers_fail_without_partial_publication() {
    for mode in ["missing", "extra", "mismatch", "sum", "negative"] {
        let (criteria, mut out) = fixture();
        let mut value: Value = serde_json::from_str(&out.text).unwrap();
        match mode {
            "missing" => {
                value.as_object_mut().unwrap().remove("skill_0");
            }
            "extra" => {
                value["unknown"] = value["skill_0"].clone();
            }
            "mismatch" => value["skill_0"]["choice"] = json!("partial"),
            "sum" => value["skill_0"]["probabilities"]["demonstrated"] = json!(1.0),
            _ => value["skill_0"]["probabilities"]["uncertain"] = json!(-0.01),
        }
        out.text = value.to_string();
        assert!(validate_choices(&out, &criteria).is_err(), "{mode}");
    }
}

#[test]
fn actual_model_must_belong_to_requested_family_not_one_calendar_revision() {
    let (criteria, mut output) = fixture();
    for model in [
        MODEL,
        "typesafe/jev-1.13-20260917",
        "typesafe/jev-1.13-20260922",
    ] {
        output.actual_model = model.into();
        assert!(validate_choices(&output, &criteria).is_ok(), "{model}");
    }
    for model in [
        "typesafe/jev-1.14",
        "typesafe/jev-1.13-other",
        "typesafe/jev-1.13-20260922-extra",
        "typesafe/jev-1.13-123",
        "unrelated/model",
    ] {
        output.actual_model = model.into();
        assert!(validate_choices(&output, &criteria).is_err(), "{model}");
    }
}
