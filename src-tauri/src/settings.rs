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
