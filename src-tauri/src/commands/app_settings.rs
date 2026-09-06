//! Reading and writing settings, plus the update-check feed.

use serde::{Serialize};
use log::{info};
use tauri::{State};
use crate::conversation;
use crate::ai::truncate_for_log;
use crate::observer;
use crate::settings;
use crate::settings::Settings;
use crate::AppState;
use std::time::Duration;
use super::coach::{init_coach_thread, persist_coach_thread};
use super::conversations::pair_and_chat;

// ─── Settings ────────────────────────────────────────────────────────────────

/// Update delivery is determined by the native build target.
#[tauri::command]
pub fn get_update_channel() -> &'static str {
    if cfg!(target_os = "ios") {
        "app-store"
    } else if cfg!(target_os = "android") {
        "download"
    } else {
        "install"
    }
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    info!("[cmd] get_settings");
    // Secrets travel masked: the webview never receives raw key material.
    Ok(state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone()
        .masked())
}

/// The repository whose releases are the update feed. Mobile has no in-place
/// updater, so it asks GitHub directly what the newest published release is.
const RELEASES_API: &str =
    "https://api.github.com/repos/freemocap/skellyspeak/releases/latest";

#[derive(Debug, Clone, Serialize)]
pub struct LatestRelease {
    /// Semver with no leading "v", e.g. "0.2.0".
    pub version: String,
    /// Human-facing release page.
    pub url: String,
    pub notes: String,
}

/// The newest PUBLISHED release on GitHub.
///
/// This runs in the core rather than the webview because `connect-src` does not
/// allow the webview to reach api.github.com — and should not, since widening
/// it for one call would widen it for every call.
///
/// Draft releases are excluded by the endpoint itself, which matches the
/// desktop updater: an unpublished release reaches nobody.
#[tauri::command]
pub async fn latest_github_release() -> Result<LatestRelease, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("could not build http client: {e}"))?;
    let response = client
        .get(RELEASES_API)
        // GitHub rejects requests without one.
        .header("User-Agent", "SkellySpeak")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("could not reach GitHub: {e}"))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("could not read GitHub response: {e}"))?;
    if !status.is_success() {
        return Err(format!(
            "GitHub returned {status}: {}",
            truncate_for_log(&body, 200)
        ));
    }
    let v: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("GitHub response was not JSON: {e}"))?;
    let tag = v["tag_name"]
        .as_str()
        .ok_or("GitHub response had no tag_name")?;
    Ok(LatestRelease {
        version: tag.trim_start_matches('v').to_string(),
        url: v["html_url"].as_str().unwrap_or("").to_string(),
        notes: v["body"].as_str().unwrap_or("").to_string(),
    })
}

/// Drain faults recorded before the webview existed, so the UI can show them.
/// Anything that goes wrong during startup lands here rather than in a log
/// file the user will never open.
#[tauri::command]
pub fn take_startup_faults(state: State<'_, AppState>) -> Vec<String> {
    let mut faults = state
        .startup_faults
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    std::mem::take(&mut *faults)
}

/// Wipe every setting back to its built-in default, API keys included.
/// Returns the fresh (masked) settings so the UI does not have to guess what
/// the defaults are — `Settings::default()` stays the only definition of them.
#[tauri::command]
pub fn reset_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    info!("[cmd] reset_settings: restoring defaults, clearing API keys");
    let fresh = Settings::default();
    apply_settings(&state, fresh.clone(), false)?;
    Ok(fresh.masked())
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, settings: Settings) -> Result<(), String> {
    apply_settings(&state, settings, true)
}

