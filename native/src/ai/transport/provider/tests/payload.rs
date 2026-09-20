use super::*;

#[test]
fn structured_payload_preserves_prose_and_routes_strict_schema() {
    let schema = serde_json::json!({"type":"object","additionalProperties":false,"properties":{"spans":{"type":"array"}},"required":["spans"]});
    let messages = vec![PromptMessage {
        role: "user".into(),
        content: "Sí 你好".into(),
    }];
    for route in [
        ConnectionRoute::Openrouter,
        ConnectionRoute::Hosted,
        ConnectionRoute::Custom,
    ] {
        let prose = payload("google/gemini-2.5-flash", &messages, route).unwrap();
        assert_eq!(
            prose,
            payload_with_output(
                "google/gemini-2.5-flash",
                &messages,
                route,
                RequestOutput::Prose
            )
            .unwrap()
        );
        assert!(prose.get("response_format").is_none());
        let structured = payload_with_output(
            "google/gemini-2.5-flash",
            &messages,
            route,
            RequestOutput::JsonSchema {
                max_output_tokens: GLOSS_OUTPUT_TOKENS,
                name: "word_gloss_v1",
                schema: &schema,
            },
        )
        .unwrap();
        assert_eq!(
            structured["response_format"],
            serde_json::json!({"type":"json_schema","json_schema":{"name":"word_gloss_v1","strict":true,"schema":schema}})
        );
        assert_eq!(structured["messages"], prose["messages"]);
        assert_eq!(structured["max_tokens"], GLOSS_OUTPUT_TOKENS);
        assert_eq!(structured["temperature"], 0.7);
        assert_eq!(
            structured["reasoning"],
            serde_json::json!({"enabled":false})
        );
        if route == ConnectionRoute::Openrouter {
            assert_eq!(
                structured["provider"],
                serde_json::json!({"allow_fallbacks":false,"require_parameters":true})
            );
            assert_eq!(
                prose["provider"],
                serde_json::json!({"allow_fallbacks":false})
            );
        } else {
            assert!(structured.get("provider").is_none());
        }
    }
}

#[test]
fn structured_bounds_include_schema_python_spaces_escaping_and_float_headroom() {
    let sample = serde_json::json!({"é":["a\n", true, 1, null]});
    let python = "{\"é\": [\"a\\n\", true, 1, null]}";
    assert_eq!(
        structured_input_bound(&sample).unwrap(),
        python.len() + SERVER_INPUT_OVERHEAD
    );
    for (number, python) in [
        (1e-7, "1e-07"),
        (1e20, "1e+20"),
        (1e100, "1e+100"),
        (-0.0, "-0.0"),
    ] {
        assert!(
            structured_input_bound(&serde_json::json!(number)).unwrap()
                >= python.len() + SERVER_INPUT_OVERHEAD
        );
    }
    let schema = serde_json::json!({"description":"schema content", "type":"object"});
    for route in [
        ConnectionRoute::Hosted,
        ConnectionRoute::Custom,
        ConnectionRoute::Openrouter,
    ] {
        let mut messages = vec![PromptMessage {
            role: "user".into(),
            content: String::new(),
        }];
        let output = RequestOutput::JsonSchema {
            max_output_tokens: 2048,
            name: "bounded",
            schema: &schema,
        };
        let base =
            payload_with_output("google/gemini-2.5-flash", &messages, route, output).unwrap();
        let room = STRUCTURED_INPUT_LIMIT - structured_input_bound(&base).unwrap();
        messages[0].content = "x".repeat(room);
        assert!(payload_with_output("google/gemini-2.5-flash", &messages, route, output).is_ok());
        messages[0].content.push('x');
        assert_eq!(
            payload_with_output("google/gemini-2.5-flash", &messages, route, output)
                .unwrap_err()
                .code,
            ErrorCode::Validation
        );
        messages[0].content = "\n".repeat(room / 2 + 1);
        assert!(payload_with_output("google/gemini-2.5-flash", &messages, route, output).is_err());
    }
    let huge_schema = serde_json::json!({"description":"s".repeat(100_000)});
    assert!(
        payload_with_output(
            "google/gemini-2.5-flash",
            &[PromptMessage {
                role: "user".into(),
                content: "small".into()
            }],
            ConnectionRoute::Hosted,
            RequestOutput::JsonSchema {
                max_output_tokens: 2048,
                name: "schema",
                schema: &huge_schema
            }
        )
        .is_err()
    );
}

