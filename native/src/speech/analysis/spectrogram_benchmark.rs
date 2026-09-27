//! Explicit local measurement, excluded from routine correctness tests.
use super::*;
use std::{hint::black_box, time::Instant};

#[test]
#[ignore = "local spectrogram performance measurement"]
fn ten_second_resolution_cost() {
    for rate in [16000u32, 48000] {
        // Deterministic voiced harmonics with a changing envelope, no I/O timed.
        let samples: Vec<i16> = (0..rate * 10)
            .map(|i| {
                let t = i as f64 / rate as f64;
                let signal = (std::f64::consts::TAU * 180.0 * t).sin()
                    + 0.4 * (std::f64::consts::TAU * 730.0 * t).sin()
                    + 0.2 * (std::f64::consts::TAU * 2400.0 * t).sin();
                (signal * (0.5 + 0.4 * (t * 3.0).sin()) * 16000.0) as i16
            })
            .collect();
        for (name, bands, frames_per_second) in [
            ("baseline", 128, 50),
            ("bands_150", 192, 50),
            ("bands_200", 256, 50),
            ("time_150", 128, 75),
            ("time_200", 128, 100),
            ("both_150", 192, 75),
            ("both_200", 256, 100),
        ] {
            let mut compute = vec![];
            let mut encode = vec![];
            let mut bytes = 0;
            let mut frames = 0;
            for iteration in 0..12 {
                let start = Instant::now();
                let kernel = Kernel::with_bands(rate, bands);
                let hop = rate as usize / frames_per_second;
                let mut data = kernel.description.clone();
                data.frame_seconds = hop as f64 / rate as f64;
                for offset in (0..samples.len()).step_by(hop) {
                    data.bins.push(kernel.frame(black_box(&samples[offset..])));
                    data.frame_start_seconds.push(offset as f64 / rate as f64);
                }
                let elapsed = start.elapsed().as_secs_f64() * 1000.0;
                let start = Instant::now();
                bytes = black_box(serde_json::to_vec(black_box(&data)).unwrap()).len();
                let encoded = start.elapsed().as_secs_f64() * 1000.0;
                frames = data.bins.len();
                if iteration >= 2 {
                    compute.push(elapsed);
                    encode.push(encoded);
                }
            }
            compute.sort_by(f64::total_cmp);
            encode.sort_by(f64::total_cmp);
            eprintln!(
                "rate={rate} case={name} bands={bands} frames={frames} compute_ms={:.3} range_ms={:.3}..{:.3} json_ms={:.3} bytes={bytes}",
                (compute[4] + compute[5]) / 2.0,
                compute[0],
                compute[9],
                (encode[4] + encode[5]) / 2.0
            );
        }
    }
}
