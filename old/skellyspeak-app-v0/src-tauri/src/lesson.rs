//! Learner-owned lesson choices. The observer never writes this document.

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct LessonChoices {
    pub goal: String,
    /// Explicit preferences and corrections to inferred learner memory.
    pub preferences: Vec<String>,
    /// None lets the observer choose; zero requests no unsolicited recasts.
    pub correction_budget: Option<u32>,
}

impl LessonChoices {
    pub fn validate(&self) -> Option<String> {
        if self.goal.chars().count() > 600 || self.preferences.len() > 10
            || self.preferences.iter().any(|p| p.trim().is_empty() || p.chars().count() > 256)
            || self.correction_budget.is_some_and(|n| n > 2) {
            return Some("Lesson limits: goal 600 characters, 10 nonblank preferences of 256 characters, correction budget 0–2.".into());
        }
        None
    }

    pub fn directives(&self) -> String {
        crate::prompts::lesson::directives(self)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LessonChange {
    pub revision: u64,
    pub at_ms: u64,
    pub source: String,
    pub reason: String,
    pub before: LessonChoices,
    pub after: LessonChoices,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LessonState {
    pub revision: u64,
    pub choices: LessonChoices,
    pub changes: Vec<LessonChange>,
}

pub fn load(pair: &Path) -> Result<LessonState, String> {
    let Some(raw) = crate::persistence::read(&pair.join("lesson.json"))? else {
        return Ok(LessonState::default());
    };
    let lesson: LessonState = serde_json::from_str(&raw).map_err(|e| format!("Cannot read lesson choices: {e}"))?;
    if let Some(error) = lesson.choices.validate() { return Err(error); }
    Ok(lesson)
}

pub fn save(pair: &Path, expected_revision: u64, choices: LessonChoices, source: &str, reason: &str) -> Result<LessonState, String> {
    if let Some(error) = choices.validate() { return Err(error); }
    let mut lesson = load(pair)?;
    if lesson.revision != expected_revision {
        return Err("The lesson changed while you were editing. Review the current lesson and try again.".into());
    }
    if lesson.choices == choices { return Ok(lesson); }
    lesson.revision += 1;
    let at_ms = SystemTime::now().duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Cannot timestamp lesson change: {e}"))?.as_millis() as u64;
    lesson.changes.push(LessonChange {
        revision: lesson.revision, at_ms, source: source.into(), reason: reason.into(),
        before: lesson.choices.clone(), after: choices.clone(),
    });
    if lesson.changes.len() > 20 { lesson.changes.remove(0); }
    lesson.choices = choices;
    let raw = serde_json::to_vec_pretty(&lesson).map_err(|e| format!("Cannot serialize lesson: {e}"))?;
    crate::persistence::write(&pair.join("lesson.json"), &raw)?;
    Ok(lesson)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn choices_survive_observation_and_reject_stale_edits() {
        let dir = tempfile::tempdir().unwrap();
        let choices = LessonChoices { goal: "Past-tense travel stories".into(), preferences: vec!["I already know greetings".into()], correction_budget: Some(0) };
        let saved = save(dir.path(), 0, choices.clone(), "learner", "Practise travel").unwrap();
        assert_eq!(saved.revision, 1);
        assert!(crate::observer::persist_documents(dir.path(), &crate::observer::TeachingPlan::default(), &crate::observer::Profile::default()).is_empty());
        assert_eq!(load(dir.path()).unwrap().choices, choices);
        assert!(save(dir.path(), 0, LessonChoices::default(), "learner", "stale").is_err());
        assert_eq!(load(dir.path()).unwrap().changes[0].after, choices);
    }

    #[test]
    fn corruption_and_invalid_choices_fail_without_overwriting() {
        let dir = tempfile::tempdir().unwrap();
        let invalid = LessonChoices { correction_budget: Some(3), ..Default::default() };
        assert!(save(dir.path(), 0, invalid, "learner", "invalid").is_err());
        std::fs::write(dir.path().join("lesson.json"), "broken").unwrap();
        assert!(save(dir.path(), 0, LessonChoices::default(), "learner", "edit").is_err());
        assert_eq!(std::fs::read_to_string(dir.path().join("lesson.json")).unwrap(), "broken");
    }
}
