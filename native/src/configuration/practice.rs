//! Authored practice sets. These are display text, never matching or assessment tokens.
use super::{Registry, Result, error};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use ts_rs::TS;

#[derive(
    Clone, Copy, Debug, Deserialize, Serialize, JsonSchema, TS, PartialEq, Eq, PartialOrd, Ord,
)]
#[serde(rename_all = "snake_case")]
pub enum PracticeSet {
    AbsoluteZero,
    Beginner,
    Intermediate,
    Advanced,
    Social,
    Idiomatic,
}
pub const SETS: [PracticeSet; 6] = [
    PracticeSet::AbsoluteZero,
    PracticeSet::Beginner,
    PracticeSet::Intermediate,
    PracticeSet::Advanced,
    PracticeSet::Social,
    PracticeSet::Idiomatic,
];
impl PracticeSet {
    pub fn key(self) -> &'static str {
        match self {
            Self::AbsoluteZero => "absolute_zero",
            Self::Beginner => "beginner",
            Self::Intermediate => "intermediate",
            Self::Advanced => "advanced",
            Self::Social => "social",
            Self::Idiomatic => "idiomatic",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PhraseSets {
    #[schemars(length(min = 8, max = 50))]
    pub absolute_zero: Vec<String>,
    #[schemars(length(min = 8, max = 50))]
    pub beginner: Vec<String>,
    #[schemars(length(min = 8, max = 50))]
    pub intermediate: Vec<String>,
    #[schemars(length(min = 8, max = 50))]
    pub advanced: Vec<String>,
    #[schemars(length(min = 8, max = 50))]
    pub social: Vec<String>,
    #[schemars(length(min = 8, max = 50))]
    pub idiomatic: Vec<String>,
}
impl PhraseSets {
    pub fn phrases(&self, set: PracticeSet) -> &[String] {
        match set {
            PracticeSet::AbsoluteZero => &self.absolute_zero,
            PracticeSet::Beginner => &self.beginner,
            PracticeSet::Intermediate => &self.intermediate,
            PracticeSet::Advanced => &self.advanced,
            PracticeSet::Social => &self.social,
            PracticeSet::Idiomatic => &self.idiomatic,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PracticeContent {
    pub review: super::identity::ReviewStatus,
    pub sets: PhraseSets,
    /// Authored replacements where a variety requires different wording or script.
    pub varieties: BTreeMap<String, PhraseSets>,
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PracticeSetSummary {
    pub set: PracticeSet,
    pub count: usize,
    pub sample: String,
}

impl Registry {
    pub fn practice_phrases(
        &self,
        language: &str,
        variety: Option<&str>,
    ) -> crate::model::Result<&PhraseSets> {
        let config = self.language_config(language)?;
        let variety = variety.unwrap_or(&config.default_variety);
        if !config.varieties.iter().any(|entry| entry.id == variety) {
            return Err(error(
                format!("languages/{language}.yaml#practice"),
                "unknown_variety",
                variety,
            )
            .into());
        }
        let practice = &self.documents[language].practice;
        Ok(practice.varieties.get(variety).unwrap_or(&practice.sets))
    }

    pub fn practice_summaries(
        &self,
        language: &str,
        variety: Option<&str>,
    ) -> crate::model::Result<Vec<PracticeSetSummary>> {
        let bank = self.practice_phrases(language, variety)?;
        Ok(SETS
            .into_iter()
            .map(|set| PracticeSetSummary {
                set,
                count: bank.phrases(set).len(),
                sample: bank.phrases(set)[0].clone(),
            })
            .collect())
    }

    pub(super) fn validate_practice_content(&self) -> Result<()> {
        for (language, document) in &self.documents {
            let path = format!("languages/{language}.yaml#practice");
            validate_sets(&document.practice.sets, &format!("{path}.sets"))?;
            for (variety, sets) in &document.practice.varieties {
                let path = format!("{path}.varieties.{variety}");
                if !document.varieties.iter().any(|entry| entry.id == *variety) {
                    return Err(error(
                        path,
                        "unknown_variety",
                        "Phrase sets name an unknown variety.",
                    ));
                }
                validate_sets(sets, &path)?;
            }
        }
        Ok(())
    }
}

fn validate_sets(sets: &PhraseSets, path: &str) -> Result<()> {
    for set in SETS {
        let phrases = sets.phrases(set);
        let path = format!("{path}.{}", set.key());
        if phrases.len() < 8 || phrases.len() > 50 {
            return Err(error(
                &path,
                "phrase_count",
                "Author between 8 and 50 phrases per set.",
            ));
        }
        let mut seen = BTreeSet::new();
        for (index, text) in phrases.iter().enumerate() {
            let path = format!("{path}[{index}]");
            if text.trim() != text
                || text.is_empty()
                || text.encode_utf16().count() > 512
                || text.chars().any(char::is_control)
            {
                return Err(error(
                    path,
                    "invalid_phrase",
                    "Use 1–512 UTF-16 units of display text, without outer whitespace or control characters.",
                ));
            }
            if !seen.insert(text) {
                return Err(error(
                    path,
                    "duplicate_phrase",
                    "A phrase must occur only once within a set.",
                ));
            }
        }
    }
    Ok(())
}
