//! Bounded speech transport. Scheduling, credentials and publication belong to the caller.
use crate::{
    access::ResolvedTarget,
    model::{AppError, ConnectionRoute, ErrorCode, Result},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde_json::{Value, json};
use std::time::Duration;

pub const WAV_LIMIT: usize = 4 * 1024 * 1024;
const STREAM_LIMIT: usize = 16 * 1024 * 1024;
const EVENT_LIMIT: usize = 1024 * 1024;
const TRANSCRIPT_LIMIT: usize = 32 * 1024;
const MODEL: &str = "openai/gpt-audio-mini";

pub struct SpeechInput {
    pub text: String,
    pub voice: String,
    pub language: String,
}
pub struct SpeechOutcome {
    pub audio: Result<Vec<u8>>,
    pub actual_model: Option<String>,
    pub provider_id: Option<String>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cost_micros: Option<u64>,
    pub finish_reason: Option<String>,
}
fn fault(message: &str) -> AppError {
    AppError::new(ErrorCode::Provider, message)
}
fn unknown() -> AppError {
    AppError::new(
        ErrorCode::UnknownOutcome,
        "Speech outcome is unknown after an interrupted response. Processing may have incurred a charge. No automatic retry was made.",
    )
}
impl SpeechOutcome {
    fn empty() -> Self {
        Self {
            audio: Err(unknown()),
            actual_model: None,
            provider_id: None,
            input_tokens: None,
            output_tokens: None,
            cost_micros: None,
            finish_reason: None,
        }
    }
}

/// Same builder is used before attempt admission and immediately before transport.
pub fn payload(target: &ResolvedTarget, input: &SpeechInput) -> Result<Value> {
    if target.model != MODEL
        || ![
            "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer",
            "verse",
        ]
        .contains(&input.voice.as_str())
    {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Unsupported speech model or voice.",
        ));
    }
    if input.text.len() > 16_384
        || input.text.trim().is_empty()
        || input.text.contains('\0')
        || input.language.is_empty()
        || input.language.len() > 80
        || input.language.chars().any(char::is_control)
    {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Speech requires source text and a valid language.",
        ));
    }
    let mut value = json!({"model": target.model, "messages": [
        {"role":"system","content":"You are a text-to-speech engine. Read the user's text aloud EXACTLY as written: verbatim, no additions, no replies, no commentary, no follow-up questions. If the text is in another language, speak it in that language."},
        {"role":"user","content":format!("Say exactly, with no additions:\n{}", input.text)}
    ], "modalities":["text","audio"], "audio":{"voice":input.voice,"format":"pcm16"}, "stream":true, "max_tokens":2000,
       "provider":{"require_parameters":true}});
    if target.route == ConnectionRoute::Openrouter {
        value["provider"]["allow_fallbacks"] = json!(false);
    }
    // Python json.dumps uses a space after structural commas/colons. Count those
    // outside strings to match server/contracts.py's UTF-8 admission bound.
    let encoded = serde_json::to_vec(&value)?;
    let (mut quoted, mut escaped, mut spaces) = (false, false, 0usize);
    for byte in &encoded {
        if quoted {
            if escaped {
                escaped = false;
            } else if *byte == b'\\' {
                escaped = true;
            } else if *byte == b'"' {
                quoted = false;
            }
        } else if *byte == b'"' {
            quoted = true;
        } else if matches!(*byte, b',' | b':') {
            spaces += 1;
        }
    }
    if encoded.len() + spaces + 1024 > 16_384 {
        return Err(AppError::new(
            ErrorCode::Validation,
            "The message exceeds the speech input limit. No speech request was made.",
        ));
    }
    Ok(value)
}

