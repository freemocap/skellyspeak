//! # SkellySubs Core
//!
//! Domain logic for SkellySubs v2 — a local, multilingual, **word-aligned**
//! transcription + translation + subtitling engine.
//!
//! This crate ports the proven behavior of the original `python-only` branch:
//!
//! 1. **Full-text translation** of the transcript.
//! 2. **Segment-level translation** with full-text context.
//! 3. **Word-level matching** — a many-to-one alignment of each spoken word to
//!    its closest word in every target language (the signature feature).
//!
//! plus the subtitle formatters (SRT/VTT/MD) and the 78-language configuration
//! dataset from the `main` branch.
//!
//! ## Design notes vs. the original
//!
//! * **Language configs are normalized** — words store a *language key*, never a
//!   full `LanguageConfig`. The original duplicated the whole config on every
//!   matched word (a 40k-line JSON bloat); we don't.
//! * **Word matching returns only alignment data.** The redundant
//!   `target_language_config` / `original_language` fields the old LLM schema
//!   echoed are dropped: the orchestrator already knows the (segment, language)
//!   context and fills them in.
//! * **Timestamps are milliseconds** (`i64`), matching transcribe.cpp's native
//!   `t0_ms`/`t1_ms`.

pub mod languages;
pub mod llm;
pub mod models;
pub mod subtitles;
pub mod translation;

pub use models::{
    LanguageBackground, LanguageConfig, MatchedTranslatedSegment, MatchedTranslatedWord,
    TranscriptSegment, Transcription, TranslatedText, WordTimestamp,
};
