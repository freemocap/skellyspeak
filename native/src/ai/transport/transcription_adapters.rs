//! Provider wire conversion only. No recording state, route changes or retries.
use crate::ai::audio::{
    TranscriptionLanguage, TranscriptionOutcome, TranscriptionRequest, TranscriptionResult,
};
use crate::model::{AppError, ErrorCode, Result};
use crate::speech::analysis::fluency::{TranscriptTiming, Word};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Clone, Copy, PartialEq)]
pub(super) enum Adapter {
    Service,
    Groq,
    ElevenLabs,
}
fn invalid(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}
impl Adapter {
    pub fn language(self, language: &TranscriptionLanguage) -> Result<String> {
        let tag = &language.language_tag;
        if language.language_id.is_empty()
            || language.variety_id.is_empty()
            || tag.len() > 80
            || !tag
                .split('-')
                .all(|part| !part.is_empty() && part.bytes().all(|c| c.is_ascii_alphanumeric()))
        {
            return Err(invalid(
                "Transcription requires an explicit language identity.",
            ));
        }
        let code = tag.split('-').next().unwrap_or_default();
        let maximum = if self == Self::Groq { 2 } else { 3 };
        if !(2..=maximum).contains(&code.len()) || !code.bytes().all(|c| c.is_ascii_lowercase()) {
            return Err(invalid(
                "The selected transcription provider does not support this language code.",
            ));
        }
        Ok(if self == Self::Service {
            tag.clone()
        } else {
            code.into()
        })
    }
    pub fn form(
        self,
        model: &str,
        input: TranscriptionRequest,
    ) -> Result<reqwest::multipart::Form> {
        let language = self.language(&input.language)?;
        let mut form = reqwest::multipart::Form::new().part(
            "file",
            reqwest::multipart::Part::bytes(input.wav)
                .file_name("audio.wav")
                .mime_str("audio/wav")
                .map_err(|_| invalid("Invalid audio type."))?,
        );
        if self == Self::ElevenLabs {
            return Ok(form
                .text("model_id", model.to_owned())
                .text("language_code", language)
                .text("timestamps_granularity", "word")
                .text("tag_audio_events", "false")
                .text("diarize", "false")
                .text("no_verbatim", "false"));
        }
        form = form
            .text("model", model.to_owned())
            .text("language", language)
            .text(
                "response_format",
                if self == Self::Groq {
                    "verbose_json"
                } else {
                    "json"
                },
            );
        if self == Self::Groq {
            form = form.text(
                "prompt",
                super::transcription_context::prompt(
                    &input.language.language_tag,
                    input.context.as_deref(),
                ),
            );
        } else if let Some(context) = input.context {
            form = form.text("prompt", context);
        }
        if self == Self::Groq {
            form = form
                .text("timestamp_granularities[]", "word")
                .text("timestamp_granularities[]", "segment");
        }
        Ok(form)
    }
    pub fn decode(self, bytes: &[u8], duration: Option<f64>) -> Result<TranscriptionOutcome> {
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
        // The transcript is the result. Word/segment metadata is optional and
        // must not turn usable text into a failed recording.
        let text = value["text"].as_str().ok_or_else(failure)?.to_owned();
        let parsed: Result<TranscriptionResult> = (|| {
            Ok(match self {
                Self::Groq if value.get("words").is_none_or(Value::is_null) => {
                    TranscriptionResult {
                        text: value["text"].as_str().ok_or_else(failure)?.to_owned(),
                        timing: None,
                    }
                }
                Self::Groq => {
                    // Confidence and segment metadata must not gate word timing.
                    let words: Vec<Word> =
                        serde_json::from_value(value["words"].clone()).map_err(|_| failure())?;
                    let measured = duration
                        .or_else(|| value["duration"].as_f64())
                        .ok_or_else(failure)?;
                    crate::speech::analysis::fluency::validate_timing(&text, measured, &words)
                        .map_err(|_| failure())?;
                    if words.iter().any(|word| word.end > measured) {
                        return Err(failure());
                    }
                    diagnostics["segment_evidence"] = json!(value["segments"].as_array().into_iter().flatten().take(2000).map(|s| json!({
                        "start":s["start"].as_f64(),"end":s["end"].as_f64(),"avg_logprob":s["avg_logprob"].as_f64(),
                        "no_speech_prob":s["no_speech_prob"].as_f64(),"temperature":s["temperature"].as_f64(),
                        "compression_ratio":s["compression_ratio"].as_f64()
                    })).collect::<Vec<_>>());
                    TranscriptionResult {
                        text: text.clone(),
                        timing: Some(TranscriptTiming {
                            text: text.clone(),
                            duration: measured,
                            words,
                        }),
                    }
                }
                Self::Service => {
                    #[derive(Deserialize)]
                    struct Wire {
                        text: String,
                        timing: Option<TranscriptTiming>,
                    }
                    let wire: Wire =
                        serde_json::from_value(value.clone()).map_err(|_| failure())?;
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
                    TranscriptionResult {
                        text: wire.text,
                        timing: wire.timing,
                    }
                }
                Self::ElevenLabs => {
                    let text = value["text"].as_str().ok_or_else(failure)?.to_owned();
                    let timing = match value.get("words") {
                        None | Some(Value::Null) => None,
                        Some(raw) => {
                            let raw = raw
                                .as_array()
                                .filter(|v| v.len() <= 20000)
                                .ok_or_else(failure)?;
                            let mut words = Vec::new();
                            let mut previous = 0.0;
                            for item in raw {
                                match item["type"].as_str() {
                                    Some("spacing" | "audio_event") => continue,
                                    Some("word") => {}
                                    _ => return Err(failure()),
                                }
                                let (start, end) = (
                                    item["start"].as_f64().ok_or_else(failure)?,
                                    item["end"].as_f64().ok_or_else(failure)?,
                                );
                                let word = item["text"]
                                    .as_str()
                                    .filter(|s| !s.trim().is_empty() && !s.contains('\0'))
                                    .ok_or_else(failure)?;
                                if !start.is_finite()
                                    || !end.is_finite()
                                    || start < previous
                                    || end <= start
                                    || end > 120.0
                                {
                                    return Err(failure());
                                }
                                previous = start;
                                words.push(Word {
                                    word: word.into(),
                                    start,
                                    end,
                                });
                            }
                            let duration = duration
                                .filter(|d| d.is_finite() && *d > 0.0 && *d <= 120.0)
                                .ok_or_else(failure)?;
                            if words.iter().any(|word| word.end > duration) {
                                return Err(failure());
                            }
                            Some(TranscriptTiming {
                                text: text.clone(),
                                duration,
                                words,
                            })
                        }
                    };
                    TranscriptionResult { text, timing }
                }
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

#[cfg(test)]
mod tests {
    use super::*;
    fn language(tag: &str) -> TranscriptionLanguage {
        TranscriptionLanguage {
            language_id: tag.into(),
            variety_id: "fixture".into(),
            language_tag: tag.into(),
        }
    }
    #[test]
    fn language_mapping_is_owned_by_boundary_and_never_autodetects() {
        for (tag, code) in [
            ("en-US", "en"),
            ("es-MX", "es"),
            ("ar-LB", "ar"),
            ("zh-Hans", "zh"),
        ] {
            for adapter in [Adapter::Groq, Adapter::ElevenLabs] {
                assert_eq!(adapter.language(&language(tag)).unwrap(), code);
            }
            assert_eq!(Adapter::Service.language(&language(tag)).unwrap(), tag);
        }
        for tag in ["", "auto", "en_XX", "en--US"] {
            assert!(Adapter::Groq.language(&language(tag)).is_err());
        }
        assert!(Adapter::Groq.language(&language("chr")).is_err());
        assert_eq!(
            Adapter::ElevenLabs.language(&language("chr")).unwrap(),
            "chr"
        );
    }
    #[test]
    fn providers_publish_the_same_timing_contract_and_redacted_diagnostics() {
        for text in ["Hello", "¿Cómo estás?", "صباح الخير", "你好"] {
            let whisper = json!({"text":text,"duration":1.0,"words":[{"word":text,"start":0.1,"end":0.8}],"segments":[]});
            let scribe = json!({"text":text,"language_code":"ar","words":[{"type":"word","text":text,"start":0.1,"end":0.8}]});
            let first = Adapter::Groq
                .decode(&serde_json::to_vec(&whisper).unwrap(), Some(1.0))
                .unwrap();
            let second = Adapter::ElevenLabs
                .decode(&serde_json::to_vec(&scribe).unwrap(), Some(1.0))
                .unwrap();
            assert_eq!(first.result.text, second.result.text);
            let a = first.result.timing.unwrap();
            let b = second.result.timing.unwrap();
            assert_eq!(a.words[0].word, b.words[0].word);
            assert_eq!(a.words[0].start, b.words[0].start);
            assert_eq!(a.words[0].end, b.words[0].end);
            assert!(
                !serde_json::to_string(&second.diagnostics)
                    .unwrap()
                    .contains(text)
            );
        }
    }
    #[test]
    fn invalid_scribe_timing_preserves_text_and_reports_missing_timing() {
        for end in [json!(-1), json!("1"), json!(130), Value::Null] {
            let raw = json!({"text":"private transcript","request_id":"req-1","words":[{"type":"word","text":"private","start":0.1,"end":end}]});
            let outcome = Adapter::ElevenLabs
                .decode(&serde_json::to_vec(&raw).unwrap(), Some(1.0))
                .unwrap();
            assert_eq!(outcome.result.text, "private transcript");
            assert!(outcome.result.timing.is_none());
            let diagnostic = serde_json::to_string(&outcome.diagnostics).unwrap();
            assert!(diagnostic.contains("unavailable"));
            assert!(!diagnostic.contains("private transcript"));
            assert!(diagnostic.contains("req-1"));
        }
    }
}
