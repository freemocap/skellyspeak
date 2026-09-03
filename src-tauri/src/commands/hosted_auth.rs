//! Signing in to the hosted service, and what allowance is left.

use log::{info};
use tauri::State;
use crate::hosted;
use crate::settings;
use crate::AppState;

// ─── Hosted service (sign-in and allowance) ──────────────────────────────────

/// Sign in to the hosted service and store the resulting session.
///
/// Opens the system browser and waits for the redirect to come back. Returns
/// the account so the UI can show who signed in and what is left.
#[tauri::command]
pub async fn hosted_sign_in(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<hosted::Account, String> {
    let client_info = {
        let guard = state.settings.lock().unwrap_or_else(|p| p.into_inner());
        hosted::ClientInfo::new(&guard.install_id)
    };
    // Both platforms need the handle: it opens the system browser, and on
    // mobile it also receives the deep link coming back.
    let session = hosted::sign_in(&app, &client_info).await?;

    info!("[cmd] hosted_sign_in: signed in as {}", session.email);
    let updated = {
        let mut guard = state.settings.lock().unwrap_or_else(|p| p.into_inner());
        guard.hosted_token = session.token.clone();
        guard.hosted_email = session.email;
        guard.clone()
    };
    // A session that is not on disk is gone at the next launch, and the user
    // would have no way to know why they were signed out.
    settings::persist(&state.config_dir, &updated)?;
    hosted::account(&session.token, &client_info).await
}

/// Identity and remaining allowance for the stored session.
#[tauri::command]
pub async fn hosted_account(state: State<'_, AppState>) -> Result<hosted::Account, String> {
    let (token, client_info) = {
        let guard = state.settings.lock().unwrap_or_else(|p| p.into_inner());
        (
            guard.hosted_token.clone(),
            hosted::ClientInfo::new(&guard.install_id),
        )
    };
    if token.trim().is_empty() {
        return Err("Not signed in to the hosted service.".into());
    }
    hosted::account(&token, &client_info).await
}

/// Forget the stored session. The only way the token is ever cleared.
#[tauri::command]
pub fn hosted_sign_out(state: State<'_, AppState>) -> Result<(), String> {
    info!("[cmd] hosted_sign_out: clearing the stored session");
    let updated = {
        let mut guard = state.settings.lock().unwrap_or_else(|p| p.into_inner());
        guard.hosted_token.clear();
        guard.hosted_email.clear();
        guard.clone()
    };
    settings::persist(&state.config_dir, &updated)
}
