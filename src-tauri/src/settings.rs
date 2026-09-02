use crate::ai::Provider;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Where chat and analysis requests go.
///
/// "cloud"  — OpenRouter, with the user's own API key.
/// "custom" — any OpenAI-compatible server the user runs (Ollama, LM Studio,
///            vLLM, ...). The address is theirs; the key is optional, because
///            most local servers do not use one.
pub const PROVIDER_CLOUD: &str = "cloud";
pub const PROVIDER_CUSTOM: &str = "custom";

const OPENROUTER_BASE_URL: &str = "https://openrouter.ai/api/v1";

/// Configurable keyboard shortcuts. Stored as normalized combo strings
/// ("ctrl+m") — see lib/keyboard.ts for the normalization dialect.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Shortcuts {
    #[serde(default = "default_sc_mic")]
    pub mic: String,
    #[serde(default = "default_sc_speak")]
    pub speak: String,
    #[serde(default = "default_sc_panel")]
    pub panel: String,
    #[serde(default = "default_sc_settings")]
    pub settings: String,
}

fn default_sc_mic() -> String {
    "ctrl+m".into()
}
fn default_sc_speak() -> String {
    "ctrl+l".into()
}
fn default_sc_panel() -> String {
    "ctrl+b".into()
}
fn default_sc_settings() -> String {
    "ctrl+,".into()
}

impl Default for Shortcuts {
    fn default() -> Self {
        Self {
            mic: default_sc_mic(),
            speak: default_sc_speak(),
            panel: default_sc_panel(),
            settings: default_sc_settings(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    /// One of PROVIDER_CLOUD or PROVIDER_CUSTOM.
    #[serde(default = "default_provider_mode")]
    pub provider_mode: String,
    #[serde(default)]
    pub openrouter_key: String,
    /// Base URL of a user-run OpenAI-compatible server, including the version
    /// path — e.g. "http://localhost:11434/v1" for Ollama.
    #[serde(default)]
    pub custom_base_url: String,
    /// Optional: most local servers accept any key, or none.
    #[serde(default)]
    pub custom_api_key: String,
    /// The model name as that server knows it. OpenRouter model ids mean
    /// nothing to a local server, so this replaces them outright.
    #[serde(default)]
    pub custom_model: String,
    #[serde(default)]
    pub groq_key: String,
    #[serde(default = "default_model")]
    pub openrouter_model: String,
    #[serde(default = "default_target")]
    pub target_language: String,
    /// Regional variant of the target language (id from `languages.rs`
    /// dialects), e.g. "ar-LE" or "es-MX". Empty = language default.
    #[serde(default)]
    pub target_dialect: String,
    #[serde(default = "default_native")]
    pub native_language: String,
    #[serde(default)]
    pub microphone_device_id: Option<String>,
    /// Speak each tutor reply aloud via OS voices (Web Speech API).
    #[serde(default)]
    pub auto_speak: bool,
    /// Send the speech transcription immediately instead of filling the composer.
    #[serde(default)]
    pub auto_send: bool,
    /// Always show romanization under non-Latin tokens (in addition to
    /// press-and-hold/tap insight). Default: only when revealed.
    #[serde(default)]
    pub always_romanize: bool,
    /// Always show the native-language translation under each tutor reply,
    /// instead of only on a punctuation tap.
    #[serde(default)]
    pub auto_translate: bool,
    /// Configurable keyboard shortcuts.
    #[serde(default)]
    pub shortcuts: Shortcuts,
    /// Speech engine for playback: "cloud" (OpenRouter gpt-audio-mini) or
    /// "os" (Web Speech). A failure in either surfaces as an error in the UI.
    #[serde(default = "default_tts_engine")]
    pub tts_engine: String,
    /// Cloud voice name (OpenAI audio voices: alloy, nova, shimmer, ...).
    #[serde(default = "default_tts_voice")]
    pub tts_voice: String,
    #[serde(default)]
    pub observer_model: Option<String>,
    /// User-edited prompt overrides, keyed by prompt id. Absent/empty = the
    /// built-in default from prompts.rs applies.
    #[serde(default)]
    pub prompt_overrides: std::collections::BTreeMap<String, String>,
}

fn default_provider_mode() -> String {
    PROVIDER_CLOUD.into()
}

fn default_tts_engine() -> String {
    "cloud".into()
}
fn default_tts_voice() -> String {
    "nova".into()
}

fn default_model() -> String {
    // Worker default: gemini-2.5-flash — 6/6 on the model bench (all analysis
    // calls + story, zero retries) plus a full day of live use, zero schema
    // failures. Decoder-enforced structured output; ~$0.30/$2.50 per M tokens.
    "google/gemini-2.5-flash".into()
}

/// The observer's model. Reasoning stays ENABLED (that is where its value
/// comes from) but it does not need a frontier model to do it: the job is
/// summarising a short transcript into two small documents. Successful passes
/// on the worker model run 19-22s, well inside the 180s client timeout.
pub fn default_observer_model() -> String {
    default_model()
}

fn default_target() -> String {
    "es-ES".into()
}

fn default_native() -> String {
    "en".into()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            provider_mode: default_provider_mode(),
            openrouter_key: String::new(),
            custom_base_url: String::new(),
            custom_api_key: String::new(),
            custom_model: String::new(),
            groq_key: String::new(),
            openrouter_model: default_model(),
            target_language: default_target(),
            target_dialect: String::new(),
            native_language: default_native(),
            microphone_device_id: None,
            auto_speak: false,
            auto_send: false,
            always_romanize: false,
            auto_translate: false,
            shortcuts: Shortcuts::default(),
            tts_engine: default_tts_engine(),
            tts_voice: default_tts_voice(),
            observer_model: None,
            prompt_overrides: std::collections::BTreeMap::new(),
        }
    }
}

/// Mask a secret for display/IPC: show the first and last 6 characters so
/// the user can verify WHICH key is stored, blank the middle. A masked
/// value round-trips safely — save_settings treats an unchanged mask as
/// "keep the stored key".
pub fn mask(key: &str) -> String {
    let chars: Vec<char> = key.chars().collect();
    if chars.len() < 12 {
        return "•".repeat(chars.len());
    }
    let head: String = chars[..6].iter().collect();
    let tail: String = chars[chars.len() - 6..].iter().collect();
    format!("{head}••••••••{tail}")
}

impl Settings {
    /// Endpoint and credentials for one chat or analysis call.
    ///
    /// This is the ONLY place the app decides where AI requests go. `model` is
    /// the caller's choice — worker or observer — and is honoured in cloud
    /// mode; a custom server has its own model names, so there it is replaced
    /// by the configured one.
    ///
    /// An unusable configuration returns the reason, which the UI shows. It
    /// never falls back to another provider: a request the user asked to send
    /// to their own server must not silently go to a paid cloud instead.
    pub fn chat_provider(&self, model: &str) -> Result<Provider, String> {
        match self.provider_mode.as_str() {
            PROVIDER_CLOUD => {
                if self.openrouter_key.trim().is_empty() {
                    return Err(
                        "No OpenRouter API key configured. Open Settings and add your key.".into(),
                    );
                }
                Ok(Provider {
                    base_url: OPENROUTER_BASE_URL.into(),
                    api_key: self.openrouter_key.trim().into(),
                    model: model.into(),
                })
            }
            PROVIDER_CUSTOM => {
                let url = self.custom_base_url.trim().trim_end_matches('/');
                if url.is_empty() {
                    return Err("No server address configured. Open Settings, and under AI provider enter your server's address (for example http://localhost:11434/v1).".into());
                }
                let custom_model = self.custom_model.trim();
                if custom_model.is_empty() {
                    return Err("No model configured for your server. Open Settings, and under AI provider enter the model name your server serves.".into());
                }
                Ok(Provider {
                    base_url: url.into(),
                    // Local servers usually want no key at all.
                    api_key: self.custom_api_key.trim().into(),
                    model: custom_model.into(),
                })
            }
            other => Err(format!(
                "Unknown AI provider mode {other:?}. Open Settings and choose one under AI provider."
            )),
        }
    }

