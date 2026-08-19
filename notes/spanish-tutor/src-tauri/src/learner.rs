//! Per-learner state. Drives sheltering (what vocab is "known") and card novelty
//! (which features/constructions have already been seen). Persisted as JSON in the
//! app data dir.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearnerModel {
    /// CEFR-ish target level, steers the conversation register.
    pub level: String,
    /// Lemmas the learner is assumed to know (seeds the sheltering allowlist).
    pub known_vocab: HashSet<String>,
    /// Exposure counts per feature/construction id, e.g. "Tense=Past" -> 4.
    pub seen: HashMap<String, u32>,
    /// Recently surfaced card ids, so we don't repeat a card every turn.
    pub recent_cards: VecDeque<String>,
    #[serde(skip)]
    path: Option<PathBuf>,
}

impl Default for LearnerModel {
    fn default() -> Self {
        Self {
            level: "A1".into(),
            known_vocab: HashSet::new(),
            seen: HashMap::new(),
            recent_cards: VecDeque::new(),
            path: None,
        }
    }
}

impl LearnerModel {
    /// Load from disk, or build a fresh model seeded with the Super-7 vocab.
    pub fn load_or_seed(path: PathBuf, seed_vocab: &[String]) -> Self {
        if let Ok(bytes) = std::fs::read(&path) {
            if let Ok(mut m) = serde_json::from_slice::<LearnerModel>(&bytes) {
                m.path = Some(path);
                return m;
            }
        }
        let mut m = LearnerModel::default();
        m.known_vocab.extend(seed_vocab.iter().cloned());
        m.path = Some(path);
        m.save();
        m
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

    pub fn save(&self) {
        if let Some(p) = &self.path {
            if let Some(dir) = p.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            if let Ok(json) = serde_json::to_vec_pretty(self) {
                let _ = std::fs::write(p, json);
            }
        }
    }
}
