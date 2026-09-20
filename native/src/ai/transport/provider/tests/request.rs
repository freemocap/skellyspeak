use super::super::fixtures::{server, structured_dispatch};
use super::*;
use std::net::TcpListener;

#[tokio::test]
async fn structured_direct_preserves_raw_candidate_finish_usage_and_redaction() {
    let schema = serde_json::json!({"type":"object"});
    let contract = RequestOutput::JsonSchema {
        max_output_tokens: 2048,
        name: "fixture",
        schema: &schema,
    };
    for finish in ["stop", "length"] {
        let raw = serde_json::json!({"id":"request", "model":"actual", "choices":[{"finish_reason":finish,"message":{"content":"{\"same\":1,\"same\":2}"}}],"usage":{"prompt_tokens":12,"completion_tokens":3}}).to_string();
        let (url, worker) = server("200 OK", &raw, "");
        let result = complete_with_output(
            &client().unwrap(),
            "test-credential",
            &structured_dispatch(url, ConnectionRoute::Openrouter),
            contract,
        )
        .await
        .unwrap();
        assert_eq!(result.text, "{\"same\":1,\"same\":2}");
        assert_eq!(result.finish_reason, finish);
        assert_eq!(
            (result.input_tokens, result.output_tokens),
            (Some(12), Some(3))
        );
        let payload = worker.join().unwrap();
        assert_eq!(payload["response_format"]["json_schema"]["schema"], schema);
        assert_eq!(
            payload["provider"],
            serde_json::json!({"allow_fallbacks":false,"require_parameters":true})
        );
    }
    let destination = TcpListener::bind("127.0.0.1:0").unwrap();
    destination.set_nonblocking(true).unwrap();
    let (url, worker) = server(
        "302 Found",
        "private-schema test-credential",
        &format!(
            "Location: http://{}/leak\r\n",
            destination.local_addr().unwrap()
        ),
    );
    let error = complete_with_output(
        &client().unwrap(),
        "test-credential",
        &structured_dispatch(url, ConnectionRoute::Openrouter),
        contract,
    )
    .await
    .unwrap_err();
    worker.join().unwrap();
    assert!(!error.message.contains("private-schema"));
    assert!(!error.message.contains("test-credential"));
    assert_eq!(
        destination.accept().unwrap_err().kind(),
        std::io::ErrorKind::WouldBlock
    );
}
#[tokio::test]
async fn structured_invalid_preflight_submits_no_http_for_any_route_or_group() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let url = format!("http://{}/v1/operations", listener.local_addr().unwrap());
    let schema = serde_json::json!({"description":"private-schema".repeat(10000)});
    let contract = RequestOutput::JsonSchema {
        max_output_tokens: 2048,
        name: "fixture",
        schema: &schema,
    };
    let client = client().unwrap();
    for route in [
        ConnectionRoute::Hosted,
        ConnectionRoute::Custom,
        ConnectionRoute::Openrouter,
    ] {
        let error = complete_with_output(
            &client,
            "test-credential",
            &structured_dispatch(url.clone(), route),
            contract,
        )
        .await
        .unwrap_err();
        assert_eq!(error.code, ErrorCode::Validation);
        assert!(!error.message.contains("private-schema"));
    }
    let dispatches = [
        structured_dispatch(url.clone(), ConnectionRoute::Hosted),
        structured_dispatch(url, ConnectionRoute::Hosted),
    ];
    for outputs in [
        vec![RequestOutput::Prose],
        vec![RequestOutput::Prose, contract],
    ] {
        let error = crate::ai::transport::grouped::request_with_outputs(
            &client,
            "test-credential",
            &dispatches,
            &outputs,
            |_, _| panic!("preflight must not publish"),
        )
        .await
        .unwrap_err();
        assert_eq!(error.code, ErrorCode::Validation);
    }
    assert_eq!(
        listener.accept().unwrap_err().kind(),
        std::io::ErrorKind::WouldBlock
    );
}
#[tokio::test]
async fn adapter_sends_explicit_target_and_normalizes_usage() {
    let (url, worker) = server(
        "200 OK",
        r#"{"id":"request-id","model":"actual-model","choices":[{"finish_reason":"stop","message":{"content":"Hola"}}],"usage":{"prompt_tokens":12,"completion_tokens":3}}"#,
        "",
    );
    let output = request(
        &client().unwrap(),
        &url,
        "test-credential",
        "selected-model",
        &[PromptMessage {
            role: "user".into(),
            content: "Hi".into(),
        }],
        ConnectionRoute::Openrouter,
        "test-install",
    )
    .await
    .unwrap();
    assert_eq!(output.text, "Hola");
    assert_eq!(output.output_tokens, Some(3));
    let payload = worker.join().unwrap();
    assert_eq!(payload["model"], "selected-model");
    assert_eq!(payload["provider"]["allow_fallbacks"], false);
    assert_eq!(payload["stream"], false);
}
#[tokio::test]
async fn hosted_admission_error_preserves_reason_and_retry_after() {
    let (url, worker) = server(
        "429 Too Many Requests",
        r#"{"detail":"Daily request limit reached. Resets at 00:00 UTC."}"#,
        "Retry-After: 60\r\n",
    );
    let error = request(
        &client().unwrap(),
        &url,
        "test-credential",
        "google/gemini-2.5-flash",
        &[],
        ConnectionRoute::Hosted,
        "test-install",
    )
    .await
    .unwrap_err();
    worker.join().unwrap();
    assert!(error.message.contains("Daily request limit reached"));
    assert!(error.message.contains("Retry-After: 60 seconds"));
    let refusal = error.refusal.unwrap();
    assert!(refusal.retry_at.unwrap() > crate::ai::policy::refusal::now());
    assert!(!refusal.service_wide); // Text alone cannot widen the scope.
    assert!(!error.message.contains("test-credential"));
}
#[tokio::test]
async fn redirects_are_not_followed_and_provider_errors_are_redacted() {
    let destination = TcpListener::bind("127.0.0.1:0").unwrap();
    destination.set_nonblocking(true).unwrap();
    let (url, worker) = server(
        "302 Found",
        "test-credential must not be returned",
        &format!(
            "Location: http://{}/leak\r\n",
            destination.local_addr().unwrap()
        ),
    );
    let error = request(
        &client().unwrap(),
        &url,
        "test-credential",
        "selected-model",
        &[],
        ConnectionRoute::Openrouter,
        "test-install",
    )
    .await
    .unwrap_err();
    worker.join().unwrap();
    assert!(error.message.contains("302"));
    assert!(!error.message.contains("test-credential"));
    assert_eq!(
        destination.accept().unwrap_err().kind(),
        std::io::ErrorKind::WouldBlock
    );
}

