mod access;
mod admission;
#[cfg(desktop)]
mod audio;
pub mod coaching;
mod conversation_prompt;
pub mod credentials;
pub mod diagnostics;
mod emoji;
pub mod execution;
mod factory_reset;
mod generation;
mod generation_receipts;
pub mod gloss;
pub mod grouped;
mod holds;
pub mod hosted;
pub mod languages;
pub mod linguistics;
pub mod model;
mod persona;
mod persona_prompt;
pub mod profile;
pub mod progression;
pub mod provider;
mod refusal;
mod reward_settings;
pub mod speech;
pub mod speech_provider;
pub mod store;
mod transcription;
pub mod turn_plan;
mod updater;
mod voice;

use model::{
    AppError, Command, ConnectionConfig, ConnectionRoute, ConversationSnapshot, ErrorCode,
    HostedAccount, PersonaDetails, ProfileSnapshot, Receipt, Result, Snapshot, StartupState,
};
use std::ops::{Deref, DerefMut};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;
use store::Store;
use tauri::Manager;
#[cfg(desktop)]
use tauri::{
    Emitter,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
};
use zeroize::Zeroizing;

struct Application {
    admission: admission::Admission,
    generations: generation::Registry,
    capture: Mutex<Option<voice::Recording>>,
    store: Mutex<Option<Store>>,
    /// Why the workspace could not be opened at startup. Commands report it
    /// rather than a generic failure, and the window stays open so the reason
    /// reaches the screen and the reset stays reachable.
    refusal: Mutex<Option<AppError>>,
    /// A cleanup a previous reset recorded that this launch could not finish.
    cleanup: Mutex<Option<AppError>>,
    credential_operations: Mutex<()>,
    fatal: Mutex<Option<AppError>>,
    signing_in: tokio::sync::Mutex<()>,
    auth_epoch: std::sync::atomic::AtomicU64,
}
struct StoreGuard<'a>(MutexGuard<'a, Option<Store>>);
impl Deref for StoreGuard<'_> {
    type Target = Store;
    fn deref(&self) -> &Self::Target {
        self.0.as_ref().expect("application store is unavailable")
    }
}
impl DerefMut for StoreGuard<'_> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.0.as_mut().expect("application store is unavailable")
    }
}
impl Application {
    /// Open the workspace without ever aborting the launch. A refused database is
    /// an ordinary outcome, and it has to reach a screen that can reset it.
    /// `cleanup` is the failure, if any, of finishing a previous reset; the caller
    /// runs that before the log sink opens, because the log directory is part of it.
    fn start(workspace: &std::path::Path, cleanup: Option<AppError>) -> Arc<Self> {
        let (store, refusal) = match Store::open(workspace) {
            Ok(store) => (Some(store), None),
            Err(error) => (None, Some(error)),
        };
        Arc::new(Self {
            admission: admission::Admission::new(),
            generations: generation::Registry::default(),
            capture: Mutex::new(None),
            store: Mutex::new(store),
            refusal: Mutex::new(refusal),
            cleanup: Mutex::new(cleanup),
            credential_operations: Mutex::new(()),
            fatal: Mutex::new(None),
            signing_in: tokio::sync::Mutex::new(()),
            auth_epoch: std::sync::atomic::AtomicU64::new(0),
        })
    }
    fn refusal(&self) -> Option<AppError> {
        self.refusal.lock().ok().and_then(|value| value.clone())
    }
    fn startup_state(&self) -> StartupState {
        StartupState {
            refusal: self.refusal(),
            cleanup: self.cleanup.lock().ok().and_then(|value| value.clone()),
        }
    }
    fn lock(&self) -> Result<StoreGuard<'_>> {
        if let Some(error) = self.fatal.lock().map_err(|_| internal())?.as_ref() {
            return Err(error.clone());
        }
        let store = self.store.lock().map_err(|_| internal())?;
        if store.is_none() {
            if let Some(error) = self.refusal.lock().map_err(|_| internal())?.as_ref() {
                return Err(error.clone());
            }
            return Err(internal());
        }
        Ok(StoreGuard(store))
    }
    fn credential_operation(&self) -> Result<MutexGuard<'_, ()>> {
        self.credential_operations.lock().map_err(|_| internal())
    }
    fn clean_credentials_with(&self, remove: impl Fn(&str) -> Result<()>) -> Result<()> {
        loop {
            let id = self.lock()?.claim_credential_cleanup()?;
            let Some(id) = id else {
                return Ok(());
            };
            // A claimed unique ID cannot be reused while the external call blocks.
            let result = remove(&id);
            self.lock()?
                .finish_credential_cleanup(&id, result.is_ok())?;
            result?;
        }
    }
    fn clean_credentials(&self) -> Result<()> {
        self.clean_credentials_with(credentials::remove)
    }
    fn write_credential_with<T>(
        &self,
        prepare: impl FnOnce(&mut Store) -> Result<()>,
        write: impl FnOnce(&str) -> Result<()>,
        commit: impl FnOnce(&mut Store, &str) -> Result<T>,
        remove: impl Fn(&str) -> Result<()>,
    ) -> Result<T> {
        let _credential_operation = self.credential_operation()?;
        let id = uuid::Uuid::new_v4().to_string();
        {
            let mut store = self.lock()?;
            prepare(&mut store)?;
            // Durable before the secret exists: a reset that cannot read the
            // database still has to be able to find every keychain entry.
            credentials::remember(&store.credential_index, &id)?;
            store.reserve_credential(&id)?;
        }
        let written = write(&id);
        let result = {
            let mut store = self.lock()?;
            store.credential_writes.remove(&id);
            written.and_then(|_| commit(&mut store, &id))
        };
        self.clean_credentials_with(remove)?;
        result
    }
    fn stop(&self, error: AppError) {
        *self.fatal.lock().expect("execution fault mutex") = Some(error);
    }
}
fn internal() -> AppError {
    AppError::new(ErrorCode::Internal, "Application state is unavailable.")
}
/// Why the workspace could not be opened, or null when it opened. This is the one
/// command that answers before any store exists, so the window can always report
/// a refusal instead of failing every call with a generic error.
#[tauri::command]
fn get_startup_state(state: tauri::State<'_, Arc<Application>>) -> StartupState {
    state.startup_state()
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
fn read_speech_audio(
    state: tauri::State<'_, Arc<Application>>,
    session_id: String,
    operation_id: String,
) -> Result<model::SpeechAudioState> {
    let store = state.lock()?;
    if session_id != store.session_id {
        return Err(AppError::new(
            ErrorCode::SessionExpired,
            "The application session changed. Refresh before continuing.",
        ));
    }
    store.speech_audio(&operation_id, &store.speech_cache)
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
        if let Some(key) = &key {
            state.write_credential_with(
                |store| {
                    if store.connection_config()?.revision != expected_revision {
                        return Err(AppError::new(
                            ErrorCode::Conflict,
                            "Connection settings changed. Reload before saving.",
                        ));
                    }
                    Ok(())
                },
                |id| credentials::save(id, key.trim()),
                |store, id| {
                    store.set_connection(
                        expected_revision,
                        Some(id),
                        standard_model.trim(),
                        fast_model.trim(),
                    )?;
                    store.connection_config()
                },
                credentials::remove,
            )
        } else {
            let result = {
                let mut store = state.lock()?;
                let id = store.credential_id()?.ok_or_else(|| {
                    AppError::new(
                        ErrorCode::Validation,
                        "Enter an OpenRouter API key before saving.",
                    )
                })?;
                store.set_connection(
                    expected_revision,
                    Some(&id),
                    standard_model.trim(),
                    fast_model.trim(),
                )?;
                store.connection_config()
            };
            state.clean_credentials()?;
            result
        }
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
async fn disconnect(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
) -> Result<ConnectionConfig> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = {
            let mut store = state.lock()?;
            let config = store.connection_config()?;
            store.set_connection(
                expected_revision,
                None,
                &config.standard_model,
                &config.fast_model,
            )?;
            store.connection_config()
        };
        state.clean_credentials()?;
        result
    })
    .await
    .map_err(|_| internal())?
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
    let worker = state.inner().clone();
    let email = account.email.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let valid = |store: &mut Store| -> Result<()> {
            if store.connection_config()?.revision != revision
                || worker.auth_epoch.load(std::sync::atomic::Ordering::SeqCst) != epoch
            {
                return Err(AppError::new(
                    ErrorCode::Conflict,
                    "Connection changed during sign-in. Sign in again.",
                ));
            }
            Ok(())
        };
        worker.write_credential_with(
            valid,
            |id| credentials::save(id, &token),
            |store, id| {
                valid(store)?;
                store.set_hosted_connection(revision, Some(id), &email)
            },
            credentials::remove,
        )
    })
    .await
    .map_err(|_| internal())??;
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
async fn hosted_sign_out(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
) -> Result<ConnectionConfig> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = {
            let mut store = state.lock()?;
            store.set_hosted_connection(expected_revision, None, "")?;
            store.connection_config()
        };
        state.clean_credentials()?;
        result
    })
    .await
    .map_err(|_| internal())?
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
/// Reserve bounded ownership before any provider work. The proposal remains
/// volatile; creating the reviewed contact is a separate ordinary action.
#[tauri::command]
fn begin_persona_generation(
    state: tauri::State<'_, Arc<Application>>,
    language_id: String,
    brief: Option<String>,
) -> Result<String> {
    reserve_persona_generation(&state, language_id, brief)
}

