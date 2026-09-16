use super::*;

#[tauri::command]
pub(in crate::application) fn get_connection(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<ConnectionConfig> {
    state.lock()?.connection_config()
}

#[tauri::command]
pub(in crate::application) async fn save_connection(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
    api_key: Option<String>,
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
                    let config = store.connection_config()?;
                    store.set_connection(
                        expected_revision,
                        Some(id),
                        &config.standard_model,
                        &config.fast_model,
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
                let config = store.connection_config()?;
                store.set_connection(
                    expected_revision,
                    Some(&id),
                    &config.standard_model,
                    &config.fast_model,
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
pub(in crate::application) fn save_models(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
    standard_model: String,
    fast_model: String,
    transcription_model: String,
) -> Result<ConnectionConfig> {
    let mut store = state.lock()?;
    store.set_models(
        expected_revision,
        standard_model.trim(),
        fast_model.trim(),
        transcription_model.trim(),
    )?;
    store.connection_config()
}

#[tauri::command]
pub(in crate::application) async fn verify_openrouter_key(
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
pub(in crate::application) async fn disconnect(
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
pub(in crate::application) fn select_route(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
    route: ConnectionRoute,
) -> Result<ConnectionConfig> {
    let mut store = state.lock()?;
    store.select_route(expected_revision, route)?;
    store.connection_config()
}
