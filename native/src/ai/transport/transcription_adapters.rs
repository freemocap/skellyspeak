//! SkellySpeak transcription wire conversion. Providers are owned by the server.
use crate::ai::audio::{
    TranscriptionLanguage, TranscriptionOutcome, TranscriptionRequest, TranscriptionResult,
};
use crate::model::{AppError, ErrorCode, Result};
use crate::speech::analysis::fluency::TranscriptTiming;
use serde::Deserialize;
use serde_json::{Value, json};
pub(super) struct Adapter;
fn invalid(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}
impl Adapter {
    pub fn language(language: &TranscriptionLanguage) -> Result<String> {
        let tag = &language.language_tag;
        if language.language_id.is_empty()
            || language.variety_id.is_empty()
            || tag.len() > 80
            || !tag
                .split('-')
                .all(|p| !p.is_empty() && p.bytes().all(|c| c.is_ascii_alphanumeric()))
        {
            return Err(invalid(
                "Transcription requires an explicit language identity.",
            ));
        }
        let code = tag.split('-').next().unwrap_or_default();
        if !(2..=3).contains(&code.len()) || !code.bytes().all(|c| c.is_ascii_lowercase()) {
            return Err(invalid("Invalid transcription language code."));
        }
        Ok(tag.clone())
    }
    pub fn form(model: &str, input: TranscriptionRequest) -> Result<reqwest::multipart::Form> {
        let language = Self::language(&input.language)?;
        let mut form = reqwest::multipart::Form::new()
            .part(
                "file",
                reqwest::multipart::Part::bytes(input.wav)
                    .file_name("audio.wav")
                    .mime_str("audio/wav")
                    .map_err(|_| invalid("Invalid audio type."))?,
            )
            .text("model", model.to_owned())
            .text("language", language)
            .text("response_format", "json");
        if let Some(context) = input.context {
            form = form.text("prompt", context);
        }
        Ok(form)
    }
    pub fn decode(bytes: &[u8]) -> Result<TranscriptionOutcome> {
        let value: Value = serde_json::from_slice(bytes).map_err(|cause| {
            crate::diagnostics::response::json_context(
                &cause,
                "transcription_json",
                invalid("Invalid transcription JSON."),
            )
        })?;
        let mut diagnostics = crate::diagnostics::response::metadata(&value, &[]);
        let failure = || {
            crate::diagnostics::response::invalid(
                "transcription",
                "$",
                "text and optional valid timing",
                &value,
            )
        };
        let text = value["text"].as_str().ok_or_else(failure)?.to_owned();
        let parsed: Result<TranscriptionResult> = (|| {
            #[derive(Deserialize)]
            struct Wire {
                text: String,
                timing: Option<TranscriptTiming>,
            }
            let wire: Wire = serde_json::from_value(value.clone()).map_err(|_| failure())?;
            if let Some(timing) = &wire.timing {
                if timing.text != wire.text {
                    return Err(failure());
                }
                crate::speech::analysis::fluency::validate_timing(
                    &timing.text,
                    timing.duration,
                    &timing.words,
                )
                .map_err(|_| failure())?;
                if timing.words.iter().any(|word| word.end > timing.duration) {
                    return Err(failure());
                }
            }
            Ok(TranscriptionResult {
                text: wire.text,
                timing: wire.timing,
            })
        })();
        let result = match parsed {
            Ok(result) => result,
            Err(error) => {
                diagnostics["timing"] = json!({"status":"unavailable", "stage":"transcription_timing",
                    "reason":"invalid_provider_timing", "validation":error.diagnostics});
                TranscriptionResult { text, timing: None }
            }
        };
        if result.text.chars().count() > 20000 || result.text.contains('\0') {
            return Err(failure());
        }
        Ok(TranscriptionOutcome {
            result,
            diagnostics: Some(crate::diagnostics::response::metadata(&diagnostics, &[])),
        })
    }
}
