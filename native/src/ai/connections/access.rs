//! Capability resolution is shared by chat, speech and microphone operations. Adapters
//! consume captured targets; they never choose credentials or fall back to a route.
use crate::ai::connections::credentials;
use crate::ai::hosted;
use crate::ai::transport::provider;
use crate::application::Application;
use crate::conversations::execution;
use crate::model::*;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::{sync::Arc, time::Duration};
use zeroize::Zeroizing;

const DEFAULT_CUSTOM_BASE_URL: &str = "http://127.0.0.1:8765/v1";

#[derive(Clone, Copy)]
pub enum Capability {
    Chat,
    Transcription,
    Speech,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedTarget {
    pub route: ConnectionRoute,
    pub revision: i32,
    pub url: String,
    pub model: String,
    pub credential: Option<String>,
}
fn error(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}
fn conflict() -> AppError {
    AppError::new(
        ErrorCode::Conflict,
        "AI settings changed. Reload before continuing.",
    )
}
pub fn settings(db: &Connection) -> Result<AccessSettings> {
    let (revision,groq,custom,config): (i32,bool,bool,String) = db.query_row("SELECT revision,groq_credential_id IS NOT NULL,custom_credential_id IS NOT NULL,custom_config FROM ai_config",[],|r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)))?;
    Ok(AccessSettings {
        credential_previews: None,
        custom_url_is_unsaved_default: false,
        revision,
        groq_key_configured: groq,
        custom_key_configured: custom,
        custom: serde_json::from_str(&config)?,
    })
}
pub fn validate_custom(value: &CustomEndpoint) -> Result<()> {
    base_url(&value.base_url)?;
    Ok(())
}
pub fn base_url(value: &str) -> Result<reqwest::Url> {
    let url = reqwest::Url::parse(value).map_err(|_| {
        error("Enter a complete API base URL, including https:// or http:// for loopback.")
    })?;
    let local = url.host_str().is_some_and(|h| {
        h == "localhost"
            || h.trim_matches(['[', ']'])
                .parse::<std::net::IpAddr>()
                .is_ok_and(|ip| ip.is_loopback())
    });
    if !(url.scheme() == "https" || (url.scheme() == "http" && local))
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(error(
            "Use HTTPS, or HTTP on localhost/loopback. Put authentication in the key field; URLs cannot contain credentials, query strings or fragments.",
        ));
    }
    Ok(url)
}