fn reserve_persona_generation(
    state: &Application,
    language_id: String,
    brief: Option<String>,
) -> Result<String> {
    let mut store = state.lock()?;
    for expired in state.generations.expire()? {
        generation_receipts::expire(&mut store, &expired)?;
    }
    let request = generation::Request::capture(&store, language_id, brief)?;
    let request = state.generations.insert(request)?;
    if let Err(error) = generation_receipts::begin(&mut store, &request) {
        state.generations.cancel(&request.id)?;
        return Err(error);
    }
    Ok(request.id.clone())
}

#[tauri::command]
fn cancel_persona_generation(
    state: tauri::State<'_, Arc<Application>>,
    generation_id: String,
) -> Result<()> {
    cancel_owned_persona_generation(&state, &generation_id)
}

fn cancel_owned_persona_generation(state: &Application, generation_id: &str) -> Result<()> {
    let mut store = state.lock()?;
    if let Some(request) = state.generations.cancel(generation_id)? {
        generation_receipts::cancel(&mut store, &request)?;
    }
    Ok(())
}

#[tauri::command]
async fn run_persona_generation(
    state: tauri::State<'_, Arc<Application>>,
    generation_id: String,
) -> Result<PersonaDetails> {
    let run = {
        let mut store = state.lock()?;
        for expired in state.generations.expire()? {
            generation_receipts::expire(&mut store, &expired)?;
        }
        state.generations.claim(&generation_id)?
    };
    let request = &run.request;
    // Keep completion metadata even when the proposal fails parsing or loses
    // authority before adoption. Its text never enters the durable receipt.
    let mut provider_outcome = None;
    let outcome = async {
        let validate = || {
            let store = state.lock()?;
            request.validate(&store)
        };
        validate()?;
        let permit = state.admission.try_chat().ok_or_else(|| {
            AppError::new(
                ErrorCode::AdmissionHeld,
                "AI work is already at capacity. Let pending work finish, then generate again.",
            )
        })?;
        let client = provider::client()?;
        let key = generation::await_checked(
            request,
            async {
                if request.credential.is_empty() {
                    Ok(Zeroizing::new(String::new()))
                } else {
                    read_secret(request.credential.clone()).await
                }
            },
            validate,
        )
        .await??;
        validate()?;
        let language = languages::language(&request.language_id)?;
        let schema = persona::output_schema();
        let dispatch = execution::Dispatch {
            target: request.target.clone(),
            attempt: request.attempt.clone(),
            operation: request.operation.clone(),
            credential: request.credential.clone(),
            model: request.target.model.clone(),
            route: request.target.route,
            install_id: request.install_id.clone(),
            messages: persona_prompt::messages(&language.name, request.brief.as_deref()),
            coaching_schema: None,
            gloss_source: None,
            speech_source: None,
        };
        {
            // Cancellation also takes Store before Registry. Validation, the
            // durable dispatch boundary and submission state are one ordered step.
            let mut store = state.lock()?;
            request.validate(&store)?;
            generation_receipts::dispatch(&mut store, request)?;
            request.mark_submitted();
        }
        provider_outcome = Some(
            generation::await_checked(
                request,
                provider::complete_with_output(
                    &client,
                    &key,
                    &dispatch,
                    provider::RequestOutput::JsonSchema {
                        name: persona_prompt::SCHEMA_NAME,
                        schema: &schema,
                    },
                ),
                validate,
            )
            .await?,
        );
        drop(permit);
        let completed = provider_outcome
            .as_ref()
            .expect("provider outcome was captured");
        generation::accept_completion(&mut *state.lock()?, request, completed)?;
        let completion = completed.as_ref().map_err(Clone::clone)?;
        let details = generated_persona(&completion.text, &request.language_id)?;
        validate()?;
        Ok(details)
    }
    .await;
    let completion = provider_outcome
        .as_ref()
        .and_then(|value| value.as_ref().ok());
    finish_persona_generation(&state, request, completion, outcome)
}

