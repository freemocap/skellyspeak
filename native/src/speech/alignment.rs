//! Generated audio and its original alignment travel as a single local result.
use crate::{
    model::*,
    speech::analysis::fluency::{TranscriptTiming, Word},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use unicode_segmentation::UnicodeSegmentation;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
pub struct CharacterAlignment {
    pub characters: Vec<String>,
    pub starts: Vec<f64>,
    pub ends: Vec<f64>,
}
impl CharacterAlignment {
    pub fn valid(&self, duration: f64) -> bool {
        let n = self.characters.len();
        n > 0
            && n <= 20000
            && n == self.starts.len()
            && n == self.ends.len()
            && self.characters.iter().map(String::len).sum::<usize>() <= 80000
            && self
                .characters
                .iter()
                .all(|s| !s.is_empty() && !s.contains('\0'))
            && self
                .starts
                .iter()
                .zip(&self.ends)
                .enumerate()
                .all(|(i, (start, end))| {
                    start.is_finite()
                        && end.is_finite()
                        && *start >= 0.0
                        && end >= start
                        && *end <= duration
                        && (i == 0 || *start >= self.starts[i - 1])
                })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn alignment(source: &str) -> SpeechAlignment {
        let text = format!("[voice cue]\n{source}");
        let characters: Vec<String> = text.chars().map(|c| c.to_string()).collect();
        let starts = (0..characters.len()).map(|i| i as f64 * 0.01).collect();
        let ends = (1..=characters.len()).map(|i| i as f64 * 0.01).collect();
        SpeechAlignment {
            source_text: source.into(),
            original: Some(CharacterAlignment {
                characters,
                starts,
                ends,
            }),
            normalized: None,
        }
    }

    #[test]
    fn source_projection_preserves_character_data_and_excludes_cues_across_scripts() {
        for source in [
            "Hola, café.",
            "مرحبا بالعالم",
            "你好世界",
            "नमस्ते दुनिया",
            "cafe\u{301}",
        ] {
            let original = alignment(source);
            let encoded =
                serde_json::to_vec(&SpeechAudio::new(b"wav", Some(original.clone()))).unwrap();
            let decoded = SpeechAudio::decode(&encoded).unwrap();
            assert_eq!(decoded.alignment.as_ref(), Some(&original));
            assert_eq!(decoded.wav().unwrap(), b"wav");
            let words = original.words(2.0).unwrap();
            assert_eq!(words.text, source);
            assert!(
                !words
                    .words
                    .iter()
                    .any(|w| w.word == "voice" || w.word == "cue")
            );
            assert!(words.words[0].start >= 0.12);
        }
    }

    #[test]
    fn invalid_or_ambiguous_alignment_cannot_become_word_evidence() {
        let mut value = alignment("Hola");
        value.original.as_mut().unwrap().ends[0] = 10.0;
        assert!(value.words(1.0).is_none());
        let mut value = alignment("Hola");
        value.source_text = "different".into();
        assert!(value.words(1.0).is_none());
        let mut value = alignment("Hola Hola");
        value.source_text = "Hola".into();
        assert!(value.words(1.0).is_none());
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SpeechAlignment {
    pub source_text: String,
    pub original: Option<CharacterAlignment>,
    pub normalized: Option<CharacterAlignment>,
}
impl SpeechAlignment {
    pub fn valid(&self, duration: f64) -> bool {
        self.source_text.len() <= 16384
            && !self.source_text.contains('\0')
            && self
                .original
                .iter()
                .chain(self.normalized.iter())
                .all(|a| a.valid(duration))
    }

    /// Derive word intervals using shared Unicode boundaries. Retain both source
    /// alignments unchanged. A cue or normalization mismatch cannot become evidence
    /// for a word the learner was shown: only an exact source span is projected.
    pub fn words(&self, duration: f64) -> Option<TranscriptTiming> {
        if !self.valid(duration) || self.source_text.is_empty() {
            return None;
        }
        for alignment in self.normalized.iter().chain(self.original.iter()) {
            let text = alignment.characters.concat();
            let mut matches = text.match_indices(&self.source_text);
            let Some((offset, _)) = matches.next() else {
                continue;
            };
            if matches.next().is_some() {
                continue;
            }
            let mut cursor = 0;
            let spans: Vec<_> = alignment
                .characters
                .iter()
                .enumerate()
                .map(|(i, value)| {
                    let start = cursor;
                    cursor += value.len();
                    (start, cursor, i)
                })
                .collect();
            let words: Vec<_> = self
                .source_text
                .unicode_word_indices()
                .filter_map(|(start, word)| {
                    let begin = offset + start;
                    let end = begin + word.len();
                    let first = spans.iter().find(|(a, b, _)| *a <= begin && begin < *b)?.2;
                    let last = spans.iter().rfind(|(a, b, _)| *a < end && end <= *b)?.2;
                    Some(Word {
                        word: word.into(),
                        start: alignment.starts[first],
                        end: alignment.ends[last],
                    })
                })
                .collect();
            if !words.is_empty() {
                return Some(TranscriptTiming {
                    text: self.source_text.clone(),
                    duration,
                    words,
                });
            }
        }
        None
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SpeechAudio {
    pub audio_base64: String,
    pub alignment: Option<SpeechAlignment>,
}
impl SpeechAudio {
    pub fn new(wav: &[u8], alignment: Option<SpeechAlignment>) -> Self {
        Self {
            audio_base64: STANDARD.encode(wav),
            alignment,
        }
    }
    pub fn decode(payload: &[u8]) -> Result<Self> {
        serde_json::from_slice(payload)
            .map_err(|_| AppError::new(ErrorCode::Storage, "Saved speech result is invalid."))
    }
    pub fn wav(&self) -> Result<Vec<u8>> {
        STANDARD
            .decode(&self.audio_base64)
            .map_err(|_| AppError::new(ErrorCode::Storage, "Saved speech audio is invalid."))
    }
}
