//! Apply the recording threshold before encoding or generating a clip preview.
use super::segmentation::Clip;
use crate::speech::analysis::fluency::frame_energy_db;

/// Keep 100 ms around the first/last active 20 ms frame. Interior pauses stay
/// untouched. Boundaries retain the live microphone clock; cut time is unchanged.
/// A wholly below-threshold clip has no active audio to submit.
pub(super) fn trim(mut clip: Clip, rate: u32, threshold_db: f64) -> Option<Clip> {
    let width = (rate as usize / 50).max(1);
    let padding = rate as usize / 10;
    let active = |frame: &&[f32]| {
        frame_energy_db(frame.iter().map(|sample| f64::from(*sample))) > threshold_db
    };
    let first = clip
        .samples
        .chunks(width)
        .position(|frame| active(&frame))?;
    let last = clip
        .samples
        .chunks(width)
        .rposition(|frame| active(&frame))?;
    let start = (first * width).saturating_sub(padding);
    let end = ((last + 1) * width + padding).min(clip.samples.len());
    let origin = clip.start_seconds;
    clip.samples.truncate(end);
    clip.samples.drain(..start);
    clip.start_seconds = origin + start as f64 / rate as f64;
    clip.end_seconds = origin + end as f64 / rate as f64;
    Some(clip)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clip(samples: Vec<f32>, rate: u32) -> Clip {
        Clip {
            start_seconds: 5.0,
            end_seconds: 5.0 + samples.len() as f64 / rate as f64,
            cut_seconds: 10.0,
            samples,
        }
    }

    #[test]
    fn trims_both_ends_preserving_padding_internal_pauses_and_clock() {
        for rate in [8000, 44100, 48000] {
            let tenth = rate as usize / 10;
            let samples = [
                vec![0.001; tenth * 4],
                vec![0.2; tenth * 3],
                vec![0.0; tenth * 5],
                vec![0.2; tenth * 2],
                vec![0.001; tenth * 6],
            ]
            .concat();
            let result = trim(clip(samples.clone(), rate), rate, -40.0).unwrap();
            assert_eq!(result.samples, samples[tenth * 3..tenth * 15]);
            assert!((result.start_seconds - 5.3).abs() < 1e-9);
            assert!((result.end_seconds - 6.5).abs() < 1e-9);
            assert_eq!(result.cut_seconds, 10.0);
        }
    }

    #[test]
    fn preserves_short_padding_and_partial_active_frames() {
        let samples = [vec![0.0; 400], vec![0.2; 163], vec![0.0; 400]].concat();
        let result = trim(clip(samples.clone(), 8000), 8000, -40.0).unwrap();
        assert_eq!(result.samples, samples);
        assert_eq!(result.start_seconds, 5.0);
        assert!(trim(clip(vec![0.2; 17], 8000), 8000, -40.0).is_some());
    }

    #[test]
    fn uses_the_selected_threshold_and_ignores_silent_clips() {
        assert!(trim(clip(vec![0.001; 8000], 8000), 8000, -40.0).is_none());
        assert!(trim(clip(vec![0.001; 8000], 8000), 8000, -80.0).is_some());
        assert!(trim(clip(vec![], 8000), 8000, -40.0).is_none());
    }
}
