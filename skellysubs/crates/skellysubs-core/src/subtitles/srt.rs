//! SubRip (SRT) formatter.

use super::time::format_srt_time;
use super::types::SubtitleSegment;

fn format_segment(index: usize, start_ms: i64, end_ms: i64, text: &str) -> String {
    format!(
        "{}\n{} --> {}\n{}",
        index,
        format_srt_time(start_ms),
        format_srt_time(end_ms),
        text
    )
}

pub fn original_spoken(segments: &[SubtitleSegment]) -> String {
    segments
        .iter()
        .enumerate()
        .map(|(i, s)| format_segment(i + 1, s.start_ms, s.end_ms, s.original_text.trim()))
        .collect::<Vec<_>>()
        .join("\n\n")
}

pub fn translation_only(segments: &[SubtitleSegment]) -> String {
    segments
        .iter()
        .enumerate()
        .map(|(i, s)| format_segment(i + 1, s.start_ms, s.end_ms, s.translated_text.trim()))
        .collect::<Vec<_>>()
        .join("\n\n")
}

pub fn with_romanization(segments: &[SubtitleSegment]) -> String {
    segments
        .iter()
        .enumerate()
        .map(|(i, s)| {
            let text = format!(
                "{}\n{}",
                s.translated_text.trim(),
                s.romanized_text.as_deref().unwrap_or("").trim()
            );
            format_segment(i + 1, s.start_ms, s.end_ms, &text)
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

pub fn multi_language(segments: &[SubtitleSegment]) -> String {
    segments
        .iter()
        .enumerate()
        .map(|(i, s)| {
            let mut parts = vec![s.original_text.trim().to_string(), s.translated_text.trim().to_string()];
            if s.has_romanization() {
                parts.push(s.romanized_text.as_deref().unwrap_or("").trim().to_string());
            }
            format_segment(i + 1, s.start_ms, s.end_ms, &parts.join("\n"))
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seg() -> SubtitleSegment {
        SubtitleSegment {
            start_ms: 0,
            end_ms: 1000,
            original_text: "Hello world".into(),
            translated_text: "Hola mundo".into(),
            romanized_text: Some("hola mundo".into()),
        }
    }

    #[test]
    fn original_block() {
        assert_eq!(
            original_spoken(&[seg()]),
            "1\n00:00:00,000 --> 00:00:01,000\nHello world"
        );
    }

    #[test]
    fn translation_block_has_no_romanization() {
        let out = translation_only(&[seg()]);
        assert!(out.contains("Hola mundo"));
        assert!(!out.contains("hola mundo"));
    }

    #[test]
    fn romanization_second_line() {
        let out = with_romanization(&[seg()]);
        assert!(out.contains("Hola mundo\nhola mundo"));
    }

    #[test]
    fn multi_language_three_lines() {
        let out = multi_language(&[seg()]);
        assert!(out.contains("Hello world\nHola mundo\nhola mundo"));
    }
}