fn sse(events: &[serde_json::Value], done: bool) -> String {
    let mut body: String = events
        .iter()
        .map(|event| format!("data: {event}\n\n"))
        .collect();
    if done {
        body.push_str("data: [DONE]\n\n");
    }
    body
}

#[tokio::test]
async fn streamed_prose_reports_growth_and_decodes_like_a_whole_response() {
    let body = sse(
        &[
            serde_json::json!({"id":"gen","model":"actual","choices":[{"delta":{"content":"¿Qué "}}]}),
            serde_json::json!({"id":"gen","model":"actual","choices":[{"delta":{"content":"tal?"},"finish_reason":"stop"}]}),
            serde_json::json!({"id":"gen","model":"actual","choices":[],"usage":{"prompt_tokens":9,"completion_tokens":3}}),
        ],
        true,
    );
    let (url, worker) = server("200 OK", &body, "");
    let mut seen = Vec::new();
    let result = complete_streaming(
        &client().unwrap(),
        "test-credential",
        &structured_dispatch(url, ConnectionRoute::Openrouter),
        |text| seen.push(text.to_owned()),
    )
    .await
    .unwrap();
    assert_eq!(result.text, "¿Qué tal?");
    assert_eq!(result.finish_reason, "stop");
    assert_eq!(
        (result.input_tokens, result.output_tokens),
        (Some(9), Some(3))
    );
    assert_eq!(seen.last().map(String::as_str), Some("¿Qué tal?"));
    assert!(result.diagnostics.unwrap().get("http").is_some());
    let payload = worker.join().unwrap();
    assert_eq!(payload["stream"], true);
    assert_eq!(payload["usage"], serde_json::json!({"include": true}));
}