#[test]
fn structured_invalid_contracts_fail_with_content_free_errors() {
    let schema = serde_json::json!({});
    let messages = vec![PromptMessage {
        role: "user".into(),
        content: "private fixture".into(),
    }];
    for name in ["", "private schema name!", &"n".repeat(65)] {
        let error = payload_with_output(
            "google/gemini-2.5-flash",
            &messages,
            ConnectionRoute::Hosted,
            RequestOutput::JsonSchema {
                max_output_tokens: 2048,
                name,
                schema: &schema,
            },
        )
        .unwrap_err();
        assert_eq!(error.code, ErrorCode::Validation);
        assert!(!error.message.contains("private"));
    }
    for schema in [
        serde_json::json!(true),
        serde_json::json!([]),
        serde_json::Value::Null,
    ] {
        assert!(
            payload_with_output(
                "chosen/model",
                &messages,
                ConnectionRoute::Openrouter,
                RequestOutput::JsonSchema {
                    max_output_tokens: 2048,
                    name: "schema",
                    schema: &schema
                }
            )
            .is_err()
        );
    }
    let output = RequestOutput::JsonSchema {
        max_output_tokens: 2048,
        name: "schema",
        schema: &schema,
    };
    assert!(
        payload_with_output("chosen/model", &messages, ConnectionRoute::Custom, output).is_ok()
    );
    assert!(payload_with_output("chosen/model", &[], ConnectionRoute::Openrouter, output).is_err());
    let unsupported = [PromptMessage {
        role: "tool".into(),
        content: "private fixture".into(),
    }];
    assert!(
        payload_with_output(
            "chosen/model",
            &unsupported,
            ConnectionRoute::Openrouter,
            output
        )
        .is_err()
    );
    let mut nested = serde_json::json!({});
    for _ in 0..70 {
        nested = serde_json::json!({"items":nested});
    }
    assert!(
        payload_with_output(
            "chosen/model",
            &messages,
            ConnectionRoute::Openrouter,
            RequestOutput::JsonSchema {
                max_output_tokens: 2048,
                name: "schema",
                schema: &nested
            }
        )
        .is_err()
    );
}
#[test]
fn hosted_payload_obeys_service_routing_and_model_contract() {
    let hosted = payload("google/gemini-2.5-flash", &[], ConnectionRoute::Hosted).unwrap();
    assert!(hosted.get("provider").is_none());
    assert_eq!(hosted["max_tokens"], 2048);
    assert_eq!(hosted["stream"], false);
    assert_eq!(
        payload("new-provider/new-model", &[], ConnectionRoute::Hosted).unwrap()["model"],
        "new-provider/new-model"
    );
    let direct = payload("chosen/model", &[], ConnectionRoute::Openrouter).unwrap();
    assert_eq!(direct["provider"]["allow_fallbacks"], false);
}

#[test]
fn every_route_preserves_an_arbitrary_structured_model() {
    let messages = [PromptMessage {
        role: "user".into(),
        content: "Hello".into(),
    }];
    let schema = serde_json::json!({"type":"object","properties":{}});
    for route in [
        ConnectionRoute::Hosted,
        ConnectionRoute::Custom,
        ConnectionRoute::Openrouter,
    ] {
        let body = payload_with_output(
            "new-provider/new-model:variant",
            &messages,
            route,
            RequestOutput::JsonSchema {
                max_output_tokens: 2048,
                name: "reply",
                schema: &schema,
            },
        )
        .unwrap();
        assert_eq!(body["model"], "new-provider/new-model:variant");
        assert_eq!(body["response_format"]["json_schema"]["schema"], schema);
    }
}
