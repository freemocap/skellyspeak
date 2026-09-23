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
        let mut diagnostics = crate::diagnostics::response::metadata(&diagnostics, &[]);
        // Keep the bounded confidence summary even if verbose provider metadata
        // exhausts the general diagnostic budget. Only declared scalar fields survive.
        if let Some(summary) = super::transcription_confidence::summary(&value) {
            diagnostics["transcription_confidence"] = summary;
        }
        Ok(TranscriptionOutcome {
            result,
            diagnostics: Some(diagnostics),
        })
    }
}

#[cfg(test)]
mod confidence_tests {
    use super::*;

    #[test]
    fn existing_service_evidence_reaches_the_drill_gate() {
        let value = json!({"text":"fixture", "usage":{"diagnostics":{"response":{"segments":[
            {"avg_logprob":-0.05339829,"no_speech_prob":0.0012197495}
        ]}}}});
        let outcome = Adapter::decode(&serde_json::to_vec(&value).unwrap()).unwrap();
        let mut wav = std::io::Cursor::new(Vec::new());
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 8000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::new(&mut wav, spec).unwrap();
        for sample in 0..8000 {
            writer
                .write_sample(if (1600..4800).contains(&sample) {
                    3000i16
                } else {
                    0
                })
                .unwrap();
        }
        writer.finalize().unwrap();
        let (inspection, _) = crate::speech::analysis::audio_inspection::inspect_wav(
            &wav.into_inner(),
            "r",
            &crate::speech::recording::owner::RecordingOwner::DrillItem("i".into()),
        )
        .unwrap();
        let reliability =
            crate::drill::reliability::assess(&inspection, outcome.diagnostics.as_ref());
        assert!(reliability.accepted);
        assert_eq!(reliability.source, "segment_logprobs");
        assert!((reliability.confidence.unwrap() - 0.9480023574202364).abs() < 1e-8);
    }

    #[test]
    fn confidence_survives_verbose_metadata_limits_without_content() {
        let summary = json!({"score":0.8,"complete":true,"count":100,"no_speech_probability":0.1,"source":"word_logprobs","private_extra":"private transcript"});
        let value = json!({"text":"private transcript", "transcription_confidence":summary,
            "usage":{"diagnostics":{"response":{"segments":vec![json!({"text":"private transcript","logprob":-0.2}); 2000]}}}});
        let outcome = Adapter::decode(&serde_json::to_vec(&value).unwrap()).unwrap();
        assert_eq!(outcome.result.text, "private transcript");
        let metadata = outcome.diagnostics.unwrap();
        assert_eq!(metadata["transcription_confidence"]["score"], 0.8);
        assert_eq!(
            metadata["transcription_confidence"]["source"],
            "word_logprobs"
        );
        assert!(
            metadata["transcription_confidence"]
                .get("private_extra")
                .is_none()
        );
        assert!(!metadata.to_string().contains("private transcript"));
    }
}
