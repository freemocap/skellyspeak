//! Transient, bounded recording inspection. Audio is returned for temporary playback, never saved.
use crate::model::*;
use crate::speech::analysis::fluency;
use serde::Serialize;
use ts_rs::TS;
const MAX_BYTES: usize = 25 * 1024 * 1024;
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionInspectionResult {
    pub text: String,
    pub inspection: AudioInspection,
    pub audio_base64: String,
    #[ts(type = "unknown | null")]
    pub diagnostics: Option<serde_json::Value>,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AudioInspection {
    pub recording_id: String,
    pub conversation_id: String,
    pub duration: f64,
    pub sample_rate: u32,
    pub waveform: InspectionWaveform,
    pub spectrogram: InspectionSpectrogram,
    pub activity: InspectionActivity,
    pub word_timing: InspectionWordTiming,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InspectionWaveform {
    pub bin_seconds: f64,
    pub min: Vec<f32>,
    pub max: Vec<f32>,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InspectionSpectrogram {
    pub frame_seconds: f64,
    pub frame_start_seconds: Vec<f64>,
    pub window_seconds: f64,
    pub fft_size: usize,
    pub frequency_bin_hz: f64,
    pub max_frequency_hz: f64,
    pub db_min: f32,
    pub db_max: f32,
    // Time-major rows, frequency buckets ascending. One-sided Hann-window FFT
    // power, normalized by squared window sum and summed within each bucket.
    pub bins: Vec<Vec<f32>>,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InspectionRegion {
    pub start: f64,
    pub end: f64,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InspectionPause {
    pub start: f64,
    pub duration: f64,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InspectionActivity {
    pub algorithm: String,
    pub noise_floor_dbfs: f64,
    pub threshold_dbfs: f64,
    pub regions: Vec<InspectionRegion>,
    pub pauses: Vec<InspectionPause>,
    pub limitations: Vec<String>,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum InspectionTimingStatus {
    Available,
    Unavailable,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InspectionWordTiming {
    pub status: InspectionTimingStatus,
    pub reason: Option<String>,
    pub words: Vec<InspectionWord>,
    pub unsupported: Vec<InspectionUnsupportedWord>,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InspectionWord {
    pub index: usize,
    pub word: String,
    pub provider_start: f64,
    pub provider_end: f64,
    pub start: f64,
    pub end: f64,
    pub clipped: bool,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InspectionUnsupportedWord {
    pub index: usize,
    pub word: String,
    pub provider_start: f64,
    pub provider_end: f64,
    pub reason: String,
}
fn invalid(message: &str) -> AppError {
    AppError::new(
        ErrorCode::Validation,
        format!("Audio inspection: {message}"),
    )
}

/// WAV decoding and STFT are called on a blocking worker before provider dispatch.
/// Returned local timing is transient and stays paired with this recording.
pub(crate) fn inspect_wav(
    bytes: &[u8],
    recording_id: &str,
    conversation_id: &str,
) -> Result<(AudioInspection, fluency::LocalTiming)> {
    if bytes.len() < 44 || bytes.len() > MAX_BYTES {
        return Err(invalid("WAV must contain audio and be at most 25 MB."));
    }
    let mut reader = hound::WavReader::new(std::io::Cursor::new(bytes)).map_err(|cause| {
        crate::diagnostics::failures::wav(
            &cause,
            "audio_inspection",
            invalid("Invalid WAV encoding."),
        )
    })?;
    let spec = reader.spec();
    if spec.channels != 1
        || spec.bits_per_sample != 16
        || spec.sample_format != hound::SampleFormat::Int
        || !(8_000..=192_000).contains(&spec.sample_rate)
        || reader.duration() == 0
        || reader.duration() as f64 / spec.sample_rate as f64 > 120.0
    {
        return Err(invalid(
            "Requires PCM16 mono WAV, 8–192 kHz, at most 120 seconds.",
        ));
    }
    let samples = reader
        .samples::<i16>()
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|cause| {
            crate::diagnostics::failures::wav(
                &cause,
                "audio_inspection",
                invalid("Truncated or invalid PCM samples."),
            )
        })?;
    let local = fluency::analyze_pcm16(&samples, spec.sample_rate)?;
    let width = samples.len().div_ceil(1200).max(1);
    let min = samples
        .chunks(width)
        .map(|chunk| *chunk.iter().min().unwrap() as f32 / 32768.0)
        .collect();
    let max = samples
        .chunks(width)
        .map(|chunk| *chunk.iter().max().unwrap() as f32 / 32768.0)
        .collect();
    let spectrogram = spectrogram(&samples, spec.sample_rate);
    let activity = InspectionActivity {
        algorithm: local.algorithm.into(),
        noise_floor_dbfs: local.noise_floor_dbfs,
        threshold_dbfs: local.threshold_dbfs,
        regions: local
            .regions
            .iter()
            .map(|r| InspectionRegion {
                start: r.start,
                end: r.end,
            })
            .collect(),
        pauses: local
            .pauses
            .iter()
            .map(|p| InspectionPause {
                start: p.start,
                duration: p.duration,
            })
            .collect(),
        limitations: local.limitations.iter().map(|s| (*s).into()).collect(),
    };
    Ok((
        AudioInspection {
            recording_id: recording_id.into(),
            conversation_id: conversation_id.into(),
            duration: local.duration,
            sample_rate: spec.sample_rate,
            waveform: InspectionWaveform {
                bin_seconds: width as f64 / spec.sample_rate as f64,
                min,
                max,
            },
            spectrogram,
            activity,
            word_timing: InspectionWordTiming {
                status: InspectionTimingStatus::Unavailable,
                reason: Some(
                    "Word timestamps are unavailable for this recording. Provider details are retained in diagnostics.".into(),
                ),
                words: vec![],
                unsupported: vec![],
            },
        },
        local,
    ))
}
fn fft(real: &mut [f64], imag: &mut [f64]) {
    let n = real.len();
    let mut j = 0;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if i < j {
            real.swap(i, j);
            imag.swap(i, j);
        }
    }
    let mut length = 2;
    while length <= n {
        let angle = -2.0 * std::f64::consts::PI / length as f64;
        let (sin, cos) = angle.sin_cos();
        for start in (0..n).step_by(length) {
            let (mut wr, mut wi) = (1.0, 0.0);
            for offset in 0..length / 2 {
                let a = start + offset;
                let b = a + length / 2;
                let tr = wr * real[b] - wi * imag[b];
                let ti = wr * imag[b] + wi * real[b];
                real[b] = real[a] - tr;
                imag[b] = imag[a] - ti;
                real[a] += tr;
                imag[a] += ti;
                let next = wr * cos - wi * sin;
                wi = wr * sin + wi * cos;
                wr = next;
            }
        }
        length *= 2;
    }
}
fn spectrogram(samples: &[i16], rate: u32) -> InspectionSpectrogram {
    let n = ((rate as usize * 25 / 1000).max(256))
        .next_power_of_two()
        .min(8192);
    let hop = (n / 2).max(samples.len().div_ceil(400));
    let resolution = rate as f64 / n as f64;
    let last_bin = (8000.0 / resolution).floor() as usize;
    let count = last_bin.min(n / 2) + 1;
    let group = count.div_ceil(129);
    let window: Vec<f64> = (0..n)
        .map(|i| 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / (n - 1) as f64).cos())
        .collect();
    let normalization = window.iter().sum::<f64>().powi(2);
    let mut bins = vec![];
    let mut frame_start_seconds = vec![];
    for start in (0..samples.len()).step_by(hop) {
        let mut real: Vec<f64> = (0..n)
            .map(|i| samples.get(start + i).copied().unwrap_or(0) as f64 / 32768.0 * window[i])
            .collect();
        let mut imag = vec![0.0; n];
        fft(&mut real, &mut imag);
        let power: Vec<f64> = (0..count)
            .map(|i| {
                (real[i] * real[i] + imag[i] * imag[i]) / normalization
                    * if i == 0 || i == n / 2 { 1.0 } else { 2.0 }
            })
            .collect();
        bins.push(
            power
                .chunks(group)
                .map(|bucket| {
                    (10.0 * bucket.iter().sum::<f64>().max(1e-10).log10()).clamp(-100.0, 0.0) as f32
                })
                .collect(),
        );
        frame_start_seconds.push(start as f64 / rate as f64);
    }
    InspectionSpectrogram {
        frame_seconds: hop as f64 / rate as f64,
        frame_start_seconds,
        window_seconds: n as f64 / rate as f64,
        fft_size: n,
        frequency_bin_hz: resolution * group as f64,
        max_frequency_hz: (count - 1) as f64 * resolution,
        db_min: -100.0,
        db_max: 0.0,
        bins,
    }
}
/// Display validated provider timestamps without fluency alignment. Acoustic
/// activity is inspection data, never a gate on a successful transcription.
pub(crate) fn attach_words(
    inspection: &mut AudioInspection,
    transcript: Option<&fluency::TranscriptTiming>,
) {
    let Some(transcript) = transcript else {
        return;
    };
    inspection.word_timing = InspectionWordTiming {
        status: InspectionTimingStatus::Available,
        reason: None,
        words: transcript
            .words
            .iter()
            .enumerate()
            .map(|(index, word)| InspectionWord {
                index,
                word: word.word.clone(),
                provider_start: word.start,
                provider_end: word.end,
                start: word.start,
                end: word.end,
                clipped: false,
            })
            .collect(),
        unsupported: vec![],
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    fn wav(samples: &[i16], rate: u32, channels: u16) -> Vec<u8> {
        let mut cursor = std::io::Cursor::new(Vec::new());
        {
            let mut writer = hound::WavWriter::new(
                &mut cursor,
                hound::WavSpec {
                    channels,
                    sample_rate: rate,
                    bits_per_sample: 16,
                    sample_format: hound::SampleFormat::Int,
                },
            )
            .unwrap();
            for sample in samples {
                writer.write_sample(*sample).unwrap();
            }
            writer.finalize().unwrap();
        }
        cursor.into_inner()
    }
    #[test]
    fn real_stft_tone_peak_and_axes_match_the_recording() {
        let rate = 16000;
        let frequency = 1000.0;
        let samples: Vec<i16> = (0..rate)
            .map(|i| {
                (12000.0 * (2.0 * std::f64::consts::PI * frequency * i as f64 / rate as f64).sin())
                    as i16
            })
            .collect();
        let (inspection, _) =
            inspect_wav(&wav(&samples, rate, 1), "recording", "conversation").unwrap();
        let spectrum = &inspection.spectrogram;
        let peak = spectrum.bins[0]
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .unwrap()
            .0;
        let lower = peak as f64 * spectrum.frequency_bin_hz;
        assert!(frequency >= lower && frequency < lower + spectrum.frequency_bin_hz);
        assert!(spectrum.bins[0][peak] > -20.0);
        assert_eq!(spectrum.frame_start_seconds[0], 0.0);
        assert_eq!(spectrum.frame_start_seconds[1], spectrum.frame_seconds);
        assert_eq!(
            spectrum.window_seconds,
            spectrum.fft_size as f64 / rate as f64
        );
        assert_eq!(inspection.recording_id, "recording");
        assert_eq!(inspection.conversation_id, "conversation");
        assert!(inspection.waveform.min.iter().all(|v| *v >= -1.0));
        assert!(inspection.waveform.max.iter().all(|v| *v <= 1.0));
    }
    #[test]
    fn long_silence_is_bounded_and_wav_validation_fails_before_dispatch() {
        let (inspection, _) = inspect_wav(&wav(&vec![0; 8000 * 120], 8000, 1), "r", "c").unwrap();
        assert!(inspection.waveform.min.len() <= 1200);
        assert!(inspection.spectrogram.bins.len() <= 400);
        assert!(
            inspection
                .spectrogram
                .bins
                .iter()
                .all(|row| row.len() <= 129 && row.iter().all(|db| *db == -100.0))
        );
        assert!(inspection.activity.regions.is_empty());
        assert!(matches!(
            inspection.word_timing.status,
            InspectionTimingStatus::Unavailable
        ));
        assert!(inspection.word_timing.reason.is_some());
        assert!(inspect_wav(b"invalid", "r", "c").is_err());
        assert!(inspect_wav(&wav(&[0; 100], 16000, 2), "r", "c").is_err());
        assert!(inspect_wav(&wav(&[0; 100], 1000, 1), "r", "c").is_err());
        let mut truncated = wav(&[0; 100], 16000, 1);
        truncated.truncate(truncated.len() - 7);
        assert!(inspect_wav(&truncated, "r", "c").is_err());
        assert!(inspect_wav(&vec![0; MAX_BYTES + 1], "r", "c").is_err());
    }
    #[test]
    fn provider_timing_is_preserved_without_fluency_alignment() {
        let rate = 16000;
        let samples: Vec<i16> = (0..rate)
            .map(|i| {
                if (3200..9600).contains(&i) {
                    if i % 2 == 0 { 8000 } else { -8000 }
                } else {
                    0
                }
            })
            .collect();
        let (mut inspection, _) = inspect_wav(&wav(&samples, rate as u32, 1), "r", "c").unwrap();
        // A provider need only supply word timing, not Whisper segment probabilities.
        let transcript = fluency::TranscriptTiming {
            text: "مرحبا وهم".into(),
            duration: 1.0,
            words: vec![
                fluency::Word {
                    word: "مرحبا".into(),
                    start: 0.2,
                    end: 0.9,
                },
                fluency::Word {
                    word: "وهم".into(),
                    start: 0.9,
                    end: 0.9,
                },
            ],
        };
        attach_words(&mut inspection, Some(&transcript));
        assert!(matches!(
            inspection.word_timing.status,
            InspectionTimingStatus::Available
        ));
        assert_eq!(inspection.word_timing.words[0].word, "مرحبا");
        assert_eq!(inspection.word_timing.words[0].provider_end, 0.9);
        assert_eq!(inspection.word_timing.words[0].end, 0.9);
        assert!(!inspection.word_timing.words[0].clipped);
        // Zero-duration timestamps accepted by the service must not invalidate
        // the transcript, even when the word falls outside local activity.
        assert_eq!(inspection.word_timing.words[1].start, 0.9);
        assert_eq!(inspection.word_timing.words[1].end, 0.9);
        assert!(inspection.word_timing.unsupported.is_empty());
        assert_eq!(transcript.text, "مرحبا وهم");
        let encoded = serde_json::to_string(&inspection).unwrap();
        assert!(!encoded.contains("\"samples\""));
        assert!(!encoded.contains("\"wav\""));
        assert!(!encoded.contains("base64"));
    }
    #[test]
    fn tone_power_and_peak_remain_consistent_across_capture_rates() {
        for rate in [8000u32, 16000, 44100, 48000, 192000] {
            let samples: Vec<i16> = (0..rate / 4)
                .map(|i| {
                    (12000.0 * (2.0 * std::f64::consts::PI * 1000.0 * i as f64 / rate as f64).sin())
                        as i16
                })
                .collect();
            let spectrum = spectrogram(&samples, rate);
            let (peak, power) = spectrum.bins[0]
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.total_cmp(b.1))
                .unwrap();
            assert!(
                ((peak as f64 + 0.5) * spectrum.frequency_bin_hz - 1000.0).abs()
                    < spectrum.frequency_bin_hz * 1.5
            );
            assert!((-15.0..-8.0).contains(power), "{rate}: {power}");
            assert!(spectrum.bins.len() <= 400);
            assert!(spectrum.bins[0].len() <= 129);
        }
    }
}
