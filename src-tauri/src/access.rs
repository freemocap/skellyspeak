//! Capability resolution is shared by chat and microphone operations. Adapters
//! consume captured targets; they never choose credentials or fall back to a route.
use crate::{Application, credentials, execution, hosted, model::*, provider};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::{sync::Arc, time::Duration};
use zeroize::Zeroizing;

#[derive(Clone, Copy)]
pub enum Capability {
    Chat,
    Transcription,
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
        revision,
        groq_key_configured: groq,
        custom_key_configured: custom,
        custom: serde_json::from_str(&config)?,
    })
}
pub fn validate_custom(value: &CustomEndpoint) -> Result<()> {
    base_url(&value.base_url)?;
    for model in [&value.standard_model, &value.fast_model]
        .into_iter()
        .chain(value.transcription_model.iter())
    {
        if model.is_empty() || model.len() > 160 || !model.bytes().all(|b| b.is_ascii_graphic()) {
            return Err(error(
                "Enter explicit model IDs without whitespace (at most 160 bytes).",
            ));
        }
    }
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
        (ConnectionRoute::Hosted, Capability::Transcription) => (
            format!("{}/v1", hosted::ORIGIN),
            "whisper-large-v3".into(),
            "hosted_credential_id",
        ),
        (ConnectionRoute::Openrouter, Capability::Chat) => (
            "https://openrouter.ai/api/v1".into(),
            config.standard_model,
            "credential_id",
        ),
        (ConnectionRoute::Openrouter, Capability::Transcription) => (
            "https://api.groq.com/openai/v1".into(),
            "whisper-large-v3".into(),
            "groq_credential_id",
        ),
        (ConnectionRoute::Custom, _) => {
            validate_custom(&access.custom)?;
            let model = match capability {
                Capability::Chat => access.custom.standard_model.clone(),
                Capability::Transcription => access.custom.transcription_model.clone().ok_or_else(|| error("This custom endpoint is configured for chat only. Enable transcription and set its model in AI access settings."))?,
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
        Capability::Chat => "chat/completions",
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
pub fn get_access_settings(state: tauri::State<'_, Arc<Application>>) -> Result<AccessSettings> {
    settings(&state.lock()?.connection)
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
    if let Some(value) = &custom {
        validate_custom(value)?;
    }
    let key = api_key.map(|s| Zeroizing::new(s.trim().to_owned()));
    if let Some(key) = &key {
        provider::validate_key_format(key)?;
    }
    if remove_key && key.is_some() {
        return Err(error("Remove or replace the key, not both."));
    }
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let id = key.as_ref().map(|_| uuid::Uuid::new_v4().to_string());
        {
            let mut store = state.lock()?;
            if settings(&store.connection)?.revision != expected_revision { return Err(conflict()); }
            validate_key_destination(&settings(&store.connection)?, custom.as_ref(), key.is_some() || remove_key)?;
            if let Some(id) = &id { store.reserve_credential(id)?; }
        }
        // Native permission prompts must not hold the workspace mutex.
        if let (Some(id),Some(key)) = (&id,&key) { credentials::save(id,key)?; }
        let mut store = state.lock()?;
        let result = (|| -> Result<()> {
        let tx = store.connection.transaction()?;
        if settings(&tx)?.revision != expected_revision { return Err(conflict()); }
        let column = if custom.is_some() { "custom_credential_id" } else { "groq_credential_id" };
        if id.is_some() || remove_key {
            tx.execute(&format!("INSERT OR IGNORE INTO credential_cleanup SELECT {column} FROM ai_config WHERE {column} IS NOT NULL"),[])?;
            tx.execute(&format!("UPDATE ai_config SET {column}=?1"),[&id])?;
            if let Some(id) = &id { tx.execute("DELETE FROM credential_cleanup WHERE id=?1",[id])?; }
        }
        if let Some(custom) = &custom {
            tx.execute("UPDATE ai_config SET custom_config=?1",[serde_json::to_string(custom)?])?;
        }
        tx.execute("UPDATE ai_config SET revision=revision+1",[])?;
        execution::invalidate(&tx,Some(if custom.is_some() { ConnectionRoute::Custom } else { ConnectionRoute::Openrouter }))?;
        tx.execute("UPDATE metadata SET revision=revision+1",[])?;
        tx.commit()?;
        Ok(())
        })();
        if let Some(id) = &id { store.credential_writes.remove(id); }
        store.clean_credentials()?;
        result?;
        settings(&store.connection)
    }).await.map_err(|_| error("Saving AI access settings stopped unexpectedly."))?
}

pub async fn response_bytes(
    mut response: reqwest::Response,
    label: &str,
    limit: usize,
) -> Result<Vec<u8>> {
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let hint = match status {
            401 | 403 => "Check the saved key and endpoint permissions.",
            404 | 405 | 415 | 422 => "Check the endpoint protocol, capability and model ID.",
            429 => "Rate or allowance limit reached; wait before retrying.",
            _ => "Check the endpoint service.",
        };
        return Err(AppError::new(
            ErrorCode::Provider,
            format!("{label}: HTTP {status}. {hint} No automatic retry was made."),
        ));
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
) -> Result<String> {
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
                format!("{}/models", access.custom.base_url.trim_end_matches('/'))
            } else {
                "https://api.groq.com/openai/v1/models".into()
            },
            key,
        )
    };
    let key = match credential {
        Some(id) => crate::read_secret(id).await?,
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
    let value: serde_json::Value =
        serde_json::from_slice(&response_bytes(response, "Connection check", 262144).await?)
            .map_err(|_| error("Endpoint returned invalid JSON."))?;
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
    Ok(format!(
        "Connection accepted · {} model IDs returned. No inference requested; chat and audio support are verified when used.",
        models.len()
    ))
}

