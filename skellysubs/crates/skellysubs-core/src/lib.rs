//! SkellySubs Core: domain logic for SkellySubs v2, a cross-language
//! conversation partner (transcription + translation + word alignment +
//! subtitles).
//!
//! Ports the proven behavior of the original python-only branch:
//!   1. full-text translation
//!   2. segment-level translation
//!   3. word-level matching (many-to-one alignment with timestamps)
//! plus subtitle formatters and the 78-language config from the main branch.

pub mod grammar;
pub mod languages;
pub mod llm;
pub mod models;
pub mod providers;
pub mod subtitles;
pub mod translation;
pub mod tutor;

pub use models::{
    LanguageBackground, LanguageConfig, MatchedTranslatedSegment, MatchedTranslatedWord,
    TranscriptSegment, Transcription, TranslatedSegment, TranslatedText, TutorReply, WordTimestamp,
};

pub use grammar::{
    run_turn, run_turn_with_reply, Card, CardLibrary, Construction, Feature, FeatureEvent,
    LearnerModel, SpanishLlmAnalyzer, Token, Trigger, TutorTurn,
};

pub use providers::{
    ApiFormat, LlmClient, LlmProviderConfig, ProviderMode, ProviderSettings, SttProviderConfig,
};

pub use tutor::HistoryTurn;
