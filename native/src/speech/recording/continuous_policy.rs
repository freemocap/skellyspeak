//! Versioned bounds shared by native capture and its controls.
use serde::{Deserialize, Serialize};
use ts_rs::TS;
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContinuousRecordingPolicy {
    pub version: u32,
    pub pause_options_ms: [u32; 5],
    pub default_pause_ms: u32,
    pub silence_timeout_options_ms: [u32; 5],
    pub default_silence_timeout_ms: u32,
    /// How far above the measured room noise a frame must be to count as speech.
    pub min_threshold_offset_db: f64,
    pub max_threshold_offset_db: f64,
    pub default_threshold_offset_db: f64,
    /// Voiced time a take needs before it is kept; shorter bursts are ignored.
    pub min_take_options_ms: [u32; 4],
    pub default_min_take_ms: u32,
    pub max_pending_takes: u32,
    pub max_take_seconds: u32,
    pub max_session_seconds: u32,
    pub max_takes: u32,
}
pub const POLICY: ContinuousRecordingPolicy = ContinuousRecordingPolicy {
    version: 3,
    pause_options_ms: [600, 1000, 1500, 2000, 2500],
    default_pause_ms: 1000,
    silence_timeout_options_ms: [5000, 10000, 15000, 30000, 60000],
    default_silence_timeout_ms: 10000,
    min_threshold_offset_db: 4.0,
    max_threshold_offset_db: 30.0,
    default_threshold_offset_db: 16.0,
    min_take_options_ms: [160, 300, 600, 1000],
    default_min_take_ms: 300,
    max_pending_takes: 3,
    max_take_seconds: 30,
    max_session_seconds: 600,
    max_takes: 100,
};

/// The learner's boundary choices for one listening run. They can change while
/// listening; each change applies from the next analysed frame.
#[derive(Clone, Copy, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ListeningSettings {
    pub pause_ms: u32,
    pub silence_timeout_ms: u32,
    pub threshold_offset_db: f64,
    pub min_take_ms: u32,
}
impl ListeningSettings {
    pub fn validate(&self) -> Result<(), String> {
        if !(POLICY.pause_options_ms[0]..=POLICY.pause_options_ms[4]).contains(&self.pause_ms) {
            return Err("Choose a pause between 600 and 2500 milliseconds.".into());
        }
        if !self.threshold_offset_db.is_finite()
            || !(POLICY.min_threshold_offset_db..=POLICY.max_threshold_offset_db)
                .contains(&self.threshold_offset_db)
        {
            return Err("Choose a threshold between 4 and 30 dB above the room noise.".into());
        }
        if !(POLICY.min_take_options_ms[0]..=POLICY.min_take_options_ms[3])
            .contains(&self.min_take_ms)
        {
            return Err("Choose a shortest take between 160 and 1000 milliseconds.".into());
        }
        if !(POLICY.silence_timeout_options_ms[0]..=POLICY.silence_timeout_options_ms[4])
            .contains(&self.silence_timeout_ms)
        {
            return Err("Choose a silence timeout between 5 and 60 seconds.".into());
        }
        Ok(())
    }
}
