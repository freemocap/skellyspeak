//! Clip boundaries can change without changing microphone ownership or its clock.
use super::{
    continuous_policy::{ListeningMode, ListeningSettings, POLICY},
    segmentation::{Clip, Segmenter},
};

pub(super) struct ClipCapture {
    pub detector: Segmenter,
    mode: ListeningMode,
    rate: u32,
    cursor: usize,
    manual_start: usize,
    manual: Vec<f32>,
    ignored: u32,
}
impl ClipCapture {
    pub fn new(rate: u32, settings: ListeningSettings, offset: usize) -> Result<Self, String> {
        let mut detector = Segmenter::new(rate, settings)?;
        detector.set_offset(offset);
        Ok(Self {
            detector,
            mode: ListeningMode::Auto,
            rate,
            cursor: offset,
            manual_start: offset,
            manual: vec![],
            ignored: 0,
        })
    }
    pub fn ignored(&self) -> u32 {
        self.ignored + self.detector.ignored()
    }
    pub fn speaking(&self) -> bool {
        self.mode == ListeningMode::Manual
            || (self.mode == ListeningMode::Auto && self.detector.speaking())
    }
    pub fn finish(&mut self) -> Option<Clip> {
        if self.mode == ListeningMode::Auto {
            return self.detector.finish_on_stop();
        }
        if self.manual.is_empty() {
            return None;
        }
        Some(Clip {
            samples: std::mem::take(&mut self.manual),
            start_seconds: self.manual_start as f64 / self.rate as f64,
            end_seconds: self.cursor as f64 / self.rate as f64,
            cut_seconds: self.cursor as f64 / self.rate as f64,
        })
    }
    pub fn push(
        &mut self,
        pcm: &[f32],
        mode: ListeningMode,
        settings: ListeningSettings,
    ) -> Result<Vec<Clip>, String> {
        let mut clips = vec![];
        if mode != self.mode {
            // Turning auto off or ending a manual take closes its current boundary.
            if let Some(clip) = self.finish() {
                clips.push(clip);
            }
            self.ignored += self.detector.ignored();
            self.detector = Segmenter::new(self.rate, settings)?;
            self.detector.set_offset(self.cursor);
            self.manual_start = self.cursor;
            self.mode = mode;
        }
        self.detector.tune(settings)?;
        if mode != ListeningMode::Auto {
            // Measure levels while monitoring, without accumulating hidden auto takes
            // or allowing the silence timeout to stop a deliberately live microphone.
            self.detector = Segmenter::new(self.rate, settings)?;
            self.detector.set_offset(self.cursor);
        }
        let automatic = self.detector.push(pcm)?;
        if mode == ListeningMode::Auto {
            clips.extend(automatic);
        }
        if mode == ListeningMode::Manual {
            if self.manual.len() + pcm.len() > self.rate as usize * POLICY.max_take_seconds as usize
            {
                return Err("A take exceeded 30 seconds. Listening stopped; the unfinished take was discarded.".into());
            }
            self.manual.extend_from_slice(pcm);
        }
        self.cursor += pcm.len();
        Ok(clips)
    }
    pub fn silence_expired(&self) -> bool {
        self.mode == ListeningMode::Auto && self.detector.silence_expired()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn monitoring_keeps_the_clock_and_manual_boundaries_do_not_depend_on_silence() {
        let settings = ListeningSettings {
            pause_ms: 600,
            threshold_db: -45.0,
            min_take_ms: 300,
            silence_timeout_ms: 5000,
        };
        let mut capture = ClipCapture::new(8000, settings, 0).unwrap();
        for _ in 0..120 {
            assert!(
                capture
                    .push(&[0.0; 400], ListeningMode::Monitor, settings)
                    .unwrap()
                    .is_empty()
            );
        }
        assert!(!capture.silence_expired());
        capture
            .push(&[0.1; 4000], ListeningMode::Manual, settings)
            .unwrap();
        capture
            .push(&[0.0; 4000], ListeningMode::Manual, settings)
            .unwrap();
        let clips = capture
            .push(&[0.0; 400], ListeningMode::Monitor, settings)
            .unwrap();
        assert_eq!(clips.len(), 1);
        assert_eq!(clips[0].samples.len(), 8000);
        assert_eq!(clips[0].start_seconds, 6.0);
        assert_eq!(clips[0].end_seconds, 7.0);
        assert!(capture.finish().is_none());
    }
}
