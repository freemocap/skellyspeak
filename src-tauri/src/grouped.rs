//! Bounded NDJSON decoding. Valid item outcomes can be persisted before EOF.
use crate::{
    model::{AppError, ErrorCode, Result},
    provider::{self, Completion},
};
use serde::Deserialize;
use std::collections::HashMap;

const LINE_LIMIT: usize = 4 * 1024 * 1024 + 4096;
const STREAM_LIMIT: usize = 8 * LINE_LIMIT + 1024;

fn unknown() -> AppError {
    AppError::new(
        ErrorCode::UnknownOutcome,
        "Grouped response is incomplete or invalid. Unconfirmed operations may have incurred charges; no automatic retry was made.",
    )
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
enum Event {
    Result {
        operation_id: String,
        attempt_id: String,
        response: serde_json::Value,
    },
    Duplicate {
        operation_id: String,
        attempt_id: String,
        state: String,
    },
    Error {
        operation_id: String,
        attempt_id: String,
        code: String,
        status: u16,
        retry_after: Option<u32>,
    },
    Complete {
        count: usize,
    },
}

pub struct Decoder {
    pending: HashMap<String, String>,
    count: usize,
    line: Vec<u8>,
    bytes: usize,
    complete: bool,
}
impl Decoder {
    pub fn new(identities: impl IntoIterator<Item = (String, String)>) -> Result<Self> {
        let mut pending = HashMap::new();
        for (operation, attempt) in identities {
            if pending.values().any(|existing| existing == &attempt)
                || pending.insert(operation, attempt).is_some()
            {
                return Err(unknown());
            }
        }
        let count = pending.len();
        if !(1..=8).contains(&count) {
            return Err(unknown());
        }
        Ok(Self {
            pending,
            count,
            line: Vec::new(),
            bytes: 0,
            complete: false,
        })
    }
    pub fn push(
        &mut self,
        chunk: &[u8],
        mut publish: impl FnMut(&str, Result<Completion>) -> Result<()>,
    ) -> Result<()> {
        self.bytes = self.bytes.checked_add(chunk.len()).ok_or_else(unknown)?;
        if self.bytes > STREAM_LIMIT {
            return Err(unknown());
        }
        for byte in chunk {
            if self.complete {
                return Err(unknown());
            }
            if *byte != b'\n' {
                if self.line.len() >= LINE_LIMIT {
                    return Err(unknown());
                }
                self.line.push(*byte);
                continue;
            }
            let event: Event = serde_json::from_slice(&self.line).map_err(|_| unknown())?;
            self.line.clear();
            let (operation, attempt, result) = match event {
                Event::Complete { count } => {
                    if count != self.count || !self.pending.is_empty() {
                        return Err(unknown());
                    }
                    self.complete = true;
                    continue;
                }
                Event::Result {
                    operation_id,
                    attempt_id,
                    response,
                } => (
                    operation_id,
                    attempt_id,
                    provider::decode(&serde_json::to_vec(&response)?).map_err(|_| AppError::new(
                        ErrorCode::UnknownOutcome,
                        "The server returned an invalid AI completion for this operation. Usage is unconfirmed; no automatic retry was made.",
                    )),
                ),
                Event::Duplicate {
                    operation_id,
                    attempt_id,
                    state,
                } => {
                    if !matches!(
                        state.as_str(),
                        "running" | "succeeded" | "failed" | "unknown"
                    ) {
                        return Err(unknown());
                    }
                    (
                        operation_id,
                        attempt_id,
                        Err(AppError::new(
                            ErrorCode::UnknownOutcome,
                            "The server has already admitted this attempt. Its result is not available for replay; no additional request was started.",
                        )),
                    )
                }
                Event::Error {
                    operation_id,
                    attempt_id,
                    code,
                    status,
                    retry_after,
                } => {
                    if !(400..=599).contains(&status)
                        || code.len() > 64
                        || !code.bytes().all(|c| c.is_ascii_uppercase() || c == b'_')
                    {
                        return Err(unknown());
                    }
                    let error = if status == 429 {
                        AppError::new(
                            ErrorCode::Provider,
                            "Server admission refused this operation.",
                        )
                        .with_refusal(crate::refusal::classify(
                            Some(&code),
                            retry_after,
                            None,
                        ))
                    } else if status >= 500 {
                        AppError::new(
                            ErrorCode::UnknownOutcome,
                            format!("The server reported HTTP {status} for this operation. Usage is unconfirmed; no automatic retry was made."),
                        )
                    } else {
                        AppError::new(
                            ErrorCode::Provider,
                            format!(
                                "Server rejected this operation (HTTP {status}). No automatic retry was made."
                            ),
                        )
                    };
                    (operation_id, attempt_id, Err(error))
                }
            };
            if self.pending.get(&operation) != Some(&attempt) {
                return Err(unknown());
            }
            publish(&operation, result)?;
            self.pending.remove(&operation);
        }
        Ok(())
    }
    pub fn finish(self) -> Result<()> {
        if self.complete && self.line.is_empty() && self.pending.is_empty() {
            Ok(())
        } else {
            Err(unknown())
        }
    }
}

pub async fn request(
    client: &reqwest::Client,
    key: &str,
    dispatches: &[crate::execution::Dispatch],
    publish: impl FnMut(usize, Result<Completion>) -> Result<()>,
) -> Result<()> {
    let outputs = vec![provider::RequestOutput::Prose; dispatches.len()];
    request_with_outputs(client, key, dispatches, &outputs, publish).await
}

/// One explicit output contract per item; mismatches fail before HTTP submission.
pub async fn request_with_outputs(
    client: &reqwest::Client,
    key: &str,
    dispatches: &[crate::execution::Dispatch],
    outputs: &[provider::RequestOutput<'_>],
    mut publish: impl FnMut(usize, Result<Completion>) -> Result<()>,
) -> Result<()> {
    if dispatches.len() != outputs.len() {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Each grouped operation requires one output contract.",
        ));
    }
    let first = dispatches.first().ok_or_else(unknown)?;
    if dispatches.len() > 8 || dispatches.iter().any(|d| !compatible(first, d)) {
        return Err(unknown());
    }
    let mut items = Vec::new();
    let mut identities = Vec::new();
    for (dispatch, output) in dispatches.iter().zip(outputs) {
        let operation = dispatch.operation.replace('-', "");
        items.push(
            serde_json::json!({"operation_id":operation,"attempt_id":dispatch.attempt,
            "request":provider::payload_with_output(&dispatch.model, &dispatch.messages, dispatch.route, *output)?}),
        );
        identities.push((operation, dispatch.attempt.clone()));
    }
    let body = serde_json::to_vec(&serde_json::json!({"version":1,"items":items}))?;
    if body.len() > 1024 * 1024 {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Operation group exceeds its input limit.",
        ));
    }
    let request = client
        .post(&first.target.url)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/x-ndjson")
        .body(body);
    let request = if key.is_empty() {
        request
    } else {
        request.bearer_auth(key)
    };
    let request = if first.route == crate::model::ConnectionRoute::Hosted {
        crate::hosted::identity(request, &first.install_id)
    } else {
        request
    };
    let mut response = request.send().await.map_err(|_| unknown())?;
    if !response.status().is_success() {
        if first.route == crate::model::ConnectionRoute::Custom
            && response.status() == reqwest::StatusCode::UNAUTHORIZED
        {
            return Err(AppError::new(
                ErrorCode::Provider,
                "Custom server authentication failed. Update its session token in Settings → AI access → Custom URL, then check the connection.",
            ));
        }
        if response.status().is_server_error() {
            return Err(unknown());
        }
        return Err(crate::hosted::body(response)
            .await
            .err()
            .unwrap_or_else(unknown));
    }
    if response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(';').next())
        != Some("application/x-ndjson")
    {
        return Err(unknown());
    }
    let mut decoder = Decoder::new(identities.clone())?;
    while let Some(chunk) = response.chunk().await.map_err(|_| unknown())? {
        decoder.push(&chunk, |operation, result| {
            let index = identities
                .iter()
                .position(|(id, _)| id == operation)
                .ok_or_else(unknown)?;
            publish(index, result)
        })?;
    }
    decoder.finish()
}

