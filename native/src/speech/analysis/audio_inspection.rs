//! Transient, bounded recording inspection. Audio is returned for temporary playback, never saved.
use super::spectrogram::spectrogram;
#[cfg(test)]
use super::spectrogram::{
    DB_REFERENCE, MEL_BANDS, MEL_MAX_HZ, MEL_MIN_HZ, MEL_NORMALIZATION, MEL_SCALE, from_mel, to_mel,
};
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
    pub owner: crate::speech::recording::owner::RecordingOwner,
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
    // The mel bands these rows describe, low to high, with their edges in Hz.
    // The same grid for every recording, whatever its sample rate, so two
    // panels can be compared row by row.
    pub bands: Vec<InspectionMelBand>,
    pub min_frequency_hz: f64,
    pub max_frequency_hz: f64,
    // The highest frequency this recording could carry: the grid ceiling, or
    // Nyquist when the sample rate is lower. Bands above it are unavailable,
    // which is not the same as measured silence.
    pub measured_max_frequency_hz: f64,
    // How a frequency in Hz maps to a mel band, for anyone reading the numbers.
    pub mel_scale: String,
    // How each triangular filter is scaled before its power is summed.
    pub normalization: String,
    // What 0 dB means here.
    pub db_reference: String,
    pub db_min: f32,
    pub db_max: f32,
    // Time-major rows, mel bands ascending. One-sided Hann-window FFT power,
    // normalized by the squared window sum, passed through the mel filterbank
    // and expressed in dB relative to full-scale power. A band the recording
    // cannot carry is null: unmeasurable, not silent.
    pub bins: Vec<Vec<Option<f32>>>,
}
// One triangular mel filter: it rises from `low_hz` to `center_hz` and falls
// to `high_hz`.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InspectionMelBand {
    pub low_hz: f64,
    pub center_hz: f64,
    pub high_hz: f64,
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
    owner: &crate::speech::recording::owner::RecordingOwner,
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
            owner: owner.clone(),
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
    /// The loudest band a recording actually measured, with its level.
    fn loudest(frame: &[Option<f32>]) -> (usize, f32) {
        frame
            .iter()
            .enumerate()
            .filter_map(|(index, db)| db.map(|value| (index, value)))
            .max_by(|a, b| a.1.total_cmp(&b.1))
            .expect("a measured band")
    }

    fn owner() -> crate::speech::recording::owner::RecordingOwner {
        crate::speech::recording::owner::RecordingOwner::Conversation("conversation".into())
    }
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
        let (inspection, _) = inspect_wav(&wav(&samples, rate, 1), "recording", &owner()).unwrap();
        let spectrum = &inspection.spectrogram;
        let (peak, level) = loudest(&spectrum.bins[0]);
        // The loudest mel band is the one whose triangle covers the tone.
        let band = &spectrum.bands[peak];
        assert!(
            frequency > band.low_hz && frequency < band.high_hz,
            "{frequency} Hz outside {band:?}"
        );
        assert!(level > -20.0);
        assert_eq!(spectrum.frame_start_seconds[0], 0.0);
        assert_eq!(spectrum.frame_start_seconds[1], spectrum.frame_seconds);
        assert_eq!(
            spectrum.window_seconds,
            spectrum.fft_size as f64 / rate as f64
        );
        assert_eq!(inspection.recording_id, "recording");
        assert_eq!(inspection.owner, owner());
        assert!(inspection.waveform.min.iter().all(|v| *v >= -1.0));
        assert!(inspection.waveform.max.iter().all(|v| *v <= 1.0));
    }
    #[test]
    fn long_silence_is_bounded_and_wav_validation_fails_before_dispatch() {
        let (inspection, _) =
            inspect_wav(&wav(&vec![0; 8000 * 120], 8000, 1), "r", &owner()).unwrap();
        assert!(inspection.waveform.min.len() <= 1200);
        assert!(inspection.spectrogram.bins.len() <= 1200);
        assert!(inspection.spectrogram.bins.iter().all(|row| {
            row.len() == MEL_BANDS && row.iter().all(|db| db.is_none() || *db == Some(-100.0))
        }));
        assert!(inspection.activity.regions.is_empty());
        assert!(matches!(
            inspection.word_timing.status,
            InspectionTimingStatus::Unavailable
        ));
        assert!(inspection.word_timing.reason.is_some());
        assert!(inspect_wav(b"invalid", "r", &owner()).is_err());
        assert!(inspect_wav(&wav(&[0; 100], 16000, 2), "r", &owner()).is_err());
        assert!(inspect_wav(&wav(&[0; 100], 1000, 1), "r", &owner()).is_err());
        let mut truncated = wav(&[0; 100], 16000, 1);
        truncated.truncate(truncated.len() - 7);
        assert!(inspect_wav(&truncated, "r", &owner()).is_err());
        assert!(inspect_wav(&vec![0; MAX_BYTES + 1], "r", &owner()).is_err());
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
        let (mut inspection, _) =
            inspect_wav(&wav(&samples, rate as u32, 1), "r", &owner()).unwrap();
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
            let (peak, power) = loudest(&spectrum.bins[0]);
            let band = &spectrum.bands[peak];
            assert!(
                1000.0 > band.low_hz && 1000.0 < band.high_hz,
                "{rate}: 1000 Hz outside {band:?}"
            );
            assert!((-15.0..-8.0).contains(&power), "{rate}: {power}");
            assert!(spectrum.bins.len() <= 1200);
            assert_eq!(spectrum.bins[0].len(), MEL_BANDS);
            // Every rate reports the same grid; only what it could measure differs.
            assert_eq!(spectrum.max_frequency_hz, MEL_MAX_HZ);
            assert_eq!(
                spectrum.measured_max_frequency_hz,
                MEL_MAX_HZ.min(rate as f64 / 2.0)
            );
        }
    }

    #[test]
    fn every_recording_shares_one_band_grid_and_marks_what_it_cannot_measure() {
        for (rate, measured_high) in [(8000u32, 4000.0), (16000, 8000.0), (48000, 8000.0)] {
            let spectrum = spectrogram(&vec![0; rate as usize / 8], rate);
            let bands = &spectrum.bands;
            assert_eq!(bands.len(), MEL_BANDS);
            // One grid, whatever the sample rate: row N is the same frequency
            // in every panel, which is what makes two recordings comparable.
            assert!((bands[0].low_hz - MEL_MIN_HZ).abs() < 1e-6);
            assert!((bands[MEL_BANDS - 1].high_hz - MEL_MAX_HZ).abs() < 1e-6);
            assert_eq!(spectrum.max_frequency_hz, MEL_MAX_HZ);
            assert_eq!(spectrum.measured_max_frequency_hz, measured_high);
            for (index, band) in bands.iter().enumerate() {
                assert!(band.low_hz < band.center_hz && band.center_hz < band.high_hz);
                if index > 0 {
                    // Each filter starts at the previous one's centre: adjacent
                    // triangles overlap by half a band, covering the whole range.
                    assert!((band.low_hz - bands[index - 1].center_hz).abs() < 1e-6);
                    assert!(band.center_hz > bands[index - 1].center_hz);
                }
                // Above Nyquist there is nothing to hear, so the band is
                // unavailable rather than a convincing stretch of silence.
                let measurable = band.high_hz <= measured_high + 1e-6;
                assert_eq!(
                    spectrum.bins[0][index].is_some(),
                    measurable,
                    "{rate}: band {index} ({band:?})"
                );
                if measurable {
                    assert_eq!(spectrum.bins[0][index], Some(-100.0));
                }
            }
            // A mel axis spends its rows on speech: the middle band sits well
            // below the midpoint a linear axis would put there.
            assert!(bands[MEL_BANDS / 2].center_hz < MEL_MAX_HZ / 2.5);
            // Formants live in the lowest couple of kHz; most bands are there.
            let low_bands = bands.iter().filter(|b| b.center_hz < 2000.0).count();
            assert!(low_bands * 2 > MEL_BANDS, "{low_bands} of {MEL_BANDS}");
        }
        // The scale is the documented HTK formula, invertible in both directions.
        assert!((to_mel(700.0) - 2595.0 * 2.0_f64.log10()).abs() < 1e-9);
        for hz in [50.0, 440.0, 1000.0, 4000.0, 8000.0] {
            assert!((from_mel(to_mel(hz)) - hz).abs() < 1e-6);
        }
    }

    #[test]
    fn the_same_tone_lands_in_the_same_band_whatever_the_capture_rate() {
        let peaks: Vec<usize> = [8000u32, 16000, 44100, 48000]
            .into_iter()
            .map(|rate| {
                let samples: Vec<i16> = (0..rate / 2)
                    .map(|i| {
                        (12000.0
                            * (2.0 * std::f64::consts::PI * 1000.0 * i as f64 / rate as f64).sin())
                            as i16
                    })
                    .collect();
                let spectrum = spectrogram(&samples, rate);
                let (peak, _) = loudest(&spectrum.bins[spectrum.bins.len() / 2]);
                // The band grid itself is identical, so the row index is
                // directly comparable between recordings.
                assert_eq!(
                    serde_json::to_value(&spectrum.bands).unwrap(),
                    serde_json::to_value(spectrogram(&vec![0; 8000], 16000).bands).unwrap()
                );
                peak
            })
            .collect();
        assert!(
            peaks.windows(2).all(|pair| pair[0] == pair[1]),
            "one tone, different rows: {peaks:?}"
        );
    }

    #[test]
    fn silence_sits_at_the_floor_and_a_tone_lifts_only_its_own_band() {
        let rate = 16000;
        let silence = spectrogram(&vec![0; rate as usize], rate);
        assert!(
            silence.bins.iter().flatten().all(|db| *db == Some(-100.0)),
            "digital silence must read as the floor"
        );
        assert_eq!(silence.db_min, -100.0);
        assert_eq!(silence.db_max, 0.0);

        let samples: Vec<i16> = (0..rate)
            .map(|i| {
                (12000.0 * (2.0 * std::f64::consts::PI * 1000.0 * i as f64 / rate as f64).sin())
                    as i16
            })
            .collect();
        let tone = spectrogram(&samples, rate);
        let frame = &tone.bins[tone.bins.len() / 2];
        let (peak, peak_db) = loudest(frame);
        assert!(1000.0 > tone.bands[peak].low_hz && 1000.0 < tone.bands[peak].high_hz);
        // Bands the tone does not reach stay far below it, so a comparison reads
        // as one bright stripe rather than a wash.
        for (index, db) in frame.iter().enumerate() {
            let db = db.expect("16 kHz measures the whole grid");
            if tone.bands[index].low_hz > 1200.0 || tone.bands[index].high_hz < 800.0 {
                assert!(
                    db < peak_db - 30.0,
                    "band {index} at {db} dB is too close to the {peak_db} dB peak"
                );
            }
        }
        // Halving the amplitude lowers the same band by about 6 dB.
        let quiet: Vec<i16> = samples.iter().map(|value| value / 2).collect();
        let quieter = spectrogram(&quiet, rate);
        let difference = peak_db - loudest(&quieter.bins[quieter.bins.len() / 2]).1;
        assert!((difference - 6.02).abs() < 0.2, "{difference} dB");
    }

    #[test]
    fn the_reported_parameters_describe_the_numbers_that_were_produced() {
        let rate = 16000;
        let spectrum = spectrogram(&vec![0; rate as usize], rate);
        assert_eq!(spectrum.bands.len(), spectrum.bins[0].len());
        assert_eq!(spectrum.mel_scale, MEL_SCALE);
        assert_eq!(spectrum.normalization, MEL_NORMALIZATION);
        assert_eq!(spectrum.db_reference, DB_REFERENCE);
        assert_eq!(spectrum.min_frequency_hz, MEL_MIN_HZ);
        assert_eq!(spectrum.window_seconds, spectrum.fft_size as f64 / 16000.0);
        assert_eq!(
            spectrum.frame_seconds,
            spectrum.frame_start_seconds[1] - spectrum.frame_start_seconds[0]
        );
    }

    /// Two synthetic utterances: a steady "reference" and a lower, slower
    /// "attempt". Deterministic, so the committed preview fixture stays honest.
    fn paired_utterances(rate: u32) -> [Vec<i16>; 2] {
        let tone = |samples: &mut Vec<i16>, hz: f64, seconds: f64, amplitude: f64| {
            let count = (rate as f64 * seconds) as usize;
            for i in 0..count {
                let t = i as f64 / rate as f64;
                // Two harmonics and a short fade keep the picture speech-like
                // without pretending this is a recorded voice.
                let fade = (t / 0.02).min(1.0).min((seconds - t) / 0.02).max(0.0);
                let value = (2.0 * std::f64::consts::PI * hz * t).sin()
                    + 0.5 * (4.0 * std::f64::consts::PI * hz * t).sin();
                samples.push((12000.0 * amplitude * fade * value / 1.5) as i16);
            }
        };
        let silence = |samples: &mut Vec<i16>, seconds: f64| {
            samples.extend(std::iter::repeat_n(0, (rate as f64 * seconds) as usize))
        };
        let mut reference = Vec::new();
        silence(&mut reference, 0.1);
        tone(&mut reference, 220.0, 0.35, 1.0);
        silence(&mut reference, 0.08);
        tone(&mut reference, 440.0, 0.3, 0.8);
        silence(&mut reference, 0.08);
        tone(&mut reference, 880.0, 0.25, 0.6);
        silence(&mut reference, 0.1);
        let mut attempt = Vec::new();
        silence(&mut attempt, 0.2);
        tone(&mut attempt, 196.0, 0.45, 0.7);
        silence(&mut attempt, 0.15);
        tone(&mut attempt, 392.0, 0.25, 0.5);
        silence(&mut attempt, 0.05);
        tone(&mut attempt, 784.0, 0.2, 0.3);
        silence(&mut attempt, 0.1);
        [reference, attempt]
    }

    /// The UI spectrogram preview renders this file. Regenerate it with
    /// `SKELLYSPEAK_UPDATE_FIXTURES=1 cargo test --lib paired_inspection`
    /// whenever the analysis changes, so the picture is never stale.
    #[test]
    fn paired_inspection_fixture_matches_the_current_analysis() {
        // Deliberately different capture rates: the reference comes from the
        // speech provider, the attempt from whatever the microphone gives.
        // Their pictures must still line up row for row.
        let inspections: Vec<_> = [("reference", 16000u32), ("attempt", 8000)]
            .into_iter()
            .map(|(name, rate)| {
                let [reference, attempt] = paired_utterances(rate);
                let samples = if name == "reference" {
                    reference
                } else {
                    attempt
                };
                inspect_wav(
                    &wav(&samples, rate, 1),
                    name,
                    &crate::speech::recording::owner::RecordingOwner::DrillItem(name.into()),
                )
                .unwrap()
                .0
            })
            .collect();
        let current = serde_json::to_string_pretty(&inspections).unwrap() + "\n";
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../ui/tools/spectrogram-fixture.json");
        if std::env::var("SKELLYSPEAK_UPDATE_FIXTURES").is_ok() {
            std::fs::write(&path, &current).unwrap();
        }
        let committed = std::fs::read_to_string(&path).expect("preview fixture exists");
        assert_eq!(
            committed, current,
            "the spectrogram preview fixture is stale; regenerate it with SKELLYSPEAK_UPDATE_FIXTURES=1"
        );
    }
}
