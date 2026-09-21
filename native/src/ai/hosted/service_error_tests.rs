//! Exercise actual HTTP errors: novel explanations survive without request content.
use serde_json::json;
#[tokio::test]
async fn http_failure_retains_reason_and_request_id_without_private_content() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let id = "a8db19511a2940d3ae09e614707b026b";
    let reason = "The \"language\" field must be an \"a supported language code\".";
    let body = json!({"code":"INVALID_REQUEST", "detail":format!("{reason} api_key=short-secret; Submitted transcript: private-transcript"),
            "request_id":id, "diagnostics":null, "unknown":"private-transcript"})
        .to_string();
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut buffer = [0u8; 4096];
        let mut received = Vec::new();
        while !received.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
            let count = stream.read(&mut buffer).await.unwrap();
            assert!(count > 0, "request ended before its headers");
            received.extend_from_slice(&buffer[..count]);
            assert!(
                received.len() <= 16_384,
                "request headers exceed fixture limit"
            );
        }
        let response = format!(
            "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nX-Request-ID: {id}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(response.as_bytes()).await.unwrap();
    });
    let response = reqwest::Client::new()
        .get(format!("http://{address}"))
        .send()
        .await
        .unwrap();
    let error = super::body_with_private(response, &["private-transcript", "short-secret"])
        .await
        .unwrap_err();
    server.await.unwrap();
    assert!(error.message.contains(reason));
    assert!(error.message.contains(id));
    let diagnostics = error.diagnostics.unwrap();
    assert!(
        diagnostics["response"]["detail"]
            .as_str()
            .unwrap()
            .contains(reason)
    );
    assert!(!error.message.contains("private-transcript"));
    assert!(!error.message.contains("short-secret"));
    assert!(!diagnostics.to_string().contains("short-secret"));
    assert!(!diagnostics.to_string().contains("private-transcript"));
}
