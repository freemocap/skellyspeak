mod access;
#[cfg(desktop)]
mod audio;
pub mod credentials;
pub mod execution;
pub mod hosted;
pub mod languages;
pub mod model;
pub mod profile;
pub mod provider;
pub mod store;
pub mod turn_plan;
#[cfg(desktop)]
mod voice;
#[cfg(not(desktop))]
#[path = "voice_mobile.rs"]
mod voice;

use model::{
    AppError, Command, ConnectionConfig, ConnectionRoute, ConversationSnapshot, ErrorCode,
    HostedAccount, ProfileSnapshot, Receipt, Result, Snapshot,
};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;
use store::Store;
use tauri::Manager;
use zeroize::Zeroizing;

struct Application {
    #[cfg(desktop)]
    capture: Mutex<Option<voice::Recording>>,
    store: Mutex<Store>,
    fatal: Mutex<Option<AppError>>,
    signing_in: tokio::sync::Mutex<()>,
    auth_epoch: std::sync::atomic::AtomicU64,
}
impl Application {
    fn lock(&self) -> Result<MutexGuard<'_, Store>> {
        if let Some(error) = self.fatal.lock().map_err(|_| internal())?.as_ref() {
            return Err(error.clone());
        }
        self.store.lock().map_err(|_| internal())
    }
    fn stop(&self, error: AppError) {
        *self.fatal.lock().expect("execution fault mutex") = Some(error);
    }
}
fn internal() -> AppError {
    AppError::new(ErrorCode::Internal, "Application state is unavailable.")
}
#[tauri::command]
fn get_snapshot(state: tauri::State<'_, Arc<Application>>) -> Result<Snapshot> {
    state.lock()?.snapshot()
}
#[tauri::command]
fn execute_command(state: tauri::State<'_, Arc<Application>>, command: Command) -> Result<Receipt> {
    state.lock()?.execute(command)
}
#[tauri::command]
fn get_connection(state: tauri::State<'_, Arc<Application>>) -> Result<ConnectionConfig> {
    state.lock()?.connection_config()
}
#[tauri::command]
async fn save_connection(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
    api_key: Option<String>,
    standard_model: String,
    fast_model: String,
) -> Result<ConnectionConfig> {
    let key = api_key.map(Zeroizing::new);
    if let Some(key) = &key {
        provider::validate_key_format(key.trim())?;
    }
    // Keychain may display a native permission prompt. Never block the UI thread.
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut store = state.lock()?;
        if store.connection_config()?.revision != expected_revision {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Connection settings changed. Reload before saving.",
            ));
        }
        let id = if let Some(key) = &key {
            let id = uuid::Uuid::new_v4().to_string();
            store.reserve_credential(&id)?;
            credentials::save(&id, key.trim())?;
            id
        } else {
            store.credential_id()?.ok_or_else(|| {
                AppError::new(
                    ErrorCode::Validation,
                    "Enter an OpenRouter API key before saving.",
                )
            })?
        };
        let result = store.set_connection(
            expected_revision,
            Some(&id),
            standard_model.trim(),
            fast_model.trim(),
        );
        store.credential_writes.remove(&id);
        if let Err(error) = result {
            store.clean_credentials()?;
            return Err(error);
        }
        store.clean_credentials()?;
        store.connection_config()
    })
    .await
    .map_err(|_| internal())?
}

