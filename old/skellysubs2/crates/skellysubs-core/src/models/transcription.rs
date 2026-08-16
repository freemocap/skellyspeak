//! Transcription domain types.
//!
//! These mirror transcribe.cpp's result shape (word/segment timestamps in
//! milliseconds) so the transcription driver can map 1:1 onto them.

use serde::{Deserialize, Serialize};

/// One word with its timing (milliseconds, relative to audio start).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct WordTimestamp {
    pub start_ms: i64,
    pub end_ms: i64,
    pub text: String,
    pub index_in_segment: i32,
    pub index_in_transcript: i32,
}

/// One timestamped segment with its words.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub start_ms: i64,
    pub end_ms: i64,
    pub text: String,
    pub words: Vec<WordTimestamp>,
}

/// A complete transcription.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Transcription {
    pub language: String,
    pub text: String,
    pub segments: Vec<TranscriptSegment>,
}

impl Transcription {
    pub fn words(&self) -> impl Iterator<Item = &WordTimestamp> {
        self.segments.iter().flat_map(|s| s.words.iter())
    }
}
