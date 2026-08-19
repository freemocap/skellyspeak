//! WebVTT formatter.

use super::time::format_vtt_time;
use super::types::SubtitleSegment;

fn header(description: &str) -> String {
    format!("WEBVTT\nNOTE {description}\n\n")
}

fn cue(index: usize, start_ms: i64, end_ms: i64, text: &str) -> String {
    format!(
        "{}\n{} --> {}\n{}",
        index,
        format_vtt_time(start_ms),
        format_vtt_time(end_ms),
        text
    )
}

fn assemble(cues: Vec<String>) -> String {
    let mut out = header("SkellySubs generated captions");
    out.push_str(&cues.join("\n\n"));
    out.trim_end().to_string()
}

pub fn original_spoken(segments: &[SubtitleSegment]) -> String {
    assemble(
        segments
            .iter()
            .enumerate()
            .map(|(i, s)| cue(i + 1, s.start_ms, s.end_ms, s.original_text.trim()))
            .collect(),
    )
}

pub fn translation_only(segments: &[SubtitleSegment]) -> String {
    assemble(
        segments
            .iter()
            .enumerate()
            .map(|(i, s)| cue(i + 1, s.start_ms, s.end_ms, s.translated_text.trim()))
            .collect(),
    )
}

pub fn with_romanization(segments: &[SubtitleSegment]) -> String {
    assemble(
        segments
            .iter()
            .enumerate()
            .map(|(i, s)| {
                let text = format!(
                    "{}\n<i>{}</i>",
                    s.translated_text.trim(),
                    s.romanized_text.as_deref().unwrap_or("").trim()
                );
                cue(i + 1, s.start_ms, s.end_ms, &text)
            })
            .collect(),
    )
}

pub fn multi_language(segments: &[SubtitleSegment]) -> String {
    assemble(
        segments
            .iter()
            .enumerate()
            .map(|(i, s)| {
                let mut parts = vec![
                    format!("[Original] {}", s.original_text.trim()),
                    format!("[Translated] {}", s.translated_text.trim()),
                ];
                if s.has_romanization() {
                    parts.push(format!("[Romanized] <i>{}</i>", s.romanized_text.as_deref().unwrap_or("").trim()));
                }
                cue(i + 1, s.start_ms, s.end_ms, &parts.join("\n"))
            })
            .collect(),
    )
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
    fn has_webvtt_header() {
        assert!(original_spoken(&[seg()]).starts_with("WEBVTT\n"));
    }

    #[test]
    fn romanization_is_italicized() {
        let out = with_romanization(&[seg()]);
        assert!(out.contains("<i>hola mundo</i>"));
    }

    #[test]
    fn uses_dot_timecodes() {
        let out = original_spoken(&[seg()]);
        assert!(out.contains("00:00:00.000 --> 00:00:01.000"));
    }
}
