//! What the learner said, measured against what the item asked for.
//!
//! Every number here is a measurement of two texts. It is never a judgement of
//! pronunciation: a transcript is text evidence, and the recognizer that
//! produced it has its own errors. The policy version travels with each result
//! so an old attempt is never silently re-interpreted under new rules.
use crate::model::*;
use serde::Serialize;
use ts_rs::TS;
use unicode_normalization::UnicodeNormalization;
use unicode_segmentation::UnicodeSegmentation;

pub const POLICY: &str = "drill-comparison-v1";

#[derive(Debug, Clone, Serialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DrillComparison {
    pub policy: String,
    // The texts exactly as they were, before any normalization.
    pub target: String,
    pub transcript: String,
    // What normalization did to each side, named so a match cannot quietly
    // claim more than it measured.
    pub normalizations: Vec<String>,
    pub normalized_target: String,
    pub normalized_transcript: String,
    // Grapheme-cluster edit distance over the normalized texts, and the
    // reference length it is measured against.
    pub edits: usize,
    pub reference_graphemes: usize,
    // Character error rate: edits / reference_graphemes, or null when the
    // target has no graphemes to measure against.
    pub character_error_rate: Option<f64>,
    // 1 - CER, floored at zero, for reading as a score. Null with the rate.
    pub match_ratio: Option<f64>,
    pub words: Vec<WordComparison>,
    // Whether the transcript's script matches the target's. Advisory only: it
    // never changes the measured numbers.
    pub script_note: ScriptNote,
}

#[derive(Debug, Clone, Serialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WordComparison {
    pub kind: WordOutcome,
    // The target word, when there is one; `extra` has only a transcript word.
    pub target: Option<String>,
    pub transcript: Option<String>,
    // Grapheme similarity for a substitution, 0.0 to 1.0.
    pub similarity: Option<f64>,
}

#[derive(Debug, Clone, Copy, Serialize, TS, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WordOutcome {
    Same,
    Substituted,
    Missing,
    Extra,
}

#[derive(Debug, Clone, Copy, Serialize, TS, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ScriptNote {
    Matches,
    Mismatch,
    Unknown,
}

/// Composition, case and punctuation only. Diacritics are preserved: a match
/// must not claim a distinction was spoken when it was never compared.
/// Punctuation is dropped because a recognizer does not report it reliably —
/// a missing full stop is not something the learner failed to say.
fn normalize(text: &str) -> (String, Vec<&'static str>) {
    let composed: String = text.nfc().collect();
    let folded = composed.to_lowercase();
    let stripped: String = folded
        .chars()
        .filter(|letter| !letter.is_ascii_punctuation() && !is_unicode_punctuation(*letter))
        .collect();
    let collapsed = stripped.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut applied = Vec::new();
    if composed != text {
        applied.push("unicode_nfc");
    }
    if folded != composed {
        applied.push("lowercase");
    }
    if stripped != folded {
        applied.push("strip_punctuation");
    }
    if collapsed != stripped {
        applied.push("collapse_whitespace");
    }
    (collapsed, applied)
}

/// Punctuation outside ASCII: the marks target-language text actually uses,
/// such as ¿ ¡ « » — and the CJK and Arabic stops.
fn is_unicode_punctuation(letter: char) -> bool {
    matches!(letter as u32,
        0x00A1 | 0x00BF | 0x00AB | 0x00BB
        | 0x2010..=0x2027 | 0x2030..=0x205E
        | 0x3001..=0x3003 | 0x300C..=0x300F | 0x3008..=0x3011
        | 0xFF01 | 0xFF0C | 0xFF0E | 0xFF1A | 0xFF1B | 0xFF1F
        | 0x060C | 0x061B | 0x061F | 0x06D4)
}

fn graphemes(text: &str) -> Vec<&str> {
    text.graphemes(true).collect()
}

/// Levenshtein distance over grapheme clusters: a combining mark or an emoji
/// sequence counts once, as a reader would count it.
fn distance(target: &[&str], said: &[&str]) -> usize {
    let mut previous: Vec<usize> = (0..=said.len()).collect();
    let mut current = vec![0; said.len() + 1];
    for (row, want) in target.iter().enumerate() {
        current[0] = row + 1;
        for (column, got) in said.iter().enumerate() {
            let substitution = previous[column] + usize::from(want != got);
            current[column + 1] = substitution
                .min(previous[column + 1] + 1)
                .min(current[column] + 1);
        }
        std::mem::swap(&mut previous, &mut current);
    }
    previous[said.len()]
}

fn similarity(target: &str, said: &str) -> f64 {
    let (want, got) = (graphemes(target), graphemes(said));
    let longest = want.len().max(got.len());
    if longest == 0 {
        return 1.0;
    }
    1.0 - distance(&want, &got) as f64 / longest as f64
}