fn finish_persona_generation(
    state: &Application,
    request: &generation::Request,
    completion: Option<&provider::Completion>,
    mut outcome: Result<PersonaDetails>,
) -> Result<PersonaDetails> {
    // The final authority check and terminal receipt share the Store lock with
    // cancel/settings actions. A failed terminal write never adopts a proposal.
    let mut store = state.lock()?;
    if outcome.is_ok()
        && let Err(error) = request.validate(&store)
    {
        outcome = Err(error);
    }
    generation_receipts::finish(&mut store, request, completion, &outcome)?;
    outcome
}

#[tauri::command]
fn get_persona_generation_activity(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<model::PersonaGenerationActivity> {
    let mut store = state.lock()?;
    for expired in state.generations.expire()? {
        generation_receipts::expire(&mut store, &expired)?;
    }
    generation_receipts::activity(&store.connection)
}

/// Attempt and operation identities for one generation request, in the forms every
/// dispatch uses. The hosted server refuses a grouped request whose identities have
/// any other shape.
fn generation_identity() -> (String, String) {
    (
        execution::new_attempt_id(),
        uuid::Uuid::new_v4().simple().to_string(),
    )
}

/// Parse and validate one completion. Pure, so both outcomes are covered without
/// a provider and a rejected response cannot have written anything.
fn generated_persona(text: &str, language_id: &str) -> Result<PersonaDetails> {
    let details = persona_prompt::parse(text)?;
    persona::validate(&details, language_id)?;
    Ok(details)
}

#[cfg(test)]
mod generation_tests {
    use super::*;

    fn generation_app() -> (tempfile::TempDir, Arc<Application>) {
        let directory = tempfile::tempdir().unwrap();
        let app = Application::start(&directory.path().join("generation.sqlite3"), None);
        app.lock().unwrap().connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl','http://127.0.0.1:8765/v1','$.bearerAuth',json('false'),'$.standardModel','fixture','$.fastModel','fixture')", []).unwrap();
        (directory, app)
    }

    #[test]
    fn failed_durable_begin_releases_volatile_ownership_and_cancel_is_idempotent() {
        let (_directory, app) = generation_app();
        app.lock()
            .unwrap()
            .connection
            .execute_batch("PRAGMA query_only=ON")
            .unwrap();
        for _ in 0..5 {
            let error = reserve_persona_generation(&app, "es".into(), None).unwrap_err();
            assert_eq!(error.code, ErrorCode::Storage);
        }
        app.lock()
            .unwrap()
            .connection
            .execute_batch("PRAGMA query_only=OFF")
            .unwrap();
        let ids: Vec<_> = (0..4)
            .map(|_| reserve_persona_generation(&app, "es".into(), None).unwrap())
            .collect();
        for id in ids {
            cancel_owned_persona_generation(&app, &id).unwrap();
            cancel_owned_persona_generation(&app, &id).unwrap();
            assert!(app.generations.claim(&id).is_err());
        }
        assert!(reserve_persona_generation(&app, "es".into(), None).is_ok());
    }

    #[test]
    fn cancellation_or_authority_change_cannot_adopt_a_completed_proposal() {
        for cancel in [true, false] {
            let (_directory, app) = generation_app();
            let id = reserve_persona_generation(&app, "es".into(), None).unwrap();
            let run = {
                let mut store = app.lock().unwrap();
                let run = app.generations.claim(&id).unwrap();
                generation_receipts::dispatch(&mut store, &run.request).unwrap();
                run.request.mark_submitted();
                run
            };
            if cancel {
                cancel_owned_persona_generation(&app, &id).unwrap();
            } else {
                app.lock()
                    .unwrap()
                    .connection
                    .execute("UPDATE ai_config SET revision=revision+1", [])
                    .unwrap();
            }
            let proposed = persona::starter("es").unwrap();
            let completion = provider::Completion {
                text: serde_json::to_string(&proposed).unwrap(),
                actual_model: "fixture".into(),
                provider_id: "synthetic".into(),
                finish_reason: "stop".into(),
                input_tokens: Some(4),
                output_tokens: Some(8),
            };
            let error =
                finish_persona_generation(&app, &run.request, Some(&completion), Ok(proposed))
                    .unwrap_err();
            assert_eq!(error.code, ErrorCode::UnknownOutcome);
        }
    }

    #[test]
    fn rejected_proposals_keep_usage_metadata_and_failed_terminal_writes_do_not_adopt() {
        for reject_write in [true, false] {
            let (_directory, app) = generation_app();
            let id = reserve_persona_generation(&app, "es".into(), Some("private brief".into()))
                .unwrap();
            let run = {
                let mut store = app.lock().unwrap();
                let run = app.generations.claim(&id).unwrap();
                generation_receipts::dispatch(&mut store, &run.request).unwrap();
                run.request.mark_submitted();
                run
            };
            let completion = provider::Completion {
                text: "private malformed proposal".into(),
                actual_model: "fixture-actual".into(),
                provider_id: "synthetic".into(),
                finish_reason: "stop".into(),
                input_tokens: Some(4),
                output_tokens: Some(8),
            };
            let outcome = if reject_write {
                app.lock()
                    .unwrap()
                    .connection
                    .execute_batch("PRAGMA query_only=ON")
                    .unwrap();
                Ok(persona::starter("es").unwrap())
            } else {
                generated_persona(&completion.text, "es")
            };
            let error = finish_persona_generation(&app, &run.request, Some(&completion), outcome)
                .unwrap_err();
            if reject_write {
                assert_eq!(error.code, ErrorCode::Storage);
            } else {
                let activity =
                    generation_receipts::activity(&app.lock().unwrap().connection).unwrap();
                assert_eq!(activity.attempts[0].state, "failed");
                assert_eq!(activity.attempts[0].input_tokens, Some(4));
                assert_eq!(activity.attempts[0].output_tokens, Some(8));
                assert_eq!(
                    activity.attempts[0].actual_model.as_deref(),
                    Some("fixture-actual")
                );
                assert!(
                    !serde_json::to_string(&activity)
                        .unwrap()
                        .contains("private")
                );
            }
        }
    }

    #[test]
    fn non_stop_completion_cannot_publish_a_valid_proposal_but_retains_usage() {
        for finish in ["length", "content_filter", "tool_calls", ""] {
            let (_directory, app) = generation_app();
            let id = reserve_persona_generation(&app, "es".into(), None).unwrap();
            let run = {
                let mut store = app.lock().unwrap();
                let run = app.generations.claim(&id).unwrap();
                generation_receipts::dispatch(&mut store, &run.request).unwrap();
                run.request.mark_submitted();
                run
            };
            let proposed = persona::starter("es").unwrap();
            let completed = Ok(provider::Completion {
                text: serde_json::to_string(&proposed).unwrap(),
                actual_model: "fixture".into(),
                provider_id: "synthetic".into(),
                finish_reason: finish.into(),
                input_tokens: Some(9),
                output_tokens: Some(14),
            });
            let outcome =
                generation::accept_completion(&mut app.lock().unwrap(), &run.request, &completed)
                    .map(|_| proposed);
            let error =
                finish_persona_generation(&app, &run.request, completed.as_ref().ok(), outcome)
                    .unwrap_err();
            assert_eq!(error.code, ErrorCode::Provider);
            let view = generation_receipts::activity(&app.lock().unwrap().connection).unwrap();
            assert_eq!(view.attempts[0].state, "failed");
            assert_eq!(view.usage.input_tokens, 9);
            assert_eq!(view.usage.output_tokens, 14);
            assert_eq!(view.usage.unknown_usage, 0);
        }
    }

    #[test]
    fn generation_identities_have_the_shape_the_hosted_server_accepts() {
        let hex = |value: &str| {
            value.len() == 32
                && value
                    .chars()
                    .all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c))
        };
        let (attempt, operation) = generation_identity();
        // The server's rules: operation `[0-9a-f]{32}`, attempt `[0-9]{10}-[0-9a-f]{32}`.
        let (issued, random) = attempt.split_once('-').expect("attempt has an issue time");
        assert!(
            issued.len() == 10 && issued.chars().all(|c| c.is_ascii_digit()),
            "{attempt}"
        );
        assert!(hex(random), "{attempt}");
        assert!(hex(&operation), "{operation}");
    }

    #[test]
    fn a_valid_response_becomes_a_reviewable_persona_and_writes_nothing() {
        let directory = tempfile::tempdir().unwrap();
        let store = Store::open(&directory.path().join("skellyspeak.sqlite3")).unwrap();
        let before = store.snapshot().unwrap();
        let proposed = persona::starter("fr").unwrap();
        let details = generated_persona(&serde_json::to_string(&proposed).unwrap(), "fr").unwrap();
        assert_eq!(details.name, proposed.name);
        assert_eq!(details.vibe, proposed.vibe);
        // A proposal is not a contact: nothing is written until the learner creates one.
        let after = store.snapshot().unwrap();
        assert_eq!(after.revision, before.revision);
        assert!(after.personas.is_empty());
        assert!(after.contacts.is_empty());
        assert!(after.conversations.is_empty());
    }

    #[test]
    fn an_unusable_response_is_refused_and_writes_nothing() {
        let directory = tempfile::tempdir().unwrap();
        let store = Store::open(&directory.path().join("skellyspeak.sqlite3")).unwrap();
        let before = store.snapshot().unwrap().revision;
        assert_eq!(
            generated_persona("not json", "fr").unwrap_err().code,
            ErrorCode::Provider
        );
        // Well-shaped but outside a limit: refused by the same rules an edit obeys.
        let mut oversized = persona::starter("fr").unwrap();
        oversized.vibe = vec!["🌿".into()];
        assert_eq!(
            generated_persona(&serde_json::to_string(&oversized).unwrap(), "fr")
                .unwrap_err()
                .code,
            ErrorCode::Validation
        );
        let after = store.snapshot().unwrap();
        assert_eq!(after.revision, before);
        assert!(after.personas.is_empty());
        assert!(after.contacts.is_empty());
        assert!(after.conversations.is_empty());
    }
}

