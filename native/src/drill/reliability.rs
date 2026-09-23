//! Transcript reliability is separate from text similarity. All scripts use one policy.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

// Product cutoffs, not empirically calibrated probabilities of correctness.
const MIN_CONFIDENCE: f64 = 0.6;
const MAX_NO_SPEECH: f64 = 0.6;

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DrillReliability {
    pub policy: u32,
    pub accepted: bool,
    pub confidence: Option<f64>,
    pub minimum_confidence: f64,
    pub speech_seconds: f64,
    pub no_speech_probability: Option<f64>,
    pub source: String,
    pub reason: String,
}

fn probability(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
}

pub fn assess(
    inspection: &crate::speech::analysis::audio_inspection::AudioInspection,
    diagnostics: Option<&Value>,
) -> DrillReliability {
    let speech_seconds: f64 = inspection
        .activity
        .regions
        .iter()
        .map(|r| r.end - r.start)
        .sum();
    let summary = diagnostics.and_then(|v| {
        v.get("transcription_confidence")
            .or_else(|| v.pointer("/usage/diagnostics/transcription_confidence"))
    });
    let mut confidence = summary
        .filter(|v| v["complete"] == true)
        .and_then(|v| probability(&v["score"]));
    let no_speech_probability = summary.and_then(|v| probability(&v["no_speech_probability"]));
    let source = summary
        .and_then(|v| v["source"].as_str())
        .filter(|s| matches!(*s, "word_logprobs" | "segment_logprobs"))
        .unwrap_or("unavailable");
    if source == "unavailable" {
        confidence = None;
    }
    let reason =
        if speech_seconds <= 0.0 || no_speech_probability.is_some_and(|v| v > MAX_NO_SPEECH) {
            "no_speech"
        } else if confidence.is_some_and(|v| v < MIN_CONFIDENCE) {
            "low_confidence"
        } else if confidence.is_none() {
            "confidence_unavailable"
        } else {
            "accepted"
        };
    DrillReliability {
        policy: 1,
        accepted: reason == "accepted",
        confidence,
        minimum_confidence: MIN_CONFIDENCE,
        speech_seconds,
        no_speech_probability,
        source: source.into(),
        reason: reason.into(),
    }
}

/// Preserve raw text measurements; only the evaluated match is withheld.
pub fn qualify(comparison: &mut super::comparison::DrillComparison, reliability: DrillReliability) {
    if !reliability.accepted {
        comparison.match_ratio = None;
    }
    comparison.reliability = Some(reliability);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::speech::analysis::audio_inspection::{InspectionRegion, inspect_wav};
    use crate::speech::recording::owner::RecordingOwner;
    use serde_json::json;

    #[test]
    fn silence_overrides_confidence_and_unreliable_text_is_never_scored() {
        let mut wav = std::io::Cursor::new(Vec::new());
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 8000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::new(&mut wav, spec).unwrap();
        for _ in 0..8000 {
            writer.write_sample(0i16).unwrap();
        }
        writer.finalize().unwrap();
        let wav = wav.into_inner();
        let (mut inspection, _) =
            inspect_wav(&wav, "r", &RecordingOwner::DrillItem("i".into())).unwrap();
        let data = |score| json!({"transcription_confidence": {"score":score,"complete":true,"source":"word_logprobs"}});
        assert_eq!(assess(&inspection, Some(&data(0.99))).reason, "no_speech");
        inspection.activity.regions.push(InspectionRegion {
            start: 0.1,
            end: 0.8,
        });
        for (score, accepted) in [(0.59, false), (0.6, true), (0.95, true)] {
            let reliability = assess(&inspection, Some(&data(score)));
            assert_eq!(reliability.accepted, accepted);
            // Canonical forms and different scripts share exactly the same gate.
            for text in ["café", "cafe\u{301}", "你好", "مرحبا"] {
                let mut compared = super::super::comparison::compare(text, text);
                qualify(&mut compared, reliability.clone());
                assert_eq!(compared.match_ratio, accepted.then_some(1.0));
                assert_eq!(compared.transcript, text);
                assert_eq!(compared.character_error_rate, Some(0.0));
            }
        }
        assert_eq!(assess(&inspection, None).reason, "confidence_unavailable");
        let mut metadata = data(0.99);
        metadata["transcription_confidence"]["no_speech_probability"] = json!(0.9);
        assert_eq!(assess(&inspection, Some(&metadata)).reason, "no_speech");
        metadata["transcription_confidence"]["no_speech_probability"] = json!(0.1);
        metadata["transcription_confidence"]["score"] = json!(2.0);
        assert_eq!(
            assess(&inspection, Some(&metadata)).reason,
            "confidence_unavailable"
        );
    }
}