fn apply_settings(state: &AppState, mut settings: Settings, preserve_session: bool) -> Result<(), String> {
    if !settings.tts_rate.is_finite() || !(0.5..=1.5).contains(&settings.tts_rate) {
        return Err("Voice playback speed must be between 0.5 and 1.5.".into());
    }
    let mut epoch = state.context_epoch.lock().expect("context lock poisoned");
    // Phone clipboards love appending whitespace to pasted keys — a dirty
    // key makes providers report "Missing Authentication header".
    settings.openrouter_key = settings.openrouter_key.trim().to_string();
    settings.groq_key = settings.groq_key.trim().to_string();
    settings.custom_api_key = settings.custom_api_key.trim().to_string();
    // Masked values round-tripping from the UI mean "keep the stored key".
    let stored = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    if !stored.openrouter_key.is_empty() && settings.openrouter_key == settings::mask(&stored.openrouter_key)
    {
        settings.openrouter_key = stored.openrouter_key.clone();
    }
    if !stored.groq_key.is_empty() && settings.groq_key == settings::mask(&stored.groq_key) {
        settings.groq_key = stored.groq_key.clone();
    }
    if !stored.custom_api_key.is_empty()
        && settings.custom_api_key == settings::mask(&stored.custom_api_key)
    {
        settings.custom_api_key = stored.custom_api_key.clone();
    }
    // The session token is issued by signing in and is blanked on its way out
    // to the webview, so whatever comes back is meaningless. Always keep what
    // is stored; `hosted_sign_out` is the only way to clear it. The install id
    // is withheld the same way and must survive a save untouched.
    if preserve_session {
        settings.hosted_token = stored.hosted_token.clone();
        settings.hosted_email = stored.hosted_email.clone();
    }
    settings.install_id = stored.install_id.clone();
    info!(
        "[cmd] save_settings: target={} native={} model={}",
        settings.target_language,
        settings.native_language,
        settings.openrouter_model
    );
    // A failed save means the user's keys are NOT on disk — fail loudly.

    // Language pairing changed → the observer documents and coach thread
    // belong to the OTHER conversation. Save them where they came from and
    // load whatever this pairing had, so switching away and back returns you
    // to where you were. The dialect is deliberately NOT part of a pairing:
    // moving between Levantine and MSA is a setting on one conversation.
    let pairing_changed = stored.target_language != settings.target_language
        || stored.native_language != settings.native_language;
    if pairing_changed {
        info!(
            "[cmd] pairing {}->{}: saving the old conversation, loading the new one",
            conversation::pair_key(&stored.target_language, &stored.native_language),
            conversation::pair_key(&settings.target_language, &settings.native_language),
        );
        // Plan and profile belong to the pairing; the coach thread belongs to
        // the chat that was open inside it.
        let (old_pair, old_chat, _) = pair_and_chat(
            &state,
            &stored.target_language,
            &stored.native_language,
        )?;
        {
            let plan = state.plan.lock().unwrap_or_else(|p| p.into_inner()).clone();
            let profile = state.profile.lock().unwrap_or_else(|p| p.into_inner()).clone();
            let faults = observer::persist_documents(&old_pair, &plan, &profile);
            if let Some(first) = faults.into_iter().next() {
                return Err(first);
            }
            let thread = state
                .coach_thread
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .clone();
            persist_coach_thread(&old_chat, &thread)?;
        }

        let (new_pair, new_chat, _) = pair_and_chat(
            &state,
            &settings.target_language,
            &settings.native_language,
        )?;
        // Anything unreadable in the incoming conversation must reach the
        // screen, not be discovered later as missing context.
        let mut faults: Vec<String> = Vec::new();
        let (plan, profile) = observer::load_documents(&new_pair, &mut faults);
        let thread = init_coach_thread(&new_chat, &mut faults);
        if let Some(first) = faults.into_iter().next() {
            return Err(first);
        }
        settings::persist(&state.config_dir, &settings)?;
        *state.plan.lock().expect("plan lock poisoned") = plan;
        *state.profile.lock().expect("profile lock poisoned") = profile;
        *state.coach_thread.lock().expect("coach lock poisoned") = thread;
        state.recent_mechanics.lock().expect("mechanics lock poisoned").clear();
    }
    if !pairing_changed { settings::persist(&state.config_dir, &settings)?; }
    let context_changed = pairing_changed || stored.target_dialect != settings.target_dialect
        || stored.provider_mode != settings.provider_mode || stored.openrouter_model != settings.openrouter_model
        || stored.observer_model != settings.observer_model || stored.custom_base_url != settings.custom_base_url
        || stored.custom_model != settings.custom_model || stored.openrouter_key != settings.openrouter_key
        || stored.custom_api_key != settings.custom_api_key || stored.hosted_token != settings.hosted_token;
    if context_changed {
        *epoch += 1;
        *state.observer_turns.lock().expect("observer cadence lock poisoned") = 0;
    }
    *state.settings.lock().unwrap_or_else(|p| p.into_inner()) = settings;
    Ok(())
}