pub async fn transcribe(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    wav: Vec<u8>,
    language: &str,
    install: &str,
) -> Result<String> {
    if wav.is_empty() || wav.len() > 25 * 1024 * 1024 {
        return Err(error("Recording must contain audio and be at most 25 MB."));
    }
    let form = reqwest::multipart::Form::new()
        .text("model", target.model.clone())
        .text("response_format", "json")
        .text("language", language.to_owned())
        .part(
            "file",
            reqwest::multipart::Part::bytes(wav)
                .file_name("audio.wav")
                .mime_str("audio/wav")
                .map_err(|_| error("Invalid audio type."))?,
        );
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
        .map_err(|_| error("Transcription request failed. No automatic retry was made."))?;
    let bytes = if target.route == ConnectionRoute::Hosted {
        hosted::body(response).await?
    } else {
        response_bytes(response, "Transcription", 131072).await?
    };
    #[derive(Deserialize)]
    struct Transcript {
        text: String,
    }
    let transcript: Transcript = serde_json::from_slice(&bytes)
        .map_err(|_| error("Endpoint returned an invalid transcription response."))?;
    if transcript.text.trim().is_empty() {
        return Err(error("No speech was recognized. Try another recording."));
    }
    if transcript.text.chars().count() > 20000 || transcript.text.contains('\0') {
        return Err(error("Transcription exceeds the message limits."));
    }
    Ok(transcript.text)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn db() -> Connection {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("schema.sql")).unwrap();
        db
    }
    fn custom(db: &Connection, auth: bool, audio: bool) {
        let value = CustomEndpoint {
            base_url: "http://127.0.0.1:1234/v1/".into(),
            standard_model: "local-chat".into(),
            fast_model: "local-fast".into(),
            bearer_auth: auth,
            transcription_model: audio.then(|| "local-whisper".into()),
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
        custom(&db, true, false);
        db.execute("UPDATE ai_config SET custom_credential_id='saved-key'", [])
            .unwrap();
        let saved = settings(&db).unwrap();
        let mut next = saved.custom.clone();
        validate_key_destination(&saved, Some(&next), false).unwrap();
        next.standard_model = "another-model".into();
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
    fn custom_no_auth_and_missing_audio_are_explicit() {
        let db = db();
        custom(&db, false, false);
        db.execute(
            "UPDATE ai_config SET credential_id='other-key',custom_credential_id='unused-secret'",
            [],
        )
        .unwrap();
        let chat = resolve(&db, Capability::Chat).unwrap();
        assert!(chat.credential.is_none());
        assert_eq!(chat.url, "http://127.0.0.1:1234/v1/chat/completions");
        assert_eq!(chat.model, "local-chat");
        assert!(
            resolve(&db, Capability::Transcription)
                .unwrap_err()
                .message
                .contains("chat only")
        );
        custom(&db, true, true);
        let audio = resolve(&db, Capability::Transcription).unwrap();
        assert_eq!(audio.model, "local-whisper");
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
                "filename=\"audio.wav\"",
                "RIFF-test-audio",
            ] {
                assert!(body.contains(expected), "{expected}");
            }
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
            "es",
            "private-install-id",
        )
        .await
        .unwrap();
        assert_eq!(result, "Hola, ¿cómo estás?");
        worker.join().unwrap();
    }
}
