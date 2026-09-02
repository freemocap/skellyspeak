use serde::{Deserialize, Serialize};
use std::path::Path;

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
    #[serde(default)]
    pub openrouter_key: String,
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
    /// "os" (Web Speech). Cloud failures fall back to the OS voice, loudly.
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

/// Prior worker defaults — stored settings migrate off these on load.
const LEGACY_DEFAULT_MODELS: &[&str] = &[
    "deepseek/deepseek-v4-flash-0731",
    "google/gemini-3.1-flash-lite",
    "openai/gpt-5-nano",
];

fn migrate(settings: &mut Settings) {
    // Arabic entry restructured: code ar-LE became code ar + dialect preset.
    if settings.target_language == "ar-LE" {
        settings.target_language = "ar".into();
        if settings.target_dialect.is_empty() {
            settings.target_dialect = "ar-LE".into();
        }
    }
    if LEGACY_DEFAULT_MODELS.contains(&settings.openrouter_model.as_str()) {
        log::info!(
            "migrating worker model: {} -> {}",
            settings.openrouter_model,
            default_model()
        );
        settings.openrouter_model = default_model();
    }
    if let Some(m) = settings.observer_model.as_deref() {
        if LEGACY_OBSERVER_MODELS.contains(&m) {
            log::info!("migrating observer model: {m} -> {}", default_observer_model());
            settings.observer_model = Some(default_observer_model());
        }
    }
    if settings.tts_engine == "groq" {
        settings.tts_engine = "cloud".into();
    }
    if settings.tts_voice == "Celeste-PlayAI" {
        settings.tts_voice = "nova".into();
    }
}

/// The observer's model. Reasoning stays ENABLED (that is where its value
/// comes from) but it does not need a frontier model to do it: the job is
/// summarising a short transcript into two small documents.
///
/// `z-ai/glm-5.3-flash` was the previous default and was intermittently
/// blowing the 180s client timeout — costing the teaching plan an update on
/// those turns, silently. Successful passes on the worker model run 19-22s.
/// Fast and cheap beats clever here.
pub fn default_observer_model() -> String {
    default_model()
}

/// Prior observer defaults — stored settings migrate off these on load.
const LEGACY_OBSERVER_MODELS: &[&str] = &["z-ai/glm-5.3-flash"];

fn default_target() -> String {
    "es-ES".into()
}

fn default_native() -> String {
    "en".into()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            openrouter_key: String::new(),
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
    /// IPC-safe copy: secrets replaced by their masked form.
    pub fn masked(&self) -> Settings {
        let mut s = self.clone();
        s.openrouter_key = mask(&self.openrouter_key);
        s.groq_key = mask(&self.groq_key);
        s
    }
}

fn settings_path(dir: &Path) -> std::path::PathBuf {
    dir.join("settings.json")
}

pub fn load_or_create(dir: &Path) -> Settings {
    let path = settings_path(dir);
    match std::fs::read_to_string(&path) {
        Ok(raw) => match serde_json::from_str::<Settings>(&raw) {
            Ok(mut s) => {
                migrate(&mut s);
                s
            }
            Err(e) => {
                // A corrupt settings file must NEVER be silently replaced —
                // that would wipe the user's API keys without a word. Move it
                // aside and scream.
                let bad = dir.join("settings.json.bad");
                let _ = std::fs::rename(&path, &bad);
                log::error!(
                    "settings.json was CORRUPT ({e}) - moved to {} and starting fresh. \
                     API keys were NOT loaded; re-enter them in Settings.",
                    bad.display()
                );
                let defaults = Settings::default();
                if let Err(e) = persist(dir, &defaults) {
                    log::error!("could not write fresh settings.json: {e}");
                }
                defaults
            }
        },
        Err(_) => {
            let defaults = Settings::default();
            if let Err(e) = persist(dir, &defaults) {
                log::error!("could not write initial settings.json: {e}");
            }
            defaults
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
fn migrate_moves_legacy_defaults_to_current() {
    for legacy in LEGACY_DEFAULT_MODELS {
        let mut s = Settings {
            openrouter_model: legacy.to_string(),
            ..Settings::default()
        };
        migrate(&mut s);
        assert_eq!(s.openrouter_model, default_model());
    }
    // The current default is stable under migration.
    let mut cur = Settings::default();
    migrate(&mut cur);
    assert_eq!(cur.openrouter_model, default_model());
}
}
