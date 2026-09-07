use tauri::{Emitter, State};
use crate::{skills, AppState};

#[derive(serde::Serialize)]
pub struct LearnerSnapshot {
    #[serde(flatten)]
    evidence: skills::Snapshot,
    profile: skills::progress::Profile,
}
fn snapshot(state: &AppState, target: &str) -> Result<LearnerSnapshot, String> {
    let evidence = skills::snapshot(&state.config_dir, target)?;
    let profile = skills::progress::project(&evidence, skills::progress::load(&state.config_dir, target)?)?;
    Ok(LearnerSnapshot { evidence, profile })
}
#[tauri::command]
pub fn get_skill_evidence(state: State<'_, AppState>) -> Result<LearnerSnapshot, String> {
    let _context = state.context_epoch.lock().expect("context lock poisoned");
    let target = state.settings.lock().expect("settings lock poisoned").target_language.clone();
    snapshot(&state, &target)
}
#[tauri::command]
pub fn save_skill_profile(app: tauri::AppHandle, state: State<'_, AppState>, target: String, expected_revision: u64, choices: skills::progress::Choices) -> Result<LearnerSnapshot, String> {
    let _context = state.context_epoch.lock().expect("context lock poisoned");
    if state.settings.lock().expect("settings lock poisoned").target_language != target { return Err("The language changed. Reopen your profile before saving.".into()); }
    let evidence = skills::snapshot(&state.config_dir, &target)?;
    let current = skills::progress::load(&state.config_dir, &target)?;
    if choices.excluded_attempts.iter().any(|id| !current.excluded_attempts.contains(id) && !evidence.records.iter().any(|r| &r.attempt_id == id)) { return Err("Cannot exclude unknown evidence.".into()); }
    skills::progress::save(&state.config_dir, &target, expected_revision, choices)?;
    let result = snapshot(&state, &target)?;
    app.emit("skills:changed", &target).map_err(|e| e.to_string())?;
    Ok(result)
}
