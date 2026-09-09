//! Explicit practice settings owned by one persistent conversation.
use std::path::Path;
use serde::{Deserialize, Serialize};
use crate::{persistence, prompts::difficulty::Difficulty};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Practice {
    pub revision: u64,
    pub difficulty: Difficulty,
}

pub fn load(chat: &Path) -> Result<Practice, String> {
    let raw = persistence::read(&chat.join("practice.json"))?
        .ok_or("Conversation practice settings are missing.")?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid conversation practice settings: {e}"))
}

pub fn initialize(chat: &Path) -> Result<(), String> {
    if persistence::read(&chat.join("practice.json"))?.is_some() { load(chat)?; return Ok(()); }
    write(chat, &Practice { revision: 0, difficulty: Difficulty::Beginner })
}

fn write(chat: &Path, practice: &Practice) -> Result<(), String> {
    persistence::write(&chat.join("practice.json"), &serde_json::to_vec_pretty(practice).map_err(|e| e.to_string())?)
}

/// Caller holds the application context lock for the complete read/check/write.
pub fn save(chat: &Path, expected_revision: u64, difficulty: Difficulty) -> Result<Practice, String> {
    let current = load(chat)?;
    if current.revision != expected_revision { return Err("Conversation settings changed. Reload them before saving.".into()); }
    let practice = Practice { revision: current.revision.checked_add(1).ok_or("Conversation revision overflow")?, difficulty };
    write(chat, &practice)?;
    Ok(practice)
}

pub fn require_difficulty(chat: &Path, expected: Difficulty) -> Result<(), String> {
    if load(chat)?.difficulty != expected { return Err("Conversation difficulty changed. Reload its settings before continuing.".into()); }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn conversations_have_independent_persistent_difficulty_and_revision_checks() {
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        initialize(a.path()).unwrap();
        initialize(b.path()).unwrap();
        save(a.path(), 0, Difficulty::Zero).unwrap();
        save(b.path(), 0, Difficulty::Advanced).unwrap();
        initialize(a.path()).unwrap();
        assert_eq!(load(a.path()).unwrap().difficulty, Difficulty::Zero);
        assert_eq!(load(b.path()).unwrap().difficulty, Difficulty::Advanced);
        assert!(save(a.path(), 0, Difficulty::Fluent).is_err());
        require_difficulty(a.path(), Difficulty::Zero).unwrap();
        assert!(require_difficulty(a.path(), Difficulty::Advanced).is_err());
        save(a.path(), 1, Difficulty::Intermediate).unwrap();
        assert_eq!(load(b.path()).unwrap().difficulty, Difficulty::Advanced);
    }
    #[test]
    fn missing_and_invalid_settings_fail() {
        let dir = tempfile::tempdir().unwrap();
        assert!(load(dir.path()).is_err());
        persistence::write(&dir.path().join("practice.json"), b"{}").unwrap();
        assert!(initialize(dir.path()).is_err());
        assert!(save(dir.path(), 0, Difficulty::Beginner).is_err());
    }
}
