//! Streamed chat completions, split into two parts so neither hides the
//! other's information:
//!
//! - `SseFramer` only frames server-sent events: lines, UTF-8, size limits and
//!   the `[DONE]` marker. It makes no judgement about errors or finish reasons.
//! - `CompletionAccumulator` keeps everything the provider sent: the text, the
//!   finish reasons, the last usage report and the other top-level metadata.
//!   A completed stream becomes the same completion JSON a non-streaming
//!   request returns, so the existing decoder, diagnostics and validation run
//!   unchanged on it.
use crate::model::{AppError, ErrorCode, Result};
use serde_json::{Map, Value, json};

/// Largest single event, matching the server's framer.
const MAX_EVENT_BYTES: usize = 4 * 1024 * 1024;
/// Hard ceiling for a streamed response's text, in UTF-8 bytes. Matches the
/// non-streaming response ceiling; exceeding it is an error, never a truncation.
pub const RESPONSE_TEXT_LIMIT: usize = 262_144;
/// Top-level metadata fields kept from the stream; diagnostics bound them again.
const MAX_TOP_FIELDS: usize = 64;

#[derive(Debug, PartialEq)]
pub enum SseEvent {
    Data(Value),
    Done,
}

fn broken(reason: &str) -> AppError {
    let mut error = AppError::new(
        ErrorCode::Provider,
        "The AI service's streamed reply broke off. Usage may have been incurred; no automatic retry was made.",
    );
    error.diagnostics = Some(json!({"stage": "stream", "reason": reason}));
    error
}

#[derive(Default)]
pub struct SseFramer {
    pending: Vec<u8>,
    data: Vec<String>,
    event_bytes: usize,
    done: bool,
}

impl SseFramer {
    /// Feed bytes; `on_event` receives each complete event in order.
    pub fn push(
        &mut self,
        chunk: &[u8],
        mut on_event: impl FnMut(SseEvent) -> Result<()>,
    ) -> Result<()> {
        if self.pending.len() + chunk.len() > MAX_EVENT_BYTES {
            return Err(broken("event_too_large"));
        }
        self.pending.extend_from_slice(chunk);
        while let Some(end) = self.pending.iter().position(|byte| *byte == b'\n') {
            let mut line: Vec<u8> = self.pending.drain(..=end).collect();
            line.pop();
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            if self.done {
                if line.iter().all(u8::is_ascii_whitespace) {
                    continue;
                }
                return Err(broken("data_after_done"));
            }
            let line = String::from_utf8(line).map_err(|cause| {
                crate::diagnostics::failures::utf8(
                    &cause.utf8_error(),
                    "stream_utf8",
                    broken("invalid_utf8"),
                )
            })?;
            if let Some(data) = line.strip_prefix("data:") {
                self.event_bytes += data.len();
                if self.event_bytes > MAX_EVENT_BYTES {
                    return Err(broken("event_too_large"));
                }
                self.data
                    .push(data.strip_prefix(' ').unwrap_or(data).to_owned());
            } else if line.is_empty() && !self.data.is_empty() {
                let raw = self.data.join("\n");
                self.data.clear();
                self.event_bytes = 0;
                if raw == "[DONE]" {
                    self.done = true;
                    on_event(SseEvent::Done)?;
                } else {
                    let value: Value = serde_json::from_str(&raw).map_err(|cause| {
                        crate::diagnostics::response::json_context(
                            &cause,
                            "streaming_decode",
                            broken("invalid_event_json"),
                        )
                    })?;
                    if !value.is_object() {
                        return Err(broken("event_not_object"));
                    }
                    on_event(SseEvent::Data(value))?;
                }
            }
            // Comments (": keep-alive") and other fields carry nothing for us.
        }
        Ok(())
    }

    pub fn done(&self) -> bool {
        self.done
    }
}

/// How a stream ended.
#[derive(Debug, PartialEq)]
pub enum StreamEnd {
    /// `[DONE]` arrived; the result is whatever the provider said, including a
    /// `length` or `content_filter` finish. Publication judges it, as it does
    /// for non-streaming replies.
    Completed,
    /// The provider sent an error payload.
    ProviderError,
    /// The stream stopped without `[DONE]`.
    TransportBroken,
}

#[derive(Default)]
pub struct CompletionAccumulator {
    text: String,
    top: Map<String, Value>,
    finish_reason: Option<Value>,
    native_finish_reason: Option<Value>,
    usage: Option<Value>,
    error: Option<Value>,
    done: bool,
}

