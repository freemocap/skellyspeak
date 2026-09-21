use super::super::{client, fixtures::server};
use super::*;

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
