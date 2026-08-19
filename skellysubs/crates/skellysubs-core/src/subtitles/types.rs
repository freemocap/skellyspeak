//! Subtitle domain types.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SubtitleVariant {
    OriginalSpoken,
    TranslationOnly,
    TranslationWithRomanization,
    MultiLanguage,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SubtitleFormat {
    Srt,
    Vtt,
    Md,
    Ass,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SubtitleSegment {
    pub start_ms: i64,
    pub end_ms: i64,
    pub original_text: String,
    pub translated_text: String,
    pub romanized_text: Option<String>,
}

impl SubtitleSegment {
    pub fn has_romanization(&self) -> bool {
        self.romanized_text
            .as_deref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
    }
}
