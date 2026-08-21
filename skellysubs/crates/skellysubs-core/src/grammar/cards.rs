//! Mechanics cards: curated, per-language explanations keyed to an IR trigger.
//! Language-agnostic engine; the content lives in assets/cards/spanish.json.

use serde::{Deserialize, Serialize};

use super::ir::FeatureEvent;
use super::learner::LearnerModel;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Trigger {
    Feature { key: String, value: String },
    Construction { id: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Card {
    pub id: String,
    pub title: String,
    pub cefr: String,
    pub trigger: Trigger,
    pub explanation: String,
    pub example: String,
    pub contrast: String,
}

impl Card {
    pub fn matches(&self, ev: &FeatureEvent) -> bool {
        match &self.trigger {
            Trigger::Feature { key, value } => {
                ev.features.iter().any(|f| &f.key == key && &f.value == value)
            }
            Trigger::Construction { id } => ev.constructions.iter().any(|c| &c.id == id),
        }
    }

    pub fn trigger_id(&self) -> String {
        match &self.trigger {
            Trigger::Feature { key, value } => format!("{key}={value}"),
            Trigger::Construction { id } => id.clone(),
        }
    }
}

pub struct CardLibrary {
    cards: Vec<Card>,
}

impl CardLibrary {
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        let cards: Vec<Card> = serde_json::from_str(json)?;
        Ok(Self { cards })
    }

    /// Pick up to 2 cards whose trigger is present and not recently shown,
    /// prioritising the least-seen mechanic (i+1 pacing).
    pub fn trigger(&self, ev: &FeatureEvent, learner: &LearnerModel) -> Vec<Card> {
        let mut hits: Vec<&Card> = self
            .cards
            .iter()
            .filter(|c| c.matches(ev) && !learner.recently_shown(&c.id))
            .collect();
        hits.sort_by_key(|c| learner.times_seen(&c.trigger_id()));
        hits.into_iter().take(2).cloned().collect()
    }

    pub fn len(&self) -> usize {
        self.cards.len()
    }

    pub fn is_empty(&self) -> bool {
        self.cards.is_empty()
    }
}

/// The seed Spanish card library (embedded at compile time).
pub const SPANISH_CARDS_JSON: &str = include_str!("../../assets/cards/spanish.json");

/// The Super-7 Spanish seed vocab (embedded at compile time).
pub const SUPER7_VOCAB_JSON: &str = include_str!("../../assets/data/super7_es.json");

#[cfg(test)]
mod tests {
    use super::*;

    fn ev_with_feature(key: &str, value: &str) -> FeatureEvent {
        FeatureEvent {
            language: "es".into(),
            source_text: "hablé".into(),
            tokens: vec![],
            features: vec![crate::grammar::ir::Feature { key: key.into(), value: value.into(), token_index: 0 }],
            constructions: vec![],
        }
    }

    #[test]
    fn spanish_cards_parse() {
        let lib = CardLibrary::from_json(SPANISH_CARDS_JSON).unwrap();
        assert!(lib.len() >= 6);
    }

    #[test]
    fn feature_trigger_matches() {
        let lib = CardLibrary::from_json(SPANISH_CARDS_JSON).unwrap();
        let cards = lib.trigger(&ev_with_feature("Tense", "Past"), &LearnerModel::default());
        assert!(cards.iter().any(|c| c.id == "es-preterite"));
    }

    #[test]
    fn no_trigger_returns_empty() {
        let lib = CardLibrary::from_json(SPANISH_CARDS_JSON).unwrap();
        let cards = lib.trigger(&ev_with_feature("Nope", "Nope"), &LearnerModel::default());
        assert!(cards.is_empty());
    }
}