/// Word-level alignment by the same edit distance, kept deterministic: on a
/// tie it prefers the substitution, so an attempt reads as one word changed
/// rather than one missing and one extra.
fn align(target: &[&str], said: &[&str]) -> Vec<WordComparison> {
    let mut costs = vec![vec![0.0_f64; said.len() + 1]; target.len() + 1];
    for (row, entry) in costs.iter_mut().enumerate() {
        entry[0] = row as f64;
    }
    for (column, cost) in costs[0].iter_mut().enumerate() {
        *cost = column as f64;
    }
    for row in 1..=target.len() {
        for column in 1..=said.len() {
            // A substitution costs what the two words differ by, so a near-miss
            // is cheaper than deleting and inserting.
            let change =
                costs[row - 1][column - 1] + (1.0 - similarity(target[row - 1], said[column - 1]));
            costs[row][column] = change
                .min(costs[row - 1][column] + 1.0)
                .min(costs[row][column - 1] + 1.0);
        }
    }
    let (mut row, mut column) = (target.len(), said.len());
    let mut result = Vec::new();
    while row > 0 || column > 0 {
        let change = if row > 0 && column > 0 {
            Some(costs[row - 1][column - 1] + (1.0 - similarity(target[row - 1], said[column - 1])))
        } else {
            None
        };
        if change.is_some_and(|cost| (cost - costs[row][column]).abs() < 1e-9) {
            let (want, got) = (target[row - 1], said[column - 1]);
            let score = similarity(want, got);
            result.push(WordComparison {
                kind: if want == got {
                    WordOutcome::Same
                } else {
                    WordOutcome::Substituted
                },
                target: Some(want.into()),
                transcript: Some(got.into()),
                similarity: if want == got { None } else { Some(score) },
            });
            row -= 1;
            column -= 1;
        } else if row > 0 && (costs[row - 1][column] + 1.0 - costs[row][column]).abs() < 1e-9 {
            result.push(WordComparison {
                kind: WordOutcome::Missing,
                target: Some(target[row - 1].into()),
                transcript: None,
                similarity: None,
            });
            row -= 1;
        } else {
            result.push(WordComparison {
                kind: WordOutcome::Extra,
                target: None,
                transcript: Some(said[column - 1].into()),
                similarity: None,
            });
            column -= 1;
        }
    }
    result.reverse();
    result
}

/// The script a letter belongs to, by Unicode block. Coarse on purpose: this
/// only answers "is the learner writing in the same system as the target?"
fn script_of(letter: char) -> Option<&'static str> {
    if !letter.is_alphabetic() {
        return None;
    }
    Some(match letter as u32 {
        0x0000..=0x02AF => "latin",
        0x0370..=0x03FF | 0x1F00..=0x1FFF => "greek",
        0x0400..=0x052F => "cyrillic",
        0x0590..=0x05FF => "hebrew",
        0x0600..=0x06FF | 0x0750..=0x077F | 0xFB50..=0xFDFF | 0xFE70..=0xFEFF => "arabic",
        0x0900..=0x097F => "devanagari",
        0x0D00..=0x0D7F => "malayalam",
        0x0E00..=0x0E7F => "thai",
        0x3040..=0x30FF => "kana",
        0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xF900..=0xFAFF => "han",
        0xAC00..=0xD7AF | 0x1100..=0x11FF => "hangul",
        _ => "other",
    })
}

/// The script most of a text's letters are written in, or nothing when it has
/// no letters at all.
fn dominant_script(text: &str) -> Option<&'static str> {
    let mut counts: std::collections::BTreeMap<&'static str, usize> = Default::default();
    for script in text.chars().filter_map(script_of) {
        *counts.entry(script).or_default() += 1;
    }
    counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(script, _)| script)
}

/// Whether both texts are written in the same script. An unfamiliar or missing
/// script is `Unknown` rather than a verdict about the wrong language, and it
/// never changes the measured numbers.
fn script_note(target: &str, transcript: &str) -> ScriptNote {
    match (dominant_script(target), dominant_script(transcript)) {
        (Some("other"), _) | (_, Some("other")) | (None, _) | (_, None) => ScriptNote::Unknown,
        (Some(left), Some(right)) if left == right => ScriptNote::Matches,
        _ => ScriptNote::Mismatch,
    }
}

/// Compare one attempt with its target. Both texts are kept as they were; the
/// numbers are measured over their normalized forms.
pub fn compare(target: &str, transcript: &str) -> DrillComparison {
    let (normalized_target, mut steps) = normalize(target);
    let (normalized_transcript, said_steps) = normalize(transcript);
    for step in said_steps {
        if !steps.contains(&step) {
            steps.push(step);
        }
    }
    let (want, got) = (
        graphemes(&normalized_target),
        graphemes(&normalized_transcript),
    );
    let edits = distance(&want, &got);
    // An empty target cannot be scored: there is nothing to measure against.
    // An empty transcript is scored, and scores zero.
    let rate = (!want.is_empty()).then(|| edits as f64 / want.len() as f64);
    DrillComparison {
        policy: POLICY.into(),
        target: target.into(),
        transcript: transcript.into(),
        normalizations: steps.into_iter().map(String::from).collect(),
        words: align(
            &normalized_target.split_whitespace().collect::<Vec<_>>(),
            &normalized_transcript.split_whitespace().collect::<Vec<_>>(),
        ),
        script_note: script_note(target, transcript),
        edits,
        reference_graphemes: want.len(),
        character_error_rate: rate,
        match_ratio: rate.map(|value| (1.0 - value).max(0.0)),
        normalized_target,
        normalized_transcript,
    }
}

/// The comparison as it is stored beside the attempt.
pub fn record(comparison: &DrillComparison) -> Result<String> {
    Ok(serde_json::to_string(comparison)?)
}

#[cfg(test)]
#[path = "comparison_tests.rs"]
mod tests;
