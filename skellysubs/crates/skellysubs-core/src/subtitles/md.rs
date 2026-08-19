//! Markdown formatter (readable transcript view).

use super::time::format_markdown_time;
use super::types::SubtitleSegment;

pub fn original_spoken(segments: &[SubtitleSegment]) -> String {
    let mut out = vec!["# Transcript".to_string()];
    for s in segments {
        out.push(format!("\n[{}] {}", format_markdown_time(s.start_ms), s.original_text.trim()));
    }
    out.join("\n")
}

pub fn translation_only(segments: &[SubtitleSegment]) -> String {
    let mut out = vec!["# Transcript".to_string()];
    for s in segments {
        out.push(format!("\n[{}] {}", format_markdown_time(s.start_ms), s.translated_text.trim()));
    }
    out.join("\n")
}

pub fn with_romanization(segments: &[SubtitleSegment]) -> String {
    let mut out = vec!["# Transcript with Romanization".to_string()];
    for s in segments {
        out.push(format!("\n[{}] {}", format_markdown_time(s.start_ms), s.translated_text.trim()));
        if s.has_romanization() {
            out.push(format!("_{}_", s.romanized_text.as_deref().unwrap_or("").trim()));
        }
    }
    out.join("\n")
}

pub fn multi_language(segments: &[SubtitleSegment]) -> String {
    let mut out = vec!["# Transcript with Original Language".to_string()];
    for (i, s) in segments.iter().enumerate() {
        out.push(format!("\n> Segment#{} {}", i, format_markdown_time(s.start_ms)));
        out.push(format!("\n> {}", s.original_text.trim()));
        out.push(format!("\n> {}", s.translated_text.trim()));
        if s.has_romanization() {
            out.push(format!("\n> {}", s.romanized_text.as_deref().unwrap_or("").trim()));
        }
    }
    out.join("\n")
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
    fn original_has_timestamp() {
        let out = original_spoken(&[seg()]);
        assert!(out.contains("[00:00:00.000] Hello world"));
    }

    #[test]
    fn multi_language_has_original_and_translation() {
        let out = multi_language(&[seg()]);
        assert!(out.contains("Hello world"));
        assert!(out.contains("Hola mundo"));
        assert!(out.contains("hola mundo"));
    }
}
