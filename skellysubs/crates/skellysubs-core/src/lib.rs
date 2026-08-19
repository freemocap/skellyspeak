//! SkellySubs Core: domain logic for SkellySubs v2, a cross-language
//! conversation partner (transcription + translation + word alignment +
//! subtitles).
//!
//! Ports the proven behavior of the original python-only branch:
//!   1. full-text translation
//!   2. segment-level translation
//!   3. word-level matching (many-to-one alignment with timestamps)
//! plus subtitle formatters and the 78-language config from the main branch.

pub mod languages;
pub mod llm;
pub mod models;
pub mod subtitles;
pub mod translation;
pub mod tutor;

pub use models::{
    LanguageBackground, LanguageConfig, MatchedTranslatedSegment, MatchedTranslatedWord,
    TranscriptSegment, Transcription, TranslatedSegment, TranslatedText, TutorReply, WordTimestamp,
};
