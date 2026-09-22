use crate::model::{AppError, ErrorCode, Result};
use crate::speech::analysis::fluency::{Word, validate_timing};
use serde::{Deserialize, Serialize};
const ENDPOINT_SPILL_SECONDS: f64 = 1.0;
fn invalid(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, format!("Transcription: {message}"))
}
fn interval(start: f64, end: f64, limit: f64) -> Result<()> {
    if !start.is_finite() || !end.is_finite() || start < 0.0 || end <= start || end > limit {
        return Err(invalid("invalid timestamp interval"));
    }
    Ok(())
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Segment {
    pub id: u32,
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub avg_logprob: f64,
    pub no_speech_prob: f64,
    pub seek: Option<u32>,
    pub tokens: Option<Vec<u32>>,
    pub temperature: Option<f64>,
    pub compression_ratio: Option<f64>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
// Provider envelope metadata is ignored; timing objects remain strict.
pub struct VerboseTranscript {
    pub text: String,
    pub duration: f64,
    pub words: Vec<Word>,
    #[serde(default)]
    pub segments: Vec<Segment>,
    pub language: Option<String>,
    pub task: Option<String>,
}
fn validate_transcript(value: &VerboseTranscript) -> Result<()> {
    validate_timing(&value.text, value.duration, &value.words)?;
    if value.segments.len() > 2_000 {
        return Err(invalid("transcription exceeds its limits."));
    }
    if value
        .task
        .as_deref()
        .is_some_and(|task| task != "transcribe")
    {
        return Err(invalid("timings require transcription, not translation."));
    }
    if value
        .language
        .as_ref()
        .is_some_and(|s| s.is_empty() || s.len() > 80 || s.contains('\0'))
    {
        return Err(invalid("invalid language label."));
    }
    let limit = value.duration + ENDPOINT_SPILL_SECONDS;
    let mut previous_start = 0.0;
    let mut previous_id = None;
    for segment in &value.segments {
        interval(segment.start, segment.end, limit)?;
        if segment.start < previous_start
            || previous_id.is_some_and(|id| segment.id <= id)
            || segment.text.len() > 200_000
            || segment.text.contains('\0')
        {
            return Err(invalid("invalid segment order or text."));
        }
        if !segment.avg_logprob.is_finite()
            || segment.avg_logprob > 0.0
            || !segment.no_speech_prob.is_finite()
            || !(0.0..=1.0).contains(&segment.no_speech_prob)
            || segment
                .temperature
                .is_some_and(|v| !v.is_finite() || !(0.0..=2.0).contains(&v))
            || segment
                .compression_ratio
                .is_some_and(|v| !v.is_finite() || v < 0.0)
            || segment.tokens.as_ref().is_some_and(|v| v.len() > 10_000)
        {
            return Err(invalid("invalid segment confidence metadata."));
        }
        previous_start = segment.start;
        previous_id = Some(segment.id);
    }
    Ok(())
}
/// Explicit verbose contract. Unsupported provider shapes fail; no text-only
/// fallback can accidentally manufacture timestamp availability. Overlapping word
/// ends are allowed because clipping those artifacts is part of alignment.
pub fn parse_verbose_json(raw: &str) -> Result<VerboseTranscript> {
    if raw.len() > 1_048_576 {
        return Err(invalid("verbose response is too large."));
    }
    let value: VerboseTranscript = serde_json::from_str(raw).map_err(|cause| {
        crate::diagnostics::response::json_context(
            &cause,
            "fluency_decode",
            invalid("invalid verbose transcription schema."),
        )
    })?;
    validate_transcript(&value)?;
    Ok(value)
}
