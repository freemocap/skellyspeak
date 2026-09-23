//! One log-mel kernel for completed recordings and bounded live history.
use super::audio_inspection::{InspectionMelBand, InspectionSpectrogram};
use serde::Serialize;
use ts_rs::TS;
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
/// Analysis parameters, stated once and reported with every result.
/// Mel bands, not linear FFT bins: speech detail sits in the lowest couple of
/// kHz, and a mel axis spends its rows there instead of on 6 kHz of hiss.
pub(super) const MEL_BANDS: usize = 128;
pub(super) const MEL_MIN_HZ: f64 = 50.0;
pub(super) const MEL_MAX_HZ: f64 = 8000.0;
pub(super) const MEL_SCALE: &str = "htk: mel = 2595 * log10(1 + hz / 700)";
pub(super) const MEL_NORMALIZATION: &str = "unit-peak triangular filters";
pub(super) const DB_REFERENCE: &str = "0 dB = full-scale power (1.0)";

pub(super) fn to_mel(hz: f64) -> f64 {
    2595.0 * (1.0 + hz / 700.0).log10()
}
pub(super) fn from_mel(mel: f64) -> f64 {
    700.0 * (10.0_f64.powf(mel / 2595.0) - 1.0)
}

/// Triangular filter edges, evenly spaced on the mel scale between `low` and
/// `high`. Adjacent filters overlap by half a band, so every frequency in range
/// is covered.
fn mel_bands(low: f64, high: f64) -> Vec<InspectionMelBand> {
    let (low_mel, high_mel) = (to_mel(low), to_mel(high));
    let step = (high_mel - low_mel) / (MEL_BANDS + 1) as f64;
    (0..MEL_BANDS)
        .map(|band| InspectionMelBand {
            low_hz: from_mel(low_mel + step * band as f64),
            center_hz: from_mel(low_mel + step * (band + 1) as f64),
            high_hz: from_mel(low_mel + step * (band + 2) as f64),
        })
        .collect()
}

struct Kernel {
    n: usize,
    count: usize,
    window: Vec<f64>,
    normalization: f64,
    filters: Vec<Vec<f64>>,
    measurable: Vec<bool>,
    description: InspectionSpectrogram,
}
impl Kernel {
    fn new(rate: u32) -> Self {
        let n = ((rate as usize * 50 / 1000).max(256))
            .next_power_of_two()
            .min(8192);
        let resolution = rate as f64 / n as f64;
        // Every recording gets the same band grid, so row N means the same
        // frequency in every panel. A recording below 16 kHz simply cannot measure
        // the top of it: those bands are reported as unavailable, never as silence.
        let nyquist = rate as f64 / 2.0;
        let measured = MEL_MAX_HZ.min(nyquist);
        let bands = mel_bands(MEL_MIN_HZ, MEL_MAX_HZ);
        // A band is measured only when its whole triangle is below Nyquist;
        // a half-covered filter would understate its own energy.
        // The tolerance absorbs the mel round trip: a band whose edge lands on
        // Nyquist to within a millionth of a hertz is still measurable.
        let measurable: Vec<bool> = bands
            .iter()
            .map(|band| band.high_hz <= nyquist + 1e-6)
            .collect();
        let last_bin = (measured / resolution).floor() as usize;
        let count = last_bin.min(n / 2) + 1;
        // Weight of each one-sided FFT bin in each mel band; bin centres outside a
        // filter contribute nothing.
        let filters: Vec<Vec<f64>> = bands
            .iter()
            .map(|band| {
                (0..count)
                    .map(|bin| {
                        let hz = bin as f64 * resolution;
                        if hz <= band.low_hz || hz >= band.high_hz {
                            0.0
                        } else if hz <= band.center_hz {
                            (hz - band.low_hz) / (band.center_hz - band.low_hz)
                        } else {
                            (band.high_hz - hz) / (band.high_hz - band.center_hz)
                        }
                    })
                    .collect()
            })
            .collect();
        let window: Vec<f64> = (0..n)
            .map(|i| 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / (n - 1) as f64).cos())
            .collect();
        let normalization = window.iter().sum::<f64>().powi(2);
        let description = InspectionSpectrogram {
            frame_seconds: 0.02,
            frame_start_seconds: vec![],
            window_seconds: n as f64 / rate as f64,
            fft_size: n,
            bands,
            min_frequency_hz: MEL_MIN_HZ,
            max_frequency_hz: MEL_MAX_HZ,
            measured_max_frequency_hz: measured,
            mel_scale: MEL_SCALE.into(),
            normalization: MEL_NORMALIZATION.into(),
            db_reference: DB_REFERENCE.into(),
            db_min: -100.0,
            db_max: 0.0,
            bins: vec![],
        };
        Self {
            n,
            count,
            window,
            normalization,
            filters,
            measurable,
            description,
        }
    }
    fn frame(&self, samples: &[i16]) -> Vec<Option<f32>> {
        let Self {
            n,
            count,
            window,
            normalization,
            filters,
            measurable,
            ..
        } = self;
        let (n, count) = (*n, *count);
        let mut real: Vec<f64> = (0..n)
            .map(|i| samples.get(i).copied().unwrap_or(0) as f64 / 32768.0 * window[i])
            .collect();
        let mut imag = vec![0.0; n];
        fft(&mut real, &mut imag);
        let power: Vec<f64> = (0..count)
            .map(|i| {
                (real[i] * real[i] + imag[i] * imag[i]) / normalization
                    * if i == 0 || i == n / 2 { 1.0 } else { 2.0 }
            })
            .collect();
        filters
            .iter()
            .zip(measurable)
            .map(|(filter, measured)| {
                if !measured {
                    return None;
                }
                let energy: f64 = filter
                    .iter()
                    .zip(&power)
                    .map(|(weight, value)| weight * value)
                    .sum();
                Some((10.0 * energy.max(1e-10).log10()).clamp(-100.0, 0.0) as f32)
            })
            .collect()
    }
}
pub(super) fn spectrogram(samples: &[i16], rate: u32) -> InspectionSpectrogram {
    let kernel = Kernel::new(rate);
    let hop = (rate as usize / 50).max(samples.len().div_ceil(1200));
    let mut data = kernel.description.clone();
    data.frame_seconds = hop as f64 / rate as f64;
    for start in (0..samples.len()).step_by(hop) {
        data.bins.push(kernel.frame(&samples[start..]));
        data.frame_start_seconds.push(start as f64 / rate as f64);
    }
    data
}

