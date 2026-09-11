//! Serde data models shared across the crate.

mod language;
mod serde;
mod transcription;
mod translation;
mod word_match;

pub use language::{LanguageBackground, LanguageConfig};
pub use transcription::{TranscriptSegment, Transcription, WordTimestamp};
pub use translation::{TranslatedSegment, TranslatedText};
pub use word_match::{MatchedTranslatedSegment, MatchedTranslatedWord};