impl CompletionAccumulator {
    /// Take one event. Returns true when the text grew.
    pub fn accept(&mut self, event: &SseEvent) -> Result<bool> {
        let payload = match event {
            SseEvent::Done => {
                self.done = true;
                return Ok(false);
            }
            SseEvent::Data(payload) => payload,
        };
        let object = payload
            .as_object()
            .ok_or_else(|| broken("event_not_object"))?;
        for (key, value) in object {
            match key.as_str() {
                "choices" => {}
                "usage" if !value.is_null() => self.usage = Some(value.clone()),
                "error" if !value.is_null() => self.error = Some(value.clone()),
                _ if self.top.len() < MAX_TOP_FIELDS || self.top.contains_key(key) => {
                    self.top.insert(key.clone(), value.clone());
                }
                _ => {}
            }
        }
        let mut grew = false;
        if let Some(choice) = object
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|choices| choices.first())
        {
            if let Some(delta) = choice
                .get("delta")
                .and_then(|delta| delta.get("content"))
                .and_then(Value::as_str)
            {
                if self.text.len() + delta.len() > RESPONSE_TEXT_LIMIT {
                    let mut error = AppError::new(
                        ErrorCode::Provider,
                        "The AI service's reply exceeded the response limit. Usage may have been incurred; no automatic retry was made.",
                    );
                    error.diagnostics = Some(
                        json!({"stage": "stream", "reason": "response_limit", "chars": self.text.chars().count()}),
                    );
                    return Err(error);
                }
                if !delta.is_empty() {
                    self.text.push_str(delta);
                    grew = true;
                }
            }
            for (field, slot) in [
                ("finish_reason", &mut self.finish_reason),
                ("native_finish_reason", &mut self.native_finish_reason),
            ] {
                if let Some(value) = choice.get(field).filter(|value| !value.is_null()) {
                    *slot = Some(value.clone());
                }
            }
        }
        Ok(grew)
    }

    pub fn text(&self) -> &str {
        &self.text
    }

    pub fn end(&self) -> StreamEnd {
        if self.error.is_some() {
            StreamEnd::ProviderError
        } else if self.done {
            StreamEnd::Completed
        } else {
            StreamEnd::TransportBroken
        }
    }

    /// The non-streaming completion this stream is equivalent to.
    pub fn completion_json(&self) -> Value {
        let mut value = self.top.clone();
        value.insert("object".into(), json!("chat.completion"));
        let mut choice = Map::new();
        choice.insert("index".into(), json!(0));
        choice.insert(
            "message".into(),
            json!({"role": "assistant", "content": self.text}),
        );
        choice.insert(
            "finish_reason".into(),
            self.finish_reason.clone().unwrap_or(Value::Null),
        );
        if let Some(native) = &self.native_finish_reason {
            choice.insert("native_finish_reason".into(), native.clone());
        }
        value.insert("choices".into(), json!([Value::Object(choice)]));
        if let Some(usage) = &self.usage {
            value.insert("usage".into(), usage.clone());
        }
        Value::Object(value)
    }

    /// Bounded, redacted facts about a stream that did not complete, for the
    /// error's diagnostics. Never the text itself.
    pub fn partial_diagnostics(&self, reason: &str) -> Value {
        let mut details = self.top.clone();
        details.extend(
            json!({
                "stage": "stream",
                "reason": reason,
                "chars": self.text.chars().count(),
                "finish_reason": self.finish_reason,
                "native_finish_reason": self.native_finish_reason,
                "usage": self.usage,
                "error": self.error,
            })
            .as_object()
            .expect("diagnostic object")
            .clone(),
        );
        crate::diagnostics::response::metadata(&Value::Object(details), &[&self.text])
    }

    pub fn error_payload(&self) -> Option<&Value> {
        self.error.as_ref()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frames(chunks: &[&[u8]]) -> Result<(Vec<SseEvent>, bool)> {
        let mut framer = SseFramer::default();
        let mut events = Vec::new();
        for chunk in chunks {
            framer.push(chunk, |event| {
                events.push(event);
                Ok(())
            })?;
        }
        Ok((events, framer.done()))
    }

    #[test]
    fn framing_survives_utf8_split_across_chunks() {
        let body =
            "data: {\"choices\":[{\"delta\":{\"content\":\"¿Qué 🎉?\"}}]}\n\ndata: [DONE]\n\n"
                .as_bytes();
        for split in 1..body.len() {
            let (events, done) = frames(&[&body[..split], &body[split..]]).unwrap();
            assert_eq!(events.len(), 2, "split at {split}");
            assert!(done);
        }
    }

    #[test]
    fn framing_rejects_data_after_done_and_bad_utf8() {
        assert!(frames(&[b"data: [DONE]\n\ndata: {}\n\n"]).is_err());
        assert!(frames(&[b"data: \xff\n\n"]).is_err());
        assert!(frames(&[b"data: [1]\n\n"]).is_err());
        assert!(frames(&[b": keep-alive\n\ndata: [DONE]\n\n"]).unwrap().1);
    }

    fn accumulate(events: &[Value], done: bool) -> CompletionAccumulator {
        let mut accumulator = CompletionAccumulator::default();
        for event in events {
            accumulator.accept(&SseEvent::Data(event.clone())).unwrap();
        }
        if done {
            accumulator.accept(&SseEvent::Done).unwrap();
        }
        accumulator
    }

    #[test]
    fn truncated_finish_keeps_text_reason_and_trailing_usage() {
        let accumulator = accumulate(
            &[
                json!({"id":"gen-1","model":"m","provider":"P","choices":[{"delta":{"content":"Hola"}}]}),
                json!({"id":"gen-1","model":"m","choices":[{"delta":{"content":" mun"},"finish_reason":"length","native_finish_reason":"MAX_TOKENS"}]}),
                json!({"id":"gen-1","model":"m","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":2,"cost":0.001}}),
            ],
            true,
        );
        assert_eq!(accumulator.end(), StreamEnd::Completed);
        let value = accumulator.completion_json();
        assert_eq!(value["choices"][0]["message"]["content"], "Hola mun");
        assert_eq!(value["choices"][0]["finish_reason"], "length");
        assert_eq!(value["usage"]["cost"], 0.001);
        assert_eq!(value["provider"], "P");
    }

    #[test]
    fn provider_error_after_partial_output_keeps_text_and_later_usage() {
        let accumulator = accumulate(
            &[
                json!({"id":"gen-2","model":"m","choices":[{"delta":{"content":"Parti"}}]}),
                json!({"error":{"code":502,"message":"upstream"}}),
                json!({"id":"gen-2","model":"m","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":1}}),
            ],
            false,
        );
        assert_eq!(accumulator.end(), StreamEnd::ProviderError);
        assert_eq!(accumulator.text(), "Parti");
        let diagnostics = accumulator.partial_diagnostics("provider_error");
        assert_eq!(diagnostics["chars"], 5);
        assert_eq!(diagnostics["usage"]["completion_tokens"], 1);
        assert!(
            diagnostics.to_string().find("Parti").is_none(),
            "diagnostics never carry text"
        );
    }

    #[test]
    fn missing_done_is_a_broken_transport() {
        let accumulator = accumulate(
            &[json!({"id":"g","model":"m","choices":[{"delta":{"content":"x"}}]})],
            false,
        );
        assert_eq!(accumulator.end(), StreamEnd::TransportBroken);
    }

    #[test]
    fn response_limit_is_an_error_never_a_truncation() {
        let mut accumulator = CompletionAccumulator::default();
        let chunk = "a".repeat(100_000);
        for _ in 0..2 {
            accumulator
                .accept(&SseEvent::Data(
                    json!({"choices":[{"delta":{"content":chunk}}]}),
                ))
                .unwrap();
        }
        let error = accumulator
            .accept(&SseEvent::Data(
                json!({"choices":[{"delta":{"content":chunk}}]}),
            ))
            .unwrap_err();
        assert_eq!(error.diagnostics.unwrap()["reason"], "response_limit");
        assert_eq!(accumulator.text().len(), 200_000);
    }

    #[test]
    fn assembled_stream_decodes_like_the_non_streaming_response() {
        let whole = json!({"id":"gen-3","model":"google/gemini","object":"chat.completion","created":1_700_000_000,"provider":"Google","system_fingerprint":"fp",
            "choices":[{"index":0,"message":{"role":"assistant","content":"¿Qué compraste?"},"finish_reason":"stop","native_finish_reason":"STOP"}],
            "usage":{"prompt_tokens":12,"completion_tokens":4,"total_tokens":16,"cost":0.0002}});
        let accumulator = accumulate(
            &[
                json!({"id":"gen-3","model":"google/gemini","object":"chat.completion.chunk","created":1_700_000_000,"provider":"Google","system_fingerprint":"fp","choices":[{"index":0,"delta":{"role":"assistant","content":"¿Qué "}}]}),
                json!({"id":"gen-3","model":"google/gemini","object":"chat.completion.chunk","created":1_700_000_000,"provider":"Google","system_fingerprint":"fp","choices":[{"index":0,"delta":{"content":"compraste?"},"finish_reason":"stop","native_finish_reason":"STOP"}]}),
                json!({"id":"gen-3","model":"google/gemini","object":"chat.completion.chunk","created":1_700_000_000,"provider":"Google","system_fingerprint":"fp","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":4,"total_tokens":16,"cost":0.0002}}),
            ],
            true,
        );
        let streamed = crate::ai::transport::provider::decode(
            &serde_json::to_vec(&accumulator.completion_json()).unwrap(),
        )
        .unwrap();
        let direct =
            crate::ai::transport::provider::decode(&serde_json::to_vec(&whole).unwrap()).unwrap();
        assert_eq!(streamed.text, direct.text);
        assert_eq!(streamed.finish_reason, direct.finish_reason);
        assert_eq!(streamed.actual_model, direct.actual_model);
        assert_eq!(streamed.provider_id, direct.provider_id);
        assert_eq!(streamed.input_tokens, direct.input_tokens);
        assert_eq!(streamed.output_tokens, direct.output_tokens);
        assert_eq!(
            streamed.diagnostics, direct.diagnostics,
            "diagnostics and billing provenance match"
        );
    }
}