struct Decoder {
    outcome: SpeechOutcome,
    pending: Vec<u8>,
    data: String,
    audio: String,
    transcript: String,
    total: usize,
    done: bool,
    audio_id: Option<String>,
    audio_terminal: bool,
    failure: Option<AppError>,
}
impl Decoder {
    fn new() -> Self {
        Self {
            outcome: SpeechOutcome::empty(),
            pending: Vec::new(),
            data: String::new(),
            audio: String::new(),
            transcript: String::new(),
            total: 0,
            done: false,
            audio_id: None,
            audio_terminal: false,
            failure: None,
        }
    }
    fn fail(&mut self, message: &str) {
        if self.failure.is_none() {
            self.failure = Some(fault(message));
        }
    }
    fn push(&mut self, bytes: &[u8]) -> Result<()> {
        self.total = self.total.saturating_add(bytes.len());
        if self.total > STREAM_LIMIT {
            return Err(fault("Speech stream exceeds its size limit."));
        }
        // Parse incrementally even when a network chunk contains many SSE events.
        for byte in bytes {
            if *byte == b'\n' {
                let line = std::mem::take(&mut self.pending);
                let line = std::str::from_utf8(&line)
                    .map_err(|_| fault("Speech stream is not UTF-8."))?
                    .trim_end_matches('\r');
                if line.is_empty() {
                    self.event();
                } else if let Some(data) = line.strip_prefix("data:") {
                    let data = data.strip_prefix(' ').unwrap_or(data);
                    if self.data.len() + data.len() + 1 > EVENT_LIMIT {
                        return Err(fault("Speech event exceeds its size limit."));
                    }
                    if !self.data.is_empty() {
                        self.data.push('\n');
                    }
                    self.data.push_str(data);
                }
            } else {
                if self.pending.len() >= EVENT_LIMIT {
                    return Err(fault("Speech line exceeds its size limit."));
                }
                self.pending.push(*byte);
            }
        }
        Ok(())
    }
    fn event(&mut self) {
        let data = std::mem::take(&mut self.data);
        if data.is_empty() {
            return;
        }
        if self.done {
            self.fail("Speech data followed the stream terminator.");
            return;
        }
        if data == "[DONE]" {
            self.done = true;
            return;
        }
        let Ok(value) = serde_json::from_str::<Value>(&data) else {
            self.fail("Speech event contains invalid JSON.");
            return;
        };
        // Capture metering before validating content; later usage-only events are
        // consumed even after an invalid transcript/audio event.
        if let Some(usage) = value.get("usage") {
            for (field, dest) in [
                ("prompt_tokens", &mut self.outcome.input_tokens),
                ("completion_tokens", &mut self.outcome.output_tokens),
            ] {
                if let Some(n) = usage[field].as_u64() {
                    *dest = Some(n);
                }
            }
            if let Some(cost) = usage["cost"]
                .as_f64()
                .filter(|c| c.is_finite() && *c >= 0.0 && *c < (u64::MAX as f64 / 1_000_000.0))
            {
                self.outcome.cost_micros = Some((cost * 1_000_000.0).ceil() as u64);
            }
        }
        for (field, dest) in [
            ("model", &mut self.outcome.actual_model),
            ("id", &mut self.outcome.provider_id),
        ] {
            if let Some(s) = value[field]
                .as_str()
                .filter(|s| !s.is_empty() && s.len() <= 256)
            {
                *dest = Some(s.to_owned());
            }
        }
        if value.get("error").is_some() {
            self.fail("Provider reported a speech generation error.");
        }
        let Some(choices) = value["choices"].as_array() else {
            self.fail("Speech event has no choices array.");
            return;
        };
        if choices.is_empty() {
            return;
        }
        if choices.len() != 1 || choices[0]["index"].as_u64().is_some_and(|n| n != 0) {
            self.fail("Speech returned unexpected choices.");
            return;
        }
        let choice = &choices[0];
        if let Some(finish) = choice["finish_reason"].as_str() {
            self.outcome.finish_reason = Some(finish.to_owned());
            if finish != "stop" {
                self.fail("Speech generation did not finish normally.");
            }
        }
        let delta = &choice["delta"];
        let audio = &delta["audio"];
        // OpenAI SDK PR #1991 (July 2026) documents audio ending with
        // an expires_at-only marker instead of a separate finish_reason.
        // A later OpenRouter usage frame is accounting, not more content.
        let terminal = audio.as_object().is_some_and(|fields| {
            fields.len() == 1
                && fields
                    .get("expires_at")
                    .and_then(Value::as_u64)
                    .is_some_and(|n| n > 0)
        }) && delta.as_object().is_some_and(|fields| {
            fields
                .iter()
                .all(|(key, value)| key == "audio" || empty_envelope_field(key, value))
        });
        // OpenRouter adds role/content envelope fields and may send a separate
        // empty frame before its usage frame. Neither contains new audio/text.
        let empty_frame = delta.as_object().is_some_and(|fields| {
            fields
                .iter()
                .all(|(key, value)| empty_envelope_field(key, value))
        });
        if self.audio_terminal && !empty_frame {
            self.fail("Speech content followed the audio completion marker.");
        }
        if terminal {
            self.audio_terminal = true;
        }
        if let Some(id) = audio.get("id").filter(|v| !v.is_null()) {
            if let Some(id) = id.as_str().filter(|id| !id.is_empty() && id.len() <= 256) {
                if self.audio_id.as_deref().is_some_and(|saved| saved != id) {
                    self.fail("Speech audio identity changed during generation.");
                } else {
                    self.audio_id = Some(id.to_owned());
                }
            } else {
                self.fail("Speech audio has an invalid identity.");
            }
        }
        if audio.get("expires_at").is_some() && !terminal {
            self.fail("Speech audio completion marker is malformed.");
        }
        if choice
            .get("finish_reason")
            .is_some_and(|v| !v.is_null() && !v.is_string())
        {
            self.fail("Speech finish reason has an invalid type.");
        }
        for field in ["data", "transcript"] {
            if let Some(value) = audio.get(field).filter(|v| !v.is_null()) {
                let Some(s) = value.as_str() else {
                    self.fail("Speech audio field has an invalid type.");
                    continue;
                };
                let (dest, cap) = if field == "data" {
                    (&mut self.audio, WAV_LIMIT.div_ceil(3) * 4)
                } else {
                    (&mut self.transcript, TRANSCRIPT_LIMIT)
                };
                if dest.len() + s.len() > cap {
                    self.fail("Speech audio or transcript exceeds its size limit.");
                } else {
                    dest.push_str(s);
                }
            }
        }
    }
    fn finish(mut self, source: &str, interrupted: Option<AppError>) -> SpeechOutcome {
        if let Some(error) = interrupted {
            self.outcome.audio = Err(error);
            return self.outcome;
        }
        if !self.done || !self.pending.is_empty() || !self.data.is_empty() {
            self.outcome.audio = Err(unknown());
            return self.outcome;
        }
        let audio_completed =
            self.outcome.finish_reason.is_none() && self.audio_terminal && self.audio_id.is_some();
        if self.outcome.finish_reason.as_deref() != Some("stop") && !audio_completed {
            self.fail(
                "Speech response has no successful finish reason or audio completion marker.",
            );
        }
        // Preserve absent provider finish_reason as None; do not invent "stop".
        // Deliberately conservative: do not collapse punctuation, case, accents,
        // digits, or internal whitespace. A matching transcript is metadata, not
        // proof that the waveform pronounces the text correctly.
        match transcript_difference(source, &self.transcript) {
            TranscriptDifference::Exact => {}
            TranscriptDifference::Missing => self.fail("Speech transcript is missing (speech_transcript_missing)."),
            TranscriptDifference::Whitespace => self.fail("Speech transcript differs in whitespace (speech_transcript_whitespace_difference)."),
            TranscriptDifference::PunctuationOrCase => self.fail("Speech transcript differs in punctuation or case (speech_transcript_punctuation_or_case_difference)."),
            TranscriptDifference::Content => self.fail("Speech transcript differs in content (speech_transcript_content_difference)."),
        }
        self.outcome.audio = if let Some(error) = self.failure {
            Err(error)
        } else {
            STANDARD
                .decode(&self.audio)
                .map_err(|_| fault("Speech contains invalid base64 audio."))
                .and_then(wav)
        };
        self.outcome
    }
}
/// Diagnostics only. Non-Exact results NEVER authorize playback. In particular,
/// punctuation/case changes can alter meaning (negative signs, decimals, US/us).
#[derive(Debug, PartialEq, Eq)]
enum TranscriptDifference {
    Exact,
    Missing,
    Whitespace,
    PunctuationOrCase,
    Content,
}
fn transcript_difference(source: &str, transcript: &str) -> TranscriptDifference {
    if source.trim().is_empty() || transcript.trim().is_empty() {
        return TranscriptDifference::Missing;
    }
    if source.trim() == transcript.trim() {
        return TranscriptDifference::Exact;
    }
    fn spaces(text: &str) -> String {
        text.split_whitespace().collect::<Vec<_>>().join(" ")
    }
    if spaces(source) == spaces(transcript) {
        return TranscriptDifference::Whitespace;
    }
    static PUNCTUATION: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
        regex::Regex::new(r"\p{P}").expect("static punctuation pattern")
    });
    fn diagnostic_text(text: &str) -> String {
        spaces(&PUNCTUATION.replace_all(text, "").to_lowercase())
    }
    if diagnostic_text(source) == diagnostic_text(transcript) {
        TranscriptDifference::PunctuationOrCase
    } else {
        TranscriptDifference::Content
    }
}
fn empty_envelope_field(key: &str, value: &Value) -> bool {
    value.is_null()
        || (key == "content" && value.as_str() == Some(""))
        || (key == "role" && value.as_str() == Some("assistant"))
}
fn wav(pcm: Vec<u8>) -> Result<Vec<u8>> {
    if pcm.is_empty() || !pcm.len().is_multiple_of(2) || pcm.len() > WAV_LIMIT - 44 {
        return Err(fault(
            "Speech PCM is empty, incomplete, or exceeds its size limit.",
        ));
    }
    let n = pcm.len() as u32;
    let mut out = Vec::with_capacity(pcm.len() + 44);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(n + 36).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&24000u32.to_le_bytes());
    out.extend_from_slice(&48000u32.to_le_bytes());
    out.extend_from_slice(&2u16.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&n.to_le_bytes());
    out.extend_from_slice(&pcm);
    Ok(out)
}

