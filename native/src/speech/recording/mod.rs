#[cfg(desktop)]
pub(crate) mod audio;
mod browser_capture;
pub(crate) mod continuous;
pub(crate) mod continuous_policy;
pub(crate) mod microphone;
pub(crate) mod owner;
pub(crate) mod results;
mod segmentation;
pub(crate) mod transcription;
pub(crate) mod voice;
mod wav;

mod preflight;