async fn read_secret(id: String) -> Result<Zeroizing<String>> {
    static READS: std::sync::LazyLock<admission::CredentialReads> =
        std::sync::LazyLock::new(admission::CredentialReads::new);
    READS.read(move || credentials::read(&id)).await
}
async fn scheduler(state: Arc<Application>) {
    let client = match provider::client() {
        Ok(client) => client,
        Err(error) => {
            state.stop(error);
            return;
        }
    };
    loop {
        let mut groups: Vec<Vec<(execution::Dispatch, tokio::sync::OwnedSemaphorePermit)>> =
            Vec::new();
        // Bounded local planning pass; no timer or artificial batch-fill delay.
        for _ in 0..128 {
            let Some(permit) = state.admission.try_chat() else {
                match state.lock().and_then(|store| store.has_ready_work()) {
                    Ok(true) => state.admission.warn_chat_wait(),
                    Ok(false) => {}
                    Err(error) => {
                        state.stop(error);
                        return;
                    }
                }
                break;
            };
            let dispatch = match state.lock().and_then(|mut store| store.dispatch()) {
                Ok(value) => value,
                Err(error) => {
                    state.stop(error);
                    return;
                }
            };
            if let Some(dispatch) = dispatch {
                if dispatch.speech_source.is_none()
                    && dispatch.route != ConnectionRoute::Openrouter
                    && let Some(group) = groups.iter_mut().find(|g| {
                        g[0].0.speech_source.is_none() && grouped::compatible(&g[0].0, &dispatch)
                    })
                {
                    group.push((dispatch, permit));
                    continue;
                }
                groups.push(vec![(dispatch, permit)]);
            } else {
                drop(permit);
                match state.lock().and_then(|store| store.has_ready_work()) {
                    Ok(true) => continue,
                    Ok(false) => break,
                    Err(error) => {
                        state.stop(error);
                        return;
                    }
                }
            }
        }
        for group in groups {
            let state = state.clone();
            let client = client.clone();
            tauri::async_runtime::spawn(async move {
                let (dispatches, permits): (Vec<_>, Vec<_>) = group.into_iter().unzip();
                let mut permits: Vec<_> = permits.into_iter().map(Some).collect();
                let mut finished = vec![false; dispatches.len()];
                let result: Result<()> = async {
                    let first = &dispatches[0];
                    let key = if first.credential.is_empty() { Zeroizing::new(String::new()) }
                        else { read_secret(first.credential.clone()).await? };
                    // A group is captured under one authority; reject before HTTP
                    // if any item lost that authority during credential access.
                    for dispatch in &dispatches {
                        if !state.lock()?.attempt_active(&dispatch.attempt)? {
                            return Err(AppError::new(ErrorCode::Provider, "Operation revoked before grouped dispatch."));
                        }
                        holds::check(&state.lock()?.connection, &dispatch.target)?;
                    }
                    let schemas: Vec<_> = dispatches.iter().map(|d| match &d.gloss_source { Some(source) => linguistics::adapter::source_schema(&source.text).map_err(|_| gloss::validation_error()), None => Ok(linguistics::adapter::output_schema()) }).collect::<Result<Vec<_>>>()?;
                    let outputs: Vec<_> = dispatches.iter().zip(&schemas).map(|(dispatch,schema)| match dispatch.coaching_schema.as_ref() { Some(schema) => provider::RequestOutput::JsonSchema { name: "coaching", schema }, None => gloss::request_output(dispatch.gloss_source.as_ref(), schema) }).collect();
                    if let Some(source) = &first.speech_source {
                        let input = speech_provider::SpeechInput { text: source.text.clone(), voice: source.voice.clone(), language: source.language.clone() };
                        let request = speech_provider::synthesize(&client, &first.target, &key, &input, &first.install_id);
                        tokio::pin!(request);
                        let outcome = loop {
                            tokio::select! {
                                result = &mut request => break result,
                                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                                    if !state.lock()?.attempt_active(&first.attempt)? {
                                        return Err(AppError::new(ErrorCode::UnknownOutcome, "Speech cancelled locally; provider billing may continue."));
                                    }
                                }
                            }
                        };
                        let mut store = state.lock()?;
                        if let Some(audio) = store.finish_speech(first, outcome)? {
                            store.speech_cache.insert(audio)?;
                        }
                        finished[0] = true;
                        permits[0].take();
                    } else if first.route == ConnectionRoute::Openrouter {
                        let request = provider::complete_with_output(&client, &key, first, outputs[0]);
                        tokio::pin!(request);
                        let outcome = loop {
                            tokio::select! {
                                result = &mut request => break result,
                                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                                    if !state.lock()?.attempt_active(&first.attempt)? {
                                        return Err(AppError::new(ErrorCode::UnknownOutcome, "Request cancelled locally; provider billing may continue."));
                                    }
                                }
                            }
                        };
                        state.lock()?.finish(first, outcome)?;
                        finished[0] = true;
                        permits[0].take();
                    } else {
                        let request = grouped::request_with_outputs(&client, &key, &dispatches, &outputs, |index, outcome| {
                            state.lock()?.finish(&dispatches[index], outcome)?;
                            finished[index] = true;
                            permits[index].take();
                            Ok(())
                        });
                        tokio::pin!(request);
                        loop {
                            tokio::select! {
                                result = &mut request => { result?; break; },
                                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                                    let store = state.lock()?;
                                    let mut active = false;
                                    for dispatch in &dispatches { active |= store.attempt_active(&dispatch.attempt)?; }
                                    if !active { break; }
                                }
                            }
                        }
                    }
                    Ok(())
                }.await;
                // A broken stream must not overwrite already committed siblings.
                for (index, dispatch) in dispatches.iter().enumerate() {
                    if !finished[index] {
                        let error = result.as_ref().err().cloned().unwrap_or_else(|| AppError::new(ErrorCode::UnknownOutcome, "Grouped operation has no confirmed result. No automatic retry was made."));
                        if let Err(error) = state.lock().and_then(|mut store| {
                            if dispatch.speech_source.is_some() {
                                store
                                    .finish_speech(
                                        dispatch,
                                        speech_provider::SpeechOutcome {
                                            audio: Err(error),
                                            actual_model: None,
                                            provider_id: None,
                                            input_tokens: None,
                                            output_tokens: None,
                                            cost_micros: None,
                                            finish_reason: None,
                                        },
                                    )
                                    .map(|_| ())
                            } else {
                                store.finish(dispatch, Err(error))
                            }
                        }) {
                            state.stop(error);
                        }
                    }
                }
            });
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());
    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_deep_link::init());
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .on_menu_event(|app, event| {
            let action = if event.id() == "reading-size-increase" {
                Some("increase")
            } else if event.id() == "reading-size-decrease" {
                Some("decrease")
            } else if event.id() == "reading-size-reset" {
                Some("reset")
            } else {
                None
            };
            if let Some(action) = action
                && let Err(error) = app.emit("reading-size-action", action)
            {
                eprintln!("Unable to deliver reading-size menu action: {error}");
            }
        });
    builder
        .setup(|app| {
            #[cfg(desktop)]
            {
                let app_menu = SubmenuBuilder::new(app, "SkellySpeak")
                    .about(None)
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .separator()
                    .quit()
                    .build()?;
                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;
                let view_menu = SubmenuBuilder::new(app, "View")
                    .item(
                        &MenuItemBuilder::with_id("reading-size-increase", "Increase Font Size")
                            .accelerator("CmdOrCtrl+=")
                            .build(app)?,
                    )
                    .item(
                        &MenuItemBuilder::with_id("reading-size-decrease", "Decrease Font Size")
                            .accelerator("CmdOrCtrl+-")
                            .build(app)?,
                    )
                    .item(
                        &MenuItemBuilder::with_id("reading-size-reset", "Reset Font Size")
                            .accelerator("CmdOrCtrl+0")
                            .build(app)?,
                    )
                    .build()?;
                let window_menu = SubmenuBuilder::new(app, "Window")
                    .minimize()
                    .close_window()
                    .build()?;
                app.set_menu(
                    MenuBuilder::new(app)
                        .items(&[&app_menu, &edit_menu, &view_menu, &window_menu])
                        .build()?,
                )?;
            }
            let directory = app.path().app_data_dir()?;
            store::prepare_private_directory(&directory)?;
            // A previous reset may have left the log directory to clear. That has to
            // happen before the log sink below opens a file inside it.
            // Android/iOS use a subdirectory of app data: it is private, writable,
            // and available before the webview starts. Desktop retains the platform
            // log directory (or the development repository sink) in diagnostics.
            #[cfg(any(target_os = "android", target_os = "ios"))]
            let diagnostics_root = directory.join("logs");
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            let diagnostics_root = app.path().app_log_dir()?;
            let cleanup = factory_reset::finish_pending(
                &directory,
                &diagnostics::configured_root(&diagnostics_root)?,
            )
            .err();
            diagnostics::initialize(&diagnostics_root)?;
            let state = Application::start(&directory.join(store::WORKSPACE_FILE), cleanup);
            // A refused workspace has nothing to clean or prepare; the window still
            // opens, the reason reaches the screen, and the reset stays reachable.
            if state.refusal().is_none() {
                state.clean_credentials()?;
                state.lock()?.prepare_chat()?;
            }
            app.manage(state.clone());
            tauri::async_runtime::spawn(scheduler(state));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            updater::get_update_channel,
            updater::latest_github_release,
            read_speech_audio,
            diagnostics::record_frontend_diagnostic,
            diagnostics::read_frontend_diagnostics,
            voice::mic_start,
            voice::mic_wave,
            voice::mic_cancel,
            voice::mic_transcribe,
            factory_reset::factory_reset,
            factory_reset::export_workspace,
            get_startup_state,
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
            begin_persona_generation,
            run_persona_generation,
            cancel_persona_generation,
            hosted_sign_in,
            hosted_account,
            hosted_diagnostics,
            hosted_sign_out,
            cancel_sign_in,
            select_route,
            get_profile,
            get_persona_generation_activity,
            progression::get_skill_evidence,
            reward_settings::get_reward_settings,
            reward_settings::get_playback_rate,
            reward_settings::save_playback_rate,
            reward_settings::save_reward_settings,
            progression::save_skill_profile,
            progression::get_practice_overview,
            open_ai_window
        ])
        .run(tauri::generate_context!())
        .expect("SkellySpeak could not start; no reset or fallback was performed");
}