#[tokio::test]
async fn streamed_failures_keep_what_arrived_without_leaking_text() {
    let cases = [
        (
            sse(
                &[
                    serde_json::json!({"id":"gen","model":"actual","choices":[{"delta":{"content":"Parti"}}]}),
                    serde_json::json!({"error":{"code":502,"message":"Upstream fixture failed"}}),
                ],
                false,
            ),
            "provider_error",
        ),
        (
            sse(
                &[
                    serde_json::json!({"id":"gen","model":"actual","choices":[{"delta":{"content":"Parti"}}]}),
                ],
                false,
            ),
            "transport_broken",
        ),
    ];
    for (body, reason) in cases {
        let (url, worker) = server("200 OK", &body, "");
        let mut seen = Vec::new();
        let error = complete_streaming(
            &client().unwrap(),
            "test-credential",
            &structured_dispatch(url, ConnectionRoute::Openrouter),
            |text| seen.push(text.to_owned()),
        )
        .await
        .unwrap_err();
        worker.join().unwrap();
        assert_eq!(
            seen,
            vec!["Parti".to_owned()],
            "{reason}: the text reached the caller"
        );
        let details = error.diagnostics.unwrap();
        assert_eq!(details["reason"], reason);
        assert_eq!(details["chars"], 5);
        assert!(!details.to_string().contains("Parti"));
        assert!(!error.message.contains("test-credential"));
    }
}

#[tokio::test]
async fn every_stream_failure_keeps_received_metadata_and_redacts_content() {
    use serde_json::json;
    let prefix = sse(
        &[
            json!({"id":"gen-retained","model":"actual-model","provider":"Google",
            "debug_blob":"unclassified-private-value", "api_key":"test-credential",
            "choices":[{"delta":{"content":"Private response"},"finish_reason":"length","native_finish_reason":"MAX_TOKENS"}]}),
            json!({"usage":{"prompt_tokens":9,"completion_tokens":3,"cost":0.001,
            "prompt_tokens_details":{"cached_tokens":2},"content":"private usage content"}}),
        ],
        false,
    );
    let cases = [
        (String::new(), "transport_broken"),
        ("data: {broken\n\n".into(), "invalid_event_json"),
        (
            sse(
                &[
                    json!({"error":{"code":502,"message":"fixture test-credential Private response"}}),
                ],
                false,
            ),
            "provider_error",
        ),
        (
            sse(
                &[json!({"choices":[{"delta":{"content":"x".repeat(262_144)}}]})],
                false,
            ),
            "response_limit",
        ),
    ];
    for (suffix, reason) in cases {
        let (url, worker) = server(
            "200 OK",
            &(prefix.clone() + &suffix),
            "X-Request-ID: http-retained\r\n",
        );
        let error = complete_streaming(
            &client().unwrap(),
            "test-credential",
            &structured_dispatch(url, ConnectionRoute::Openrouter),
            |_| {},
        )
        .await
        .unwrap_err();
        worker.join().unwrap();
        let details = error.diagnostics.unwrap();
        assert_eq!(details["reason"], reason);
        assert_eq!(details["id"], "gen-retained");
        assert_eq!(details["model"], "actual-model");
        assert_eq!(details["provider"], "Google");
        assert_eq!(details["native_finish_reason"], "MAX_TOKENS");
        assert_eq!(
            details["usage"]["prompt_tokens_details"]["cached_tokens"],
            2
        );
        assert_eq!(details["usage"]["cost"], 0.001);
        assert!(details["http"].to_string().contains("http-retained"));
        let recorded = format!("{details} {}", error.message);
        for private in [
            "Private response",
            "fixture",
            "test-credential",
            "unclassified-private-value",
            "private usage content",
        ] {
            assert!(!recorded.contains(private), "{reason} leaked {private}");
        }
    }
}
