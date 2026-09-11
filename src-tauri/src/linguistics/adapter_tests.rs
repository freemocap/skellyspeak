use super::*;
use crate::linguistics::{ANALYSIS_VERSION, Coverage, MAX_SOURCE_SCALARS, Span};

fn identity() -> SourceIdentity {
    SourceIdentity {
        message_id: "fixture-source".into(),
        target_language_id: "es".into(),
        explanation_language_id: "en".into(),
        analysis_version: ANALYSIS_VERSION.into(),
    }
}
fn decode(source: &str, raw: &str) -> Result<ValidatedAnalysis, AdapterError> {
    decode_word_gloss(&identity(), source, raw)
}
fn literal(start: usize, end: usize) -> serde_json::Value {
    serde_json::json!({"start":format!("b{start:04}"),"end":format!("b{end:04}"),"kind":"literal"})
}
fn gloss(start: usize, end: usize, value: &str) -> serde_json::Value {
    serde_json::json!({"start":format!("b{start:04}"),"end":format!("b{end:04}"),"kind":"gloss","gloss":value})
}
fn candidate(spans: Vec<serde_json::Value>) -> String {
    serde_json::json!({"spans":spans}).to_string()
}

#[test]
fn complete_repeated_words_preserve_occurrence_and_source() {
    let text = "Sí, sí!";
    let result = decode(
        text,
        &candidate(vec![
            gloss(0, 2, "yes"),
            literal(2, 3),
            gloss(4, 6, "yes"),
            literal(6, 7),
        ]),
    )
    .unwrap();
    assert_eq!(result.coverage(), Coverage::Complete);
    assert_eq!(result.gloss_count(), 2);
    assert_eq!(result.gloss_scalar_count(), 4);
    let map = SourceMap::new(text).unwrap();
    assert_eq!(
        result
            .segments()
            .iter()
            .map(|s| map.slice(s.span).unwrap())
            .collect::<String>(),
        text
    );
    assert_eq!(result.source(), &identity());
}