#[cfg(test)]
mod credential_io_tests {
    use super::*;

    /// A fixture workspace that must open; a refusal here is a broken fixture.
    fn application(path: &std::path::Path) -> Arc<Application> {
        let app = Application::start(path, None);
        assert!(app.refusal().is_none(), "the fixture workspace must open");
        app
    }

    /// An older workspace is refused by design; the application must survive it so
    /// the reason can reach the screen and the reset stays reachable.
    #[test]
    fn a_refused_workspace_leaves_the_application_running_with_the_reason_recorded() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("skellyspeak.sqlite3");
        drop(Store::open(&path).unwrap());
        {
            let connection = rusqlite::Connection::open(&path).unwrap();
            connection.pragma_update(None, "user_version", 8).unwrap();
        }
        let app = Application::start(&path, None);
        let refusal = app.refusal().expect("the refusal is recorded");
        assert!(
            refusal.message.contains("Factory Reset"),
            "{}",
            refusal.message
        );
        let error = match app.lock() {
            Ok(_) => panic!("a refused workspace must not hand out a store"),
            Err(error) => error,
        };
        assert_eq!(error.message, refusal.message);
    }

    #[test]
    fn blocked_credential_io_releases_workspace_and_rechecks_revision() {
        for change_revision in [false, true] {
            let directory = tempfile::tempdir().unwrap();
            let app = application(&directory.path().join("test.sqlite3"));
            let revision = app.lock().unwrap().connection_config().unwrap().revision;
            let worker = app.clone();
            let (started, wait_started) = std::sync::mpsc::channel();
            let (resume, wait_resume) = std::sync::mpsc::channel();
            let removed = Arc::new(Mutex::new(Vec::new()));
            let deletions = removed.clone();
            let task = std::thread::spawn(move || {
                worker.write_credential_with(
                    |_| Ok(()),
                    |_| {
                        started.send(()).unwrap();
                        wait_resume.recv().unwrap();
                        Ok(())
                    },
                    |store, id| {
                        store.set_connection(revision, Some(id), "fixture-standard", "fixture-fast")
                    },
                    |id| {
                        assert!(
                            worker.store.try_lock().is_ok(),
                            "Credential deletion held the workspace lock"
                        );
                        deletions.lock().unwrap().push(id.to_owned());
                        Ok(())
                    },
                )
            });
            wait_started.recv_timeout(Duration::from_secs(2)).unwrap();
            let mut store = app
                .store
                .try_lock()
                .expect("Blocked credential save held workspace lock");
            assert!(store.as_mut().unwrap().snapshot().is_ok());
            assert!(
                store
                    .as_mut()
                    .unwrap()
                    .claim_credential_cleanup()
                    .unwrap()
                    .is_none(),
                "Cleanup claimed an in-flight write"
            );
            if change_revision {
                store
                    .as_mut()
                    .unwrap()
                    .connection
                    .execute("UPDATE ai_config SET revision=revision+1", [])
                    .unwrap();
            }
            drop(store);
            resume.send(()).unwrap();
            let result = task.join().unwrap();
            let store = app.lock().unwrap();
            if change_revision {
                assert_eq!(result.unwrap_err().code, ErrorCode::Conflict);
                assert!(store.credential_id().unwrap().is_none());
                assert_eq!(removed.lock().unwrap().len(), 1);
            } else {
                result.unwrap();
                assert!(store.credential_id().unwrap().is_some());
                assert!(removed.lock().unwrap().is_empty());
            }
            assert!(store.credential_writes.is_empty());
            assert_eq!(
                store
                    .connection
                    .query_row("SELECT count(*) FROM credential_cleanup", [], |r| r
                        .get::<_, i64>(0))
                    .unwrap(),
                0
            );
        }
    }

    #[test]
    fn failed_keychain_io_releases_claims_and_keeps_failed_cleanup_retryable() {
        let directory = tempfile::tempdir().unwrap();
        let app = application(&directory.path().join("test.sqlite3"));
        let fail = || AppError::new(ErrorCode::Credential, "Synthetic credential failure.");
        let result: Result<()> = app.write_credential_with(
            |_| Ok(()),
            |_| Err(fail()),
            |_, _| panic!("Failed write must not commit"),
            |_| Err(fail()),
        );
        assert_eq!(result.unwrap_err().code, ErrorCode::Credential);
        {
            let store = app.lock().unwrap();
            assert!(store.credential_writes.is_empty());
            assert!(store.credential_id().unwrap().is_none());
            assert_eq!(
                store
                    .connection
                    .query_row("SELECT count(*) FROM credential_cleanup", [], |r| r
                        .get::<_, i64>(0))
                    .unwrap(),
                1
            );
        }
        app.clean_credentials_with(|_| {
            assert!(app.store.try_lock().is_ok());
            Ok(())
        })
        .unwrap();
        assert_eq!(
            app.lock()
                .unwrap()
                .connection
                .query_row("SELECT count(*) FROM credential_cleanup", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
}