    /// IPC-safe copy: secrets replaced by their masked form.
    pub fn masked(&self) -> Settings {
        let mut s = self.clone();
        s.openrouter_key = mask(&self.openrouter_key);
        s.groq_key = mask(&self.groq_key);
        s.custom_api_key = mask(&self.custom_api_key);
        s
    }
}

fn settings_path(dir: &Path) -> std::path::PathBuf {
    dir.join("settings.json")
}

/// Settings as loaded, plus any fault the user must be told about. A fault
/// means the stored settings could not be honoured: the app runs on defaults
/// and the message is pushed to the webview. It is never left in a log file.
pub struct Loaded {
    pub settings: Settings,
    pub fault: Option<String>,
}

pub fn load_or_create(dir: &Path) -> Loaded {
    let path = settings_path(dir);
    let Ok(raw) = std::fs::read_to_string(&path) else {
        // No file yet: a first run, not a fault. Failing to create one IS.
        let settings = Settings::default();
        let fault = persist(dir, &settings)
            .err()
            .map(|e| format!("Could not create settings.json: {e}. Settings will not persist."));
        return Loaded { settings, fault };
    };

    match serde_json::from_str::<Settings>(&raw) {
        Ok(settings) => Loaded {
            settings,
            fault: None,
        },
        Err(parse_err) => {
            // A corrupt settings file is never quietly replaced: that would
            // discard the user's API keys without a word. Move it aside, run
            // on defaults, and report all of it to the screen.
            let bad = dir.join("settings.json.bad");
            let mut fault = format!(
                "settings.json could not be read ({parse_err}). Your API keys were NOT loaded \
                 — re-enter them in Settings."
            );
            match std::fs::rename(&path, &bad) {
                Ok(()) => {
                    fault.push_str(&format!(" The unreadable file is kept at {}.", bad.display()))
                }
                Err(e) => fault.push_str(&format!(" It could not be moved aside either: {e}.")),
            }
            let settings = Settings::default();
            if let Err(e) = persist(dir, &settings) {
                fault.push_str(&format!(" Writing a fresh one also failed: {e}."));
            }
            log::error!("{fault}");
            Loaded {
                settings,
                fault: Some(fault),
            }
        }
    }
}

/// Persist settings. Returns an error instead of swallowing IO failures —
/// a failed save means the user's keys are NOT on disk and they must know.
pub fn persist(dir: &Path, settings: &Settings) -> Result<(), String> {
    let path = settings_path(dir);
    serde_json::to_string_pretty(settings)
        .map_err(|e| format!("settings serialization failed: {e}"))
        .and_then(|raw| {
            std::fs::write(path, raw).map_err(|e| format!("settings write failed: {e}"))
        })
}

#[cfg(test)]
mod tests {
use super::*;

#[test]
fn mask_shows_head_and_tail_only() {
    assert_eq!(mask(""), "");
    let key = "sk-or-v1-0123456789abcdef";
    let m = mask(key);
    // head 6 + bullet run + tail 6 — enough to identify, nothing more.
    assert!(m.starts_with("sk-or-"));
    assert!(m.ends_with("bcdef"));
    assert!(m.contains("••••••••"));
    assert!(!m.contains("v1-0123"));
}

#[test]
fn cloud_mode_needs_a_key_and_keeps_the_callers_model() {
    let mut s = Settings::default();
    assert!(s.chat_provider("some/model").is_err(), "no key means no provider");
    s.openrouter_key = "sk-or-v1-0123456789abcdef".into();
    let p = s.chat_provider("some/model").unwrap();
    assert_eq!(p.base_url, OPENROUTER_BASE_URL);
    assert_eq!(p.model, "some/model");
}

#[test]
fn custom_mode_uses_its_own_address_model_and_needs_no_openrouter_key() {
    let mut s = Settings {
        provider_mode: PROVIDER_CUSTOM.into(),
        ..Settings::default()
    };
    // Address and model are both required, and each says which is missing.
    assert!(s.chat_provider("some/model").unwrap_err().contains("address"));
    s.custom_base_url = "http://localhost:11434/v1/".into();
    assert!(s.chat_provider("some/model").unwrap_err().contains("model"));
    s.custom_model = "llama3.2".into();

    let p = s.chat_provider("some/model").unwrap();
    // Trailing slash trimmed, or every request URL would double up.
    assert_eq!(p.base_url, "http://localhost:11434/v1");
    // A local server has never heard of the caller's OpenRouter model id.
    assert_eq!(p.model, "llama3.2");
    // Local servers commonly want no key at all.
    assert_eq!(p.api_key, "");
}

#[test]
fn an_unknown_mode_is_an_error_not_a_silent_default() {
    let s = Settings {
        provider_mode: "somethingelse".into(),
        openrouter_key: "sk-or-v1-0123456789abcdef".into(),
        ..Settings::default()
    };
    // Never quietly route to a paid cloud when the user asked for something else.
    assert!(s.chat_provider("m").unwrap_err().contains("Unknown AI provider mode"));
}

#[test]
fn the_custom_key_is_masked_like_every_other_secret() {
    let s = Settings {
        custom_api_key: "sk-local-0123456789abcdef".into(),
        ..Settings::default()
    };
    assert_eq!(s.masked().custom_api_key, mask("sk-local-0123456789abcdef"));
    assert!(!s.masked().custom_api_key.contains("0123456789"));
}

#[test]
fn mask_matches_the_typescript_mask() {
    // These are the exact expectations in src/lib/secrets.test.ts. save_settings
    // decides "unchanged, keep the stored key" by comparing the value the
    // webview sends back against mask(stored) — if the two implementations
    // drift, a save silently overwrites a real key with a row of bullets.
    assert_eq!(mask("sk-or-v1-0123456789abcdef"), "sk-or-••••••••abcdef");
    assert_eq!(mask(""), "");
    assert_eq!(mask("short"), "•••••");
    assert_eq!(mask("elevenchars"), "•••••••••••");
    assert_eq!(mask("abcdefghijkl"), "abcdef••••••••ghijkl");
}

#[test]
fn a_masked_round_trip_keeps_the_stored_key() {
    // What the webview sends back untouched must be recognised as "unchanged".
    let stored = "sk-or-v1-0123456789abcdef";
    // Masking is idempotent for any real key: a mask is always 6+8+6 chars, so
    // masking it again yields the same string. That is what lets the webview
    // hold the mask in the same field the raw key would occupy.
    assert_eq!(mask(&mask(stored)), mask(stored));
    let s = Settings {
        openrouter_key: stored.into(),
        groq_key: "gsk_0123456789abcdef".into(),
        ..Settings::default()
    };
    let m = s.masked();
    // masked() is what get_settings returns, and it must equal mask() so the
    // comparison in save_settings lines up.
    assert_eq!(m.openrouter_key, mask(stored));
    assert_eq!(m.groq_key, mask("gsk_0123456789abcdef"));
    // The real material is gone from the IPC copy.
    assert!(!m.openrouter_key.contains("v1-0123"));
}

}
