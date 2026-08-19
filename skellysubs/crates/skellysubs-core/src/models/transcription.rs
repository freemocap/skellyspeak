//! Transcription domain types. Mirrors transcribe.cpp's result shape
//! (word/segment timestamps in milliseconds).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct WordTimestamp {
    pub start_ms: i64,
    pub end_ms: i64,
    pub text: String,
    pub index_in_segment: i32,
    pub index_in_transcript: i32,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub start_ms: i64,
    pub end_ms: i64,
    pub text: String,
    pub words: Vec<WordTimestamp>,
}

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

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Transcription {
        Transcription {
            language: "english".into(),
            text: "Hi there".into(),
            segments: vec![TranscriptSegment {
                start_ms: 0,
                end_ms: 1000,
                text: "Hi there".into(),
                words: vec![
                    WordTimestamp {
                        start_ms: 0,
                        end_ms: 400,
                        text: "Hi".into(),
                        index_in_segment: 0,
                        index_in_transcript: 0,
                    },
                    WordTimestamp {
                        start_ms: 500,
                        end_ms: 900,
                        text: "there".into(),
                        index_in_segment: 1,
                        index_in_transcript: 1,
                    },
                ],
            }],
        }
    }

    #[test]
    fn words_iterates_all_words() {
        assert_eq!(sample().words().count(), 2);
    }

    #[test]
    fn transcription_round_trips() {
        let s = serde_json::to_string(&sample()).unwrap();
        let rt: Transcription = serde_json::from_str(&s).unwrap();
        assert_eq!(rt, sample());
    }
}
