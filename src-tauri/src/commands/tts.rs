//! Speech synthesis, and the WAV container the webview plays.

use futures_util::StreamExt;
use log::{debug, error};
use serde_json::json;
use tauri::{State};
use crate::ai::truncate_for_log;
use crate::AppState;
use std::time::Duration;

// TTS — cloud synthesis via OpenRouter (openai/gpt-audio-mini). Audio output
// is streaming-only and ships raw PCM16 (24kHz mono LE); we wrap it in a WAV
// container for the webview.
const TTS_MODEL: &str = "openai/gpt-audio-mini";
const TTS_SAMPLE_RATE: u32 = 24_000;

#[derive(Debug, serde::Serialize)]
pub struct TtsAudio {
    pub audio_base64: String,
    pub mime: String,
}

/// Synthesize speech via OpenRouter (gpt-audio-mini). Returns base64 WAV
/// audio for the webview to play. Every failure is returned as an error and
/// shown on screen; nothing substitutes for this engine.
#[tauri::command]
pub async fn speak_text(
    state: State<'_, AppState>,
    text: String,
    voice: Option<String>,
) -> Result<TtsAudio, String> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("no text to speak".into());
    }
    if text.len() > 10_000 {
        return Err("text too long for TTS".into());
    }
    let stored = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    let endpoint = stored.tts_endpoint()?;
    let v = voice
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "nova".into());
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let payload = json!({
        "model": TTS_MODEL,
        "modalities": ["text", "audio"],
        "audio": {"voice": v, "format": "pcm16"},
        "stream": true,
        "messages": [
            // gpt-audio models are conversational — without this they answer
            // or continue after the requested phrase. Engine framing, not chat.
            {"role": "system", "content": "You are a text-to-speech engine. Read the user's text aloud EXACTLY as written: verbatim, no additions, no replies, no commentary, no follow-up questions. If the text is in another language, speak it in that language."},
            {"role": "user", "content": format!("Say exactly, with no additions:\n{text}")}
        ],
    });
    let response = client
        .post(&endpoint.url)
        .bearer_auth(&endpoint.api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("tts request failed: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("tts API error {status}: {}", truncate_for_log(&body, 300)));
    }

    // Stream SSE; accumulate base64 PCM16 chunks, then wrap in a WAV header.
    // Also accumulate the audio transcript — spoken content is compared
    // against the request afterwards, and any extra speech logs loudly.
    let mut stream = response.bytes_stream();
    let mut sse_buffer = String::new();
    let mut b64 = String::new();
    let mut transcript = String::new();
    'sse: while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("tts stream: {e}"))?;
        sse_buffer.push_str(&String::from_utf8_lossy(&bytes));
        while let Some(pos) = sse_buffer.find('\n') {
            let line: String = sse_buffer.drain(..=pos).collect();
            let line = line.trim();
            if let Some(data) = line.strip_prefix("data: ") {
                let data = data.trim();
                if data == "[DONE]" {
                    break 'sse;
                }
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = v["choices"][0]["delta"]["audio"].as_object() {
                        if let Some(d) = delta.get("data").and_then(|x| x.as_str()) {
                            b64.push_str(d);
                        }
                        if let Some(t) = delta.get("transcript").and_then(|x| x.as_str()) {
                            transcript.push_str(t);
                        }
                    }
                }
            }
        }
    }
    use base64::Engine;
    let pcm = base64::engine::general_purpose::STANDARD
        .decode(b64.as_bytes())
        .map_err(|e| format!("tts audio decode failed: {e}"))?;
    if pcm.is_empty() {
        return Err("tts returned no audio".into());
    }
    let wav = wav_container(&pcm, TTS_SAMPLE_RATE);

    // Loud verification: the transcript is what the model ACTUALLY spoke.
    // Extra or mismatched speech gets logged at ERROR — the audio still
    // returns (audible diagnosis beats silence), but the problem is visible.
    let norm = |s: &str| -> String {
        let mut out = String::new();
        let mut space = true;
        for ch in s.chars() {
            if ch.is_alphanumeric() {
                for lc in ch.to_lowercase() {
                    out.push(lc);
                }
                space = false;
            } else if !space {
                out.push(' ');
                space = true;
            }
        }
        out.trim().to_string()
    };
    let asked = norm(&text);
    let spoken = norm(&transcript);
    if spoken != asked {
        error!(
            "[tts] SPEECH MISMATCH — requested {:?} but model spoke {:?} (audio returned for diagnosis)",
            asked, spoken
        );
    } else {
        debug!("[tts] transcript matches request");
    }

    Ok(TtsAudio {
        audio_base64: base64::engine::general_purpose::STANDARD.encode(&wav),
        mime: "audio/wav".into(),
    })
}