#[tauri::command]
async fn verify_openrouter_key(
    state: tauri::State<'_, Arc<Application>>,
    api_key: Option<String>,
    expected_revision: i32,
) -> Result<()> {
    let stored_id = {
        let store = state.lock()?;
        if store.connection_config()?.revision != expected_revision {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Connection settings changed. Reload before checking the key.",
            ));
        }
        store.credential_id()?
    };
    let key = match api_key {
        Some(key) => Zeroizing::new(key),
        None => {
            read_secret(stored_id.ok_or_else(|| {
                AppError::new(ErrorCode::Credential, "No OpenRouter key is saved.")
            })?)
            .await?
        }
    };
    provider::verify_key(&provider::client()?, key.trim()).await
}
#[tauri::command]
fn disconnect(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
) -> Result<ConnectionConfig> {
    let mut store = state.lock()?;
    let config = store.connection_config()?;
    if config.revision != expected_revision {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Connection changed. Reload before disconnecting.",
        ));
    }
    store.set_connection(
        expected_revision,
        None,
        &config.standard_model,
        &config.fast_model,
    )?;
    store.clean_credentials()?;
    store.connection_config()
}
#[tauri::command]
async fn hosted_sign_in(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<Application>>,
) -> Result<HostedAccount> {
    let _permit = state
        .signing_in
        .try_lock()
        .map_err(|_| AppError::new(ErrorCode::Conflict, "Sign-in is already in progress."))?;
    let epoch = state.auth_epoch.load(std::sync::atomic::Ordering::SeqCst);
    let (revision, install) = {
        let store = state.lock()?;
        (
            store.connection_config()?.revision,
            store.snapshot()?.learner.id,
        )
    };
    let authenticate = async {
        let token = hosted::sign_in(&app).await?;
        let account = hosted::account(&token, &install).await?;
        Ok::<_, AppError>((token, account))
    };
    tokio::pin!(authenticate);
    let (token, account) = loop {
        tokio::select! {result=&mut authenticate=>break result?,_=tokio::time::sleep(Duration::from_millis(100))=>{if state.auth_epoch.load(std::sync::atomic::Ordering::SeqCst)!=epoch{return Err(AppError::new(ErrorCode::Validation,"Sign-in cancelled."));}}}
    };
    let mut store = state.lock()?;
    if store.connection_config()?.revision != revision
        || state.auth_epoch.load(std::sync::atomic::Ordering::SeqCst) != epoch
    {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Connection changed during sign-in. Sign in again.",
        ));
    }
    let id = uuid::Uuid::new_v4().to_string();
    store.reserve_credential(&id)?;
    credentials::save(&id, &token)?;
    let result = store.set_hosted_connection(revision, Some(&id), &account.email);
    store.credential_writes.remove(&id);
    if let Err(error) = result {
        store.clean_credentials()?;
        return Err(error);
    }
    store.clean_credentials()?;
    Ok(account)
}
#[tauri::command]
fn cancel_sign_in(state: tauri::State<'_, Arc<Application>>) {
    state
        .auth_epoch
        .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
}
#[tauri::command]
async fn hosted_diagnostics(state: tauri::State<'_, Arc<Application>>) -> Result<String> {
    let (id, revision) = {
        let store = state.lock()?;
        (
            store.hosted_credential()?.ok_or_else(|| {
                AppError::new(ErrorCode::Credential, "Sign in to inspect service status.")
            })?,
            store.connection_config()?.revision,
        )
    };
    let token = read_secret(id).await?;
    let report = hosted::diagnostics(&token).await?;
    if state.lock()?.connection_config()?.revision != revision {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Connection changed while checking service status.",
        ));
    }
    Ok(report)
}
#[tauri::command]
async fn hosted_account(state: tauri::State<'_, Arc<Application>>) -> Result<HostedAccount> {
    let (credential, install, revision) = {
        let store = state.lock()?;
        let id = store.hosted_credential()?.ok_or_else(|| {
            AppError::new(
                ErrorCode::Credential,
                "Sign in with Google to see your account.",
            )
        })?;
        (
            id,
            store.snapshot()?.learner.id,
            store.connection_config()?.revision,
        )
    };
    let token = read_secret(credential).await?;
    let account = hosted::account(&token, &install).await?;
    if state.lock()?.connection_config()?.revision != revision {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Connection changed while loading account status.",
        ));
    }
    Ok(account)
}
#[tauri::command]
fn hosted_sign_out(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
) -> Result<ConnectionConfig> {
    state
        .auth_epoch
        .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let mut store = state.lock()?;
    store.set_hosted_connection(expected_revision, None, "")?;
    store.clean_credentials()?;
    store.connection_config()
}
#[tauri::command]
fn select_route(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
    route: ConnectionRoute,
) -> Result<ConnectionConfig> {
    let mut store = state.lock()?;
    store.select_route(expected_revision, route)?;
    store.connection_config()
}
#[tauri::command]
fn get_profile(state: tauri::State<'_, Arc<Application>>) -> Result<ProfileSnapshot> {
    state.lock()?.profile()
}
#[tauri::command]
async fn open_ai_window(app: tauri::AppHandle) -> Result<()> {
    if let Some(window) = app.get_webview_window("ai") {
        window.show().map_err(|_| internal())?;
        window.set_focus().map_err(|_| internal())?;
    } else {
        tauri::WebviewWindowBuilder::new(
            &app,
            "ai",
            tauri::WebviewUrl::App("index.html?view=ai".into()),
        )
        .title("SkellySpeak · AI activity")
        .inner_size(1000.0, 700.0)
        .min_inner_size(380.0, 400.0)
        .build()
        .map_err(|_| AppError::new(ErrorCode::Internal, "Could not open the AI window."))?;
    }
    Ok(())
}
/// Conditional full snapshots combine observation and hydration without an event gap.
#[tauri::command]
async fn watch_conversation(
    state: tauri::State<'_, Arc<Application>>,
    conversation_id: String,
    after_revision: i32,
    before: Option<i32>,
) -> Result<ConversationSnapshot> {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(20);
    loop {
        let snapshot = state
            .lock()?
            .conversation_snapshot(&conversation_id, before)?;
        if snapshot.revision > after_revision || tokio::time::Instant::now() >= deadline {
            return Ok(snapshot);
        }
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
}
async fn read_secret(id: String) -> Result<Zeroizing<String>> {
    tauri::async_runtime::spawn_blocking(move || credentials::read(&id))
        .await
        .map_err(|_| internal())?
}
async fn scheduler(state: Arc<Application>) {
    let client = match provider::client() {
        Ok(client) => client,
        Err(error) => {
            state.stop(error);
            return;
        }
    };
    let capacity = Arc::new(tokio::sync::Semaphore::new(2));
    loop {
        let permit = match capacity.clone().try_acquire_owned() {
            Ok(permit) => permit,
            Err(_) => {
                tokio::time::sleep(Duration::from_millis(100)).await;
                continue;
            }
        };
        let dispatch = match state.lock().and_then(|mut s| s.dispatch()) {
            Ok(item) => item,
            Err(error) => {
                state.stop(error);
                return;
            }
        };
        if let Some(dispatch) = dispatch {
            let state = state.clone();
            let client = client.clone();
            tauri::async_runtime::spawn(async move {
                let _permit = permit;
                let result=async {
                    if !state.lock()?.attempt_active(&dispatch.attempt)? { return Err(AppError::new(ErrorCode::Provider,"Attempt revoked before dispatch.")); }
                    let key=if dispatch.credential.is_empty() { Zeroizing::new(String::new()) } else { read_secret(dispatch.credential.clone()).await? };
                    if !state.lock()?.attempt_active(&dispatch.attempt)? { return Err(AppError::new(ErrorCode::Provider,"Attempt revoked while reading credentials.")); }
                    let request=provider::complete(&client,&key,&dispatch);
                    tokio::pin!(request);
                    loop {
                        tokio::select! {
                            result=&mut request=>return result,
                            _=tokio::time::sleep(Duration::from_millis(100))=>{
                                if !state.lock()?.attempt_active(&dispatch.attempt)? { return Err(AppError::new(ErrorCode::Provider,"Request cancelled locally; provider billing may continue.")); }
                            }
                        }
                    }
                }.await;
                let finished = state.lock().and_then(|mut s| s.finish(&dispatch, result));
                if let Err(error) = finished {
                    state.stop(error);
                }
            });
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let state = Arc::new(Application {
                #[cfg(desktop)]
                capture: Mutex::new(None),
                store: Mutex::new(Store::open(&directory.join("practice.sqlite3"))?),
                fatal: Mutex::new(None),
                signing_in: tokio::sync::Mutex::new(()),
                auth_epoch: std::sync::atomic::AtomicU64::new(0),
            });
            state.lock()?.clean_credentials()?;
            state.lock()?.prepare_chat()?;
            app.manage(state.clone());
            tauri::async_runtime::spawn(scheduler(state));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            voice::mic_start,
            voice::mic_wave,
            voice::mic_cancel,
            voice::mic_transcribe,
            get_snapshot,
            execute_command,
            access::get_access_settings,
            access::save_access_settings,
            access::check_access,
            get_connection,
            save_connection,
            verify_openrouter_key,
            disconnect,
            watch_conversation,
            hosted_sign_in,
            hosted_account,
            hosted_diagnostics,
            hosted_sign_out,
            cancel_sign_in,
            select_route,
            get_profile,
            open_ai_window
        ])
        .run(tauri::generate_context!())
        .expect("SkellySpeak could not start; no reset or fallback was performed");
}
