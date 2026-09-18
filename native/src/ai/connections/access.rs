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
    let route = match capability {
        Capability::Chat => config.route,
        Capability::Transcription => config.audio.transcription.route,
        Capability::Speech => config.audio.speech.route,
    };
    let (base, model, column) = match (route, capability) {
        (ConnectionRoute::Hosted, Capability::Chat) => (
            format!("{}/v1", hosted::ORIGIN),
            config.standard_model,
            "hosted_credential_id",
        ),
        (ConnectionRoute::Hosted, Capability::Speech) => (
            format!("{}/v1", hosted::ORIGIN),
            config.audio.speech.model.clone(),
            "hosted_credential_id",
        ),
        (ConnectionRoute::Hosted, Capability::Transcription) => (
            format!("{}/v1", hosted::ORIGIN),
            config.audio.transcription.model.clone(),
            "hosted_credential_id",
        ),
        (ConnectionRoute::Openrouter, Capability::Chat) => (
            "https://openrouter.ai/api/v1".into(),
            config.standard_model,
            "credential_id",
        ),
        (ConnectionRoute::Openrouter, Capability::Speech) => (
            "https://openrouter.ai/api/v1".into(),
            config.audio.speech.model.clone(),
            "credential_id",
        ),
        (ConnectionRoute::Openrouter, Capability::Transcription) => (
            "https://api.groq.com/openai/v1".into(),
            config.audio.transcription.model.clone(),
            "groq_credential_id",
        ),
        (ConnectionRoute::Custom, _) => {
            validate_custom(&access.custom)?;
            let model = match capability {
                Capability::Chat => config.standard_model.clone(),
                Capability::Speech => config.audio.speech.model.clone(),
                Capability::Transcription => config.audio.transcription.model.clone(),
            };
            (
                access.custom.base_url.clone(),
                model,
                "custom_credential_id",
            )
        }
    };
    let needs_key = route != ConnectionRoute::Custom || access.custom.bearer_auth;
    let credential = if needs_key {
        let id: Option<String> =
            db.query_row(&format!("SELECT {column} FROM ai_config"), [], |r| r.get(0))?;
        Some(id.ok_or_else(|| {
            error(match (route, capability) {
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
        Capability::Chat if route != ConnectionRoute::Openrouter => "operations",
        Capability::Speech if route != ConnectionRoute::Openrouter => "audio/speech",
        Capability::Chat | Capability::Speech => "chat/completions",
        Capability::Transcription => "audio/transcriptions",
    };
    Ok(ResolvedTarget {
        route,
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
        if !(2..=3).contains(&providers.len())
            || providers
                .iter()
                .filter(|p| p.provider == "OPENROUTER")
                .count()
                != 1
            || providers.iter().any(|p| {
                !["OPENROUTER", "GROQ", "ELEVENLABS"].contains(&p.provider.as_str())
                    || providers
                        .iter()
                        .filter(|other| other.provider == p.provider)
                        .count()
                        != 1
            })
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
        assert_eq!(models.audio.transcription.model, "scribe_v2");
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
            "UPDATE ai_config SET route='custom',audio_settings=json_set(audio_settings,'$.transcription.route','custom','$.speech.route','custom'),custom_config=?1",
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
    fn audio_routes_and_models_are_independent_of_chat_and_each_other() {
        let db = db();
        custom(&db, true);
        db.execute("UPDATE ai_config SET credential_id='chat-key',groq_credential_id='stt-key',hosted_credential_id='session-key',custom_credential_id='custom-key'", []).unwrap();
        for chat in ["hosted", "openrouter", "custom"] {
            for stt in ["hosted", "openrouter", "custom"] {
                for tts in ["hosted", "openrouter", "custom"] {
                    db.execute("UPDATE ai_config SET route=?1,audio_settings=json_set(audio_settings,'$.transcription.route',?2,'$.speech.route',?3,'$.transcription.model','selected-stt','$.speech.model','selected-tts')", rusqlite::params![chat,stt,tts]).unwrap();
                    let chat_target = resolve(&db, Capability::Chat).unwrap();
                    let input = resolve(&db, Capability::Transcription).unwrap();
                    let output = resolve(&db, Capability::Speech).unwrap();
                    assert_eq!(chat_target.route.label(), chat);
                    assert_eq!(input.route.label(), stt);
                    assert_eq!(output.route.label(), tts);
                    assert_eq!(input.model, "selected-stt");
                    assert_eq!(output.model, "selected-tts");
                    for (target, direct_key, direct_host) in [
                        (&input, "stt-key", "https://api.groq.com/"),
                        (&output, "chat-key", "https://openrouter.ai/"),
                    ] {
                        let (key, host) = match target.route {
                            ConnectionRoute::Hosted => ("session-key", hosted::ORIGIN),
                            ConnectionRoute::Custom => ("custom-key", "http://127.0.0.1:1234/"),
                            ConnectionRoute::Openrouter => (direct_key, direct_host),
                        };
                        assert_eq!(target.credential.as_deref(), Some(key));
                        assert!(target.url.starts_with(host));
                    }
                }
            }
        }
        db.execute("UPDATE ai_config SET route='custom',groq_credential_id=NULL,audio_settings=json_set(audio_settings,'$.transcription.route','openrouter','$.speech.route','hosted')", []).unwrap();
        assert!(resolve(&db, Capability::Chat).is_ok());
        assert!(resolve(&db, Capability::Speech).is_ok());
        assert!(
            resolve(&db, Capability::Transcription)
                .unwrap_err()
                .message
                .contains("Groq")
        );
    }

    #[test]
    fn direct_capabilities_use_distinct_credentials_and_never_require_hosted_auth() {
        let db = db();
        db.execute("UPDATE ai_config SET route='openrouter',audio_settings=json_set(audio_settings,'$.transcription.route','openrouter','$.speech.route','openrouter'),credential_id='chat-key',groq_credential_id='voice-key'",[]).unwrap();
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
            db.execute("UPDATE ai_config SET route=?1,audio_settings=json_set(audio_settings,'$.transcription.route',?1,'$.speech.route',?1),credential_id='direct-key',hosted_credential_id='hosted-key',groq_credential_id='groq-key'", [route]).unwrap();
            let speech = resolve(&db, Capability::Speech).unwrap();
            assert_eq!(speech.credential.as_deref(), Some(credential));
            assert_eq!(
                speech.url,
                format!(
                    "{prefix}/{}",
                    if route == "openrouter" {
                        "chat/completions"
                    } else {
                        "audio/speech"
                    }
                )
            );
            assert_eq!(speech.model, "eleven_v3");
        }
        custom(&db, false);
        let speech = resolve(&db, Capability::Speech).unwrap();
        assert!(speech.credential.is_none());
        assert_eq!(speech.url, "http://127.0.0.1:1234/v1/audio/speech");
        assert_eq!(speech.model, "eleven_v3");
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
            "scribe_v2"
        );
        custom(&db, true);
        let audio = resolve(&db, Capability::Transcription).unwrap();
        assert_eq!(audio.model, "scribe_v2");
        assert_eq!(audio.credential.as_deref(), Some("unused-secret"));
        db.execute("UPDATE ai_config SET custom_credential_id=NULL", [])
            .unwrap();
        assert!(!execution::config(&db).unwrap().configured);
        assert!(resolve(&db, Capability::Chat).is_err());
    }
}
