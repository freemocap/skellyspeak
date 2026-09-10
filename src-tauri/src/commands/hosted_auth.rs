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
    let (request_epoch, client_info) = {
        let epoch = state.context_epoch.lock().expect("context lock poisoned");
        let guard = state.settings.lock().unwrap_or_else(|p| p.into_inner());
        (*epoch, hosted::ClientInfo::new(&guard.install_id))
    };
    // Both platforms need the handle: it opens the system browser, and on
    // mobile it also receives the deep link coming back.
    let session = hosted::sign_in(&app, &client_info).await?;
    let account = hosted::account(&session.token, &client_info).await?;

    info!("[cmd] hosted_sign_in: signed in");
    {
        let mut epoch = state.context_epoch.lock().expect("context lock poisoned");
        if *epoch != request_epoch { return Err("Settings or sign-in changed while authentication was in progress. Please sign in again.".into()); }
        let mut guard = state.settings.lock().expect("settings lock poisoned");
        let mut updated = guard.clone();
        updated.hosted_token = session.token.clone();
        updated.hosted_email = session.email;
        settings::persist(&state.config_dir, &updated, &crate::credentials::Secrets::from(&*guard))?;
        *guard = updated;
        *epoch += 1;
    }
    Ok(account)
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
    let mut epoch = state.context_epoch.lock().expect("context lock poisoned");
    let mut guard = state.settings.lock().expect("settings lock poisoned");
    let mut updated = guard.clone();
    updated.hosted_token.clear();
    updated.hosted_email.clear();
    settings::persist(&state.config_dir, &updated, &crate::credentials::Secrets::from(&*guard))?;
    *guard = updated;
    crate::request_admission::shared().invalidate();
    *epoch += 1;
    Ok(())
}