pub async fn synthesize(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    input: &SpeechInput,
    install: &str,
) -> SpeechOutcome {
    let mut decoder = Decoder::new();
    let body = match payload(target, input) {
        Ok(body) => body,
        Err(error) => return decoder.finish(&input.text, Some(error)),
    };
    let request = client
        .post(&target.url)
        .timeout(Duration::from_secs(120))
        .json(&body);
    let request = if key.is_empty() {
        request
    } else {
        request.bearer_auth(key)
    };
    let request = if target.route == ConnectionRoute::Hosted {
        crate::hosted::identity(request, install)
    } else {
        request
    };
    let mut response = match request.send().await {
        Ok(response) => response,
        Err(_) => return decoder.finish(&input.text, Some(unknown())),
    };
    if !response.status().is_success() {
        let error = if target.route == ConnectionRoute::Hosted {
            crate::hosted::body(response)
                .await
                .err()
                .unwrap_or_else(|| fault("Speech request failed."))
        } else {
            let error = AppError::new(
                ErrorCode::Provider,
                format!(
                    "Speech HTTP {}. No automatic retry was made.",
                    response.status().as_u16()
                ),
            );
            if response.status().as_u16() == 429 {
                error.with_refusal(crate::refusal::from_response(&response))
            } else {
                error
            }
        };
        return decoder.finish(&input.text, Some(error));
    }
    if !response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| {
            v.split(';')
                .next()
                .unwrap_or("")
                .trim()
                .eq_ignore_ascii_case("text/event-stream")
        })
    {
        return decoder.finish(
            &input.text,
            Some(fault("Speech endpoint did not return an event stream.")),
        );
    }
    loop {
        match response.chunk().await {
            Ok(Some(chunk)) => {
                if let Err(error) = decoder.push(&chunk) {
                    return decoder.finish(&input.text, Some(error));
                }
            }
            Ok(None) => return decoder.finish(&input.text, None),
            Err(_) => return decoder.finish(&input.text, Some(unknown())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn target() -> ResolvedTarget {
        ResolvedTarget {
            route: ConnectionRoute::Custom,
            revision: 1,
            url: "http://127.0.0.1:1/v1/chat/completions".into(),
            model: MODEL.into(),
            credential: None,
        }
    }
    fn input(text: &str) -> SpeechInput {
        SpeechInput {
            text: text.into(),
            voice: "nova".into(),
            language: "es".into(),
        }
    }
    fn event(value: Value) -> String {
        format!("data: {value}\r\n\r\n")
    }
    fn stream(transcript: &str, pcm: &[u8], finish: &str) -> String {
        format!(
            "{}{}data: [DONE]\r\n\r\n",
            event(
                json!({"id":"request-id","model":MODEL,"choices":[{"index":0,"delta":{"audio":{"data":STANDARD.encode(pcm),"transcript":transcript}},"finish_reason":finish}]})
            ),
            event(
                json!({"choices":[],"usage":{"prompt_tokens":21,"completion_tokens":13,"cost":0.0012}})
            )
        )
    }
    fn decode(s: &str, source: &str) -> SpeechOutcome {
        let mut d = Decoder::new();
        d.push(s.as_bytes()).unwrap();
        d.finish(source, None)
    }
    #[test]
    fn fragmented_sse_utf8_and_wav_header() {
        let s = stream("¿Cómo estás?", &[0, 0, 1, 0], "stop");
        let mut d = Decoder::new();
        for byte in s.as_bytes() {
            d.push(&[*byte]).unwrap();
        }
        let outcome = d.finish("¿Cómo estás?", None);
        let wav = outcome.audio.unwrap();
        assert_eq!(wav.len(), 48);
        assert_eq!(&wav[..4], b"RIFF");
        assert_eq!(&wav[8..16], b"WAVEfmt ");
        assert_eq!(u32::from_le_bytes(wav[24..28].try_into().unwrap()), 24000);
        assert_eq!(&wav[44..], &[0, 0, 1, 0]);
        assert_eq!(outcome.input_tokens, Some(21));
        assert_eq!(outcome.output_tokens, Some(13));
        assert_eq!(outcome.cost_micros, Some(1200));
    }
    #[test]
    fn validation_errors_preserve_later_accounting() {
        for (text, pcm, finish) in [
            ("changed", vec![0, 0], "stop"),
            ("Hola", vec![0], "stop"),
            ("Hola", vec![], "stop"),
            ("Hola", vec![0, 0], "length"),
        ] {
            let out = decode(&stream(text, &pcm, finish), "Hola");
            assert!(out.audio.is_err());
            assert_eq!(out.input_tokens, Some(21));
            assert_eq!(outcome_cost(&out), Some(1200));
        }
        let s = stream("Hola", &[0, 0], "stop").replace("AAA=", "!!!!");
        let out = decode(&s, "Hola");
        assert!(out.audio.is_err());
        assert_eq!(out.output_tokens, Some(13));
    }
    fn outcome_cost(out: &SpeechOutcome) -> Option<u64> {
        out.cost_micros
    }
    #[test]
    fn transcript_policy_outer_whitespace_v1_preserves_lexical_distinctions() {
        assert!(
            decode(&stream(" \nHola\t", &[0, 0], "stop"), "Hola")
                .audio
                .is_ok()
        );
        for (source, transcript) in [
            ("No quiero", "quiero"),
            ("1,5", "15"),
            ("Sí", "Si"),
            ("Hola", "hola"),
            ("a b", "a  b"),
            ("é", "e\u{301}"),
            ("Hola", ""),
        ] {
            assert!(
                decode(&stream(transcript, &[0, 0], "stop"), source)
                    .audio
                    .is_err()
            );
        }
        let mut s =
            event(json!({"choices":[{"delta":{"audio":{"transcript":"No ","data":"AA"}}}]}));
        s.push_str(&event(json!({"choices":[{"delta":{"audio":{"transcript":"quiero","data":"A="}},"finish_reason":"stop"}]})));
        s.push_str("data: [DONE]\n\n");
        assert!(decode(&s, "No quiero").audio.is_ok());
    }
    #[test]
    fn truncation_limits_and_late_content_fail_closed() {
        let s = stream("Hola", &[0, 0], "stop");
        let out = decode(&s.replace("data: [DONE]\r\n\r\n", ""), "Hola");
        assert_eq!(out.audio.unwrap_err().code, ErrorCode::UnknownOutcome);
        assert_eq!(out.input_tokens, Some(21));
        assert!(
            decode(&(s + &event(json!({"choices":[]}))), "Hola")
                .audio
                .is_err()
        );
        assert!(wav(vec![0; WAV_LIMIT - 44]).is_ok());
        assert!(wav(vec![0; WAV_LIMIT - 42]).is_err());
        let mut d = Decoder::new();
        assert!(d.push(&vec![b'x'; EVENT_LIMIT + 1]).is_err());
        let mut d = Decoder::new();
        d.total = STREAM_LIMIT;
        assert!(d.push(b"x").is_err());
    }
    #[test]
    fn full_payload_preflight_rejects_oversize_and_wrong_capability() {
        let p = payload(&target(), &input("Hola.")).unwrap();
        assert_eq!(p["audio"]["format"], "pcm16");
        assert_eq!(p["max_tokens"], 2000);
        assert_eq!(p["stream"], true);
        assert!(payload(&target(), &input(&"é".repeat(8000))).is_err());
        assert!(payload(&target(), &input(" ")).is_err());
        let mut t = target();
        t.model = "chat-only".into();
        assert!(payload(&t, &input("Hola")).is_err());
        let mut i = input("Hola");
        i.voice = "unknown".into();
        assert!(payload(&target(), &i).is_err());
    }
    #[tokio::test]
    async fn loopback_transport_uses_captured_route_and_preserves_failed_audio_usage() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let mut t = target();
        t.url = format!(
            "http://{}/v1/chat/completions",
            listener.local_addr().unwrap()
        );
        let worker = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            let mut buf = [0u8; 2048];
            let end = loop {
                let n = socket.read(&mut buf).unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&buf[..n]);
                if let Some(i) = bytes.windows(4).position(|s| s == b"\r\n\r\n") {
                    break i + 4;
                }
            };
            let headers = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
            assert!(headers.starts_with("post /v1/chat/completions "));
            assert!(headers.contains("authorization: bearer synthetic-test-key"));
            assert!(!headers.contains("x-skellyspeak"));
            let size: usize = headers
                .lines()
                .find_map(|s| s.strip_prefix("content-length:"))
                .unwrap()
                .trim()
                .parse()
                .unwrap();
            while bytes.len() < end + size {
                let n = socket.read(&mut buf).unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&buf[..n]);
            }
            let body: Value = serde_json::from_slice(&bytes[end..end + size]).unwrap();
            assert_eq!(body["model"], MODEL);
            assert_eq!(
                body["messages"][1]["content"],
                "Say exactly, with no additions:\nHola"
            );
            assert_eq!(body["audio"]["voice"], "nova");
            let response = stream("wrong transcript", &[0, 0], "stop");
            write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",response.len(),response).unwrap();
        });
        let outcome = synthesize(
            &crate::provider::client().unwrap(),
            &t,
            "synthetic-test-key",
            &input("Hola"),
            "unused-install",
        )
        .await;
        worker.join().unwrap();
        assert!(outcome.audio.is_err());
        assert_eq!(outcome.input_tokens, Some(21));
        assert_eq!(outcome.cost_micros, Some(1200));
    }
    fn audio_terminal_stream(finish: Value, after: Option<Value>, include_marker: bool) -> String {
        let mut s = event(
            json!({"id":"request","model":MODEL,"choices":[{"index":0,"delta":{"audio":{"id":"audio-test","data":"AAA=","transcript":"Hola"}},"finish_reason":finish}]}),
        );
        if include_marker {
            s.push_str(&event(
                json!({"choices":[{"index":0,"delta":{"audio":{"expires_at":2000000000}}}]}),
            ));
        }
        if let Some(after) = after {
            s.push_str(&event(after));
        }
        s.push_str(&event(json!({"choices":[{"index":0,"delta":{"content":"","role":"assistant"},"finish_reason":null}],"usage":{"prompt_tokens":79,"completion_tokens":131}})));
        s.push_str("data: [DONE]\n\n");
        s
    }
    #[test]
    fn documented_audio_expiry_marker_completes_without_fabricating_finish_reason() {
        let s = audio_terminal_stream(Value::Null, None, true);
        let out = decode(&s, "Hola");
        assert!(out.audio.is_ok());
        assert_eq!(out.finish_reason, None);
        assert_eq!(out.input_tokens, Some(79));
        assert_eq!(out.output_tokens, Some(131));
        let s = s
            .replace(",\"finish_reason\":null", "")
            .replace("\"finish_reason\":null,", "");
        assert!(decode(&s, "Hola").audio.is_ok());
    }
    #[test]
    fn audio_expiry_never_excuses_failed_incomplete_or_continued_streams() {
        let base = audio_terminal_stream(Value::Null, None, true);
        for s in [
            audio_terminal_stream(Value::Null, None, false),
            base.replace("data: [DONE]\n\n", ""),
            base.replace("2000000000", "\"invalid\""),
            base.replace("\"id\":\"audio-test\",", ""),
            base.replace("AAA=", "AA=="),
            base.replace("Hola", "changed"),
            audio_terminal_stream(json!("length"), None, true),
            audio_terminal_stream(json!("content_filter"), None, true),
            audio_terminal_stream(json!("error"), None, true),
            audio_terminal_stream(json!(3), None, true),
            audio_terminal_stream(
                Value::Null,
                Some(json!({"choices":[{"delta":{"audio":{"data":"AAA="}}}]})),
                true,
            ),
            audio_terminal_stream(
                Value::Null,
                Some(json!({"choices":[{"delta":{"content":"extra"}}]})),
                true,
            ),
            audio_terminal_stream(
                Value::Null,
                Some(json!({"error":{"message":"failed"},"choices":[]})),
                true,
            ),
        ] {
            let out = decode(&s, "Hola");
            assert!(out.audio.is_err(), "unexpected success for {s}");
            assert_eq!(out.output_tokens, Some(131));
        }
    }
    #[test]
    fn openrouter_audio_marker_allows_empty_envelope_frames_only() {
        // Structural shape observed in the single synthetic probe. Content is
        // synthetic; the probe retained no raw transcript or audio.
        let marker = json!({"choices":[{"index":0,"delta":{"audio":{"expires_at":2000000000},"content":"","role":"assistant"},"finish_reason":null,"native_finish_reason":null}]});
        let initial = event(
            json!({"choices":[{"delta":{"audio":{"id":"audio-test","data":"AAA=","transcript":"Hola"},"content":"","role":"assistant"},"finish_reason":null}]}),
        );
        let empty = event(
            json!({"choices":[{"delta":{"content":"","role":"assistant"},"finish_reason":null}]}),
        );
        let usage = event(
            json!({"choices":[{"delta":{"content":"","role":"assistant"},"finish_reason":null}],"usage":{"prompt_tokens":60,"completion_tokens":55}}),
        );
        let stream = format!(
            "{initial}{}{empty}{usage}data: [DONE]\n\n",
            event(marker.clone())
        );
        let out = decode(&stream, "Hola");
        assert!(out.audio.is_ok());
        assert_eq!(out.finish_reason, None);
        assert_eq!(out.output_tokens, Some(55));
        for bad in [
            json!({"content":"extra","role":"assistant"}),
            json!({"audio":{"transcript":"extra"}}),
            json!({"tool_calls":[]}),
        ] {
            let stream = format!(
                "{initial}{}{}{usage}data: [DONE]\n\n",
                event(marker.clone()),
                event(json!({"choices":[{"delta":bad}]}))
            );
            let out = decode(&stream, "Hola");
            assert!(out.audio.is_err());
            assert_eq!(out.output_tokens, Some(55));
        }
    }
    #[test]
    fn speech_request_instruction_is_separate_from_validated_source() {
        let source = "Hola.\n¿Qué tal?";
        let i = input(source);
        let p = payload(&target(), &i).unwrap();
        assert_eq!(
            p["messages"][1]["content"],
            format!("Say exactly, with no additions:\n{source}")
        );
        assert_eq!(i.text, source);
        assert!(
            decode(&stream(source, &[0, 0], "stop"), &i.text)
                .audio
                .is_ok()
        );
        assert!(
            decode(
                &stream(
                    p["messages"][1]["content"].as_str().unwrap(),
                    &[0, 0],
                    "stop"
                ),
                &i.text
            )
            .audio
            .is_err()
        );
    }
    #[test]
    fn mismatch_categories_are_diagnostic_and_never_relax_acceptance() {
        for (source, transcript, category) in [
            (" Hola. ", "Hola.", TranscriptDifference::Exact),
            ("Hola", "", TranscriptDifference::Missing),
            (
                "Hola,\r\nqué tal",
                "Hola, qué\t\ttal",
                TranscriptDifference::Whitespace,
            ),
            ("Hola.", "hola!", TranscriptDifference::PunctuationOrCase),
            ("-5", "5", TranscriptDifference::PunctuationOrCase),
            ("1.5", "15", TranscriptDifference::PunctuationOrCase),
            ("US", "us", TranscriptDifference::PunctuationOrCase),
            ("C++", "C", TranscriptDifference::Content),
            ("No quiero.", "Quiero.", TranscriptDifference::Content),
            ("Hola.", "Hola. ¿Qué tal?", TranscriptDifference::Content),
            ("sí", "si", TranscriptDifference::Content),
            ("café", "cafe\u{301}", TranscriptDifference::Content),
            ("a b", "ab", TranscriptDifference::Content),
        ] {
            assert_eq!(transcript_difference(source, transcript), category);
            let out = decode(&stream(transcript, &[0, 0], "stop"), source);
            assert_eq!(out.audio.is_ok(), category == TranscriptDifference::Exact);
            if let Err(error) = out.audio {
                assert!(!error.message.contains(source));
                assert!(!error.message.contains("¿Qué tal?"));
            }
            assert_eq!(out.input_tokens, Some(21));
        }
    }
}
