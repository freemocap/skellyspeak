//! Per-learner state: what vocab is known, which mechanics have been seen, and
//! which cards were recently shown. In-memory for MVP (persistence comes later).

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearnerModel {
    /// CEFR-ish target level (steers the conversation register).
    pub level: String,
    /// Lemmas the learner is assumed to know (seeds the sheltering allowlist).
    pub known_vocab: HashSet<String>,
    /// Exposure counts per feature/construction id, e.g. "Tense=Past" -> 4.
    pub seen: HashMap<String, u32>,
    /// Recently surfaced card ids, so we don't repeat a card every turn.
    pub recent_cards: VecDeque<String>,
}

impl Default for LearnerModel {
    fn default() -> Self {
        Self {
            level: "A1".into(),
            known_vocab: HashSet::new(),
            seen: HashMap::new(),
            recent_cards: VecDeque::new(),
        }
    }
}

impl LearnerModel {
    /// Build a model seeded with an initial known-vocab allowlist.
    pub fn with_vocab(seed: &[String]) -> Self {
        let mut m = Self::default();
        m.known_vocab.extend(seed.iter().cloned());
        m
    }

    /// Known vocab as a sorted list (feeds the sheltered tutor prompt).
    pub fn sorted_known_vocab(&self) -> Vec<String> {
        let mut v: Vec<String> = self.known_vocab.iter().cloned().collect();
        v.sort();
        v
    }

    pub fn knows(&self, lemma: &str) -> bool {
        self.known_vocab.contains(&lemma.to_lowercase())
    }

    pub fn expose_vocab(&mut self, lemma: &str) {
        self.known_vocab.insert(lemma.to_lowercase());
    }

    pub fn mark_seen(&mut self, id: &str) {
        *self.seen.entry(id.to_string()).or_insert(0) += 1;
    }

    pub fn times_seen(&self, id: &str) -> u32 {
        *self.seen.get(id).unwrap_or(&0)
    }

    pub fn recently_shown(&self, card_id: &str) -> bool {
        self.recent_cards.contains(&card_id.to_string())
    }

    pub fn note_card_shown(&mut self, card_id: &str) {
        self.recent_cards.push_back(card_id.to_string());
        while self.recent_cards.len() > 8 {
            self.recent_cards.pop_front();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn knows_is_case_insensitive() {
        let mut m = LearnerModel::default();
        m.expose_vocab("Hola");
        assert!(m.knows("hola"));
        assert!(m.knows("HOLA"));
    }

    #[test]
    fn with_vocab_seeds_and_sorts() {
        let m = LearnerModel::with_vocab(&[
            "hola".to_string(),
            "gracias".to_string(),
            "adios".to_string(),
        ]);
        assert!(m.knows("HOLA"));
        assert_eq!(m.sorted_known_vocab(), vec!["adios", "gracias", "hola"]);
    }

    #[test]
    fn mark_and_count_seen() {
        let mut m = LearnerModel::default();
        m.mark_seen("Tense=Past");
        m.mark_seen("Tense=Past");
        assert_eq!(m.times_seen("Tense=Past"), 2);
    }

    #[test]
    fn recent_cards_caps_at_eight() {
        let mut m = LearnerModel::default();
        for i in 0..12 {
            m.note_card_shown(&format!("card{i}"));
        }
        assert_eq!(m.recent_cards.len(), 8);
        assert!(m.recently_shown("card11"));
        assert!(!m.recently_shown("card3"));
    }
}
