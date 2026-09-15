use super::PromptMessage;
use crate::model::ConnectionRoute;
use std::{
    io::{Read, Write},
    net::TcpListener,
    time::Duration,
};

pub(super) fn server(
    status: &str,
    body: &str,
    extra: &str,
) -> (String, std::thread::JoinHandle<serde_json::Value>) {
    server_auth(status, body, extra, true)
}
fn server_auth(
    status: &str,
    body: &str,
    extra: &str,
    auth: bool,
) -> (String, std::thread::JoinHandle<serde_json::Value>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/chat/completions", listener.local_addr().unwrap());
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n{extra}\r\n{body}",
        body.len()
    );
    let worker = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut received = Vec::new();
        let mut buffer = [0u8; 4096];
        let end = loop {
            let count = stream.read(&mut buffer).unwrap();
            assert!(count > 0);
            received.extend_from_slice(&buffer[..count]);
            if let Some(end) = received.windows(4).position(|s| s == b"\r\n\r\n") {
                break end + 4;
            }
        };
        let headers = String::from_utf8(received[..end].to_vec()).unwrap();
        assert_eq!(
            headers
                .to_lowercase()
                .contains("authorization: bearer test-credential"),
            auth
        );
        if !auth {
            assert!(!headers.to_lowercase().contains("authorization:"));
        }

        let length: usize = headers
            .lines()
            .find_map(|line| {
                line.to_lowercase()
                    .strip_prefix("content-length:")
                    .map(|n| n.trim().parse().unwrap())
            })
            .unwrap_or(0);
        while received.len() < end + length {
            let count = stream.read(&mut buffer).unwrap();
            assert!(count > 0);
            received.extend_from_slice(&buffer[..count]);
        }
        let payload = if length == 0 {
            assert!(headers.starts_with("GET "));
            serde_json::Value::Null
        } else {
            serde_json::from_slice(&received[end..end + length]).unwrap()
        };
        stream.write_all(response.as_bytes()).unwrap();
        payload
    });
    (url, worker)
}
pub(super) fn structured_dispatch(
    url: String,
    route: ConnectionRoute,
) -> crate::conversations::execution::Dispatch {
    crate::conversations::execution::Dispatch {
        coaching_schema: None,
        gloss_source: None,
        speech_source: None,
        target: crate::ai::connections::access::ResolvedTarget {
            route,
            revision: 1,
            url,
            model: "google/gemini-2.5-flash".into(),
            credential: Some("test-credential".into()),
        },
        attempt: "2000000000-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".into(),
        operation: "11111111-1111-1111-1111-111111111111".into(),
        credential: "test-credential".into(),
        model: "google/gemini-2.5-flash".into(),
        messages: vec![PromptMessage {
            role: "user".into(),
            content: "fixture".into(),
        }],
        route,
        install_id: "test".into(),
    }
}
