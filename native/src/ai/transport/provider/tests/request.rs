use super::super::fixtures::{server, structured_dispatch};
use super::*;
use std::net::TcpListener;

#[tokio::test]
async fn structured_direct_preserves_raw_candidate_finish_usage_and_redaction() {
    let schema = serde_json::json!({"type":"object"});
    let contract = RequestOutput::JsonSchema {
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
