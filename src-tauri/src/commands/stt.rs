//! Speech to text. One provider and model, named here so a switch is one edit.

use base64::Engine;
use log::{error, info, warn};
use tauri::{State};
use crate::languages::{iso639};
use crate::AppState;

const GROQ_STT_MODEL: &str = "whisper-large-v3";
/// The filename and MIME type to upload this recording under, read from its
/// own header.
///
/// Two recorders feed this command and they do not agree on a format: the
/// desktop core writes WAV, Android's WebView emits WebM/Opus, and iOS emits
/// MP4/AAC. Groq rejects a file whose declared type does not match its bytes,
/// so the type is read from the bytes rather than passed alongside them —
/// a caller cannot then mislabel what it sent, and there is no second place
/// for the two to drift apart.
///
/// An unrecognised container is an error. Guessing one would produce a
/// confusing rejection from Groq instead of a clear one from here.
fn upload_format(audio: &[u8]) -> Result<(&'static str, &'static str), String> {
    let starts = |magic: &[u8]| audio.starts_with(magic);
    if starts(b"RIFF") && audio.len() >= 12 && &audio[8..12] == b"WAVE" {
        Ok(("audio.wav", "audio/wav"))
    } else if starts(&[0x1A, 0x45, 0xDF, 0xA3]) {
        // EBML header — Matroska, which is what WebM is.
        Ok(("audio.webm", "audio/webm"))
    } else if audio.len() >= 8 && &audio[4..8] == b"ftyp" {
        Ok(("audio.mp4", "audio/mp4"))
    } else if starts(b"OggS") {
        Ok(("audio.ogg", "audio/ogg"))
    } else {
        Err("That recording is in a format the transcriber does not accept.".into())
    }
}
// ─── STT (Groq Whisper) ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn transcribe_audio(
    state: State<'_, AppState>,
    audio_base64: String,
    prompt: Option<String>,
) -> Result<String, String> {
    let settings = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    // Where speech-to-text goes is decided in exactly one place, alongside the
    // chat provider — hosted proxies it, the other modes use Groq directly.
    let endpoint = settings.stt_endpoint().inspect_err(|e| {
        warn!("[cmd] transcribe_audio rejected: {e}");
    })?;

    let started = std::time::Instant::now();
    let audio = base64::engine::general_purpose::STANDARD
        .decode(&audio_base64)
        .map_err(|e| format!("invalid audio data: {e}"))?;
    info!(
        "[cmd] transcribe_audio: {} bytes, target={}",
        audio.len(),
        settings.target_language
    );

    let target = settings.target_language.clone();
    let language = iso639(&target);
    let (upload_name, upload_mime) = upload_format(&audio)?;
    info!("[cmd] transcribe_audio uploading as {upload_mime}");
    let file_part = reqwest::multipart::Part::bytes(audio)
        .file_name(upload_name)
        .mime_str(upload_mime)
        .map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new()
        .text("model", GROQ_STT_MODEL)
        .text("language", language)
        .text("response_format", "json")
        // Context hint: biases recognition toward live vocabulary. Whisper
        // leans on this heavily for lower-resource languages like Arabic.
        .text("prompt", prompt.unwrap_or_default())
        .part("file", file_part);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .post(&endpoint.url)
        .bearer_auth(&endpoint.api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("transcription request failed: {e}"))?;

    let status = response.status();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("invalid transcription response: {e}"))?;
    if !status.is_success() {
        error!("[cmd] transcription API error {status}: {}", body);
        return Err(format!(
            "transcription API error {status}: {}",
            body
        ));
    }
    let text = body["text"].as_str().unwrap_or_default().trim().to_string();
    info!(
        "[cmd] transcribe_audio done in {:.1}s: {:?}",
        started.elapsed().as_secs_f32(),
        text
    );
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::upload_format;

    #[test]
    fn a_wav_from_the_core_is_not_uploaded_as_webm() {
        // The desktop recorder writes WAV. Labelling it "audio/webm" — which is
        // what a hardcoded upload type did — makes Groq reject the request.
        let mut wav = b"RIFF".to_vec();
        wav.extend_from_slice(&[0; 4]);
        wav.extend_from_slice(b"WAVEfmt ");
        assert_eq!(upload_format(&wav).unwrap(), ("audio.wav", "audio/wav"));
    }

    #[test]
    fn a_webm_from_the_android_webview_is_recognised() {
        let webm = [0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x00, 0x00, 0x00];
        assert_eq!(upload_format(&webm).unwrap(), ("audio.webm", "audio/webm"));
    }

    #[test]
    fn an_mp4_from_a_wkwebview_is_recognised() {
        let mut mp4 = vec![0, 0, 0, 0x20];
        mp4.extend_from_slice(b"ftypM4A ");
        assert_eq!(upload_format(&mp4).unwrap(), ("audio.mp4", "audio/mp4"));
    }

    #[test]
    fn an_unknown_container_is_refused_rather_than_guessed() {
        assert!(upload_format(b"not audio at all").is_err());
        // Too short to carry any header worth trusting.
        assert!(upload_format(b"RIFF").is_err());
        assert!(upload_format(&[]).is_err());
    }
}
