//! Learner-owned language preferences, persisted by Rust.
use std::{collections::HashSet, path::{Path, PathBuf}};
use serde::{Deserialize, Serialize};

pub const LOCAL_LEARNER: &str = "local";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LanguageProfile {
    pub version: u32,
    pub revision: u64,
    pub learner_id: String,
    pub target: String,
    pub focus: Option<String>,
    pub excluded_attempts: Vec<String>,
}
impl LanguageProfile {
    pub fn initial(target: &str) -> Self { Self { version: 1, revision: 0, learner_id: LOCAL_LEARNER.into(), target: target.into(), focus: None, excluded_attempts: vec![] } }
    pub fn validate(&self, target: &str) -> Result<(), String> {
        if self.version != 1 || self.learner_id != LOCAL_LEARNER || self.target != target { return Err("Profile ownership or version mismatch.".into()); }
        validate_target(target)?;
        let nodes = crate::skills::catalog()?;
        if self.focus.as_ref().is_some_and(|id| !nodes.iter().any(|s| s.kind == "skill" && &s.id == id)) { return Err("Unknown practice focus.".into()); }
        if self.excluded_attempts.iter().collect::<HashSet<_>>().len() != self.excluded_attempts.len() { return Err("Duplicate excluded evidence.".into()); }
        Ok(())
    }
}
fn validate_target(target: &str) -> Result<(), String> {
    if !crate::languages::LANGUAGES.iter().any(|language| language.code == target) { return Err("Invalid profile language.".into()); }
    Ok(())
}
fn path(config: &Path, target: &str) -> Result<PathBuf, String> {
    validate_target(target)?;
    Ok(config.join("learners").join(LOCAL_LEARNER).join(format!("{target}.json")))
}
pub fn load(config: &Path, target: &str) -> Result<LanguageProfile, String> {
    let Some(raw) = crate::persistence::read(&path(config, target)?)? else { return Ok(LanguageProfile::initial(target)); };
    let choices: LanguageProfile = serde_json::from_str(&raw).map_err(|e| format!("Invalid learner profile: {e}"))?;
    choices.validate(target)?;
    Ok(choices)
}
pub fn save(config: &Path, target: &str, expected_revision: u64, mut choices: LanguageProfile) -> Result<(), String> {
    choices.validate(target)?;
    let current = load(config, target)?;
    if current.revision != expected_revision || choices.revision != expected_revision { return Err("The profile changed. Refresh it before saving.".into()); }
    choices.revision += 1;
    let destination = path(config, target)?;
    std::fs::create_dir_all(destination.parent().ok_or("Profile has no parent directory")?).map_err(|e| format!("Cannot create learner profile directory: {e}"))?;
    crate::persistence::write(&destination, &serde_json::to_vec_pretty(&choices).map_err(|e| e.to_string())?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn profile_choices_are_isolated_persistent_and_revision_checked() {
        let dir = tempfile::tempdir().unwrap();
        let mut choices = LanguageProfile::initial("es-ES");
        choices.focus = Some("referent".into());
        save(dir.path(), "es-ES", 0, choices.clone()).unwrap();
        assert_eq!(load(dir.path(), "es-ES").unwrap().focus.as_deref(), Some("referent"));
        assert!(load(dir.path(), "ar").unwrap().focus.is_none());
        assert!(save(dir.path(), "es-ES", 0, choices.clone()).is_err());
        assert!(save(dir.path(), "ar", 0, choices).is_err());
        assert!(load(dir.path(), "../en").is_err());
    }

    #[test]
    fn invalid_storage_fails_without_modification() {
        let dir = tempfile::tempdir().unwrap();
        assert!(load(dir.path(), "unknown").is_err());
        let profile = LanguageProfile::initial("es-ES");
        save(dir.path(), "es-ES", 0, profile).unwrap();
        let destination = path(dir.path(), "es-ES").unwrap();
        let mut data: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&destination).unwrap()).unwrap();
        data.as_object_mut().unwrap().remove("excluded_attempts");
        let malformed = serde_json::to_string(&data).unwrap();
        std::fs::write(&destination, &malformed).unwrap();
        assert!(load(dir.path(), "es-ES").is_err());
        assert!(save(dir.path(), "es-ES", 1, LanguageProfile::initial("es-ES")).is_err());
        assert_eq!(std::fs::read_to_string(destination).unwrap(), malformed);
    }
}
