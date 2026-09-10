use std::path::Path;
use tauri::{Emitter, State};
use crate::{skills, AppState};

#[derive(serde::Serialize)]
pub struct LearnerSnapshot {
    #[serde(flatten)]
    evidence: skills::Snapshot,
    profile: skills::progress::Profile,
}
fn snapshot(config: &Path, target: &str) -> Result<LearnerSnapshot, String> {
    let evidence = skills::snapshot(config, target)?;
    let profile = skills::progress::project(&evidence, skills::progress::load(config, target)?)?;
    Ok(LearnerSnapshot { evidence, profile })
}
#[tauri::command]
pub fn get_skill_evidence(state: State<'_, AppState>) -> Result<LearnerSnapshot, String> {
    let _context = state.context_epoch.lock().expect("context lock poisoned");
    let target = state.settings.lock().expect("settings lock poisoned").target_language.clone();
    snapshot(&state.config_dir, &target)
}
#[tauri::command]
pub fn save_skill_profile(app: tauri::AppHandle, state: State<'_, AppState>, target: String, expected_revision: u64, choices: skills::progress::Choices) -> Result<LearnerSnapshot, String> {
    let _context = state.context_epoch.lock().expect("context lock poisoned");
    if state.settings.lock().expect("settings lock poisoned").target_language != target { return Err("The language changed. Reopen your profile before saving.".into()); }
    let evidence = skills::snapshot(&state.config_dir, &target)?;
    let current = skills::progress::load(&state.config_dir, &target)?;
    if choices.excluded_attempts.iter().any(|id| !current.excluded_attempts.contains(id) && !evidence.records.iter().any(|r| &r.attempt_id == id)) { return Err("Cannot exclude unknown evidence.".into()); }
    skills::progress::save(&state.config_dir, &target, expected_revision, choices)?;
    let result = snapshot(&state.config_dir, &target)?;
    app.emit("skills:changed", &target).map_err(|e| e.to_string())?;
    Ok(result)
}

#[derive(serde::Serialize)]
pub struct LanguagePractice {
    name: &'static str,
    endonym: &'static str,
    snapshot: LearnerSnapshot,
}
#[derive(serde::Serialize)]
pub struct PracticeOverview { languages: Vec<LanguagePractice> }

fn overview(config: &Path) -> Result<PracticeOverview, String> {
    let languages = crate::languages::LANGUAGES.iter().map(|language| {
        Ok(LanguagePractice { name: language.name, endonym: language.endonym, snapshot: snapshot(config, language.code)? })
    }).collect::<Result<Vec<_>, String>>()?;
    Ok(PracticeOverview { languages })
}

#[tauri::command]
pub fn get_practice_overview(state: State<'_, AppState>) -> Result<PracticeOverview, String> {
    let _context = state.context_epoch.lock().expect("context lock poisoned");
    overview(&state.config_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn overview_includes_independent_empty_profiles_for_every_supported_language() {
        let directory = tempfile::tempdir().unwrap();
        let result = overview(directory.path()).unwrap();
        assert_eq!(result.languages.len(), crate::languages::LANGUAGES.len());
        for language in result.languages {
            assert_eq!(language.snapshot.evidence.target, language.snapshot.profile.choices.target);
            assert_eq!(language.snapshot.profile.xp, 0);
            assert!(language.snapshot.evidence.records.is_empty());
        }
    }
}
