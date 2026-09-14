//! Offline timing foundation; not connected to recording receipts or messages.
//! Local energy regions cross-check provider timing, not linguistic correctness.
//! Silence-triggered transcription artifacts motivate separate unsupported-word
//! reporting [@koenecke2024]. Wire fields follow [@groq_transcription_api].
//! No transcript is rewritten by this module.
use crate::model::{AppError, ErrorCode, Result};
use serde::{Deserialize, Serialize};

const MAX_SECONDS: f64 = 120.0;
const ENDPOINT_SPILL_SECONDS: f64 = 1.0;
const FRAME_MS: u32 = 20;
const MIN_REGION_SECONDS: f64 = 0.06;
const MIN_PAUSE_SECONDS: f64 = 0.25;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Word {
    pub word: String,
    pub start: f64,
    pub end: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
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
    pub segments: Vec<Segment>,
    pub language: Option<String>,
    pub task: Option<String>,
}
#[derive(Debug, Clone, Serialize)]
pub struct Region {
    pub start: f64,
    pub end: f64,
}
#[derive(Debug, Clone, Serialize)]
pub struct Pause {
    pub start: f64,
    pub duration: f64,
    pub preceding_region: usize,
    pub following_region: usize,
}
#[derive(Debug, Clone, Serialize)]
pub struct LocalTiming {
    pub algorithm: &'static str,
    pub sample_rate: u32,
    pub sample_count: usize,
    pub duration: f64,
    pub frame_ms: u32,
    pub noise_floor_dbfs: f64,
    pub threshold_dbfs: f64,
    pub minimum_pause_seconds: f64,
    pub minimum_region_seconds: f64,
    pub regions: Vec<Region>,
    /// Internal pauses only; leading/trailing silence is not a conversational pause.
    pub pauses: Vec<Pause>,
    pub limitations: Vec<&'static str>,
}
#[derive(Debug, Clone, Serialize)]
pub struct AlignedWord {
    pub index: usize,
    pub word: String,
    pub provider_start: f64,
    pub provider_end: f64,
    pub start: f64,
    pub end: f64,
    pub region_index: usize,
    pub clipped: bool,
}
#[derive(Debug, Clone, Serialize)]
pub struct UnsupportedWord {
    pub index: usize,
    pub word: String,
    pub provider_start: f64,
    pub provider_end: f64,
    pub reason: &'static str,
}
#[derive(Debug, Clone, Serialize)]
pub struct PositionedPause {
    pub start: f64,
    pub duration: f64,
    pub preceding_word: Option<usize>,
    pub following_word: Option<usize>,
}
#[derive(Debug, Clone, Serialize)]
pub struct FluencyAnalysis {
    pub version: u32,
    pub original_text: String,
    pub transcript_rewritten: bool,
    pub provider_duration: f64,
    pub provider_segments: Vec<Segment>,
    pub local: LocalTiming,
    pub words: Vec<AlignedWord>,
    /// Removed from aligned timing only, never removed from original_text.
    pub unsupported_words: Vec<UnsupportedWord>,
    pub pauses: Vec<PositionedPause>,
}
fn invalid(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, format!("Fluency timing: {message}"))
}
fn interval(start: f64, end: f64, limit: f64) -> Result<()> {
    if !start.is_finite() || !end.is_finite() || start < 0.0 || end <= start || end > limit {
        return Err(invalid("invalid timestamp interval."));
    }
    Ok(())
}
fn validate_transcript(value: &VerboseTranscript) -> Result<()> {
    if !value.duration.is_finite() || value.duration <= 0.0 || value.duration > MAX_SECONDS {
        return Err(invalid("recording duration must be in (0,120] seconds."));
    }
    if value.text.len() > 200_000
        || value.text.contains('\0')
        || value.words.len() > 10_000
        || value.segments.len() > 2_000
    {
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
    let mut previous = 0.0;
    for word in &value.words {
        interval(word.start, word.end, limit)?;
        if word.start < previous
            || word.word.trim().is_empty()
            || word.word.len() > 2_000
            || word.word.contains('\0')
        {
            return Err(invalid("invalid word text or order."));
        }
        previous = word.start;
    }
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
    let value: VerboseTranscript =
        serde_json::from_str(raw).map_err(|_| invalid("invalid verbose transcription schema."))?;
    validate_transcript(&value)?;
    Ok(value)
}

/// Pure PCM16 mono analysis. RMS activity is a noise-adaptive heuristic; regions
/// are candidates for speech and cannot identify voices or distinguish loud noise.
pub fn analyze_pcm16(samples: &[i16], sample_rate: u32) -> Result<LocalTiming> {
    if !(8_000..=192_000).contains(&sample_rate)
        || samples.is_empty()
        || samples.len() as f64 / sample_rate as f64 > MAX_SECONDS
    {
        return Err(invalid("invalid mono PCM sample rate or duration."));
    }
    let width = (sample_rate as usize * FRAME_MS as usize / 1000).max(1);
    let db: Vec<f64> = samples
        .chunks(width)
        .map(|chunk| {
            let power = chunk
                .iter()
                .map(|sample| (*sample as f64 / 32768.0).powi(2))
                .sum::<f64>()
                / chunk.len() as f64;
            (10.0 * power.max(1e-12).log10()).max(-120.0)
        })
        .collect();
    let mut sorted = db.clone();
    sorted.sort_by(f64::total_cmp);
    let noise_floor = sorted[(sorted.len() - 1) / 5];
    let threshold = (noise_floor + 10.0).clamp(-50.0, -20.0);
    let duration = samples.len() as f64 / sample_rate as f64;
    let mut regions: Vec<Region> = vec![];
    for (index, energy) in db.iter().enumerate() {
        if *energy <= threshold {
            continue;
        }
        let start = (index * width) as f64 / sample_rate as f64;
        let end = ((index + 1) * width).min(samples.len()) as f64 / sample_rate as f64;
        if let Some(last) = regions.last_mut()
            && start - last.end < 1e-9
        {
            last.end = end;
        } else {
            regions.push(Region { start, end });
        }
    }
    regions.retain(|region| region.end - region.start + 1e-9 >= MIN_REGION_SECONDS);
    let mut merged: Vec<Region> = vec![];
    for region in regions {
        if let Some(last) = merged.last_mut()
            && region.start - last.end < MIN_PAUSE_SECONDS
        {
            last.end = region.end;
        } else {
            merged.push(region);
        }
    }
    let regions = merged;
    let pauses = regions
        .windows(2)
        .enumerate()
        .map(|(index, pair)| Pause {
            start: pair[0].end,
            duration: pair[1].start - pair[0].end,
            preceding_region: index,
            following_region: index + 1,
        })
        .collect();
    Ok(LocalTiming {
        algorithm: "pcm16-rms-20ms-p20-plus10-clamp-50-20-v1",
        sample_rate,
        sample_count: samples.len(),
        duration,
        frame_ms: FRAME_MS,
        noise_floor_dbfs: noise_floor,
        threshold_dbfs: threshold,
        minimum_pause_seconds: MIN_PAUSE_SECONDS,
        minimum_region_seconds: MIN_REGION_SECONDS,
        regions,
        pauses,
        limitations: vec![
            "Energy activity is not verified speech; loud stationary noise can pass the gate.",
            "Noise-floor estimation can be unreliable without quiet frames; quiet speech can be missed.",
            "Timing resolution is one analysis frame; short gaps are merged, not measured as pauses.",
        ],
    })
}
/// Keep provider wording and segment confidence intact. Assign a word to the
/// first overlapping region and cap it at the next strictly later word start,
/// preventing a stretched provider endpoint from spanning a locally measured pause.
pub fn align(transcript: &VerboseTranscript, local: &LocalTiming) -> Result<FluencyAnalysis> {
    validate_transcript(transcript)?;
    if !local.duration.is_finite() || local.duration <= 0.0 || local.duration > MAX_SECONDS {
        return Err(invalid("invalid local recording duration."));
    }
    if !(8_000..=192_000).contains(&local.sample_rate)
        || local.sample_count == 0
        || (local.duration - local.sample_count as f64 / local.sample_rate as f64).abs() > 1e-9
        || !local.noise_floor_dbfs.is_finite()
        || !local.threshold_dbfs.is_finite()
    {
        return Err(invalid("inconsistent local timing metadata."));
    }
    if (transcript.duration - local.duration).abs() > ENDPOINT_SPILL_SECONDS {
        return Err(invalid(
            "provider and local durations differ by more than one second.",
        ));
    }
    let mut previous_end = 0.0;
    for region in &local.regions {
        interval(region.start, region.end, local.duration)?;
        if region.start < previous_end {
            return Err(invalid("overlapping local regions."));
        }
        previous_end = region.end;
    }
    if local.pauses.len() != local.regions.len().saturating_sub(1)
        || local.pauses.iter().enumerate().any(|(index, pause)| {
            let first = &local.regions[index];
            let next = &local.regions[index + 1];
            !pause.start.is_finite()
                || !pause.duration.is_finite()
                || (pause.start - first.end).abs() > 1e-9
                || (pause.duration - (next.start - first.end)).abs() > 1e-9
                || pause.preceding_region != index
                || pause.following_region != index + 1
        })
    {
        return Err(invalid("inconsistent local pauses."));
    }
    let mut words = vec![];
    let mut unsupported_words = vec![];
    for (index, word) in transcript.words.iter().enumerate() {
        let next = transcript
            .words
            .get(index + 1)
            .filter(|next| next.start > word.start)
            .map(|next| next.start)
            .unwrap_or(word.end);
        let end = word.end.min(next);
        let matched = local
            .regions
            .iter()
            .enumerate()
            .find(|(_, region)| region.start < end && region.end > word.start);
        if let Some((region_index, region)) = matched {
            let start = word.start.max(region.start);
            let end = end.min(region.end);
            words.push(AlignedWord {
                index,
                word: word.word.clone(),
                provider_start: word.start,
                provider_end: word.end,
                start,
                end,
                region_index,
                clipped: start != word.start || end != word.end,
            });
        } else {
            unsupported_words.push(UnsupportedWord {
                index,
                word: word.word.clone(),
                provider_start: word.start,
                provider_end: word.end,
                reason: "no_overlapping_local_speech_region",
            });
        }
    }
    // Derive pause times from local regions, never from provider word endpoints.
    let pauses = local
        .regions
        .windows(2)
        .map(|pair| PositionedPause {
            start: pair[0].end,
            duration: pair[1].start - pair[0].end,
            preceding_word: words
                .iter()
                .rev()
                .find(|word| word.end <= pair[0].end)
                .map(|word| word.index),
            following_word: words
                .iter()
                .find(|word| word.start >= pair[1].start)
                .map(|word| word.index),
        })
        .collect();
    Ok(FluencyAnalysis {
        version: 1,
        original_text: transcript.text.clone(),
        transcript_rewritten: false,
        provider_duration: transcript.duration,
        provider_segments: transcript.segments.clone(),
        local: local.clone(),
        words,
        unsupported_words,
        pauses,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    const RATE: u32 = 16_000;
    fn recording() -> Vec<i16> {
        let mut samples = vec![0; RATE as usize * 3];
        for (index, sample) in samples.iter_mut().enumerate() {
            let time = index as f64 / RATE as f64;
            if (0.5..1.0).contains(&time) || (1.5..2.0).contains(&time) {
                *sample = (5000.0 * (2.0 * std::f64::consts::PI * 220.0 * time).sin()) as i16;
            }
        }
        samples
    }
    fn transcript(text: &str) -> VerboseTranscript {
        parse_verbose_json(&json!({"text":text,"duration":3.0,"language":"es","task":"transcribe","words":[{"word":text,"start":0.5,"end":1.8},{"word":"second","start":1.5,"end":2.2},{"word":"unsupported","start":3.1,"end":3.3}],"segments":[{"id":0,"start":0.5,"end":3.3,"text":text,"avg_logprob":-0.57,"no_speech_prob":0.75}]}).to_string()).unwrap()
    }
    #[test]
    fn silence_noise_and_isolated_clicks_do_not_create_speech_regions() {
        for samples in [
            vec![0; 16000],
            (0..16000)
                .map(|i| if i % 2 == 0 { 50 } else { -50 })
                .collect(),
            {
                let mut samples = vec![0; 16000];
                samples[100] = 20000;
                samples
            },
        ] {
            let timing = analyze_pcm16(&samples, RATE).unwrap();
            assert!(timing.regions.is_empty());
            assert!(timing.pauses.is_empty());
            assert!(timing.noise_floor_dbfs.is_finite());
            assert!(timing.threshold_dbfs.is_finite());
        }
    }
    #[test]
    fn adaptive_floor_and_local_pauses_have_measured_bounds() {
        let quiet = analyze_pcm16(&recording(), RATE).unwrap();
        assert_eq!(quiet.regions.len(), 2);
        assert_eq!(quiet.pauses.len(), 1);
        assert!((quiet.regions[0].start - 0.5).abs() < 0.021);
        assert!((quiet.regions[0].end - 1.0).abs() < 0.021);
        assert!((quiet.pauses[0].duration - 0.5).abs() < 0.021);
        let mut noisy = recording();
        for (index, sample) in noisy.iter_mut().enumerate() {
            *sample += if index % 2 == 0 { 300 } else { -300 };
        }
        let noisy = analyze_pcm16(&noisy, RATE).unwrap();
        assert!(noisy.noise_floor_dbfs > quiet.noise_floor_dbfs);
        assert!(noisy.threshold_dbfs > quiet.threshold_dbfs);
        assert_eq!(noisy.regions.len(), 2);
        assert!(analyze_pcm16(&[], RATE).is_err());
        assert!(analyze_pcm16(&[1], 0).is_err());
        assert!(analyze_pcm16(&vec![0; 8000 * 121], 8000).is_err());
    }
    #[test]
    fn stretched_words_are_clipped_and_unsupported_words_reported_without_rewrite() {
        let timing = analyze_pcm16(&recording(), RATE).unwrap();
        let original = transcript("¿Qué tú haces hoy?");
        let result = align(&original, &timing).unwrap();
        assert_eq!(result.original_text, original.text);
        assert!(!result.transcript_rewritten);
        assert_eq!(result.words.len(), 2);
        assert_eq!(result.unsupported_words.len(), 1);
        assert_eq!(result.words[0].provider_end, 1.8);
        assert!((result.words[0].end - 1.0).abs() < 0.021);
        assert!(result.words[0].clipped);
        assert_eq!(result.unsupported_words[0].word, "unsupported");
        assert_eq!(result.unsupported_words[0].provider_end, 3.3);
        assert_eq!(result.pauses[0].preceding_word, Some(0));
        assert_eq!(result.pauses[0].following_word, Some(1));
        assert_eq!(result.pauses[0].duration, timing.pauses[0].duration);
        assert_eq!(result.provider_segments[0].avg_logprob, -0.57);
        assert_eq!(result.provider_segments[0].no_speech_prob, 0.75);
    }
    #[test]
    fn multilingual_wording_and_spacing_are_preserved_character_for_character() {
        for text in [
            "  ¿Qué tú haces hoy?  ",
            "كيف حالك؟ بدون تشكيل",
            "你好，你在做什么？",
        ] {
            let original = transcript(text);
            let result = align(&original, &analyze_pcm16(&recording(), RATE).unwrap()).unwrap();
            assert_eq!(result.original_text, text);
            assert_eq!(result.words[0].word, text);
            assert_eq!(result.provider_segments[0].text, text);
        }
    }
    #[test]
    fn malformed_or_unavailable_provider_timings_fail_explicitly() {
        let original = serde_json::to_value(transcript("hola")).unwrap();
        for (path, value) in [
            ("negative", json!(-0.1)),
            ("reversed", json!(0.2)),
            ("excess", json!(8.0)),
            ("probability", json!(1.1)),
            ("logprob", json!(0.1)),
            ("order", json!(0.1)),
        ] {
            let mut raw = original.clone();
            match path {
                "negative" => raw["words"][0]["start"] = value,
                "reversed" | "excess" => raw["words"][0]["end"] = value,
                "probability" => raw["segments"][0]["no_speech_prob"] = value,
                "logprob" => raw["segments"][0]["avg_logprob"] = value,
                _ => raw["words"][1]["start"] = value,
            }
            assert!(
                parse_verbose_json(&raw.to_string()).is_err(),
                "accepted {path}"
            );
        }
        assert!(parse_verbose_json(r#"{"text":"text only"}"#).is_err());
        assert!(parse_verbose_json(&original.to_string().replace("0.5", "1e999")).is_err());
        let mut raw = original.clone();
        raw["x_groq"] = json!({"id":"provider-metadata"});
        assert!(parse_verbose_json(&raw.to_string()).is_ok());
        raw["words"][0]["unexpected"] = json!(true);
        assert!(parse_verbose_json(&raw.to_string()).is_err());
        let mut typed = transcript("hola");
        typed.words[0].start = f64::NAN;
        assert!(align(&typed, &analyze_pcm16(&recording(), RATE).unwrap()).is_err());
    }
    #[test]
    fn words_inside_silence_are_unsupported_and_zero_speech_remains_explicit() {
        let timing = analyze_pcm16(&vec![0; RATE as usize * 3], RATE).unwrap();
        let result = align(&transcript("hola"), &timing).unwrap();
        assert!(result.words.is_empty());
        assert_eq!(result.unsupported_words.len(), 3);
        assert_eq!(result.original_text, "hola");
        assert!(result.pauses.is_empty());
        let mut mismatched = transcript("hola");
        mismatched.duration = 10.0;
        assert!(align(&mismatched, &timing).is_err());
        let mut corrupt = timing;
        corrupt.noise_floor_dbfs = f64::NAN;
        assert!(align(&transcript("hola"), &corrupt).is_err());
    }
}
