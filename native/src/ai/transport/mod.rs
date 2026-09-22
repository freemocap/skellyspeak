pub mod grouped;
pub mod provider;
pub(super) mod speech_provider;
pub mod streaming;
pub(super) mod transcription_provider;

pub(super) mod service_audio;

mod transcription_adapters;
pub(crate) mod whisper_transcript;

mod transcription_context;
