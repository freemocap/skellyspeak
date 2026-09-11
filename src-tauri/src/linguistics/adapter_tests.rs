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
    // Convenience for fixtures with one scalar per grapheme only. Complex
    // graphemes below select explicit catalog IDs, never subtract from an end.
    serde_json::json!({"first":format!("g{start:04}"),"last":format!("g{:04}", end.saturating_sub(1)),"kind":"literal"})
}
fn gloss(start: usize, end: usize, value: &str) -> serde_json::Value {
    serde_json::json!({"first":format!("g{start:04}"),"last":format!("g{:04}", end.saturating_sub(1)),"kind":"gloss","gloss":value})
}
fn candidate(spans: Vec<serde_json::Value>) -> String {
    serde_json::json!({"spans":spans}).to_string()
}

#[test]
fn inclusive_ids_reject_gaps_terminal_aliases_and_reversal() {
    let source = "e\u{301}x";
    let raw = |first: &str, last: &str| {
        candidate(vec![
            serde_json::json!({"first":first,"last":last,"kind":"gloss","gloss":"fixture"}),
        ])
    };
    for (first, last) in [
        ("g0001", "g0002"),
        ("g0000", "g0003"),
        ("b0000", "g0002"),
        ("g0", "g0002"),
        ("G0000", "g0002"),
    ] {
        assert_eq!(
            decode(source, &raw(first, last))
                .unwrap_err()
                .diagnostic_code(),
            "gloss_unknown_boundary"
        );
    }
    assert_eq!(
        decode(source, &raw("g0002", "g0000"))
            .unwrap_err()
            .diagnostic_code(),
        "gloss_empty_or_reversed_span"
    );
    let result = decode(source, &raw("g0000", "g0000")).unwrap();
    assert_eq!(result.segments()[0].span, Span { start: 0, end: 2 });
    assert_eq!(result.coverage(), Coverage::Partial);
}

#[test]
fn explanation_guidance_uses_destination_and_preserves_source() {
    let mut id = identity();
    id.explanation_language_id = "zh".into();
    let source = "Sí, café.";
    let prompt = build_word_gloss_prompt(&id, source).unwrap();
    assert!(prompt.messages[0].content.contains("Simplified Chinese"));
    assert!(
        prompt.messages[0]
            .content
            .contains("does not prevent translating")
    );
    let data: serde_json::Value = serde_json::from_str(&prompt.messages[1].content).unwrap();
    assert_eq!(data["passage"], source);
    id.target_language_id = "zh".into();
    id.explanation_language_id = "en".into();
    assert!(
        !build_word_gloss_prompt(&id, "你好").unwrap().messages[0]
            .content
            .contains("Simplified Chinese")
    );
}

