//! OpenAI-compatible speech-to-text client (remote transcription).
//!
//! Anthropic has no STT endpoint, so "remote" transcription is always
//! OpenAI-compatible (OpenAI, Groq, Together, DeepInfra, etc.).

use std::time::Duration;

use reqwest::blocking::Client;

pub struct OpenAiSttClient {
    base_url: String,
    api_key: String,
    model: String,
    client: Client,
}

impl OpenAiSttClient {
    pub fn new(
        base_url: impl Into<String>,
        model: impl Into<String>,
        api_key: Option<String>,
    ) -> Result<Self, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self {
            base_url: base_url.into(),
            api_key: api_key.unwrap_or_default(),
            model: model.into(),
            client,
        })
    }

    fn endpoint(&self) -> String {
        let base = self.base_url.trim_end_matches('/');
        if base.ends_with("/audio/transcriptions") {
            base.to_string()
        } else {
            format!("{base}/audio/transcriptions")
        }
    }

    /// Upload mono 16 kHz f32 samples and return the transcript text.
    pub fn transcribe(&self, audio: &[f32]) -> Result<String, String> {
        if audio.is_empty() {
            return Ok(String::new());
        }
        let wav = f32_to_wav(audio, 16_000);
        let part = reqwest::blocking::multipart::Part::bytes(wav)
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| e.to_string())?;
        let form = reqwest::blocking::multipart::Form::new()
            .text("model", self.model.clone())
            .part("file", part);

        let mut req = self.client.post(self.endpoint()).multipart(form);
        if !self.api_key.is_empty() {
            req = req.bearer_auth(&self.api_key);
        }
        let resp = req.send().map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().unwrap_or_default();
            return Err(format!("{status}: {text}"));
        }
        let body: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
        Ok(body
            .get("text")
            .and_then(|t| t.as_str())
            .unwrap_or_default()
            .trim()
            .to_string())
    }
}

/// Encode mono f32 samples as a 16-bit PCM WAV (matches Handy's save_wav_file:
/// 16 kHz, mono, i16). Pure + testable.
pub fn f32_to_wav(samples: &[f32], sample_rate: u32) -> Vec<u8> {
    let data_len = (samples.len() * 2) as u32;
    let byte_rate = sample_rate * 2; // mono * 16-bit
    let mut out = Vec::with_capacity(44 + data_len as usize);

    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_len).to_le_bytes());
    out.extend_from_slice(b"WAVE");

    out.extend_from_slice(b"fmt ");
    out.extend_from_slice(&16u32.to_le_bytes()); // fmt chunk size
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&1u16.to_le_bytes()); // mono
    out.extend_from_slice(&sample_rate.to_le_bytes());
    out.extend_from_slice(&byte_rate.to_le_bytes());
    out.extend_from_slice(&2u16.to_le_bytes()); // block align
    out.extend_from_slice(&16u16.to_le_bytes()); // bits per sample

    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    for &s in samples {
        let v = (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
        out.extend_from_slice(&v.to_le_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wav_has_valid_header_and_length() {
        let samples = [0.0f32, 0.5, -0.5, 1.0];
        let wav = f32_to_wav(&samples, 16000);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(&wav[36..40], b"data");
        assert_eq!(wav.len(), 44 + samples.len() * 2);
    }

    #[test]
    fn wav_encodes_samples_as_i16() {
        let wav = f32_to_wav(&[1.0, -1.0], 16000);
        let a = i16::from_le_bytes([wav[44], wav[45]]);
        let b = i16::from_le_bytes([wav[46], wav[47]]);
        assert_eq!(a, i16::MAX);
        assert_eq!(b, -i16::MAX);
    }
}
