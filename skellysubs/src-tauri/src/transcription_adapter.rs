//! Adapter: transcribe-cpp Transcript -> skellysubs-core::Transcription.

use skellysubs_core::models::{TranscriptSegment, Transcription, WordTimestamp};

/// Convert a transcribe-cpp result (which carries word/segment timestamps in
/// milliseconds) into our canonical Transcription type.
pub fn from_transcribe_cpp(t: &transcribe_cpp::Transcript) -> Transcription {
    let mut segments: Vec<TranscriptSegment> = t
        .segments
        .iter()
        .map(|s| TranscriptSegment {
            start_ms: s.t0_ms,
            end_ms: s.t1_ms,
            text: s.text.clone(),
            words: Vec::new(),
        })
        .collect();

    for (transcript_index, w) in t.words.iter().enumerate() {
        if w.seg_index >= 0 && (w.seg_index as usize) < segments.len() {
            let seg = &mut segments[w.seg_index as usize];
            let index_in_segment = seg.words.len() as i32;
            seg.words.push(WordTimestamp {
                start_ms: w.t0_ms,
                end_ms: w.t1_ms,
                text: w.text.clone(),
                index_in_segment,
                index_in_transcript: transcript_index as i32,
            });
        }
    }

    Transcription {
        language: t.language.clone().unwrap_or_default(),
        text: t.text.clone(),
        segments,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_transcript_with_word_timestamps() {
        let t = transcribe_cpp::Transcript {
            text: "Hello world".into(),
            language: Some("en".into()),
            segments: vec![transcribe_cpp::Segment {
                t0_ms: 0,
                t1_ms: 1000,
                text: "Hello world".into(),
                ..Default::default()
            }],
            words: vec![
                transcribe_cpp::Word {
                    t0_ms: 0,
                    t1_ms: 400,
                    seg_index: 0,
                    text: "Hello".into(),
                    ..Default::default()
                },
                transcribe_cpp::Word {
                    t0_ms: 500,
                    t1_ms: 900,
                    seg_index: 0,
                    text: "world".into(),
                    ..Default::default()
                },
            ],
            ..Default::default()
        };

        let tr = from_transcribe_cpp(&t);
        assert_eq!(tr.text, "Hello world");
        assert_eq!(tr.language, "en");
        assert_eq!(tr.segments.len(), 1);
        assert_eq!(tr.segments[0].words.len(), 2);
        assert_eq!(tr.segments[0].words[0].text, "Hello");
        assert_eq!(tr.segments[0].words[0].start_ms, 0);
        assert_eq!(tr.segments[0].words[0].end_ms, 400);
        assert_eq!(tr.segments[0].words[0].index_in_transcript, 0);
        assert_eq!(tr.segments[0].words[1].text, "world");
        assert_eq!(tr.segments[0].words[1].index_in_transcript, 1);
    }
}
