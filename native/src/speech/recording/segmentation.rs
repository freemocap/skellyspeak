//! Streaming activity boundaries. Silence is a heuristic, never a linguistic verdict.
use super::continuous_policy::{ListeningSettings, POLICY};
use crate::speech::analysis::fluency::frame_energy_db;
use std::collections::VecDeque;

pub(super) struct Clip {
    pub samples: Vec<f32>,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub cut_seconds: f64,
}
/// What the detector is measuring right now, for the level meter.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct Levels {
    pub level_db: f64,
    /// The measured room noise, once a quiet frame has been heard. It is shown
    /// beside the threshold for reference and does not move the threshold.
    pub noise_floor_db: Option<f64>,
    pub threshold_db: f64,
}
pub(super) struct Segmenter {
    cursor: usize,
    clip_start: usize,
    rate: u32,
    width: usize,
    pause_frames: usize,
    threshold_db: f64,
    min_voiced_frames: usize,
    levels: Levels,
    ignored: u32,
    remainder: Vec<f32>,
    preroll: VecDeque<Vec<f32>>,
    noise: VecDeque<f64>,
    clip: Vec<f32>,
    voiced: usize,
    quiet: usize,
    silent_frames: usize,
    silence_timeout_frames: usize,
    silence_expired: bool,
    onset: usize,
}
impl Segmenter {
    pub fn new(rate: u32, settings: ListeningSettings) -> Result<Self, String> {
        if !(8000..=192000).contains(&rate) {
            return Err("The microphone sample rate is not supported.".into());
        }
        settings.validate()?;
        Ok(Self {
            cursor: 0,
            clip_start: 0,
            rate,
            width: rate as usize / 50,
            pause_frames: settings.pause_ms.div_ceil(20) as usize,
            threshold_db: settings.threshold_db,
            min_voiced_frames: settings.min_take_ms.div_ceil(20) as usize,
            levels: Levels {
                level_db: -120.0,
                noise_floor_db: None,
                threshold_db: settings.threshold_db,
            },
            ignored: 0,
            remainder: vec![],
            preroll: VecDeque::new(),
            noise: VecDeque::new(),
            clip: vec![],
            voiced: 0,
            quiet: 0,
            silent_frames: 0,
            silence_timeout_frames: settings.silence_timeout_ms.div_ceil(20) as usize,
            silence_expired: false,
            onset: 0,
        })
    }
    pub fn set_offset(&mut self, samples: usize) {
        self.cursor = samples;
    }
    /// Apply new boundary choices from the next frame on; a take in progress keeps going.
    pub fn tune(&mut self, settings: ListeningSettings) -> Result<(), String> {
        settings.validate()?;
        self.silence_timeout_frames = settings.silence_timeout_ms.div_ceil(20) as usize;
        self.pause_frames = settings.pause_ms.div_ceil(20) as usize;
        self.threshold_db = settings.threshold_db;
        self.min_voiced_frames = settings.min_take_ms.div_ceil(20) as usize;
        self.levels.threshold_db = settings.threshold_db;
        Ok(())
    }
    pub fn levels(&self) -> Levels {
        self.levels
    }
    /// Takes that ended with less voiced time than the shortest take allowed.
    pub fn ignored(&self) -> u32 {
        self.ignored
    }
    pub fn silence_expired(&self) -> bool {
        self.silence_expired
    }
    pub fn speaking(&self) -> bool {
        !self.clip.is_empty()
    }
    pub fn push(&mut self, samples: &[f32]) -> Result<Vec<Clip>, String> {
        if samples.iter().any(|s| !s.is_finite()) {
            return Err("Invalid microphone samples.".into());
        }
        self.remainder.extend_from_slice(samples);
        let end = self.remainder.len() / self.width * self.width;
        let frames: Vec<f32> = self.remainder.drain(..end).collect();
        let mut completed = vec![];
        let mut peak = f64::NEG_INFINITY;
        for frame in frames.chunks_exact(self.width) {
            if self.silence_expired {
                break;
            }
            self.cursor += self.width;
            let energy = frame_energy_db(frame.iter().map(|s| f64::from(*s)));
            peak = peak.max(energy);
            let active = energy > self.threshold_db;
            self.silent_frames = if active { 0 } else { self.silent_frames + 1 };
            if self.silent_frames >= self.silence_timeout_frames {
                self.silence_expired = true;
                break;
            }
            if self.clip.is_empty() {
                self.preroll.push_back(frame.to_vec());
                if self.preroll.len() > 10 {
                    self.preroll.pop_front();
                }
                if active {
                    self.onset += 1;
                } else {
                    self.onset = 0;
                }
                // Room noise is learned only while idle and quiet, for display.
                if !active {
                    self.noise.push_back(energy);
                    if self.noise.len() > 100 {
                        self.noise.pop_front();
                    }
                    let mut floor: Vec<_> = self.noise.iter().copied().collect();
                    floor.sort_by(f64::total_cmp);
                    self.levels.noise_floor_db = Some(floor[(floor.len() - 1) / 5]);
                }
                if self.onset >= 6 {
                    self.clip = self.preroll.drain(..).flatten().collect();
                    self.clip_start = self.cursor - self.clip.len();
                    self.voiced = self.onset;
                    self.quiet = 0;
                    self.onset = 0;
                }
            } else {
                self.clip.extend_from_slice(frame);
                if active {
                    self.voiced += 1;
                    self.quiet = 0;
                } else {
                    self.quiet += 1;
                }
                if self.clip.len() > self.rate as usize * POLICY.max_take_seconds as usize {
                    return Err("A take exceeded 30 seconds. Listening stopped; the unfinished take was discarded.".into());
                }
                if self.quiet >= self.pause_frames
                    && let Some(clip) = self.finish()
                {
                    completed.push(clip);
                }
            }
        }
        if peak.is_finite() {
            self.levels.level_db = peak;
        }
        Ok(completed)
    }
    /// End at an explicit Stop: whatever sound is in progress is the take, even
    /// one that has not yet passed onset debounce or the shortest take. Stop is
    /// the learner's own boundary, not a guess from silence.
    pub fn finish_on_stop(&mut self) -> Option<Clip> {
        if self.clip.is_empty() && self.onset > 0 {
            self.clip = self.preroll.drain(..).flatten().collect();
            self.clip_start = self.cursor - self.clip.len();
            self.voiced = self.onset;
            self.quiet = 0;
        }
        self.finish_with(1)
    }
    pub fn finish(&mut self) -> Option<Clip> {
        self.finish_with(self.min_voiced_frames)
    }
    fn finish_with(&mut self, min_voiced_frames: usize) -> Option<Clip> {
        let mut clip = std::mem::take(&mut self.clip);
        // Retain 200 ms of trailing quiet instead of the entire inter-take pause.
        let trim = self.quiet.saturating_sub(10) * self.width;
        clip.truncate(clip.len().saturating_sub(trim));
        let started = !clip.is_empty();
        let valid = self.voiced >= min_voiced_frames;
        if started && !valid {
            self.ignored += 1;
        }
        self.voiced = 0;
        self.quiet = 0;
        self.onset = 0;
        self.preroll.clear();
        (valid && !clip.is_empty()).then(|| Clip {
            start_seconds: self.clip_start as f64 / self.rate as f64,
            end_seconds: (self.clip_start + clip.len()) as f64 / self.rate as f64,
            cut_seconds: self.cursor as f64 / self.rate as f64,
            samples: clip,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn settings(pause_ms: u32) -> ListeningSettings {
        ListeningSettings {
            pause_ms,
            silence_timeout_ms: 10000,
            threshold_db: -60.0,
            min_take_ms: 160,
        }
    }
    fn block(s: &mut Segmenter, seconds: f32, level: f32) -> Vec<Clip> {
        s.push(&vec![level; (8000.0 * seconds) as usize]).unwrap()
    }
    #[test]
    fn silence_timeout_counts_from_start_resets_on_sound_and_obeys_tuning() {
        let mut s = Segmenter::new(8000, settings(1000)).unwrap();
        block(&mut s, 9.98, 0.0);
        assert!(!s.silence_expired());
        block(&mut s, 0.02, 0.0);
        assert!(s.silence_expired());
        // Sound later in the same buffered upload cannot restart a timed-out run.
        assert!(block(&mut s, 1.0, 0.1).is_empty());
        let mut s = Segmenter::new(8000, settings(1000)).unwrap();
        block(&mut s, 9.0, 0.0);
        block(&mut s, 0.5, 0.1);
        assert_eq!(block(&mut s, 1.0, 0.0).len(), 1);
        assert!(!s.silence_expired());
        s.tune(ListeningSettings {
            silence_timeout_ms: 5000,
            ..settings(1000)
        })
        .unwrap();
        block(&mut s, 4.0, 0.0);
        assert!(s.silence_expired());
        assert!(
            ListeningSettings {
                silence_timeout_ms: 0,
                ..settings(1000)
            }
            .validate()
            .is_err()
        );
    }
    #[test]
    fn three_repetitions_split_and_short_hesitation_does_not() {
        let mut s = Segmenter::new(8000, settings(1000)).unwrap();
        assert!(block(&mut s, 1.0, 0.0).is_empty());
        for _ in 0..3 {
            assert!(block(&mut s, 0.5, 0.1).is_empty());
            assert!(block(&mut s, 0.4, 0.0).is_empty());
            assert!(block(&mut s, 0.5, 0.1).is_empty());
            assert_eq!(block(&mut s, 1.2, 0.0).len(), 1);
        }
        assert!(!s.speaking());
        assert!(s.finish().is_none());
    }
    #[test]
    fn silence_clicks_partial_frames_and_stop_are_bounded() {
        let mut s = Segmenter::new(
            8000,
            ListeningSettings {
                silence_timeout_ms: 15000,
                ..settings(600)
            },
        )
        .unwrap();
        assert!(block(&mut s, 10.0, 0.0).is_empty());
        assert!(block(&mut s, 0.04, 0.5).is_empty());
        assert!(block(&mut s, 1.0, 0.0).is_empty());
        for _ in 0..200 {
            s.push(&[0.1; 13]).unwrap();
        }
        assert!(s.finish().is_some());
        assert!(s.finish().is_none());
        assert!(s.push(&[f32::NAN]).is_err());
        assert!(Segmenter::new(8000, settings(100)).is_err());
    }
    #[test]
    fn cut_bounds_match_retained_pcm_and_survive_a_discard_offset() {
        let mut segmenter = Segmenter::new(8000, settings(1000)).unwrap();
        segmenter.set_offset(8000 * 7);
        block(&mut segmenter, 1.0, 0.0);
        block(&mut segmenter, 0.5, 0.1);
        let clips = block(&mut segmenter, 1.2, 0.0);
        assert_eq!(clips.len(), 1);
        let clip = &clips[0];
        assert!(clip.start_seconds >= 7.8 && clip.start_seconds <= 8.0);
        assert!(
            (clip.end_seconds - clip.start_seconds - clip.samples.len() as f64 / 8000.0).abs()
                < 1e-9
        );
        assert!((clip.cut_seconds - clip.end_seconds - 0.8).abs() < 1e-9);
    }
    #[test]
    fn short_bursts_below_the_shortest_take_are_counted_and_dropped() {
        let mut s = Segmenter::new(
            8000,
            ListeningSettings {
                min_take_ms: 600,
                ..settings(600)
            },
        )
        .unwrap();
        assert!(block(&mut s, 1.0, 0.0).is_empty());
        // About 0.3 s of sound: enough to open a take, too short to keep.
        assert!(block(&mut s, 0.3, 0.1).is_empty());
        assert!(block(&mut s, 1.0, 0.0).is_empty());
        assert_eq!(s.ignored(), 1);
        assert!(block(&mut s, 0.8, 0.1).is_empty());
        assert_eq!(block(&mut s, 1.0, 0.0).len(), 1);
        assert_eq!(s.ignored(), 1);
    }
    #[test]
    fn a_higher_threshold_ignores_sound_a_lower_one_keeps() {
        let quiet = 0.003; // about -50 dBFS
        let mut sensitive = Segmenter::new(8000, settings(600)).unwrap();
        let mut strict = Segmenter::new(
            8000,
            ListeningSettings {
                threshold_db: -40.0,
                ..settings(600)
            },
        )
        .unwrap();
        for s in [&mut sensitive, &mut strict] {
            block(s, 1.0, 0.0005);
            block(s, 0.6, quiet);
        }
        assert_eq!(block(&mut sensitive, 1.0, 0.0005).len(), 1);
        assert!(block(&mut strict, 1.0, 0.0005).is_empty());
        let levels = strict.levels();
        assert_eq!(levels.threshold_db, -40.0);
        assert!(levels.noise_floor_db.is_some_and(|noise| noise < -60.0));
        assert!(levels.level_db < levels.threshold_db);
    }
    #[test]
    fn the_threshold_stays_where_it_is_set_while_room_noise_changes() {
        let mut s = Segmenter::new(8000, settings(600)).unwrap();
        assert_eq!(s.levels().noise_floor_db, None);
        assert_eq!(s.levels().threshold_db, -60.0);
        block(&mut s, 1.0, 0.0002); // about -74 dBFS
        let quiet_room = s.levels().noise_floor_db.unwrap();
        block(&mut s, 3.0, 0.0008); // about -62 dBFS
        let louder_room = s.levels().noise_floor_db.unwrap();
        assert!(louder_room > quiet_room + 6.0);
        assert_eq!(s.levels().threshold_db, -60.0);
        // Set below the room noise, the learner's choice still stands.
        s.tune(ListeningSettings {
            threshold_db: -80.0,
            ..settings(600)
        })
        .unwrap();
        assert_eq!(s.levels().threshold_db, -80.0);
    }
    #[test]
    fn tuning_rejects_out_of_policy_values_and_moves_the_threshold() {
        let mut s = Segmenter::new(8000, settings(1000)).unwrap();
        block(&mut s, 1.0, 0.0005);
        s.tune(ListeningSettings {
            threshold_db: -30.0,
            ..settings(1000)
        })
        .unwrap();
        assert_eq!(s.levels().threshold_db, -30.0);
        for out_of_policy in [-81.0, -5.0, f64::NAN] {
            assert!(
                s.tune(ListeningSettings {
                    threshold_db: out_of_policy,
                    ..settings(1000)
                })
                .is_err()
            );
        }
        assert!(
            s.tune(ListeningSettings {
                min_take_ms: 50,
                ..settings(1000)
            })
            .is_err()
        );
    }
    #[test]
    fn stop_sends_the_sound_in_progress_however_short_and_nothing_in_silence() {
        let strict = || {
            Segmenter::new(
                8000,
                ListeningSettings {
                    min_take_ms: 1000,
                    ..settings(1000)
                },
            )
            .unwrap()
        };
        // Mid-take, shorter than the shortest take: Stop still sends it.
        let mut s = strict();
        block(&mut s, 1.0, 0.0);
        block(&mut s, 0.4, 0.1);
        assert!(s.speaking());
        let clip = s.finish_on_stop().unwrap();
        assert!(clip.end_seconds - clip.start_seconds >= 0.4);
        // Sound that has not yet passed onset debounce is still the take.
        let mut s = strict();
        block(&mut s, 1.0, 0.0);
        block(&mut s, 0.06, 0.1);
        assert!(!s.speaking());
        assert!(s.finish_on_stop().is_some());
        // Stopping in silence sends nothing.
        let mut s = strict();
        block(&mut s, 1.0, 0.0);
        assert!(s.finish_on_stop().is_none());
    }
    #[test]
    fn long_unbroken_audio_fails_explicitly() {
        let mut s = Segmenter::new(8000, settings(1000)).unwrap();
        assert!(s.push(&vec![0.1; 8000 * 31]).is_err());
    }
}