#[test]
fn diagnostics_distinguish_rejections_without_exposing_content() {
    let cases = [
        (
            "sí",
            r#"{"spans":[],"private-sentinel":"private-sentinel"}"#.to_owned(),
            "gloss_invalid_json_or_shape",
            None,
        ),
        (
            "sí",
            candidate(vec![gloss(0, 9, "private-sentinel")]),
            "gloss_unknown_boundary",
            Some(0),
        ),
        (
            "sí",
            candidate(vec![gloss(1, 1, "private-sentinel")]),
            "gloss_empty_or_reversed_span",
            Some(0),
        ),
        (
            "e\u{301}x",
            candidate(vec![gloss(0, 2, "private-sentinel")]),
            "gloss_unknown_boundary",
            Some(0),
        ),
        (
            "sí sí",
            candidate(vec![
                gloss(0, 2, "private-sentinel"),
                gloss(1, 2, "private-sentinel"),
            ]),
            "gloss_overlap_or_unordered",
            Some(1),
        ),
        (
            "sí",
            candidate(vec![gloss(0, 2, "\0private-sentinel")]),
            "gloss_invalid_text",
            Some(0),
        ),
        (
            "sí",
            candidate(vec![gloss(0, 2, &"x".repeat(MAX_GLOSS_SCALARS + 1))]),
            "gloss_text_too_long",
            Some(0),
        ),
    ];
    for (source, raw, code, index) in cases {
        let error = decode(source, &raw).unwrap_err();
        assert_eq!(error.diagnostic_code(), code);
        assert_eq!(error.span_index(), index);
        assert!(!error.diagnostic_code().contains("private-sentinel"));
    }
    let completion = provider::Completion {
        text: "private-sentinel".into(),
        finish_reason: "private-sentinel".into(),
        actual_model: "fixture".into(),
        provider_id: "fixture".into(),
        input_tokens: Some(13),
        output_tokens: Some(7),
    };
    let error = validate_word_gloss_completion(&identity(), "sí", &completion).unwrap_err();
    assert_eq!(error.diagnostic_code(), "gloss_invalid_termination");
    assert_eq!(error.span_index(), None);
    assert_eq!(
        (completion.input_tokens, completion.output_tokens),
        (Some(13), Some(7))
    );
    assert_eq!(completion.text, "private-sentinel");
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
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"literal","first":"g0000"}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","last":"g0001","kind":"literal"}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"literal","kind":"literal"}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"gloss","gloss":"x","gloss":"y"}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"gloss","gloss":"x","\u0067loss":"y"}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"literal","gloss":null}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"literal","gloss":"x"}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"gloss"}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"gloss","gloss":null}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"gloss","gloss":1}]}"#,
        r#"{"spans":[{"first":0,"last":"g0001","kind":"literal"}]}"#,
        r#"{"spans":[{"first":null,"last":"g0001","kind":"literal"}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"phrase"}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"unresolved"}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001","kind":"literal","unit":"word"}]}"#,
        r#"{"spans":[{"last":"g0001","kind":"literal"}]}"#,
        r#"{"spans":[{"first":"g0000","kind":"literal"}]}"#,
        r#"{"spans":[{"first":"g0000","last":"g0001"}]}"#,
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
    for (text, start, end) in [("e\u{301}", 0, 2), ("x", 0, 2), ("xy", 1, 1)] {
        assert!(matches!(
            decode(text, &candidate(vec![literal(start, end)])),
            Err(AdapterError::InvalidBoundary { index: 0, .. })
        ));
    }
    for ids in [("g0", "g0001"), ("g0000", "G0001")] {
        assert!(matches!(
            decode(
                "x",
                &format!(
                    r#"{{"spans":[{{"first":"{}","last":"{}","kind":"literal"}}]}}"#,
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
        let rows = data["graphemes"].as_array().unwrap();
        let rebuilt: String = rows
            .iter()
            .map(|row| row["text"].as_str().unwrap())
            .collect();
        assert_eq!(rebuilt, text);
        let map = SourceMap::new(text).unwrap();
        let mut cursor = 0;
        for row in rows {
            let raw = candidate(vec![
                serde_json::json!({"first":row["id"],"last":row["id"],"kind":"literal"}),
            ]);
            let result = decode_word_gloss(&id, text, &raw).unwrap();
            let segment = result
                .segments()
                .iter()
                .find(|s| s.origin == super::super::Origin::Candidate)
                .unwrap();
            assert_eq!(segment.span.start, cursor);
            assert_eq!(
                map.slice(segment.span).unwrap(),
                row["text"].as_str().unwrap()
            );
            cursor = segment.span.end;
        }
        assert_eq!(cursor, text.chars().count());
        assert!(data.get("end_boundary").is_none());
        assert_eq!(prompt.format_id, FORMAT_ID);
        assert_eq!(prompt.template_id, TEMPLATE_ID);
        assert_eq!(prompt.boundary_policy, BOUNDARY_POLICY);
    }
}

#[test]
fn explicit_catalog_endpoints_select_repeated_and_single_grapheme_words() {
    for (text, selections, expected) in [
        (
            "sí sí",
            vec![(0, 1), (3, 4)],
            vec![Span { start: 0, end: 2 }, Span { start: 3, end: 5 }],
        ),
        (
            "e\u{301} e\u{301}",
            vec![(0, 0), (2, 2)],
            vec![Span { start: 0, end: 2 }, Span { start: 3, end: 5 }],
        ),
        ("我", vec![(0, 0)], vec![Span { start: 0, end: 1 }]),
    ] {
        let prompt = build_word_gloss_prompt(&identity(), text).unwrap();
        assert_eq!(prompt.template_id, "partner-word-gloss-prompt-v4");
        let data: serde_json::Value = serde_json::from_str(&prompt.messages[1].content).unwrap();
        let rows = data["graphemes"].as_array().unwrap();
        let spans: Vec<_> = selections
            .iter()
            .map(|&(first, last)| {
                serde_json::json!({
                    "first": rows[first]["id"], "last": rows[last]["id"],
                    "kind": "gloss", "gloss": "fixture meaning"
                })
            })
            .collect();
        let result = decode(text, &candidate(spans)).unwrap();
        let actual: Vec<_> = result
            .segments()
            .iter()
            .filter_map(|s| matches!(s.annotation, Annotation::Gloss { .. }).then_some(s.span))
            .collect();
        assert_eq!(actual, expected);
        assert_eq!(result.coverage(), Coverage::Complete);
        // Old wire equality is never reinterpreted as a singleton v2 row.
        let bad =
            serde_json::json!({"start":"b0000","end":"b0000","kind":"gloss","gloss":"fixture"});
        assert_eq!(
            decode(text, &candidate(vec![bad]))
                .unwrap_err()
                .diagnostic_code(),
            "gloss_invalid_json_or_shape"
        );
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
    assert!(
        first.output_schema["properties"]["spans"]
            .get("maxItems")
            .is_none()
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
    // Exercise the wire safeguard independently of source and template size.
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

#[test]
fn provider_structural_schema_retains_strict_native_acceptance() {
    let prompt = build_word_gloss_prompt(&identity(), "Hola.").unwrap();
    assert!(prompt.messages[0].content.contains("both inclusive"));
    assert!(
        prompt.messages[0]
            .content
            .contains("select g0000 through g0003")
    );
    assert!(
        prompt.messages[0]
            .content
            .contains("For a single row, use its ID for both first and last")
    );
    let variants = prompt.output_schema["properties"]["spans"]["items"]["oneOf"]
        .as_array()
        .unwrap();
    assert!(
        prompt.output_schema["properties"]["spans"]
            .get("maxItems")
            .is_none()
    );
    assert_eq!(
        variants[0]["properties"]["gloss"],
        serde_json::json!({"type":"string"})
    );
    for (variant, kind) in variants.iter().zip(["gloss", "literal"]) {
        assert_eq!(
            variant["properties"]["first"],
            serde_json::json!({"type":"string"})
        );
        assert_eq!(
            variant["properties"]["last"],
            serde_json::json!({"type":"string"})
        );
        assert_eq!(
            variant["properties"]["kind"],
            serde_json::json!({"type":"string","enum":[kind]})
        );
        assert_eq!(variant["additionalProperties"], false);
        assert!(
            variant["required"]
                .as_array()
                .unwrap()
                .contains(&serde_json::json!("kind"))
        );
    }
    let embedded = prompt.messages[0]
        .content
        .split_once("Output schema: ")
        .unwrap()
        .1;
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(embedded).unwrap(),
        prompt.output_schema
    );
    let result = decode(
        "Hola.",
        &candidate(vec![gloss(0, 4, "hello"), literal(4, 5)]),
    )
    .unwrap();
    assert_eq!(result.coverage(), Coverage::Complete);
    assert_eq!(result.gloss_count(), 1);
    for kind in [
        serde_json::json!(null),
        serde_json::json!(true),
        serde_json::json!(1),
        serde_json::json!("unknown"),
    ] {
        let mut span = gloss(0, 4, "hello");
        span["kind"] = kind;
        assert_eq!(
            decode("Hola.", &candidate(vec![span])),
            Err(AdapterError::InvalidJsonOrShape)
        );
    }
}

#[test]
fn historical_v1_live_fixture_is_not_reinterpreted_as_v2() {
    // Synthetic local-server smoke captured 2026-09-11; no learner content.
    // The model omitted one lexical scalar: preserve valid partial help, never
    // repair its span or mistake provider success for complete linguistic help.
    let output = completion(
        r###"{
  "spans": [
    {
      "start": "b0000",
      "end": "b0003",
      "kind": "gloss",
      "gloss": "hello"
    },
    {
      "start": "b0004",
      "end": "b0005",
      "kind": "literal"
    }
  ]
}"###
            .into(),
        "stop",
    );
    assert_eq!(
        validate_word_gloss_completion(&identity(), "Hola.", &output),
        Err(AdapterError::InvalidJsonOrShape)
    );
    // Authentic original fields/content remain above; this is historical v1,
    // not a v2 live result. No compatibility decoder is introduced.
}