pub fn compatible(a: &crate::execution::Dispatch, b: &crate::execution::Dispatch) -> bool {
    a.route == b.route
        && a.target.url == b.target.url
        && a.credential == b.credential
        && a.target.revision == b.target.revision
        && a.install_id == b.install_id
}

pub async fn complete(
    client: &reqwest::Client,
    key: &str,
    dispatch: &crate::execution::Dispatch,
) -> Result<Completion> {
    let mut result = None;
    request(client, key, std::slice::from_ref(dispatch), |_, value| {
        result = Some(value);
        Ok(())
    })
    .await?;
    result.ok_or_else(unknown)?
}

pub async fn complete_with_output(
    client: &reqwest::Client,
    key: &str,
    dispatch: &crate::execution::Dispatch,
    output: provider::RequestOutput<'_>,
) -> Result<Completion> {
    let mut result = None;
    request_with_outputs(
        client,
        key,
        std::slice::from_ref(dispatch),
        &[output],
        |_, value| {
            result = Some(value);
            Ok(())
        },
    )
    .await?;
    result.ok_or_else(unknown)?
}

#[cfg(test)]
mod tests {
    use super::*;
    fn response(operation: &str, attempt: &str) -> Vec<u8> {
        let mut bytes = serde_json::to_vec(&serde_json::json!({"type":"result", "operation_id":operation,"attempt_id":attempt,
            "response":{"id":"provider","model":"model","choices":[{"finish_reason":"stop","message":{"content":"¡Hola!"}}],"usage":{"prompt_tokens":2,"completion_tokens":3}}})).unwrap();
        bytes.push(b'\n');
        bytes
    }
    #[test]
    fn item_failure_diagnostics_distinguish_server_status_from_bad_completion() {
        for (event, expected) in [
            (
                serde_json::json!({"type":"error","operation_id":"one","attempt_id":"a","code":"REQUEST_REJECTED","status":502}),
                "HTTP 502",
            ),
            (
                serde_json::json!({"type":"result","operation_id":"one","attempt_id":"a","response":{"private":"must not be shown"}}),
                "invalid AI completion",
            ),
        ] {
            let mut decoder = Decoder::new([("one".into(), "a".into())]).unwrap();
            let bytes = format!("{event}\n{{\"type\":\"complete\",\"count\":1}}\n");
            let mut errors = Vec::new();
            decoder
                .push(bytes.as_bytes(), |_, result| {
                    errors.push(result.unwrap_err());
                    Ok(())
                })
                .unwrap();
            decoder.finish().unwrap();
            assert_eq!(errors.len(), 1);
            assert_eq!(errors[0].code, ErrorCode::UnknownOutcome);
            assert!(errors[0].message.contains(expected));
            assert!(!errors[0].message.contains("private"));
            assert!(!errors[0].message.contains("must not be shown"));
        }
    }
    #[test]
    fn partial_results_publish_before_eof_and_survive_missing_siblings() {
        let mut decoder =
            Decoder::new([("one".into(), "a".into()), ("two".into(), "b".into())]).unwrap();
        let mut published = Vec::new();
        for byte in response("two", "b") {
            decoder
                .push(&[byte], |id, value| {
                    published.push((id.to_owned(), value.unwrap().text));
                    Ok(())
                })
                .unwrap();
        }
        assert_eq!(published, [("two".into(), "¡Hola!".into())]);
        assert_eq!(
            decoder.finish().unwrap_err().code,
            ErrorCode::UnknownOutcome
        );
    }
    #[test]
    fn identities_duplicates_and_completion_are_strict() {
        for bad in [
            response("other", "a"),
            response("one", "other"),
            b"{\"type\":\"complete\",\"count\":1}\n".to_vec(),
        ] {
            let mut decoder = Decoder::new([("one".into(), "a".into())]).unwrap();
            assert!(
                decoder
                    .push(&bad, |_, _| panic!("must not publish"))
                    .is_err()
            );
        }
        let mut decoder = Decoder::new([("one".into(), "a".into())]).unwrap();
        decoder.push(&response("one", "a"), |_, _| Ok(())).unwrap();
        assert!(
            decoder
                .push(&response("one", "a"), |_, _| panic!(
                    "duplicate publication"
                ))
                .is_err()
        );
        let mut decoder = Decoder::new([("one".into(), "a".into())]).unwrap();
        decoder.push(&response("one", "a"), |_, _| Ok(())).unwrap();
        decoder
            .push(b"{\"type\":\"complete\",\"count\":1}\n", |_, _| panic!())
            .unwrap();
        decoder.finish().unwrap();
    }
    #[tokio::test]
    async fn hosted_transport_sends_persisted_identity_and_requires_complete_stream() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        for (route, truncated, structured) in [
            (crate::model::ConnectionRoute::Hosted, false, false),
            (crate::model::ConnectionRoute::Hosted, false, true),
            (crate::model::ConnectionRoute::Hosted, true, false),
            (crate::model::ConnectionRoute::Hosted, true, true),
            (crate::model::ConnectionRoute::Custom, false, false),
            (crate::model::ConnectionRoute::Custom, false, true),
            (crate::model::ConnectionRoute::Custom, true, false),
            (crate::model::ConnectionRoute::Custom, true, true),
        ] {
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let url = format!("http://{}/v1/operations", listener.local_addr().unwrap());
            let server = tokio::spawn(async move {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut input = Vec::new();
                loop {
                    let mut chunk = [0u8; 4096];
                    let read = socket.read(&mut chunk).await.unwrap();
                    assert!(read > 0);
                    input.extend_from_slice(&chunk[..read]);
                    if let Some(start) = input.windows(4).position(|w| w == b"\r\n\r\n") {
                        let headers = String::from_utf8_lossy(&input[..start]);
                        let length: usize = headers
                            .lines()
                            .find_map(|l| {
                                l.to_ascii_lowercase()
                                    .strip_prefix("content-length: ")
                                    .map(str::to_owned)
                            })
                            .unwrap()
                            .parse()
                            .unwrap();
                        if input.len() < start + 4 + length {
                            continue;
                        }
                        assert!(headers.starts_with("POST /v1/operations "));
                        assert_eq!(
                            headers
                                .to_ascii_lowercase()
                                .contains("x-skellyspeak-install:"),
                            route == crate::model::ConnectionRoute::Hosted
                        );
                        let payload: serde_json::Value =
                            serde_json::from_slice(&input[start + 4..]).unwrap();
                        assert_eq!(payload["version"], 1);
                        let child = &payload["items"][0]["request"];
                        assert!(child.get("provider").is_none());
                        assert_eq!(child["max_tokens"], 2048);
                        if structured {
                            assert_eq!(
                                child["response_format"],
                                serde_json::json!({"type":"json_schema","json_schema":{"name":"fixture","strict":true,"schema":{"type":"object"}}})
                            );
                        } else {
                            assert!(child.get("response_format").is_none());
                        }
                        assert_eq!(
                            payload["items"][0]["attempt_id"],
                            "2000000000-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                        );
                        break;
                    }
                }
                let mut body = response(
                    "11111111111111111111111111111111",
                    "2000000000-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                );
                if structured {
                    let mut second = response(
                        "22222222222222222222222222222222",
                        "2000000000-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    );
                    let mut first: serde_json::Value = serde_json::from_slice(&body).unwrap();
                    first["response"]["choices"][0]["message"]["content"] =
                        serde_json::json!("{\"same\":1,\"same\":2}");
                    first["response"]["choices"][0]["finish_reason"] = serde_json::json!("length");
                    second.extend(serde_json::to_vec(&first).unwrap());
                    second.push(b'\n');
                    body = second;
                }
                if !truncated {
                    body.extend(serde_json::to_vec(&serde_json::json!({"type":"complete", "count":if structured {2} else {1}})).unwrap());
                    body.push(b'\n');
                }
                let headers = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                socket.write_all(headers.as_bytes()).await.unwrap();
                socket.write_all(&body).await.unwrap();
            });
            let dispatch = crate::execution::Dispatch {
                coaching_schema: None,
                gloss_source: None,
                speech_source: None,
                target: crate::access::ResolvedTarget {
                    route,
                    revision: 1,
                    url,
                    model: "google/gemini-2.5-flash".into(),
                    credential: Some("opaque".into()),
                },
                attempt: "2000000000-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".into(),
                operation: "11111111-1111-1111-1111-111111111111".into(),
                credential: "opaque".into(),
                model: "google/gemini-2.5-flash".into(),
                messages: vec![provider::PromptMessage {
                    role: "user".into(),
                    content: "Hello".into(),
                }],
                route,
                install_id: "test".into(),
            };
            let schema = serde_json::json!({"type":"object"});
            if structured {
                let second = crate::execution::Dispatch {
                    coaching_schema: None,
                    gloss_source: None,
                    speech_source: None,
                    target: dispatch.target.clone(),
                    operation: "22222222-2222-2222-2222-222222222222".into(),
                    attempt: "2000000000-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb".into(),
                    credential: dispatch.credential.clone(),
                    model: dispatch.model.clone(),
                    messages: dispatch.messages.clone(),
                    route,
                    install_id: dispatch.install_id.clone(),
                };
                let mut arrived = Vec::new();
                let result = request_with_outputs(
                    &provider::client().unwrap(),
                    "test-only",
                    &[dispatch, second],
                    &[
                        provider::RequestOutput::JsonSchema {
                            name: "fixture",
                            schema: &schema,
                        },
                        provider::RequestOutput::Prose,
                    ],
                    |index, result| {
                        let completion = result.unwrap();
                        assert_eq!(
                            (completion.input_tokens, completion.output_tokens),
                            (Some(2), Some(3))
                        );
                        if index == 0 {
                            assert_eq!(completion.text, "{\"same\":1,\"same\":2}");
                            assert_eq!(completion.finish_reason, "length");
                        } else {
                            assert_eq!(completion.text, "¡Hola!");
                        }
                        arrived.push(index);
                        Ok(())
                    },
                )
                .await;
                assert_eq!(arrived, vec![1, 0]);
                if truncated {
                    assert_eq!(result.unwrap_err().code, ErrorCode::UnknownOutcome);
                } else {
                    result.unwrap();
                }
            } else {
                let result =
                    provider::complete(&provider::client().unwrap(), "test-only", &dispatch).await;
                if truncated {
                    assert_eq!(result.unwrap_err().code, ErrorCode::UnknownOutcome);
                } else {
                    assert_eq!(result.unwrap().text, "¡Hola!");
                }
            }
            server.await.unwrap();
        }
    }

    #[test]
    fn oversized_line_and_structured_refusal() {
        let mut decoder = Decoder::new([("one".into(), "a".into())]).unwrap();
        assert!(
            decoder
                .push(&vec![b'x'; LINE_LIMIT + 1], |_, _| panic!())
                .is_err()
        );
        let mut decoder = Decoder::new([("one".into(), "a".into())]).unwrap();
        decoder.push(b"{\"type\":\"error\",\"operation_id\":\"one\",\"attempt_id\":\"a\",\"code\":\"ACCOUNT_INFLIGHT_LIMIT\",\"status\":429,\"retry_after\":5}\n", |_, result| {
            assert!(result.unwrap_err().refusal.unwrap().retry_at.is_some()); Ok(())
        }).unwrap();
    }
}
