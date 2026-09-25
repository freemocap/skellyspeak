//! Offline timing foundation; not connected to recording receipts or messages.
//! Local energy regions cross-check provider timing, not linguistic correctness.
//! Silence-triggered transcription artifacts motivate separate unsupported-word
//! reporting [@koenecke2024]. This module consumes only normalized timing.
//! No transcript is rewritten by this module.
use crate::model::AppError;
use crate::model::ErrorCode;
use crate::model::Result;
use serde::{Deserialize, Serialize};

const MAX_SECONDS: f64 = 120.0;
const ENDPOINT_SPILL_SECONDS: f64 = 1.0;
const FRAME_MS: u32 = 20;
const MIN_REGION_SECONDS: f64 = 0.06;
const MIN_PAUSE_SECONDS: f64 = 0.25;

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[serde(deny_unknown_fields)]
pub struct Word {
    pub word: String,
    pub start: f64,
    pub end: f64,
}
/// Provider-independent timing evidence. Confidence diagnostics are separate.
#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[serde(deny_unknown_fields)]
pub struct TranscriptTiming {
    pub text: String,
    pub duration: f64,
    pub words: Vec<Word>,
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
pub(crate) fn validate_timing(text: &str, duration: f64, words: &[Word]) -> Result<()> {
    if !duration.is_finite() || duration <= 0.0 || duration > MAX_SECONDS {
        return Err(invalid("recording duration must be in (0,120] seconds."));
    }
    if text.len() > 200_000 || text.contains('\0') || words.len() > 10_000 {
        return Err(invalid("transcription exceeds its limits."));
    }
    let limit = duration + ENDPOINT_SPILL_SECONDS;
    let mut previous = 0.0;
    for word in words {
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
    Ok(())
}
/// RMS energy shared by offline inspection and the streaming boundary detector.
/// Inputs are normalized mono samples; callers own PCM conversion and framing.
pub(crate) fn frame_energy_db(samples: impl Iterator<Item = f64>) -> f64 {
    let (power, count) = samples.fold((0.0, 0usize), |(sum, count), value| {
        (sum + value * value, count + 1)
    });
    let mean = power / count.max(1) as f64;
    (10.0 * mean.max(1e-12).log10()).max(-120.0)
}

/// Shared noise-relative activity threshold for inspection and live boundaries.
pub(crate) fn activity_threshold(noise_floor: f64) -> f64 {
    (noise_floor + 10.0).clamp(-50.0, -20.0)
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
        .map(|chunk| frame_energy_db(chunk.iter().map(|sample| *sample as f64 / 32768.0)))
        .collect();
    let mut sorted = db.clone();
    sorted.sort_by(f64::total_cmp);
    let noise_floor = sorted[(sorted.len() - 1) / 5];
    let threshold = activity_threshold(noise_floor);
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
pub fn align_timing(transcript: &TranscriptTiming, local: &LocalTiming) -> Result<FluencyAnalysis> {
    validate_timing(&transcript.text, transcript.duration, &transcript.words)?;
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
    fn transcript(text: &str) -> TranscriptTiming {
        serde_json::from_value(json!({"text":text,"duration":3.0,"words":[{"word":text,"start":0.5,"end":1.8},{"word":"second","start":1.5,"end":2.2},{"word":"unsupported","start":3.1,"end":3.3}]})).unwrap()
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
        let result = align_timing(&original, &timing).unwrap();
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
    }
    #[test]
    fn multilingual_wording_and_spacing_are_preserved_character_for_character() {
        for text in [
            "  ¿Qué tú haces hoy?  ",
            "كيف حالك؟ بدون تشكيل",
            "你好，你在做什么？",
        ] {
            let original = transcript(text);
            let result =
                align_timing(&original, &analyze_pcm16(&recording(), RATE).unwrap()).unwrap();
            assert_eq!(result.original_text, text);
            assert_eq!(result.words[0].word, text);
        }
    }
    #[test]
    fn malformed_timings_fail_explicitly() {
        for end in [-1.0, 0.2, 8.0, f64::NAN] {
            let mut value = transcript("hola");
            value.words[0].end = end;
            assert!(align_timing(&value, &analyze_pcm16(&recording(), RATE).unwrap()).is_err());
        }
    }
    #[test]
    fn words_inside_silence_are_unsupported_and_zero_speech_remains_explicit() {
        let timing = analyze_pcm16(&vec![0; RATE as usize * 3], RATE).unwrap();
        let result = align_timing(&transcript("hola"), &timing).unwrap();
        assert!(result.words.is_empty());
        assert_eq!(result.unsupported_words.len(), 3);
        assert_eq!(result.original_text, "hola");
        assert!(result.pauses.is_empty());
        let mut mismatched = transcript("hola");
        mismatched.duration = 10.0;
        assert!(align_timing(&mismatched, &timing).is_err());
        let mut corrupt = timing;
        corrupt.noise_floor_dbfs = f64::NAN;
        assert!(align_timing(&transcript("hola"), &corrupt).is_err());
    }
}
