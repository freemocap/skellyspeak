//! Content-free comparison metadata. This never decides whether audio may play.
/// Diagnostics only. Transcript similarity does not verify waveform fidelity.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum TranscriptDifference {
    Exact,
    Missing,
    Whitespace,
    PunctuationOrCase,
    Content,
}
pub(crate) fn transcript_difference(source: &str, transcript: &str) -> TranscriptDifference {
    if source.trim().is_empty() || transcript.trim().is_empty() {
        return TranscriptDifference::Missing;
    }
    if source.trim() == transcript.trim() {
        return TranscriptDifference::Exact;
    }
    fn spaces(text: &str) -> String {
        text.split_whitespace().collect::<Vec<_>>().join(" ")
    }
    if spaces(source) == spaces(transcript) {
        return TranscriptDifference::Whitespace;
    }
    static PUNCTUATION: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
        regex::Regex::new(r"\p{P}").expect("static punctuation pattern")
    });
    fn diagnostic_text(text: &str) -> String {
        spaces(&PUNCTUATION.replace_all(text, "").to_lowercase())
    }
    if diagnostic_text(source) == diagnostic_text(transcript) {
        TranscriptDifference::PunctuationOrCase
    } else {
        TranscriptDifference::Content
    }
}

use serde::Serialize;
use unicode_normalization::UnicodeNormalization;
use unicode_segmentation::UnicodeSegmentation;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TranscriptDiagnostics {
    complete: bool,
    difference: Option<&'static str>,
    exact: bool,
    whitespace_equivalent: bool,
    canonical_equivalent: bool,
    canonical_whitespace_equivalent: bool,
    first_differing_scalar: Option<usize>,
    source: TextProfile,
    transcript: TextProfile,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TextProfile {
    bytes: usize,
    scalars: usize,
    graphemes: usize,
    whitespace: usize,
    combining_marks: usize,
    joining_controls: usize,
    latin: usize,
    arabic: usize,
    devanagari: usize,
    malayalam: usize,
    han: usize,
    other_letters: usize,
}

fn spaces(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}
impl TranscriptDiagnostics {
    pub(crate) fn new(source: &str, transcript: &str, complete: bool) -> Self {
        let source_nfc: String = source.nfc().collect();
        let transcript_nfc: String = transcript.nfc().collect();
        let first_differing_scalar = source
            .chars()
            .zip(transcript.chars())
            .position(|(a, b)| a != b)
            .or_else(|| {
                (source.chars().count() != transcript.chars().count())
                    .then(|| source.chars().count().min(transcript.chars().count()))
            });
        Self {
            complete,
            difference: complete.then(|| match transcript_difference(source, transcript) {
                TranscriptDifference::Exact => "exact",
                TranscriptDifference::Missing => "missing",
                TranscriptDifference::Whitespace => "whitespace",
                TranscriptDifference::PunctuationOrCase => "punctuation_or_case",
                TranscriptDifference::Content => "content",
            }),
            exact: source == transcript,
            whitespace_equivalent: spaces(source) == spaces(transcript),
            canonical_equivalent: source_nfc == transcript_nfc,
            canonical_whitespace_equivalent: spaces(&source_nfc) == spaces(&transcript_nfc),
            first_differing_scalar,
            source: TextProfile::new(source),
            transcript: TextProfile::new(transcript),
        }
    }
}
impl TextProfile {
    fn new(text: &str) -> Self {
        static CATEGORIES: std::sync::LazyLock<Vec<regex::Regex>> = std::sync::LazyLock::new(
            || {
                [r"\p{M}", r"\p{Script=Latin}", r"\p{Script=Arabic}", r"\p{Script=Devanagari}", r"\p{Script=Malayalam}", r"\p{Script=Han}", r"[\p{L}&&[^\p{Script=Latin}\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Malayalam}\p{Script=Han}]]"]
                .iter().map(|pattern| regex::Regex::new(pattern).expect("static Unicode category")).collect()
            },
        );
        let counts: Vec<_> = CATEGORIES
            .iter()
            .map(|pattern| pattern.find_iter(text).count())
            .collect();
        Self {
            bytes: text.len(),
            scalars: text.chars().count(),
            graphemes: text.graphemes(true).count(),
            whitespace: text.chars().filter(|c| c.is_whitespace()).count(),
            combining_marks: counts[0],
            joining_controls: text
                .chars()
                .filter(|c| matches!(c, '\u{200c}' | '\u{200d}'))
                .count(),
            latin: counts[1],
            arabic: counts[2],
            devanagari: counts[3],
            malayalam: counts[4],
            han: counts[5],
            other_letters: counts[6],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnoses_canonical_spelling_without_changing_acceptance() {
        for (source, transcript) in [
            ("café", "cafe\u{301}"),
            ("क़", "क\u{93c}"),
            ("കൊ", "ക\u{d46}\u{d3e}"),
        ] {
            let report = TranscriptDiagnostics::new(source, transcript, true);
            assert_eq!(report.difference, Some("content"));
            assert!(!report.exact);
            assert!(report.canonical_equivalent);
            assert!(report.first_differing_scalar.is_some());
        }
        let report = TranscriptDiagnostics::new("क़\nहै", "क\u{93c} है", true);
        assert!(!report.canonical_equivalent);
        assert!(report.canonical_whitespace_equivalent);
    }

    #[test]
    fn separates_script_changes_word_changes_and_incomplete_streams() {
        let report = TranscriptDiagnostics::new("നമസ്കാരം", "namaskaram", true);
        assert!(report.source.malayalam > 0 && report.transcript.latin > 0);
        assert!(!report.canonical_equivalent);
        let changed = TranscriptDiagnostics::new("नमस्ते", "धन्यवाद", true);
        assert_eq!(changed.difference, Some("content"));
        assert!(!changed.canonical_whitespace_equivalent);
        let partial = TranscriptDiagnostics::new("നമസ്കാരം", "നമ", false);
        assert!(!partial.complete);
        assert_eq!(partial.difference, None);
    }

    #[test]
    fn profiles_preserve_no_text_and_distinguish_marks_from_joiners() {
        let report =
            TranscriptDiagnostics::new("private-source-നമസ്തേ", "private-provider-ന്\u{200d}", true);
        let json = serde_json::to_string(&report).unwrap();
        assert!(!json.contains("private-"));
        assert_eq!(report.transcript.joining_controls, 1);
        assert!(report.transcript.combining_marks > 0);
        let same = TranscriptDiagnostics::new("Hello", "Hello", true);
        assert_eq!(same.difference, Some("exact"));
        assert_eq!(same.first_differing_scalar, None);
        assert_eq!(
            TranscriptDiagnostics::new("ab", "abc", true).first_differing_scalar,
            Some(2)
        );
    }
}