fn validate_key_destination(
    saved: &AccessSettings,
    custom: Option<&CustomEndpoint>,
    replacing_or_removing: bool,
) -> Result<()> {
    if let Some(custom) = custom
        && saved.custom_key_configured
        && !replacing_or_removing
        && base_url(&saved.custom.base_url)?
            .as_str()
            .trim_end_matches('/')
            != base_url(&custom.base_url)?.as_str().trim_end_matches('/')
    {
        return Err(error(
            "Enter a replacement key for this API base URL, or restore the saved URL and remove its key first.",
        ));
    }
    Ok(())
}
pub fn resolve(db: &Connection, capability: Capability) -> Result<ResolvedTarget> {
    let config = execution::config(db)?;
    let access = settings(db)?;
    let (base, model, column) = match (config.route, capability) {
        (ConnectionRoute::Hosted, Capability::Chat) => (
            format!("{}/v1", hosted::ORIGIN),
            config.standard_model,
            "hosted_credential_id",
        ),
        (ConnectionRoute::Hosted, Capability::Speech) => (
            format!("{}/v1", hosted::ORIGIN),
            super::model_routing::SPEECH_MODEL.into(),
            "hosted_credential_id",
        ),
        (ConnectionRoute::Hosted, Capability::Transcription) => (
            format!("{}/v1", hosted::ORIGIN),
            config.transcription_model.clone(),
            "hosted_credential_id",
        ),
        (ConnectionRoute::Openrouter, Capability::Chat) => (
            "https://openrouter.ai/api/v1".into(),
            config.standard_model,
            "credential_id",
        ),
        (ConnectionRoute::Openrouter, Capability::Speech) => (
            "https://openrouter.ai/api/v1".into(),
            super::model_routing::SPEECH_MODEL.into(),
            "credential_id",
        ),
        (ConnectionRoute::Openrouter, Capability::Transcription) => (
            "https://api.groq.com/openai/v1".into(),
            config.transcription_model.clone(),
            "groq_credential_id",
        ),
        (ConnectionRoute::Custom, _) => {
            validate_custom(&access.custom)?;
            let model = match capability {
                Capability::Chat => config.standard_model.clone(),
                Capability::Speech => super::model_routing::SPEECH_MODEL.into(),
                Capability::Transcription => config.transcription_model.clone(),
            };
            (
                access.custom.base_url.clone(),
                model,
                "custom_credential_id",
            )
        }
    };
    let needs_key = config.route != ConnectionRoute::Custom || access.custom.bearer_auth;
    let credential = if needs_key {
        let id: Option<String> =
            db.query_row(&format!("SELECT {column} FROM ai_config"), [], |r| r.get(0))?;
        Some(id.ok_or_else(|| {
            error(match (config.route, capability) {
                (ConnectionRoute::Hosted, _) => "Sign in with Google in AI access settings.",
                (ConnectionRoute::Openrouter, Capability::Transcription) => {
                    "Add a Groq API key in AI access settings to transcribe recordings."
                }
                (ConnectionRoute::Openrouter, _) => {
                    "Add an OpenRouter API key in AI access settings."
                }
                (ConnectionRoute::Custom, _) => {
                    "Add the custom endpoint's bearer key in AI access settings."
                }
            })
        })?)
    } else {
        None
    };
    let path = match capability {
        Capability::Chat if config.route != ConnectionRoute::Openrouter => "operations",
        Capability::Chat | Capability::Speech => "chat/completions",
        Capability::Transcription => "audio/transcriptions",
    };
    Ok(ResolvedTarget {
        route: config.route,
        revision: config.revision,
        url: format!("{}/{path}", base.trim_end_matches('/')),
        model,
        credential,
    })
}
#[tauri::command]
pub async fn get_access_settings(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<AccessSettings> {
    let (mut settings, ids) = {
        let store = state.lock()?;
        let settings = settings_for_editing(&store.connection)?;
        let ids: [Option<String>; 3] = store.connection.query_row(
            "SELECT credential_id,groq_credential_id,custom_credential_id FROM ai_config",
            [],
            |row| Ok([row.get(0)?, row.get(1)?, row.get(2)?]),
        )?;
        (settings, ids)
    };
    let mut previews = std::collections::BTreeMap::new();
    for (provider, id) in ["openrouter", "groq", "custom"].into_iter().zip(ids) {
        if let Some(id) = id {
            let secret = crate::application::read_secret(id).await?;
            previews.insert(provider.into(), credentials::preview(&secret));
        }
    }
    if self::settings(&state.lock()?.connection)?.revision != settings.revision {
        return Err(conflict());
    }
    settings.credential_previews = Some(previews);
    Ok(settings)
}

fn settings_for_editing(db: &Connection) -> Result<AccessSettings> {
    let mut value = settings(db)?;
    // This is an editable default, never a resolver fallback or storage rewrite.
    if value.custom.base_url.is_empty() && !value.custom_key_configured {
        value.custom.base_url = DEFAULT_CUSTOM_BASE_URL.into();
        value.custom_url_is_unsaved_default = true;
    }
    Ok(value)
}

// Saving one provider must not overwrite or activate another provider's profile.
#[tauri::command]
pub async fn save_access_settings(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
    custom: Option<CustomEndpoint>,
    api_key: Option<String>,
    remove_key: bool,
) -> Result<AccessSettings> {
    let key = api_key.map(|s| Zeroizing::new(s.trim().to_owned()));
    validate_save_input(
        custom.as_ref(),
        key.as_ref().map(|k| k.as_str()),
        remove_key,
    )
    .map_err(|(code, error)| {
        crate::diagnostics::native_event(code, &[]);
        error
    })?;
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let prepare = |store: &mut crate::storage::store::Store| -> Result<()> {
            if settings(&store.connection)?.revision != expected_revision {
                crate::diagnostics::native_event("access_save_revision_conflict", &[]);
                return Err(conflict());
            }
            validate_key_destination(&settings(&store.connection)?, custom.as_ref(), key.is_some() || remove_key)
                .inspect_err(|_| { crate::diagnostics::native_event("access_save_destination_changed", &[]); })
        };
        let commit = |store: &mut crate::storage::store::Store, id: Option<&str>| -> Result<AccessSettings> {
            let tx = store.connection.transaction()?;
            if settings(&tx)?.revision != expected_revision {
                crate::diagnostics::native_event("access_save_revision_conflict", &[]);
                return Err(conflict());
            }
            let column = if custom.is_some() { "custom_credential_id" } else { "groq_credential_id" };
            if id.is_some() || remove_key {
                tx.execute(&format!("INSERT OR IGNORE INTO credential_cleanup SELECT {column} FROM ai_config WHERE {column} IS NOT NULL"),[])?;
                tx.execute(&format!("UPDATE ai_config SET {column}=?1"),[id])?;
                if let Some(id) = id { tx.execute("DELETE FROM credential_cleanup WHERE id=?1",[id])?; }
            }
            if let Some(custom) = &custom {
                tx.execute("UPDATE ai_config SET custom_config=?1",[serde_json::to_string(custom)?])?;
            }
            tx.execute("UPDATE ai_config SET revision=revision+1",[])?;
            execution::invalidate(&tx,Some(if custom.is_some() { ConnectionRoute::Custom } else { ConnectionRoute::Openrouter }))?;
            tx.execute("UPDATE metadata SET revision=revision+1",[])?;
            tx.commit()?;
            settings(&store.connection)
        };
        if let Some(key) = &key {
            state.write_credential_with(prepare, |id| credentials::save(id,key),
                |store,id| commit(store,Some(id)), credentials::remove)
        } else {
            let result = {
                let mut store = state.lock()?;
                prepare(&mut store)?;
                commit(&mut store,None)
            };
            state.clean_credentials()?;
            result
        }
    }).await.map_err(|_| error("Saving AI access settings stopped unexpectedly."))?
}

