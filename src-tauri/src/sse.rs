//! Incremental UTF-8 SSE decoding with explicit completion and error handling.

use serde_json::Value;

#[derive(Debug)]
pub enum Event {
    Data(Value),
    Done,
}

#[derive(Default)]
pub struct Decoder {
    buffer: Vec<u8>,
    data: Vec<String>,
    done: bool,
}

impl Decoder {
    pub fn push(&mut self, bytes: &[u8]) -> Result<Vec<Event>, String> {
        self.buffer.extend_from_slice(bytes);
        if self.buffer.len() > 4 * 1024 * 1024 {
            return Err("Provider SSE record exceeds 4 MiB".into());
        }
        let mut events = Vec::new();
        while let Some(end) = self.buffer.iter().position(|b| *b == b'\n') {
            let raw: Vec<u8> = self.buffer.drain(..=end).collect();
            let line = std::str::from_utf8(&raw)
                .map_err(|e| format!("Provider stream contains invalid UTF-8: {e}"))?
                .trim_end_matches(['\r', '\n']);
            if line.is_empty() {
                if self.data.is_empty() { continue; }
                let data = std::mem::take(&mut self.data).join("\n");
                if self.done { return Err("Provider sent data after completion".into()); }
                if data == "[DONE]" {
                    self.done = true;
                    events.push(Event::Done);
                } else {
                    let value: Value = serde_json::from_str(&data)
                        .map_err(|e| format!("Provider sent malformed SSE JSON: {e}"))?;
                    if !value.is_object() { return Err("Provider SSE payload is not an object".into()); }
                    if value.get("error").is_some_and(|v| !v.is_null()) {
                        return Err(stream_error(&value["error"]));
                    }
                    if value["choices"].as_array().is_some_and(|choices|
                        choices.iter().any(|c| matches!(c["finish_reason"].as_str(), Some("length" | "content_filter" | "error")))) {
                        return Err("Provider did not complete the requested output".into());
                    }
                    events.push(Event::Data(value));
                }
            } else if let Some(data) = line.strip_prefix("data:") {
                self.data.push(data.strip_prefix(' ').unwrap_or(data).to_string());
                if self.data.iter().map(String::len).sum::<usize>() > 4 * 1024 * 1024 {
                    return Err("Provider SSE event exceeds 4 MiB".into());
                }
            }
        }
        Ok(events)
    }

    pub fn finish(&self) -> Result<(), String> {
        if !self.done || !self.data.is_empty() || !self.buffer.is_empty() {
            return Err("Provider stream ended before a complete completion marker".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_utf8_chunk_boundary_preserves_multilingual_text() {
        let bytes = "data: {\"text\":\"日本語 العربية café\"}\r\n\r\ndata: [DONE]\r\n\r\n".as_bytes();
        for split in 0..=bytes.len() {
            let mut decoder = Decoder::default();
            let mut events = decoder.push(&bytes[..split]).unwrap();
            events.extend(decoder.push(&bytes[split..]).unwrap());
            decoder.finish().unwrap();
            assert!(matches!(&events[0], Event::Data(v) if v["text"] == "日本語 العربية café"));
        }
    }

    #[test]
    fn malformed_error_truncated_and_unfinished_streams_fail() {
        for input in ["data: {oops}\n\n", "data: {\"error\":\"quota\"}\n\n",
            "data: {\"choices\":[{\"finish_reason\":\"length\"}]}\n\n"] {
            assert!(Decoder::default().push(input.as_bytes()).is_err());
        }
        let mut decoder = Decoder::default();
        decoder.push(b"data: {}\n\n").unwrap();
        assert!(decoder.finish().is_err());
    }
}

#[test]
fn provider_errors_do_not_echo_private_payloads() {
    let error = Decoder::default().push(b"data: {\"error\":\"PRIVATE_TRANSCRIPT_API_KEY\"}\n\n").unwrap_err();
    assert_eq!(error, "Provider stream failed.");
}

fn stream_error(error: &Value) -> String {
    // The hosted service reports HTTP failures either as a status object or a fixed status sentence.
    let code = error["code"].as_u64().and_then(|code| u16::try_from(code).ok())
        .or_else(|| error.as_str()?.strip_prefix("The AI provider returned ")?.strip_suffix('.')?.parse::<u16>().ok());
    match code {
        Some(402) => "Speech/AI provider credit or spending limit reached (402). For Google sign-in, the hosted service operator must check its OpenRouter balance and key limit; for your own API key, check your OpenRouter account.".into(),
        Some(code @ 400..=599) => crate::network::provider_error(reqwest::StatusCode::from_u16(code).expect("validated HTTP error status")),
        _ => "Provider stream failed.".into(),
    }
}

#[test]
fn stream_payment_errors_explain_the_limit_without_exposing_provider_payloads() {
    for error in [serde_json::json!("The AI provider returned 402."), serde_json::json!({"code": 402, "message": "PRIVATE_TRANSCRIPT_API_KEY"})] {
        let message = stream_error(&error);
        assert!(message.contains("credit or spending limit"));
        assert!(message.contains("hosted service operator"));
        assert!(!message.contains("PRIVATE"));
    }
    assert_eq!(stream_error(&serde_json::json!({"code": "PRIVATE"})), "Provider stream failed.");
}