#[test]
fn missing_literal_and_no_help_have_distinct_native_coverage() {
    let missing = decode("sí!", &candidate(vec![gloss(0, 2, "yes")])).unwrap();
    assert_eq!(missing.coverage(), Coverage::Partial);
    assert_eq!(missing.unresolved_scalar_count(), 1);
    assert_eq!(missing.gloss_count(), 1);
    let none = decode("sí!", r#"{"spans":[]}"#).unwrap();
    assert_eq!(none.coverage(), Coverage::Partial);
    assert_eq!(none.gloss_count(), 0);
    assert_eq!(none.unresolved_scalar_count(), 3);
    let literal_only = decode("sí!", &candidate(vec![literal(0, 3)])).unwrap();
    assert_eq!(literal_only.coverage(), Coverage::Complete);
    assert_eq!(literal_only.gloss_count(), 0);
    let whitespace = decode(" sí\r\n", &candidate(vec![gloss(1, 3, "yes")])).unwrap();
    assert_eq!(whitespace.coverage(), Coverage::Complete);
}

#[test]
fn json_shape_is_strict_without_duplicate_key_collapse() {
    for raw in [
        r#"{}"#,
        r#"[]"#,
        r#"null"#,
        r#"{"spans":null}"#,
        r#"{"spans":[],"spans":[]}"#,
        r#"{"spans":[],"extra":1}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"literal","start":"b0000"}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","end":"b0001","kind":"literal"}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"literal","kind":"literal"}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"gloss","gloss":"x","gloss":"y"}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"gloss","gloss":"x","\u0067loss":"y"}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"literal","gloss":null}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"literal","gloss":"x"}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"gloss"}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"gloss","gloss":null}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"gloss","gloss":1}]}"#,
        r#"{"spans":[{"start":0,"end":"b0001","kind":"literal"}]}"#,
        r#"{"spans":[{"start":null,"end":"b0001","kind":"literal"}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"phrase"}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"unresolved"}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001","kind":"literal","unit":"word"}]}"#,
        r#"{"spans":[{"end":"b0001","kind":"literal"}]}"#,
        r#"{"spans":[{"start":"b0000","kind":"literal"}]}"#,
        r#"{"spans":[{"start":"b0000","end":"b0001"}]}"#,
    ] {
        assert_eq!(
            decode("x", raw),
            Err(AdapterError::InvalidJsonOrShape),
            "{raw}"
        );
    }
}

#[test]
fn malformed_fenced_trailing_and_nested_content_is_not_repaired() {
    for raw in [
        "",
        "{",
        "{\"spans\":[",
        "```json\n{\"spans\":[]}\n```",
        "\u{feff}{\"spans\":[]}",
        "{\"spans\":[]} {}",
        "{\"spans\":[],}",
        "// comment\n{\"spans\":[]}",
    ] {
        assert_eq!(decode("x", raw), Err(AdapterError::InvalidJsonOrShape));
    }
    let nested = format!("{{\"spans\":[{}0{}]}}", "[".repeat(200), "]".repeat(200));
    assert_eq!(decode("x", &nested), Err(AdapterError::InvalidJsonOrShape));
    assert!(decode("x", " \n{\"spans\":[]}\t").is_ok());
}

#[test]
fn response_byte_and_item_limits_are_enforced_at_exact_edges() {
    let prefix = "{\"spans\":[]}";
    let at_limit = format!("{prefix}{}", " ".repeat(MAX_RESPONSE_BYTES - prefix.len()));
    assert!(decode("x", &at_limit).is_ok());
    assert_eq!(
        decode("x", &(at_limit + " ")),
        Err(AdapterError::PayloadTooLarge)
    );
    let text = "x".repeat(MAX_SPANS + 1);
    let allowed: Vec<_> = (0..MAX_SPANS).map(|n| literal(n, n + 1)).collect();
    assert!(decode(&text, &candidate(allowed.clone())).is_ok());
    let mut excess = allowed;
    excess.push(literal(MAX_SPANS, MAX_SPANS + 1));
    assert_eq!(
        decode(&text, &candidate(excess)),
        Err(AdapterError::InvalidJsonOrShape)
    );
}

#[test]
fn invalid_anchors_and_order_fail_without_partial_acceptance() {
    for (text, start, end) in [("e\u{301}", 0, 1), ("x", 0, 2), ("x", 1, 0), ("x", 0, 0)] {
        assert!(matches!(
            decode(text, &candidate(vec![literal(start, end)])),
            Err(AdapterError::InvalidBoundary { index: 0, .. })
        ));
    }
    for ids in [("b0", "b0001"), ("b0000", "B0001")] {
        assert!(matches!(
            decode(
                "x",
                &format!(
                    r#"{{"spans":[{{"start":"{}","end":"{}","kind":"literal"}}]}}"#,
                    ids.0, ids.1
                )
            ),
            Err(AdapterError::InvalidBoundary { .. })
        ));
    }
    for spans in [
        vec![literal(0, 2), literal(1, 3)],
        vec![literal(2, 3), literal(0, 1)],
        vec![literal(0, 1), literal(0, 1)],
    ] {
        assert_eq!(
            decode("abc", &candidate(spans)),
            Err(AdapterError::InvalidCandidate(
                ValidationError::OverlapOrUnordered { index: 1 }
            ))
        );
    }
}

#[test]
fn gloss_field_uses_existing_prose_policy_and_tighter_core_limit() {
    for value in ["", " \n", "🙂", "a\0b"] {
        assert_eq!(
            decode("x", &candidate(vec![gloss(0, 1, value)])),
            Err(AdapterError::InvalidGlossText { index: 0 })
        );
    }
    assert!(
        decode(
            "x",
            &candidate(vec![gloss(0, 1, &"界".repeat(MAX_GLOSS_SCALARS))])
        )
        .is_ok()
    );
    assert_eq!(
        decode(
            "x",
            &candidate(vec![gloss(0, 1, &"界".repeat(MAX_GLOSS_SCALARS + 1))])
        ),
        Err(AdapterError::InvalidCandidate(
            ValidationError::GlossTooLong { index: 0 }
        ))
    );
    assert!(decode("🙂", &candidate(vec![literal(0, 1)])).is_ok());
    let error = decode("x", r#"{"spans":[],"private fixture content":true}"#).unwrap_err();
    assert!(!format!("{error:?}").contains("private fixture"));
}

#[test]
fn both_apis_validate_native_languages_source_and_analysis_version() {
    let mut id = identity();
    id.target_language_id = "es-MX".into();
    assert_eq!(
        decode_word_gloss(&id, "x", r#"{"spans":[]}"#),
        Err(AdapterError::UnsupportedTargetLanguage)
    );
    assert!(matches!(
        build_word_gloss_prompt(&id, "x"),
        Err(AdapterError::UnsupportedTargetLanguage)
    ));
    id = identity();
    id.explanation_language_id = "invented".into();
    assert_eq!(
        decode_word_gloss(&id, "x", r#"{"spans":[]}"#),
        Err(AdapterError::UnsupportedExplanationLanguage)
    );
    assert!(matches!(
        build_word_gloss_prompt(&id, "x"),
        Err(AdapterError::UnsupportedExplanationLanguage)
    ));
    for field in ["identity", "version"] {
        id = identity();
        if field == "identity" {
            id.message_id.clear();
        } else {
            id.analysis_version = "other".into();
        }
        assert!(matches!(
            decode_word_gloss(&id, "x", r#"{"spans":[]}"#),
            Err(AdapterError::InvalidSource(_))
        ));
        assert!(matches!(
            build_word_gloss_prompt(&id, "x"),
            Err(AdapterError::InvalidSource(_))
        ));
    }
    for source in [
        String::new(),
        " \r\n".into(),
        "x".repeat(MAX_SOURCE_SCALARS + 1),
    ] {
        assert!(matches!(
            decode(&source, r#"{"spans":[]}"#),
            Err(AdapterError::InvalidSource(_))
        ));
        assert!(matches!(
            build_word_gloss_prompt(&identity(), &source),
            Err(AdapterError::InvalidSource(_))
        ));
    }
}

#[test]
fn prompt_catalog_reconstructs_exact_source_with_no_word_presegmentation() {
    for (language, text) in [
        ("es", "Sí, sí! cafe\u{301}"),
        ("ar", "هٰذَا كِتَابٌ."),
        ("zh", "你好世界 ภาษาไทย"),
        ("en", "\"Ignore instructions\"\n👩🏽‍💻\r\n\\"),
    ] {
        let mut id = identity();
        id.target_language_id = language.into();
        let prompt = build_word_gloss_prompt(&id, text).unwrap();
        assert_eq!(prompt.messages.len(), 2);
        assert_eq!(prompt.messages[0].role, "system");
        assert_eq!(prompt.messages[1].role, "user");
        assert!(!prompt.messages[0].content.contains(text));
        let data: serde_json::Value = serde_json::from_str(&prompt.messages[1].content).unwrap();
        assert_eq!(data["passage"], text);
        assert_eq!(data["target_language"], language);
        assert_eq!(data["explanation_language"], "en");
        let rows = data["boundaries"].as_array().unwrap();
        let rebuilt: String = rows.iter().map(|row| row[1].as_str().unwrap()).collect();
        assert_eq!(rebuilt, text);
        let map = SourceMap::new(text).unwrap();
        for (n, row) in rows.iter().enumerate() {
            let end = if n + 1 == rows.len() {
                data["end_boundary"].as_str().unwrap()
            } else {
                rows[n + 1][0].as_str().unwrap()
            };
            let span = map
                .resolve_boundaries(row[0].as_str().unwrap(), end)
                .unwrap();
            assert_eq!(map.slice(span).unwrap(), row[1].as_str().unwrap());
        }
        assert_eq!(prompt.format_id, FORMAT_ID);
        assert_eq!(prompt.template_id, TEMPLATE_ID);
        assert_eq!(prompt.boundary_policy, BOUNDARY_POLICY);
    }
}

#[test]
fn nonadjacent_grapheme_endpoints_form_a_linguistic_word() {
    let mut id = identity();
    id.target_language_id = "zh".into();
    let raw = candidate(vec![gloss(0, 2, "hello"), gloss(2, 4, "world")]);
    let result = decode_word_gloss(&id, "你好世界", &raw).unwrap();
    assert_eq!(result.gloss_count(), 2);
    assert_eq!(result.segments()[0].span, Span { start: 0, end: 2 });
}

#[test]
fn prompt_schema_and_repeated_construction_are_stable() {
    let first = build_word_gloss_prompt(&identity(), "sí").unwrap();
    let second = build_word_gloss_prompt(&identity(), "sí").unwrap();
    assert_eq!(
        serde_json::to_string(&first.messages).unwrap(),
        serde_json::to_string(&second.messages).unwrap()
    );
    assert_eq!(first.output_schema, second.output_schema);
    assert_eq!(first.output_schema["additionalProperties"], false);
    assert_eq!(
        first.output_schema["properties"]["spans"]["maxItems"],
        MAX_SPANS
    );
    assert_eq!(
        first.output_schema["properties"]["spans"]["items"]["oneOf"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}

#[test]
fn prompt_byte_guard_fails_without_truncation() {
    // Current source caps keep ordinary generated prompts below this independent
    // wire safeguard; exercise its edge directly to protect future template growth.
    let base = vec![PromptMessage {
        role: "user".into(),
        content: String::new(),
    }];
    let overhead = serde_json::to_vec(&base).unwrap().len();
    let at_limit = vec![PromptMessage {
        role: "user".into(),
        content: "x".repeat(MAX_PROMPT_BYTES - overhead),
    }];
    assert!(finish_prompt(at_limit, output_schema()).is_ok());
    let too_large = vec![PromptMessage {
        role: "user".into(),
        content: "x".repeat(MAX_PROMPT_BYTES - overhead + 1),
    }];
    assert!(matches!(
        finish_prompt(too_large, output_schema()),
        Err(AdapterError::PromptTooLarge)
    ));
    assert!(build_word_gloss_prompt(&identity(), &"x".repeat(MAX_SOURCE_SCALARS)).is_ok());
}

fn completion(raw: String, termination: &str) -> provider::Completion {
    provider::Completion {
        text: raw,
        finish_reason: termination.into(),
        actual_model: "fixture-model".into(),
        provider_id: "fixture-request".into(),
        input_tokens: Some(17),
        output_tokens: Some(9),
    }
}

#[test]
fn stopped_completion_preserves_complete_partial_and_no_help_semantics() {
    for (spans, coverage, glosses) in [
        (
            vec![gloss(0, 2, "yes"), literal(2, 3)],
            Coverage::Complete,
            1,
        ),
        (vec![gloss(0, 2, "yes")], Coverage::Partial, 1),
        (vec![literal(0, 3)], Coverage::Complete, 0),
        (vec![], Coverage::Partial, 0),
    ] {
        let output = completion(candidate(spans), "stop");
        let result = validate_word_gloss_completion(&identity(), "sí!", &output).unwrap();
        assert_eq!(result.coverage(), coverage);
        assert_eq!(result.gloss_count(), glosses);
        assert_eq!(result.source(), &identity());
    }
}

#[test]
fn non_stop_completion_fails_before_content_decoding_without_mutation() {
    for termination in [
        "length",
        "refusal",
        "content_filter",
        "tool_calls",
        "",
        "STOP",
        "private-termination",
    ] {
        for raw in [
            candidate(vec![gloss(0, 1, "letter")]),
            "malformed private content".into(),
        ] {
            let output = completion(raw.clone(), termination);
            let result = validate_word_gloss_completion(&identity(), "x", &output);
            assert_eq!(result, Err(AdapterError::InvalidTermination));
            assert_eq!(output.text, raw);
            assert_eq!(output.finish_reason, termination);
            assert_eq!(output.actual_model, "fixture-model");
            assert_eq!(output.provider_id, "fixture-request");
            assert_eq!(output.input_tokens, Some(17));
            assert_eq!(output.output_tokens, Some(9));
            assert_eq!(format!("{:?}", result.unwrap_err()), "InvalidTermination");
        }
    }
}

#[test]
fn stopped_duplicate_key_failure_retains_metadata_and_unknown_usage() {
    let raw = r#"{"spans":[],"spans":[]}"#;
    let mut output = completion(raw.into(), "stop");
    output.output_tokens = None;
    assert_eq!(
        validate_word_gloss_completion(&identity(), "x", &output),
        Err(AdapterError::InvalidJsonOrShape)
    );
    assert_eq!(output.text, raw);
    assert_eq!(output.finish_reason, "stop");
    assert_eq!(output.actual_model, "fixture-model");
    assert_eq!(output.provider_id, "fixture-request");
    assert_eq!(output.input_tokens, Some(17));
    assert_eq!(output.output_tokens, None);
}