fn validate_save_input(
    custom: Option<&CustomEndpoint>,
    key: Option<&str>,
    remove_key: bool,
) -> std::result::Result<(), (&'static str, AppError)> {
    if let Some(value) = custom {
        base_url(&value.base_url).map_err(|e| ("access_save_url_invalid", e))?;
        validate_custom(value).map_err(|e| ("access_save_endpoint_invalid", e))?;
    }
    if let Some(key) = key {
        provider::validate_key_format(key).map_err(|e| ("access_save_key_invalid", e))?;
    }
    if remove_key && key.is_some() {
        return Err((
            "access_save_remove_replace_conflict",
            error("Remove or replace the key, not both."),
        ));
    }
    Ok(())
}

pub async fn response_bytes(
    mut response: reqwest::Response,
    label: &str,
    route: ConnectionRoute,
    limit: usize,
) -> Result<Vec<u8>> {
    if !response.status().is_success() {
        let status = response.status().as_u16();
        if let Some(message) =
            super::auth_errors::message(route, response.url().as_str(), label, status)
        {
            return Err(AppError::new(ErrorCode::Provider, message));
        }
        let hint = match status {
            404 | 405 | 415 | 422 => "Check the endpoint protocol, capability and model ID.",
            429 => "Rate or allowance limit reached; wait before retrying.",
            _ => "Check the endpoint service.",
        };
        let error = AppError::new(
            ErrorCode::Provider,
            format!("{label}: HTTP {status}. {hint} No automatic retry was made."),
        );
        return Err(if status == 429 {
            error.with_refusal(crate::ai::policy::refusal::from_response(&response))
        } else {
            error
        });
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| error(format!("{label}: response interrupted.")))?
    {
        if body.len() + chunk.len() > limit {
            return Err(error(format!("{label}: response exceeds the size limit.")));
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}
#[tauri::command]
pub async fn check_access(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
    custom: bool,
) -> Result<AccessCheck> {
    let (url, credential) = {
        let store = state.lock()?;
        let access = settings(&store.connection)?;
        if access.revision != expected_revision {
            return Err(conflict());
        }
        if custom {
            validate_custom(&access.custom)?;
        }
        let column = if custom {
            "custom_credential_id"
        } else {
            "groq_credential_id"
        };
        let credential: Option<String> =
            store
                .connection
                .query_row(&format!("SELECT {column} FROM ai_config"), [], |r| r.get(0))?;
        let key = if custom && !access.custom.bearer_auth {
            None
        } else {
            Some(credential.ok_or_else(|| error("Save an API key first."))?)
        };
        (
            if custom {
                format!(
                    "{}/protocol?verify_providers=true",
                    access.custom.base_url.trim_end_matches('/')
                )
            } else {
                "https://api.groq.com/openai/v1/models".into()
            },
            key,
        )
    };
    let key = match credential {
        Some(id) => crate::application::read_secret(id).await?,
        None => Zeroizing::new(String::new()),
    };
    if state.lock()?.connection_config()?.revision != expected_revision {
        return Err(conflict());
    }
    let request = provider::client()?
        .get(url)
        .timeout(Duration::from_secs(15));
    let request = if key.is_empty() {
        request
    } else {
        request.bearer_auth(key.as_str())
    };
    let response = request
        .send()
        .await
        .map_err(|_| error("Connection check failed. Check the endpoint and network."))?;
    let value: serde_json::Value = serde_json::from_slice(
        &response_bytes(
            response,
            "Connection check",
            if custom {
                ConnectionRoute::Custom
            } else {
                ConnectionRoute::Openrouter
            },
            262144,
        )
        .await?,
    )
    .map_err(|_| error("Endpoint returned invalid JSON."))?;
    if custom {
        if value["protocol"] != "skellyspeak"
            || value["version"].as_u64() != Some(1)
            || value["max_items"].as_u64() != Some(8)
        {
            return Err(error(
                "The endpoint does not implement SkellySpeak protocol version 1.",
            ));
        }
        let store = state.lock()?;
        if store.connection_config()?.revision != expected_revision {
            return Err(conflict());
        }
        // Capability model lists are recommendations, not availability gates.
        // The selected provider validates the configured model during inference.
        let providers: Vec<ProviderCredentialCheck> =
            serde_json::from_value(value["providers"].clone()).map_err(|_| {
                error("Update the custom server to support internal provider credential checks.")
            })?;
        if providers.len() != 2
            || ["OPENROUTER", "GROQ"]
                .iter()
                .any(|name| providers.iter().filter(|p| p.provider == *name).count() != 1)
            || providers.iter().any(|p| {
                !matches!(
                    p.state.as_str(),
                    "accepted" | "rejected" | "unreachable" | "invalid_response"
                )
            })
        {
            return Err(error("Server returned invalid provider credential checks."));
        }
        return Ok(AccessCheck { providers });
    }
    let models = value["data"].as_array().ok_or_else(||error("Endpoint did not return an OpenAI-compatible model list. This check does not establish inference support."))?;
    if !models
        .iter()
        .all(|m| m["id"].as_str().is_some_and(|id| !id.is_empty()))
    {
        return Err(error("Endpoint returned an invalid model list."));
    }
    if state.lock()?.connection_config()?.revision != expected_revision {
        return Err(conflict());
    }
    Ok(AccessCheck {
        providers: vec![ProviderCredentialCheck {
            provider: "GROQ".into(),
            state: "accepted".into(),
            status: Some(200),
            duration_ms: 0,
        }],
    })
}

#[derive(Debug)]
pub struct TranscriptionResponse {
    pub text: String,
    pub verbose: Option<crate::speech::analysis::fluency::VerboseTranscript>,
}
fn transcription_form(
    target: &ResolvedTarget,
    wav: Vec<u8>,
    language: Option<&str>,
    variety_hint: &str,
) -> Result<reqwest::multipart::Form> {
    let verbose = target.route == ConnectionRoute::Openrouter;
    let mut form = reqwest::multipart::Form::new()
        .text("model", target.model.clone())
        .text(
            "response_format",
            if verbose { "verbose_json" } else { "json" },
        )
        .text("prompt", variety_hint.to_owned())
        .part(
            "file",
            reqwest::multipart::Part::bytes(wav)
                .file_name("audio.wav")
                .mime_str("audio/wav")
                .map_err(|_| error("Invalid audio type."))?,
        );
    if let Some(language) = language {
        form = form.text("language", language.to_owned());
    }
    if verbose {
        form = form
            .text("timestamp_granularities[]", "word")
            .text("timestamp_granularities[]", "segment");
    }
    Ok(form)
}
fn transcription_response(bytes: &[u8], verbose: bool) -> Result<TranscriptionResponse> {
    let unknown = || {
        AppError::new(
            ErrorCode::UnknownOutcome,
            "Endpoint returned an invalid transcription response. Processing may have incurred a charge; no automatic retry was made.",
        )
    };
    let (text, verbose) = if verbose {
        let raw = std::str::from_utf8(bytes).map_err(|_| unknown())?;
        let parsed =
            crate::speech::analysis::fluency::parse_verbose_json(raw).map_err(|_| unknown())?;
        (parsed.text.clone(), Some(parsed))
    } else {
        #[derive(Deserialize)]
        struct Transcript {
            text: String,
        }
        let parsed: Transcript = serde_json::from_slice(bytes).map_err(|_| unknown())?;
        (parsed.text, None)
    };
    if text.trim().is_empty() {
        return Err(error("No speech was recognized. Try another recording."));
    }
    if text.chars().count() > 20000 || text.contains('\0') {
        return Err(error("Transcription exceeds the message limits."));
    }
    Ok(TranscriptionResponse { text, verbose })
}
pub async fn transcribe(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    wav: Vec<u8>,
    language: Option<&str>,
    variety_hint: &str,
    install: &str,
) -> Result<TranscriptionResponse> {
    if wav.is_empty() || wav.len() > 25 * 1024 * 1024 {
        return Err(error("Recording must contain audio and be at most 25 MB."));
    }
    let form = transcription_form(target, wav, language, variety_hint)?;
    let request = client.post(&target.url);
    let request = if key.is_empty() {
        request
    } else {
        request.bearer_auth(key)
    };
    let request = if target.route == ConnectionRoute::Hosted {
        hosted::identity(request, install)
    } else {
        request
    };
    let response = request
        .multipart(form)
        .send()
        .await
        .map_err(|_| AppError::new(ErrorCode::UnknownOutcome, "Transcription outcome is unknown after a connection failure. Processing may have incurred a charge. No automatic retry was made."))?;
    let status = response.status();
    let bytes = if target.route == ConnectionRoute::Hosted {
        hosted::body(response).await
    } else {
        response_bytes(response, "Transcription", target.route, 1_048_576).await
    }
    .map_err(|mut error| {
        if !status.is_client_error() {
            error.code = ErrorCode::UnknownOutcome;
        }
        error
    })?;
    transcription_response(&bytes, target.route == ConnectionRoute::Openrouter)
}

#[cfg(test)]
mod tests {
    #[test]
    fn save_validation_reports_allowlisted_reason_without_private_input() {
        let mut custom = crate::model::CustomEndpoint {
            base_url: String::new(),
            bearer_auth: true,
        };
        assert_eq!(
            super::validate_save_input(Some(&custom), None, false)
                .unwrap_err()
                .0,
            "access_save_url_invalid"
        );
        custom.base_url = "http://127.0.0.1:8765/v1".into();
        assert!(super::validate_save_input(Some(&custom), Some("fixture-secret"), false).is_ok());
        let (code, error) =
            super::validate_save_input(Some(&custom), Some("PRIVATE KEY"), false).unwrap_err();
        assert_eq!(code, "access_save_key_invalid");
        assert!(!error.message.contains("PRIVATE"));
        // An unused blank custom profile must not block a Groq-key save.
        assert!(super::validate_save_input(None, Some("fixture-secret"), false).is_ok());
        assert_eq!(
            super::validate_save_input(None, Some("fixture-secret"), true)
                .unwrap_err()
                .0,
            "access_save_remove_replace_conflict"
        );
    }

    use super::*;
    fn db() -> Connection {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../storage/schemas/schema.sql"))
            .unwrap();
        db
    }
    #[test]
    fn fresh_custom_setup_uses_shared_models_and_voice_enabled() {
        let database = db();
        let endpoint = settings(&database).unwrap().custom;
        let models = execution::config(&database).unwrap();
        assert_eq!(models.standard_model, "google/gemini-2.5-flash");
        assert_eq!(models.fast_model, "google/gemini-2.5-flash-lite");
        assert_eq!(models.transcription_model, "whisper-large-v3");
        assert!(endpoint.bearer_auth);
        assert_eq!(endpoint.base_url, DEFAULT_CUSTOM_BASE_URL);
        validate_custom(&endpoint).unwrap();
    }
    #[test]
    fn editable_local_url_default_never_rewrites_or_resolves_unsaved_settings() {
        let database = db();
        for saved_url in ["", "https://fixture.example/v1"] {
            database
                .execute(
                    "UPDATE ai_config SET custom_config=json_set(custom_config,'$.baseUrl',?1)",
                    [saved_url],
                )
                .unwrap();
            let before: (i32, String, String) = database
                .query_row(
                    "SELECT revision,route,custom_config FROM ai_config",
                    [],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                )
                .unwrap();
            let edited = settings_for_editing(&database).unwrap();
            assert_eq!(
                edited.custom.base_url,
                if saved_url.is_empty() {
                    DEFAULT_CUSTOM_BASE_URL
                } else {
                    saved_url
                }
            );
            assert_eq!(settings(&database).unwrap().custom.base_url, saved_url);
            assert!(edited.custom.bearer_auth);
            let after: (i32, String, String) = database
                .query_row(
                    "SELECT revision,route,custom_config FROM ai_config",
                    [],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                )
                .unwrap();
            assert_eq!(after, before);
        }
        database.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl','')", []).unwrap();
        assert!(resolve(&database, Capability::Chat).is_err());
        database.execute("UPDATE ai_config SET custom_config=json_set(custom_config,'$.bearerAuth',json('false'))", []).unwrap();
        let mut draft = settings_for_editing(&database).unwrap().custom;
        assert!(!draft.bearer_auth);
        assert_eq!(draft.base_url, DEFAULT_CUSTOM_BASE_URL);
        draft.base_url.clear();
        assert_eq!(
            validate_save_input(Some(&draft), None, false)
                .unwrap_err()
                .0,
            "access_save_url_invalid"
        );
        database
            .execute(
                "UPDATE ai_config SET custom_credential_id='fixture-existing-id'",
                [],
            )
            .unwrap();
        assert!(
            settings_for_editing(&database)
                .unwrap()
                .custom
                .base_url
                .is_empty()
        );
    }
    fn custom(db: &Connection, auth: bool) {
        let value = CustomEndpoint {
            base_url: "http://127.0.0.1:1234/v1/".into(),
            bearer_auth: auth,
        };
        db.execute(
            "UPDATE ai_config SET route='custom',custom_config=?1",
            [serde_json::to_string(&value).unwrap()],
        )
        .unwrap();
    }
    #[test]
    fn custom_transport_policy_rejects_credential_urls_and_remote_cleartext() {
        for url in [
            "http://localhost:1234/v1",
            "http://127.0.0.1:9000",
            "http://[::1]:8000/v1",
            "https://example.com/api/v1",
        ] {
            base_url(url).unwrap();
        }
        for url in [
            "http://192.168.1.2/v1",
            "http://localhost.evil.test/v1",
            "https://key:secret@example.com",
            "https://example.com?key=secret",
            "https://example.com#secret",
            "file:///tmp/server",
            "ftp://localhost/v1",
        ] {
            assert!(base_url(url).is_err(), "{url}");
        }
    }
    #[test]
    fn saved_custom_key_cannot_follow_a_changed_destination() {
        let db = db();
        custom(&db, true);
        db.execute("UPDATE ai_config SET custom_credential_id='saved-key'", [])
            .unwrap();
        let saved = settings(&db).unwrap();
        let mut next = saved.custom.clone();
        validate_key_destination(&saved, Some(&next), false).unwrap();
        for destination in [
            "https://other.example/v1",
            "http://127.0.0.1:4321/v1",
            "http://127.0.0.1:1234/other-tenant",
        ] {
            next.base_url = destination.into();
            assert!(validate_key_destination(&saved, Some(&next), false).is_err());
            validate_key_destination(&saved, Some(&next), true).unwrap();
        }
        validate_key_destination(&saved, None, false).unwrap();
    }

    #[test]
    fn direct_capabilities_use_distinct_credentials_and_never_require_hosted_auth() {
        let db = db();
        db.execute("UPDATE ai_config SET route='openrouter',credential_id='chat-key',groq_credential_id='voice-key'",[]).unwrap();
        let chat = resolve(&db, Capability::Chat).unwrap();
        let audio = resolve(&db, Capability::Transcription).unwrap();
        assert_eq!(chat.credential.as_deref(), Some("chat-key"));
        assert_eq!(audio.credential.as_deref(), Some("voice-key"));
        assert_eq!(
            audio.url,
            "https://api.groq.com/openai/v1/audio/transcriptions"
        );
        db.execute(
            "UPDATE ai_config SET groq_credential_id=NULL,hosted_credential_id='hosted-key'",
            [],
        )
        .unwrap();
        assert!(resolve(&db, Capability::Chat).is_ok());
        assert!(
            resolve(&db, Capability::Transcription)
                .unwrap_err()
                .message
                .contains("Groq")
        );
    }
    #[test]
    fn speech_uses_only_selected_route_credentials_and_never_grouped_transport() {
        let db = db();
        for (route, credential, prefix) in [
            ("hosted", "hosted-key", format!("{}/v1", hosted::ORIGIN)),
            (
                "openrouter",
                "direct-key",
                "https://openrouter.ai/api/v1".into(),
            ),
        ] {
            db.execute("UPDATE ai_config SET route=?1,credential_id='direct-key',hosted_credential_id='hosted-key',groq_credential_id='groq-key'", [route]).unwrap();
            let speech = resolve(&db, Capability::Speech).unwrap();
            assert_eq!(speech.credential.as_deref(), Some(credential));
            assert_eq!(speech.url, format!("{prefix}/chat/completions"));
            assert_eq!(speech.model, "openai/gpt-audio-mini");
        }
        custom(&db, false);
        let speech = resolve(&db, Capability::Speech).unwrap();
        assert!(speech.credential.is_none());
        assert_eq!(speech.url, "http://127.0.0.1:1234/v1/chat/completions");
        assert_eq!(speech.model, "openai/gpt-audio-mini");
        custom(&db, true);
        assert!(resolve(&db, Capability::Speech).is_err());
        db.execute("UPDATE ai_config SET custom_credential_id='custom-key'", [])
            .unwrap();
        assert_eq!(
            resolve(&db, Capability::Speech)
                .unwrap()
                .credential
                .as_deref(),
            Some("custom-key")
        );
    }

    #[test]
    fn custom_no_auth_uses_shared_chat_and_transcription_models() {
        let db = db();
        custom(&db, false);
        db.execute(
            "UPDATE ai_config SET credential_id='other-key',custom_credential_id='unused-secret'",
            [],
        )
        .unwrap();
        let chat = resolve(&db, Capability::Chat).unwrap();
        assert!(chat.credential.is_none());
        assert_eq!(chat.url, "http://127.0.0.1:1234/v1/operations");
        assert_eq!(chat.model, "google/gemini-2.5-flash");
        assert_eq!(
            resolve(&db, Capability::Transcription).unwrap().model,
            "whisper-large-v3"
        );
        custom(&db, true);
        let audio = resolve(&db, Capability::Transcription).unwrap();
        assert_eq!(audio.model, "whisper-large-v3");
        assert_eq!(audio.credential.as_deref(), Some("unused-secret"));
        db.execute("UPDATE ai_config SET custom_credential_id=NULL", [])
            .unwrap();
        assert!(!execution::config(&db).unwrap().configured);
        assert!(resolve(&db, Capability::Chat).is_err());
    }
    #[tokio::test]
    async fn multipart_custom_transcription_sends_only_selected_auth_and_contract() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!(
            "http://{}/v1/audio/transcriptions",
            listener.local_addr().unwrap()
        );
        let worker = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            let mut buf = [0u8; 4096];
            let end = loop {
                let n = stream.read(&mut buf).unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&buf[..n]);
                if let Some(i) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                    break i + 4;
                }
            };
            let headers = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
            let size: usize = headers
                .lines()
                .find_map(|l| l.strip_prefix("content-length:"))
                .unwrap()
                .trim()
                .parse()
                .unwrap();
            while bytes.len() < end + size {
                let n = stream.read(&mut buf).unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&buf[..n]);
            }
            assert!(headers.starts_with("post /v1/audio/transcriptions "));
            assert!(!headers.contains("authorization:"));
            assert!(!headers.contains("x-skelly"));
            let body = String::from_utf8_lossy(&bytes[end..]);
            for expected in [
                "name=\"model\"",
                "custom-whisper",
                "name=\"language\"",
                "es",
                "Spanish — Spain",
                "name=\"prompt\"",
                "filename=\"audio.wav\"",
                "RIFF-test-audio",
            ] {
                assert!(body.contains(expected), "{expected}");
            }
            assert!(body.contains("name=\"response_format\"\r\n\r\njson"));
            assert!(!body.contains("timestamp_granularities"));
            let body = r#"{"text":"Hola, ¿cómo estás?"}"#;
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        });
        let target = ResolvedTarget {
            route: ConnectionRoute::Custom,
            revision: 1,
            url,
            model: "custom-whisper".into(),
            credential: None,
        };
        let result = transcribe(
            &provider::client().unwrap(),
            &target,
            "",
            b"RIFF-test-audio".to_vec(),
            Some("es"),
            "Spanish — Spain",
            "private-install-id",
        )
        .await
        .unwrap();
        assert_eq!(result.text, "Hola, ¿cómo estás?");
        assert!(result.verbose.is_none());
        worker.join().unwrap();
    }
    #[tokio::test]
    async fn transcription_routes_explicitly_select_verbose_or_json_without_fallback() {
        use std::io::{Read, Write};
        for route in [
            ConnectionRoute::Openrouter,
            ConnectionRoute::Hosted,
            ConnectionRoute::Custom,
        ] {
            for language in [Some("es"), None] {
                let hint = if language.is_some() {
                    "Español"
                } else {
                    "Gaeilge"
                };
                let verbose = route == ConnectionRoute::Openrouter;
                let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
                let url = format!(
                    "http://{}/audio/transcriptions",
                    listener.local_addr().unwrap()
                );
                let worker = std::thread::spawn(move || {
                    let (mut stream, _) = listener.accept().unwrap();
                    stream
                        .set_read_timeout(Some(Duration::from_secs(5)))
                        .unwrap();
                    let mut bytes = vec![];
                    let mut buffer = [0; 4096];
                    let end = loop {
                        let count = stream.read(&mut buffer).unwrap();
                        assert!(count > 0);
                        bytes.extend_from_slice(&buffer[..count]);
                        if let Some(i) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                            break i + 4;
                        }
                    };
                    let headers = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
                    let size: usize = headers
                        .lines()
                        .find_map(|l| l.strip_prefix("content-length:"))
                        .unwrap()
                        .trim()
                        .parse()
                        .unwrap();
                    while bytes.len() < end + size {
                        let count = stream.read(&mut buffer).unwrap();
                        assert!(count > 0);
                        bytes.extend_from_slice(&buffer[..count]);
                    }
                    let body = String::from_utf8_lossy(&bytes[end..]);
                    assert_eq!(body.contains("name=\"language\""), language.is_some());
                    if let Some(language) = language {
                        assert!(body.contains(&format!("name=\"language\"\r\n\r\n{language}")));
                    }
                    assert!(body.contains(hint));
                    if verbose {
                        assert!(body.contains("name=\"response_format\"\r\n\r\nverbose_json"));
                        for value in ["word", "segment"] {
                            assert!(body.contains(&format!(
                                "name=\"timestamp_granularities[]\"\r\n\r\n{value}"
                            )));
                        }
                    } else {
                        assert!(body.contains("name=\"response_format\"\r\n\r\njson"));
                        assert!(!body.contains("timestamp_granularities"));
                    }
                    let response = if verbose {
                        r#"{"text":"Hola","duration":1,"words":[{"word":"Hola","start":0,"end":0.5}],"segments":[{"id":0,"start":0,"end":0.5,"text":"Hola","avg_logprob":-0.5,"no_speech_prob":0.1}],"x_groq":{"id":"metadata"}}"#
                    } else {
                        r#"{"text":"Hola"}"#
                    };
                    write!(
                    stream,
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response}",
                    response.len()
                )
                .unwrap();
                });
                let target = ResolvedTarget {
                    route,
                    revision: 1,
                    url,
                    model: "fixture".into(),
                    credential: None,
                };
                let response = transcribe(
                    &provider::client().unwrap(),
                    &target,
                    "",
                    b"RIFF-test".to_vec(),
                    language,
                    hint,
                    "fixture-install",
                )
                .await
                .unwrap();
                assert_eq!(response.text, "Hola");
                assert_eq!(response.verbose.is_some(), verbose);
                worker.join().unwrap();
            }
        }
        assert!(transcription_response(br#"{"text":"Hola"}"#, true).is_err());
    }
}
