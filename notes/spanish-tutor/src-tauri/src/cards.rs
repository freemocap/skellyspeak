//! Mechanics cards: curated, per-language explanations keyed to an IR trigger.
//! Language-agnostic engine; the content lives in cards/spanish.json.

use crate::ir::FeatureEvent;
use crate::learner::LearnerModel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Trigger {
    Feature { key: String, value: String },
    Construction { id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card {
    pub id: String,
    pub title: String,
    pub cefr: String,
    pub trigger: Trigger,
    /// Short contextual explanation shown in the mechanics panel.
    pub explanation: String,
    /// A worked example (target + gloss).
    pub example: String,
    /// How this differs from English — the "aha" contrast.
    pub contrast: String,
}

impl Card {
    fn matches(&self, ev: &FeatureEvent) -> bool {
        match &self.trigger {
            Trigger::Feature { key, value } => ev
                .features
                .iter()
                .any(|f| &f.key == key && &f.value == value),
            Trigger::Construction { id } => ev.constructions.iter().any(|c| &c.id == id),
        }
    }

    fn trigger_id(&self) -> String {
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
    pub fn from_json(json: &str) -> anyhow::Result<Self> {
        let cards: Vec<Card> = serde_json::from_str(json)?;
        Ok(Self { cards })
    }

    /// Pick up to 2 cards to surface: ones whose trigger is present in this
    /// utterance and that we haven't just shown. Prioritise the least-seen
    /// mechanic so pacing tracks i+1 rather than spamming past tense forever.
    pub fn trigger(&self, ev: &FeatureEvent, learner: &LearnerModel) -> Vec<Card> {
        let mut hits: Vec<&Card> = self
            .cards
            .iter()
            .filter(|c| c.matches(ev) && !learner.recently_shown(&c.id))
            .collect();

        hits.sort_by_key(|c| learner.times_seen(&c.trigger_id()));
        hits.into_iter().take(2).cloned().collect()
    }
}
