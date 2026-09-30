use super::*;
use crate::drill::{comparison::compare, reliability::DrillReliability};
use serde_json::json;

fn take(target: &str, transcript: &str) -> DrillComparison {
    let mut comparison = compare(target, transcript);
    comparison.reliability = Some(DrillReliability {
        policy: 1,
        accepted: false,
        confidence: None,
        minimum_confidence: 0.6,
        speech_seconds: 1.0,
        no_speech_probability: None,
        source: "unavailable".into(),
        reason: "confidence_unavailable".into(),
    });
    comparison.match_ratio = None;
    comparison
}

#[test]
fn rough_and_partial_attempts_count_without_an_accuracy_score() {
    for (target, transcript) in [
        ("I want to go home", "I want go home"),
        ("I want to go home", "I want to go"),
        ("bonjour", "bonjor"),
        ("café", "cafe\u{301}"),
        ("البيت", "البَيت"),
        ("你好世界", "你好世"),
        ("가나다", "가나"),
        ("नमस्ते", "नमस्ते"),
    ] {
        let comparison = take(target, transcript);
        assert_eq!(
            practice(&comparison, true),
            Qualification::Qualified,
            "{target}"
        );
        assert_eq!(
            comparison.match_ratio, None,
            "effort must not invent a score"
        );
        assert_eq!(comparison.target, target);
        assert_eq!(comparison.transcript, transcript);
    }
}

#[test]
fn skipped_silent_unrelated_and_unresolved_takes_are_distinct() {
    assert_eq!(
        practice(&take("hello", "hello"), false),
        Qualification::NotQualified
    );
    for (target, transcript) in [
        ("hello", ""),
        ("hello", "banana"),
        ("", "hello"),
        ("!!!", "!!!"),
    ] {
        assert_eq!(
            practice(&take(target, transcript), true),
            Qualification::NotQualified
        );
    }
    let mut silent = take("hello", "hello");
    silent.reliability.as_mut().unwrap().speech_seconds = 0.0;
    assert_eq!(practice(&silent, true), Qualification::NotQualified);
    let mut unknown = take("hello", "hello");
    unknown.reliability = None;
    assert_eq!(practice(&unknown, true), Qualification::Pending);
}

#[test]
fn low_recognition_confidence_does_not_erase_on_target_effort() {
    let mut comparison = take("hello", "hello");
    comparison.reliability.as_mut().unwrap().reason = "low_confidence".into();
    comparison.reliability.as_mut().unwrap().confidence = Some(0.4);
    assert_eq!(practice(&comparison, true), Qualification::Qualified);
    comparison.reliability.as_mut().unwrap().reason = "no_speech".into();
    assert_eq!(practice(&comparison, true), Qualification::NotQualified);
}

fn clear() -> (CoachObservationView, CoachDecision) {
    (
        serde_json::from_value(json!({"issues":[],"corrections":[],"notes":[],"meaningRecovered":"full","items":[],"candidatesSent":3,"itemsReturned":0})).unwrap(),
        serde_json::from_value(json!({"exposedMove":null,"shown":null,"retryInvited":false,"alsoNoticed":[],"keptGoing":false})).unwrap(),
    )
}

#[test]
fn missing_feedback_is_never_assumed_clean() {
    let (mut feedback, decision) = clear();
    assert_eq!(no_issues(None, Some(&decision)), Qualification::Pending);
    assert_eq!(no_issues(Some(&feedback), None), Qualification::Pending);
    assert_eq!(
        no_issues(Some(&feedback), Some(&decision)),
        Qualification::Qualified
    );
    feedback.meaning_recovered = MeaningLevel::Partial;
    assert_eq!(
        no_issues(Some(&feedback), Some(&decision)),
        Qualification::NotQualified
    );
    feedback.meaning_recovered = MeaningLevel::Full;
    feedback
        .notes
        .push("Unusable assessment item omitted.".into());
    assert_eq!(
        no_issues(Some(&feedback), Some(&decision)),
        Qualification::NotQualified
    );
}

#[test]
fn no_op_revisions_do_not_count() {
    assert!(!changed_revision("hello", "hello"));
    assert!(!changed_revision("hello", " hello \n"));
    assert!(!changed_revision("hello", "   "));
    assert!(changed_revision("I goes", "I go"));
    assert!(changed_revision("cafe", "café"));
}

#[test]
fn only_validated_understood_reactions_qualify() {
    assert_eq!(understood(None), Qualification::Pending);
    for (kind, expected) in [
        ("understood", Qualification::Qualified),
        ("confused", Qualification::NotQualified),
    ] {
        let reaction: PartnerReaction = serde_json::from_value(json!({
            "kind": kind, "answer": {"choice": kind, "probabilities": {kind: 1.0}, "confidence": 1.0}
        })).unwrap();
        assert_eq!(understood(Some(&reaction)), expected);
    }
}

#[test]
fn hidden_and_partial_corrections_are_not_clean() {
    let (mut feedback, mut decision) = clear();
    feedback.items = serde_json::from_value(json!([{
        "construct":"past", "quote":"go", "outcome":"partial", "rationale":"Partial evidence"
    }]))
    .unwrap();
    assert_eq!(
        no_issues(Some(&feedback), Some(&decision)),
        Qualification::NotQualified
    );
    feedback.items.clear();
    decision.shown = Some(
        serde_json::from_value(json!({
            "construct":"past", "quote":"go", "move":"hint", "text":"Check the tense."
        }))
        .unwrap(),
    );
    assert_eq!(
        no_issues(Some(&feedback), Some(&decision)),
        Qualification::NotQualified
    );
    assert!(decision.exposed_move.is_none());
}

#[test]
fn alignment_boundary_is_explicit_and_not_a_perfection_gate() {
    assert_eq!(POLICY, "effort-inclusion-1");
    let mut comparison = take("abcdefghijklmnopqrst", "abcdefg");
    assert_eq!(practice(&comparison, true), Qualification::Qualified);
    comparison.character_error_rate = Some(0.66);
    assert_eq!(practice(&comparison, true), Qualification::NotQualified);
}