/// Wrap raw 16-bit mono LE PCM in a minimal WAV container.
fn wav_container(pcm: &[u8], sample_rate: u32) -> Vec<u8> {
    let mut w = Vec::with_capacity(pcm.len() + 44);
    w.extend_from_slice(b"RIFF");
    w.extend_from_slice(&(36 + pcm.len() as u32).to_le_bytes());
    w.extend_from_slice(b"WAVE");
    w.extend_from_slice(b"fmt ");
    w.extend_from_slice(&16u32.to_le_bytes()); // fmt chunk size
    w.extend_from_slice(&1u16.to_le_bytes()); // PCM
    w.extend_from_slice(&1u16.to_le_bytes()); // mono
    w.extend_from_slice(&sample_rate.to_le_bytes());
    w.extend_from_slice(&(sample_rate * 2).to_le_bytes()); // byte rate
    w.extend_from_slice(&2u16.to_le_bytes()); // block align
    w.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
    w.extend_from_slice(b"data");
    w.extend_from_slice(&(pcm.len() as u32).to_le_bytes());
    w.extend_from_slice(pcm);
    w
}

#[cfg(test)]
mod csp_tests {
    /// Synthesized speech is handed to an <audio> element as a blob: URL. CSP
    /// has no implicit allowance for that: with no `media-src`, media falls
    /// back to `default-src`, the blob is refused, and the element reports
    /// "Failed to load because no supported source was found" — which reads
    /// like a codec problem and is not one.
    #[test]
    fn csp_allows_blob_urls_for_media_and_images() {
        let conf: serde_json::Value =
            serde_json::from_str(include_str!("../../tauri.conf.json")).expect("tauri.conf.json");
        let csp = &conf["app"]["security"]["csp"];
        for directive in ["media-src", "img-src"] {
            let value = csp[directive]
                .as_str()
                .unwrap_or_else(|| panic!("CSP is missing {directive}"));
            assert!(
                value.contains("blob:"),
                "CSP {directive} must allow blob: URLs, got {value:?}"
            );
        }
    }
}
#[cfg(test)]
mod wav_tests {
    use super::wav_container;

    #[test]
    fn wav_header_is_wellformed() {
        let pcm = vec![0xABu8; 4800]; // 0.1s at 24kHz mono 16-bit
        let w = wav_container(&pcm, 24_000);
        assert_eq!(&w[0..4], b"RIFF");
        assert_eq!(&w[8..12], b"WAVE");
        assert_eq!(&w[12..16], b"fmt ");
        assert_eq!(u16::from_le_bytes([w[20], w[21]]), 1);
        assert_eq!(u16::from_le_bytes([w[22], w[23]]), 1);
        assert_eq!(u32::from_le_bytes([w[24], w[25], w[26], w[27]]), 24_000);
        assert_eq!(u32::from_le_bytes([w[28], w[29], w[30], w[31]]), 48_000);
        assert_eq!(u32::from_le_bytes([w[4], w[5], w[6], w[7]]), (36 + pcm.len() as u32));
        assert_eq!(&w[36..40], b"data");
        assert_eq!(u32::from_le_bytes([w[40], w[41], w[42], w[43]]), pcm.len() as u32);
        assert_eq!(w.len(), 44 + pcm.len());
    }

    #[test]
    fn wav_empty_pcm_still_valid_header() {
        let w = wav_container(&[], 24_000);
        assert_eq!(w.len(), 44);
        assert_eq!(u32::from_le_bytes([w[40], w[41], w[42], w[43]]), 0);
    }
}
