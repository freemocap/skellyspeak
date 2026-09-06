//! Selected practice difficulty, distinct from inferred learner proficiency.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Difficulty { Zero, Beginner, Intermediate, Advanced }

impl Difficulty {
    pub fn cefr(self) -> &'static str {
        match self { Self::Zero => "PRE-A1", Self::Beginner => "A2", Self::Intermediate => "B1", Self::Advanced => "C1" }
    }
    pub fn from_cefr(cefr: &str) -> Self {
        match cefr { "PRE-A1" => Self::Zero, "A2" => Self::Beginner, "B1" => Self::Intermediate, "C1" => Self::Advanced,
            _ => panic!("Unsupported practice CEFR: {cefr}") }
    }
    pub fn limits(self) -> (usize, usize, usize) {
        match self { Self::Zero => (2, 5, 10), Self::Beginner => (3, 10, 24), Self::Intermediate => (4, 18, 60), Self::Advanced => (5, 30, 100) }
    }
    pub fn policy(self) -> String {
        let (sentences, words, total) = self.limits();
        let language = match self {
            Self::Zero => "Use only very common concrete words and simple present-tense clauses. One idea per reply. Avoid subordinate clauses, idioms, figurative language and unnecessary adjectives. Reuse familiar wording; introduce at most one unfamiliar word or short phrase. A greeting can simply be a name and one tiny personal fact; do not pack in a biography or a question.",
            Self::Beginner => "Use everyday vocabulary and simple independent clauses. Prefer present tense; use a simple past or future only when the subject needs it. Avoid nested clauses and idioms. Introduce at most one unfamiliar expression.",
            Self::Intermediate => "Use connected everyday language, common past/future forms, and straightforward reasons or comparisons. Keep subordinate clauses short. Introduce unfamiliar vocabulary sparingly and make meaning clear in context.",
            Self::Advanced => "Use natural nuance, varied grammar and idioms when useful. Give precise, engaging answers without unnecessary verbosity.",
        };
        format!("PRACTICE DIFFICULTY — {}\nThis is the learner's selected practice setting, not an estimate of their ability. Apply it to EVERY response, including greetings and settings changes.\nUse at most {sentences} sentences, at most {words} words per sentence, and at most {total} words in the entire reply. For languages without spaces between words, use equivalently short natural phrases; do not add artificial spaces.\n{language}\nThese limits take priority over character detail, topic elaboration, teaching observations and imitation of earlier replies. Keep the subject; simplify its expression. Do not raise difficulty because earlier dialogue or the learner's message is more complex. Identity and memory are context, not a requirement to repeat their wording. A question is optional and counts toward the same limits. Before returning, silently shorten your draft to meet these limits.", self.cefr())
    }
    pub fn coaching_context(self) -> String {
        format!("EXPLICIT PRACTICE SETTING: {}. This is requested output difficulty, not inferred proficiency. Keep inferred ability separate; do not override this choice. Tailor practice examples and suggestions to this setting. Grade the actual learner message with evidence, not by assuming this setting describes their ability.", self.cefr())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct LengthCheck {
    pub status: String,
    pub sentences: usize,
    pub words: Option<usize>,
    pub violations: Vec<String>,
    pub method: String,
}

/// Diagnostics only: punctuation and whitespace cannot establish CEFR proficiency.
pub fn check(text: &str, difficulty: Difficulty, target: &str) -> LengthCheck {
    let (max_sentences, max_words, max_total) = difficulty.limits();
    let sentences: Vec<&str> = text.split(['.', '!', '?', '。', '！', '？', '؟']).filter(|s| s.chars().any(char::is_alphanumeric)).collect();
    let spaced = crate::languages::word_delimited(target);
    let words = spaced.then(|| text.split_whitespace().count());
    let mut violations = Vec::new();
    if sentences.len() > max_sentences { violations.push(format!("{} sentences exceeds {max_sentences}", sentences.len())); }
    if let Some(total) = words {
        if total > max_total { violations.push(format!("{total} words exceeds {max_total}")); }
        if let Some(longest) = sentences.iter().map(|s| s.split_whitespace().count()).max().filter(|n| *n > max_words) {
            violations.push(format!("Longest sentence: {longest} words exceeds {max_words}"));
        }
    }
    LengthCheck { status: if violations.is_empty() { "within_measured_limits" } else { "violation" }.into(), sentences: sentences.len(), words, violations,
        method: if spaced { "Punctuation-delimited sentences and whitespace word counts; diagnostic only, not a CEFR assessment." } else { "Punctuation-delimited sentences only; word counts not assessed for this language. Not a CEFR assessment." }.into() }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn captured_zero_level_failure_is_not_model_success() {
        let result = check("Buenos días. Soy Manolo. Mi tienda está en un pueblo pequeño, con muchos geranios. Hoy, tengo que pintar la fachada. Es un pueblo bonito.", Difficulty::Zero, "es-ES");
        assert_eq!(result.status, "violation");
        assert_eq!(result.sentences, 5);
        assert_eq!(check("Soy Carmen. Hoy estoy cansada.", Difficulty::Zero, "es-ES").status, "within_measured_limits");
        assert!(check("你好。我很累。", Difficulty::Zero, "zh-CN").words.is_none());
    }
    #[test]
    fn invalid_selection_is_rejected_instead_of_becoming_beginner() {
        assert!(serde_json::from_str::<Difficulty>("\"unknown\"").is_err());
        assert!(serde_json::from_str::<Difficulty>("null").is_err());
        assert_ne!(Difficulty::Zero.policy(), Difficulty::Beginner.policy());
    }
}
