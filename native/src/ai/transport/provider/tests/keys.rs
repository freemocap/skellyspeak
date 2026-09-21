use super::super::{client, fixtures::server};
use super::*;

#[tokio::test]
async fn failed_key_connection_retains_transport_cause_without_url_or_key() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    drop(listener);
    let url = format!("http://{address}/private-path?token=private-value");
    let failure = verify_key_at(&client().unwrap(), "test-credential", &url)
        .await
        .unwrap_err();
    assert!(matches!(failure.code, ErrorCode::Provider));
    let details = failure.diagnostics.unwrap();
    assert_eq!(details["stage"], "key_verification");
    assert_eq!(details["reason"], "connection_failed");
    assert!(!details["causes"].as_array().unwrap().is_empty());
    let saved = details.to_string();
    for secret in ["private-path", "private-value", "test-credential"] {
        assert!(!saved.contains(secret), "{saved}");
    }
}

#[tokio::test]
async fn malformed_key_response_retains_parser_location_without_body() {
    let (url, worker) = server("200 OK", "{\nprivate-response", "");
    let failure = verify_key_at(&client().unwrap(), "test-credential", &url)
        .await
        .unwrap_err();
    let details = failure.diagnostics.unwrap();
    assert_eq!(details["stage"], "key_verification_json");
    assert_eq!(details["line"], 2);
    assert_eq!(details["reason"], "Syntax");
    assert!(!details.to_string().contains("private-response"));
    worker.join().unwrap();
}

#[test]
fn validate_key_messages_distinguish_whitespace() {
    assert_eq!(
        super::validate_key_format("bad").unwrap_err().message,
        "Invalid API key."
    );
    assert_eq!(
        super::validate_key_format("key with spaces")
            .unwrap_err()
            .message,
        "API keys cannot contain spaces or line breaks."
    );
    assert!(super::validate_key_format("test-credential").is_ok());
}

#[tokio::test]
async fn key_verification_checks_authentication_without_a_completion() {
    let (url, worker) = server("200 OK", r#"{"data":{"label":"test"}}"#, "");
    verify_key_at(&client().unwrap(), "test-credential", &url)
        .await
        .unwrap();
    assert_eq!(worker.join().unwrap(), serde_json::Value::Null);
}
#[tokio::test]
async fn key_verification_reports_rejection_without_echoing_response() {
    for (status, body) in [
        ("401 Unauthorized", "Invalid API key: test-credential"),
        ("200 OK", "not JSON"),
    ] {
        let (url, worker) = server(status, body, "");
        let error = verify_key_at(&client().unwrap(), "test-credential", &url)
            .await
            .unwrap_err();
        assert!(!error.message.contains(body));
        if status.starts_with("401") {
            assert!(error.message.contains("Invalid API key"));
        }
        assert!(!error.message.contains("test-credential"));
        worker.join().unwrap();
    }
}