#[derive(Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LiveSpectrogram {
    pub data: InspectionSpectrogram,
    pub end_seconds: f64,
}
pub(crate) struct LiveAnalysis {
    kernel: Kernel,
    rate: u32,
    pending: Vec<i16>,
    offset: usize,
    received: usize,
    view: LiveSpectrogram,
}
impl LiveAnalysis {
    pub fn new(rate: u32) -> Self {
        let kernel = Kernel::new(rate);
        let view = LiveSpectrogram {
            data: kernel.description.clone(),
            end_seconds: 0.0,
        };
        Self {
            kernel,
            rate,
            pending: vec![],
            offset: 0,
            received: 0,
            view,
        }
    }
    pub fn push(&mut self, samples: &[f32]) {
        self.received += samples.len();
        self.pending.extend(
            samples
                .iter()
                .map(|s| (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16),
        );
        let hop = self.rate as usize / 50;
        let mut used = 0;
        while used + self.kernel.n <= self.pending.len() {
            self.view
                .data
                .bins
                .push(self.kernel.frame(&self.pending[used..]));
            self.view
                .data
                .frame_start_seconds
                .push((self.offset + used) as f64 / self.rate as f64);
            used += hop;
        }
        self.pending.drain(..used);
        self.offset += used;
        self.view.end_seconds = self.received as f64 / self.rate as f64;
        let before = self.view.end_seconds - 12.0;
        let remove = self
            .view
            .data
            .frame_start_seconds
            .partition_point(|t| *t + self.view.data.window_seconds < before);
        self.view.data.frame_start_seconds.drain(..remove);
        self.view.data.bins.drain(..remove);
    }
    pub fn snapshot_since(&self, after: Option<f64>) -> LiveSpectrogram {
        let start = after.map_or(0, |time| {
            self.view
                .data
                .frame_start_seconds
                .partition_point(|t| *t <= time)
        });
        let mut data = self.kernel.description.clone();
        data.frame_start_seconds = self.view.data.frame_start_seconds[start..].to_vec();
        data.bins = self.view.data.bins[start..].to_vec();
        LiveSpectrogram {
            data,
            end_seconds: self.view.end_seconds,
        }
    }
    #[cfg(test)]
    pub fn snapshot(&self) -> LiveSpectrogram {
        self.snapshot_since(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn streaming_frames_match_offline_and_history_is_bounded() {
        let rate = 48000;
        let pcm: Vec<f32> = (0..rate * 2)
            .map(|i| (i as f32 * std::f32::consts::TAU * 440.0 / rate as f32).sin() * 0.3)
            .collect();
        let encoded: Vec<i16> = pcm.iter().map(|s| (s * i16::MAX as f32) as i16).collect();
        let offline = spectrogram(&encoded, rate);
        let mut live = LiveAnalysis::new(rate);
        for chunk in pcm.chunks(713) {
            live.push(chunk);
        }
        let snapshot = live.snapshot();
        assert_eq!(snapshot.data.bins[0].len(), 128);
        assert_eq!(snapshot.data.bins, offline.bins[..snapshot.data.bins.len()]);
        assert_eq!(
            snapshot.data.frame_start_seconds,
            offline.frame_start_seconds[..snapshot.data.bins.len()]
        );
        let began = std::time::Instant::now();
        for _ in 0..10 {
            for chunk in pcm.chunks(2400) {
                live.push(chunk);
            }
        }
        let compute = began.elapsed();
        let snapshot = live.snapshot();
        assert!(snapshot.data.bins.len() <= 610);
        assert!(snapshot.data.frame_start_seconds[0] >= snapshot.end_seconds - 12.1);
        let cursor = snapshot.data.frame_start_seconds.last().copied();
        assert!(live.snapshot_since(cursor).data.bins.is_empty());
        live.push(&pcm[..9600]);
        let delta = live.snapshot_since(cursor);
        assert_eq!(delta.data.bins.len(), 10);
        assert!(
            delta
                .data
                .frame_start_seconds
                .iter()
                .all(|t| *t > cursor.unwrap())
        );
        let began = std::time::Instant::now();
        let bytes = serde_json::to_vec(&delta).unwrap();
        eprintln!(
            "20s of 48kHz live analysis: {:?}; 200ms delta: {} bytes, JSON encoding {:?}",
            compute,
            bytes.len(),
            began.elapsed()
        );
    }
}
