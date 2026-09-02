//! Tauri commands — the whole v0.1 IPC surface:
//! settings, guided conversation (two-pass reply+analysis), stories, STT.

use base64::Engine;
use serde::{Deserialize, Serialize};
use log::{debug, error, info, warn};
use serde_json::json;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

use crate::graph;
use crate::ontology;
use crate::ai::Provider;
use crate::ai::truncate_for_log;
use crate::languages::{self, iso639, language_display, native_display, overlay};
use crate::observer;
use crate::prompts;
use crate::settings;
use crate::settings::Settings;
use crate::trace::{self, RunContext};
use crate::AppState;
use std::path::Path;
use futures_util::StreamExt;
use std::time::Duration;

// STT (Groq Whisper) — central here so a provider/model switch is one edit.
const GROQ_STT_URL: &str = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_STT_MODEL: &str = "whisper-large-v3";
/// Android WebView emits webm/opus; iOS emits mp4/aac — the upload type must
/// follow the platform when the ladder reaches iOS.
const STT_UPLOAD_MIME: &str = "audio/webm";
const STT_UPLOAD_NAME: &str = "audio.webm";

// TTS — cloud synthesis via OpenRouter (openai/gpt-audio-mini). Audio output
// is streaming-only and ships raw PCM16 (24kHz mono LE); we wrap it in a WAV
// container for the webview.
const TTS_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const TTS_MODEL: &str = "openai/gpt-audio-mini";
const TTS_SAMPLE_RATE: u32 = 24_000;

#[derive(Debug, serde::Serialize)]
pub struct TtsAudio {
    pub audio_base64: String,
    pub mime: String,
}

/// Synthesize speech via OpenRouter (gpt-audio-mini). Returns base64 WAV
/// audio for the webview to play. Every failure is returned as an error and
/// shown on screen; nothing substitutes for this engine.
#[tauri::command]
pub async fn speak_text(
    state: State<'_, AppState>,
    text: String,
    voice: Option<String>,
) -> Result<TtsAudio, String> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("no text to speak".into());
    }
    if text.len() > 10_000 {
        return Err("text too long for TTS".into());
    }
    let stored = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    if stored.openrouter_key.trim().is_empty() {
        return Err("No OpenRouter API key configured.".into());
    }
    let v = voice
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "nova".into());
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let payload = json!({
        "model": TTS_MODEL,
        "modalities": ["text", "audio"],
        "audio": {"voice": v, "format": "pcm16"},
        "stream": true,
        "messages": [
            // gpt-audio models are conversational — without this they answer
            // or continue after the requested phrase. Engine framing, not chat.
            {"role": "system", "content": "You are a text-to-speech engine. Read the user's text aloud EXACTLY as written: verbatim, no additions, no replies, no commentary, no follow-up questions. If the text is in another language, speak it in that language."},
            {"role": "user", "content": format!("Say exactly, with no additions:\n{text}")}
        ],
    });
    let response = client
        .post(TTS_URL)
        .bearer_auth(&stored.openrouter_key)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("tts request failed: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("tts API error {status}: {}", truncate_for_log(&body, 300)));
    }

    // Stream SSE; accumulate base64 PCM16 chunks, then wrap in a WAV header.
    // Also accumulate the audio transcript — spoken content is compared
    // against the request afterwards, and any extra speech logs loudly.
    let mut stream = response.bytes_stream();
    let mut sse_buffer = String::new();
    let mut b64 = String::new();
    let mut transcript = String::new();
    'sse: while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("tts stream: {e}"))?;
        sse_buffer.push_str(&String::from_utf8_lossy(&bytes));
        while let Some(pos) = sse_buffer.find('\n') {
            let line: String = sse_buffer.drain(..=pos).collect();
            let line = line.trim();
            if let Some(data) = line.strip_prefix("data: ") {
                let data = data.trim();
                if data == "[DONE]" {
                    break 'sse;
                }
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = v["choices"][0]["delta"]["audio"].as_object() {
                        if let Some(d) = delta.get("data").and_then(|x| x.as_str()) {
                            b64.push_str(d);
                        }
                        if let Some(t) = delta.get("transcript").and_then(|x| x.as_str()) {
                            transcript.push_str(t);
                        }
                    }
                }
            }
        }
    }
    use base64::Engine;
    let pcm = base64::engine::general_purpose::STANDARD
        .decode(b64.as_bytes())
        .map_err(|e| format!("tts audio decode failed: {e}"))?;
    if pcm.is_empty() {
        return Err("tts returned no audio".into());
    }
    let wav = wav_container(&pcm, TTS_SAMPLE_RATE);

    // Loud verification: the transcript is what the model ACTUALLY spoke.
    // Extra or mismatched speech gets logged at ERROR — the audio still
    // returns (audible diagnosis beats silence), but the problem is visible.
    let norm = |s: &str| -> String {
        let mut out = String::new();
        let mut space = true;
        for ch in s.chars() {
            if ch.is_alphanumeric() {
                for lc in ch.to_lowercase() {
                    out.push(lc);
                }
                space = false;
            } else if !space {
                out.push(' ');
                space = true;
            }
        }
        out.trim().to_string()
    };
    let asked = norm(&text);
    let spoken = norm(&transcript);
    if spoken != asked {
        error!(
            "[tts] SPEECH MISMATCH — requested {:?} but model spoke {:?} (audio returned for diagnosis)",
            asked, spoken
        );
    } else {
        debug!("[tts] transcript matches request");
    }

    Ok(TtsAudio {
        audio_base64: base64::engine::general_purpose::STANDARD.encode(&wav),
        mime: "audio/wav".into(),
    })
}

/// Wrap raw 16-bit mono LE PCM in a minimal WAV container.
fn wav_container(pcm: &[u8], sample_rate: u32) -> Vec<u8> {
    let mut w = Vec::with_capacity(pcm.len() + 44);
    w.extend_from_slice(b"RIFF");
    w.extend_from_slice(&(36 + pcm.len() as u32).to_le_bytes());
    w.extend_from_slice(b"WAVE");
    w.extend_from_slice(b"fmt ");
    w.extend_from_slice(&16u32.to_le_bytes()); // fmt chunk size
    w.extend_from_slice(&1u16.to_le_bytes()); // PCM
    w.extend_from_slice(&1u16.to_le_bytes()); // mono
    w.extend_from_slice(&sample_rate.to_le_bytes());
    w.extend_from_slice(&(sample_rate * 2).to_le_bytes()); // byte rate
    w.extend_from_slice(&2u16.to_le_bytes()); // block align
    w.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
    w.extend_from_slice(b"data");
    w.extend_from_slice(&(pcm.len() as u32).to_le_bytes());
    w.extend_from_slice(pcm);
    w
}

// ─── API key validation ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct KeyStatus {
    pub valid: bool,
    pub detail: String,
}

/// Lightweight reachability check for an API key: OpenRouter's auth endpoint
/// for chat keys, Groq's model list for STT keys. Never logs or returns the
/// key itself.
#[tauri::command]
pub async fn validate_key(
    state: State<'_, AppState>,
    provider: String,
    key: String,
) -> Result<KeyStatus, String> {
    // A masked value from the UI means "validate the stored key".
    let mut key = key.trim().to_string();
    if key.contains('•') {
        let stored = state
            .settings
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone();
        key = match provider.as_str() {
            "openrouter" => stored.openrouter_key,
            "groq" => stored.groq_key,
            other => return Err(format!("unknown provider: {other}")),
        }
        .trim()
        .to_string();
    }
    if key.is_empty() {
        return Ok(KeyStatus {
            valid: false,
            detail: "no key entered".into(),
        });
    }
    let url = match provider.as_str() {
        "openrouter" => "https://openrouter.ai/api/v1/auth/key",
        "groq" => "https://api.groq.com/openai/v1/models",
        other => return Err(format!("unknown provider: {other}")),
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(url)
        .bearer_auth(&key)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;
    let status = response.status();
    match status.as_u16() {
        200 => {
            let detail = if provider == "openrouter" {
                response
                    .json::<serde_json::Value>()
                    .await
                    .ok()
                    .and_then(|v| v["data"]["label"].as_str().map(str::to_string))
                    .unwrap_or_else(|| "key accepted".into())
            } else {
                "key accepted".into()
            };
            Ok(KeyStatus { valid: true, detail })
        }
        401 | 403 => Ok(KeyStatus {
            valid: false,
            detail: format!("key rejected ({status})"),
        }),
        s => Ok(KeyStatus {
            valid: false,
            detail: format!("unexpected status {s}"),
        }),
    }
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

/// Retry counters for the logs overlay. Retries here are ONLY for transient
/// failures (429s, malformed model output fed back for correction) — nothing
/// falls back silently anywhere in the app.
/// The language registry, verbatim from `languages.rs`. The webview holds no
/// language table of its own — it renders what this returns.
#[tauri::command]
pub fn get_languages() -> Vec<languages::LanguageInfo> {
    languages::registry()
}

/// Label of the popped-out observability window. Also listed in
/// `capabilities/default.json` — a window not named there gets no IPC.
pub const DEV_WINDOW_LABEL: &str = "skellyspeak-dev";

/// Pop the observability panel out into its own OS window.
///
/// Built in Rust rather than from JS on purpose: the JS route needs
/// `core:webview:allow-create-webview-window` in the capability set, and
/// there is no reason to hand the webview the ability to spawn windows when
/// the app only ever opens this one. Desktop only — Tauri mobile has no
/// second window.
#[tauri::command]
pub async fn open_dev_window(app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        // Already open: focus it instead of stacking duplicates.
        if let Some(existing) = app.get_webview_window(DEV_WINDOW_LABEL) {
            let _ = existing.unminimize();
            existing.set_focus().map_err(|e| e.to_string())?;
            info!("[cmd] dev window already open - focused");
            return Ok(());
        }
        tauri::WebviewWindowBuilder::new(
            &app,
            DEV_WINDOW_LABEL,
            // Same bundle and same entry point. The frontend routes on the
            // WINDOW LABEL, not a query string: WebviewUrl::App takes a
            // PathBuf, and '?' in a Windows path is asking for trouble.
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("SkellySpeak · observability")
        .inner_size(980.0, 720.0)
        .min_inner_size(420.0, 320.0)
        .resizable(true)
        .build()
        .map_err(|e| format!("could not open the observability window: {e}"))?;
        info!("[cmd] dev window opened");
        Ok(())
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("separate windows are desktop-only; use the dev tab instead".into())
    }
}

/// The execution graph, declared in `graph.rs`. The webview draws only what
/// this returns — there is no second copy of the graph in the frontend.
#[tauri::command]
pub fn get_graph() -> Vec<graph::Graph> {
    graph::all()
}

/// The declared graph diffed against what actually ran. The observability
/// layer reporting on its own fidelity — see `trace::reconcile`.
#[tauri::command]
pub fn get_reconciliation() -> trace::Reconciliation {
    trace::reconcile()
}

/// Every AI run still in memory, oldest first. The observability substrate:
/// one record per agent execution, with per-attempt detail.
#[tauri::command]
pub fn get_runs() -> Vec<trace::Run> {
    trace::snapshot()
}

/// Drop the in-memory run history.
#[tauri::command]
pub fn clear_runs() -> Result<(), String> {
    trace::clear();
    info!("[cmd] run history cleared");
    Ok(())
}

#[tauri::command]
pub fn get_diagnostics() -> Vec<(String, u64)> {
    crate::ai::retry_stats_snapshot()
        .iter()
        .map(|(k, v)| (k.to_string(), *v))
        .collect()
}

// ─── Coach (the sidebar tutor) ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct CoachCorrection {
    /// What the learner actually wrote/said (verbatim fragment).
    pub said: String,
    /// What a fluent speaker would say.
    pub corrected: String,
    /// Why, in the learner's NATIVE language.
    pub explanation: String,
    /// grammar | vocab | word-choice | spelling | other
    pub kind: String,
}

#[derive(Debug, Serialize)]
pub struct CoachReply {
    pub reply: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct CoachFeedback {
    /// 1-3 warm sentences to the learner. Mostly native language; answers
    /// questions the learner embedded in their message.
    #[schemars(length(min = 1))]
    pub remark: String,
    /// Target-language fragments the learner produced (verbatim).
    pub used_target: Vec<String>,
    /// Native-language fragments they fell back on (verbatim).
    pub used_native: Vec<String>,
    /// 0-3 corrections. Empty is valid — a perfect message earns empty.
    pub corrections: Vec<CoachCorrection>,
    /// 1-5: would a native speaker understand the message?
    pub comprehensibility: u8,
    /// 1-5: grammatical correctness.
    pub grammar: u8,
}

impl CoachFeedback {
    pub fn validate(&self) -> Option<String> {
        if self.remark.trim().is_empty() {
            return Some("remark must not be empty".into());
        }
        if !(1..=5).contains(&self.comprehensibility) || !(1..=5).contains(&self.grammar) {
            return Some("scores must be 1-5".into());
        }
        for c in &self.corrections {
            if c.said.trim().is_empty() || c.corrected.trim().is_empty() {
                return Some("corrections must cite actual words".into());
            }
        }
        None
    }
}

// ─── Settings ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    info!("[cmd] get_settings");
    // Secrets travel masked: the webview never receives raw key material.
    Ok(state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone()
        .masked())
}

/// Drain faults recorded before the webview existed, so the UI can show them.
/// Anything that goes wrong during startup lands here rather than in a log
/// file the user will never open.
#[tauri::command]
pub fn take_startup_faults(state: State<'_, AppState>) -> Vec<String> {
    let mut faults = state
        .startup_faults
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    std::mem::take(&mut *faults)
}

/// Wipe every setting back to its built-in default, API keys included.
/// Returns the fresh (masked) settings so the UI does not have to guess what
/// the defaults are — `Settings::default()` stays the only definition of them.
#[tauri::command]
pub fn reset_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    info!("[cmd] reset_settings: restoring defaults, clearing API keys");
    let fresh = Settings::default();
    settings::persist(&state.config_dir, &fresh)?;
    *state.settings.lock().unwrap_or_else(|p| p.into_inner()) = fresh.clone();
    Ok(fresh.masked())
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, mut settings: Settings) -> Result<(), String> {
    // Phone clipboards love appending whitespace to pasted keys — a dirty
    // key makes providers report "Missing Authentication header".
    settings.openrouter_key = settings.openrouter_key.trim().to_string();
    settings.groq_key = settings.groq_key.trim().to_string();
    // Masked values round-tripping from the UI mean "keep the stored key".
    let stored = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    if !stored.openrouter_key.is_empty() && settings.openrouter_key == settings::mask(&stored.openrouter_key)
    {
        settings.openrouter_key = stored.openrouter_key;
    }
    if !stored.groq_key.is_empty() && settings.groq_key == settings::mask(&stored.groq_key) {
        settings.groq_key = stored.groq_key;
    }
    info!(
        "[cmd] save_settings: target={} native={} model={}",
        settings.target_language,
        settings.native_language,
        settings.openrouter_model
    );
    // A failed save means the user's keys are NOT on disk — fail loudly.
    settings::persist(&state.config_dir, &settings)?;
    // Language pair changed → the observer documents and coach thread were
    // built for the OTHER pairing. Archive them (never silently mix
    // languages) and start fresh for the new pairing. Archived files keep
    // every old document recoverable.
    let pairing_changed = stored.target_language != settings.target_language
        || stored.native_language != settings.native_language
        || stored.target_dialect != settings.target_dialect;
    if pairing_changed {
        let archive = |name: &str| {
            let src = state.config_dir.join(name);
            if src.exists() {
                let stamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|t| t.as_secs())
                    .unwrap_or(0);
                let dst = state.config_dir.join(format!(
                    "{name}.{old_target}.{stamp}.bak",
                    old_target = stored.target_language
                ));
                if let Err(e) = std::fs::rename(&src, &dst) {
                    warn!("[cmd] could not archive {name}: {e}");
                } else {
                    info!("[cmd] language change: archived {name} -> {}", dst.display());
                }
            }
        };
        archive("plan.json");
        archive("profile.json");
        archive("coach_thread.json");
        // Reset in-memory documents so the next turn starts clean.
        *state.plan.lock().unwrap_or_else(|p| p.into_inner()) =
            observer::TeachingPlan::default();
        *state.profile.lock().unwrap_or_else(|p| p.into_inner()) =
            observer::Profile::default();
        state
            .coach_thread
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clear();
    }
    *state.settings.lock().unwrap_or_else(|p| p.into_inner()) = settings;
    Ok(())
}

// ─── Guided conversation ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct ChatTurn {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct GuidedToken {
    /// The exact word from the reply, punctuation attached.
    pub text: String,
    /// Short native-language meaning of the word in this context.
    #[serde(default)]
    pub gloss: Option<String>,
    /// Universal part of speech (NOUN, VERB, ADJ, ...).
    #[serde(default)]
    pub pos: Option<String>,
    /// Grammatically interesting form worth the learner's attention.
    #[serde(default)]
    pub notable: bool,
    /// Romanized form for non-Latin scripts (ALA-LC for Arabic).
    #[serde(default)]
    pub romanization: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Mechanic {
    /// Name of the grammar mechanic.
    pub title: String,
    /// CEFR level of the mechanic, e.g. A2.
    #[serde(default)]
    pub cefr: Option<String>,
    /// 2-3 sentences explaining how the mechanic works, in the learner's native language.
    pub body: String,
    /// One worked example close to the reply, with a native-language gloss.
    #[serde(default)]
    pub example: Option<String>,
    /// How this differs from English, in the learner's native language.
    #[serde(default)]
    pub contrast: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Scaffolds {
    /// Complete sentences the learner could plausibly send next.
    #[serde(default)]
    pub replies: Vec<String>,
    /// Fill-in-the-blank sentences using ___ for the missing part.
    #[serde(default)]
    pub frames: Vec<String>,
    /// Short openers of 2-4 words.
    #[serde(default)]
    pub starters: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct TokensOut {
    /// minItems is enforced at the schema level: constrained providers
    /// cannot return an empty token list.
    #[schemars(length(min = 1))]
    pub tokens: Vec<GuidedToken>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct TranslationOut {
    pub translation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct MechanicsOut {
    #[schemars(length(min = 1))]
    pub mechanics: Vec<Mechanic>,
}

/// FLAT on the wire on purpose: given a `{scaffolds: {replies, ...}}` wrapper,
/// models return the inner object at the top level instead. A flat shape plus
/// schema-level minItems keeps them compliant; `Scaffolds` below is the public
/// turn shape, and the schema-level list constraints mean constrained
/// providers cannot emit empty lists (the validate closure sense-checks).
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct ScaffoldsOut {
    #[schemars(length(min = 1))]
    pub replies: Vec<String>,
    #[schemars(length(min = 1))]
    pub frames: Vec<String>,
    #[schemars(length(min = 1))]
    pub starters: Vec<String>,
}

/// Tokenization + translation of the LEARNER's own message — the "did I say
/// what I meant" check.
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct LearnerTokensOut {
    /// Natural native-language translation of what the learner communicated.
    #[schemars(length(min = 1))]
    pub translation: String,
    #[schemars(length(min = 1))]
    pub tokens: Vec<GuidedToken>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GuidedTurnResult {
    pub reply: String,
    pub translation: Option<String>,
    pub tokens: Vec<GuidedToken>,
    /// Tokenization + translation of the LEARNER's own message.
    pub user_tokens: Vec<GuidedToken>,
    pub user_translation: Option<String>,
    pub mechanics: Vec<Mechanic>,
    pub scaffolds: Scaffolds,
    /// Analysis sub-calls that FAILED after retries. Nothing degrades
    /// silently: the breakdown pane renders these as visible errors.
    pub errors: Vec<String>,
}

fn sanitize_reply(raw: &str) -> String {
    let mut text = raw.trim().to_string();
    if text.starts_with("```") {
        text = text
            .rsplit('\n')
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
        if text.ends_with("```") {
            text.truncate(text.len() - 3);
            text = text.trim().to_string();
        }
    }
    // Defensive: cut off any leaked translation/notes block.
    for marker in ["\n---", "\n***", "\n**English", "\n**Traducción"] {
        if let Some(pos) = text.find(marker) {
            text.truncate(pos);
        }
    }
    text.trim().to_string()
}

/// Events streamed to the frontend during one guided turn. The reply pass
/// resolves the turn; the analysis pass lands asynchronously afterwards so
/// the learner can keep typing while grammar notes are still being prepared.
    /// Coach feedback for the learner's latest message (sidebar tutor).
    #[derive(Debug, Clone, Serialize)]
    #[serde(tag = "type", rename_all = "snake_case")]
    pub enum GuidedEvent {
        ReplyDelta { text: String },
        ReplyDone { reply: String },
        /// Progressive hydration: emitted the moment ONE analysis sub-call
        /// finishes; only that section's field is Some. The frontend merges
        /// sections into the turn as they arrive instead of waiting for the
        /// slowest call.
        AnalysisSection {
            tokens: Option<Vec<GuidedToken>>,
            translation: Option<String>,
            /// Learner-message tokenization + translation.
            user_tokens: Option<Vec<GuidedToken>>,
            user_translation: Option<String>,
            mechanics: Option<Vec<Mechanic>>,
            scaffolds: Option<Scaffolds>,
        },
        /// Sidebar-tutor feedback on the learner's latest message.
        CoachDone { feedback: CoachFeedback },
        /// The coach call failed after retries — surfaced loudly.
        CoachFailed { error: String },
        AnalysisDone { turn: GuidedTurnResult },
        #[allow(dead_code)]
        AnalysisFailed { error: String },
        PlanUpdated {
            plan: observer::TeachingPlan,
            profile: observer::Profile,
        },
        /// Anything that failed in background work started by this turn.
        /// The webview puts it on screen; background failures are never left
        /// to a log file.
        Fault { context: String, message: String },
    }

    /// Send an event to the webview, shouting if the channel is gone. This is
    /// the one place a failure cannot be surfaced to the frontend — the
    /// frontend channel is what broke — so the log is all that is left.
    pub fn emit(channel: &Channel<GuidedEvent>, event: GuidedEvent) {
        if let Err(e) = channel.send(event) {
            log::error!("[ipc] event channel send FAILED, the webview will not see it: {e}");
        }
    }

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn guided_turn(
    app: AppHandle,
    state: State<'_, AppState>,
    message: String,
    history: Vec<ChatTurn>,
    greeting: bool,
    // Present when the learner changed practice settings — the partner
    // sends a re-opening message aligned to the new level/topic instead of
    // answering a learner message.
    steering: Option<String>,
    level: Option<String>,
    topic: Option<String>,
    on_event: Channel<GuidedEvent>,
) -> Result<String, String> {
    let settings = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    if settings.openrouter_key.is_empty() {
        warn!("[cmd] guided_turn rejected: no OpenRouter key");
        return Err("No OpenRouter API key configured. Open Settings and add your key.".into());
    }
    let started = std::time::Instant::now();
    // Every run fired by this turn shares a turn id, so the UI can group
    // them into "what happened when you sent that message".
    let turn_id = trace::next_turn_id();
    let target = settings.target_language.clone();
    info!(
        "[cmd] guided_turn start: greeting={greeting} message_len={} history={} target={target}",
        message.len(),
        history.len(),
    );
    let tln = language_display(&target);
    let native = native_display(&settings.native_language);
    let target_overlay =
        overlay(&target, Some(settings.target_dialect.as_str()));
    // Non-Latin targets get a romanization alongside every gloss; the scheme
    // is the language's, not the prompt's.
    let romanization_scheme = languages::romanization(&target);
    // Learner-selected level (steer row) maps to CEFR for every prompt.
    let cefr = match level.as_deref() {
        Some("zero") => "PRE-A1",
        Some("intermediate") => "B1",
        Some("advanced") => "C1",
        _ => "A2",
    }
    .to_string();
    // Topic steering: appended to reply/mechanics/scaffolds directives and
    // surfaced to the coach.
    let topic_directive = match topic.as_deref() {
        Some(t) if !t.trim().is_empty() => format!(
            "\n- TOPIC STEERING: the learner chose the topic \"{t}\". Steer the \
             conversation toward it when natural; if the conversation stalls, \
             offer one question about it."
        ),
        _ => String::new(),
    };

    // ── Pass 1: conversational reply (streamed to the UI) ───────────────────
    let directives = {
        let plan = state.plan.lock().unwrap_or_else(|p| p.into_inner());
        let recent = state
            .recent_mechanics
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        format!(
            "{}{}{}",
            target_overlay,
            observer::directives_block(&plan, &recent),
            topic_directive
        )
    };
    let reply_system = prompts::guided_reply_prompt(&tln, &cefr, &native, &directives);
    let mut reply_messages = vec![json!({"role": "system", "content": reply_system})];
    for turn in history.iter().rev().take(30).rev() {
        reply_messages.push(json!({"role": turn.role, "content": turn.content}));
    }
    if greeting {
        // The greeting must respect the learner's saved level and topic —
        // it is the FIRST message of a steered conversation, not a generic
        // hello that the steering pass then has to correct.
        let topic_line = match topic.as_deref() {
            Some(t) if !t.trim().is_empty() => format!(
                " The conversation topic is {t}: work the greeting and your \
                 opening question around that topic."
            ),
            _ => String::new(),
        };
        reply_messages.push(json!({
            "role": "user",
            "content": format!(
                "[Session start] Greet the learner warmly and ask one simple \
                 opening question they can answer at their level.{topic_line}"
            )
        }));
    } else if let Some(change) = steering.as_deref().filter(|s| !s.trim().is_empty()) {
        // Learner changed practice settings mid-conversation: the partner
        // re-opens the exchange aligned to the new level/topic.
        reply_messages.push(json!({
            "role": "user",
            "content": format!(
                "[The learner just adjusted their practice settings: {change}. \
                 Acknowledge the change naturally in one short sentence and \
                 re-open the conversation with a fresh question or prompt that \
                 fits the new setting. Do not mention UI or settings mechanics.]"
            )
        }));
    } else {
        if message.trim().is_empty() {
            return Err("Message is empty".into());
        }
        reply_messages.push(json!({"role": "user", "content": message}));
    }

    // `tokenize_learner` reads ONLY the learner's message — see
    // `turn_plan::TURN_STEPS`, where its `needs` is `[LearnerMessage]`. So
    // it starts HERE, in parallel with the reply, instead of waiting for a
    // dependency it never had: worth ~700ms on the learner's own bubble.
    //
    // The graph draws that edge from the input node off the same
    // declaration, and `trace::reconcile` contradicts the edge if this ever
    // regresses to waiting.
    let learner_message = if greeting {
        "(session start)".to_string()
    } else if let Some(change) = steering.as_deref().filter(|s| !s.trim().is_empty()) {
        format!("(changed practice settings: {change})")
    } else {
        message.trim().to_string()
    };
    // No learner message means nothing to tokenize. The greeting and a
    // steering turn carry placeholders ("(session start)"), and asking a model
    // to gloss and translate those produced `"translation": "not applicable"`
    // — correct per the no-information rule, then rejected by the validator's
    // non-empty check, costing a retry on EVERY such turn. Skip the call.
    let has_learner_message = !greeting && steering.as_deref().is_none_or(|s| s.trim().is_empty());
    let learner_tokens_task = if !has_learner_message {
        None
    } else {
        Some({
        let provider = Provider::openrouter(&settings.openrouter_key, &settings.openrouter_model);
        let channel = on_event.clone();
        let learner_msgs = vec![
            json!({"role": "system", "content": prompts::learner_tokens_prompt(&tln, &native, romanization_scheme)}),
            json!({"role": "user", "content": format!("Learner message to analyze:\n{}", learner_message)}),
        ];
        tokio::spawn(async move {
            let result = provider
                .structured_validated::<LearnerTokensOut, _>(
                    RunContext::new(ontology::op::TOKENIZE_LEARNER, Some(turn_id)),
                    &learner_msgs,
                    0.1,
                    "LearnerTokensOut",
                    false,
                    None,
                    |t: &LearnerTokensOut| {
                        if t.tokens.is_empty() || t.translation.trim().is_empty() {
                            Some("tokens and translation must not be empty".into())
                        } else { None }
                    },
                )
                .await;
            if let Ok(out) = &result {
                emit(&channel, GuidedEvent::AnalysisSection {
                    tokens: None,
                    translation: None,
                    user_tokens: Some(out.tokens.clone()),
                    user_translation: Some(out.translation.clone()),
                    mechanics: None,
                    scaffolds: None,
                });
            }
            result
        })
        })
    };

    let provider = Provider::openrouter(&settings.openrouter_key, &settings.openrouter_model);
    let channel = on_event.clone();
    let full_reply = provider
        .chat_streaming(
            RunContext::new(ontology::op::REPLY, Some(turn_id)),
            &reply_messages,
            0.6,
            &mut |delta| {
            emit(&channel, GuidedEvent::ReplyDelta {
                text: delta.to_string(),
            });
        })
        .await
        .map_err(|e| {
            let msg = format!("reply failed: {e}");
            if msg.contains("429") {
                "The tutor hit a rate limit — give it a few seconds and try again.".into()
            } else {
                msg
            }
        })?;
    let reply = sanitize_reply(&full_reply);
    if reply.is_empty() {
        return Err("The tutor returned an empty reply. Please try again.".into());
    }
    info!(
        "[cmd] guided_turn reply ready in {:.1}s: reply_len={}",
        started.elapsed().as_secs_f32(),
        reply.len()
    );
    emit(&on_event, GuidedEvent::ReplyDone {
        reply: reply.clone(),
    });
    // The command resolves HERE — the learner can keep talking immediately.
    // The analysis pass runs in the background and lands via the channel.

    // ── Pass 3 (background): observer pass on its own cadence ───────────────
    // Session start (greeting) + every 3rd learner turn. Runs fully parallel;
    // its output is a rewritten TeachingPlan + Profile, delivered via the
    // channel and persisted to disk.
    //
    // Runs on EVERY turn, but never overlaps itself: if the previous observer
    // pass is still thinking, this turn is skipped and the next one picks it
    // up. The plan is never more than one turn stale.
    let observer_free = {
        let mut running = state.observer_running.lock().unwrap_or_else(|p| p.into_inner());
        if *running {
            false
        } else {
            *running = true;
            true
        }
    };
    if observer_free {
        let app_for_observer = app.clone();
        let event_channel = on_event.clone();
        let transcript: Vec<String> = history
            .iter()
            .map(|t| format!("{}: {}", if t.role == "user" { "L" } else { "T" }, t.content))
            .chain(std::iter::once(format!(
                "L: {}",
                if greeting {
                    "(session start)".to_string()
                } else if let Some(change) =
                    steering.as_deref().filter(|s| !s.trim().is_empty())
                {
                    format!("(changed practice settings: {change})")
                } else {
                    message.trim().to_string()
                }
            )))
            .chain(std::iter::once(format!("T: {reply}")))
            .collect();
        let observer_model = settings
            .observer_model
            .clone()
            .unwrap_or_else(crate::settings::default_observer_model);
        let tln_for_observer = tln.clone();
        info!("[cmd] observer pass triggered (model={observer_model})");
        tokio::spawn(async move {
            let obs_started = std::time::Instant::now();
            let state = app_for_observer.state::<AppState>();

            // RAII: the running flag MUST clear when this task ends — panic,
            // early return, whatever. A stuck flag permanently and silently
            // disables the observer (this exact shape of bug happened when a
            // panic killed an earlier observer task).
            struct ClearRunning<'a>(&'a std::sync::Mutex<bool>);
            impl Drop for ClearRunning<'_> {
                fn drop(&mut self) {
                    *self.0.lock().unwrap_or_else(|p| p.into_inner()) = false;
                }
            }
            let _running_guard = ClearRunning(&state.observer_running);

            let (plan_snapshot, profile_snapshot, mechanics) = {
                let plan = state.plan.lock().unwrap_or_else(|p| p.into_inner());
                let profile = state.profile.lock().unwrap_or_else(|p| p.into_inner());
                let mechanics = state.recent_mechanics.lock().unwrap_or_else(|p| p.into_inner());
                (plan.clone(), profile.clone(), mechanics.clone())
            };
            let provider = Provider::openrouter(
                &state.settings.lock().unwrap_or_else(|p| p.into_inner()).openrouter_key,
                &observer_model,
            );
            // The observer USES its reasoning budget — no disable here.
            let result = observer::run_observer(
                &provider,
                RunContext::new(ontology::op::REFLECT, Some(turn_id)),
                &tln_for_observer,
                &transcript.join("
"),
                &plan_snapshot,
                &profile_snapshot,
                &mechanics,
            )
            .await;
            match result {
                Ok(output) => {
                    for fault in
                        observer::persist_documents(&state.config_dir, &output.plan, &output.profile)
                    {
                        emit(
                            &event_channel,
                            GuidedEvent::Fault {
                                context: "Saving teaching plan".into(),
                                message: fault,
                            },
                        );
                    }
                    *state.plan.lock().unwrap_or_else(|p| p.into_inner()) = output.plan.clone();
                    *state.profile.lock().unwrap_or_else(|p| p.into_inner()) = output.profile.clone();
                    info!(
                        "[cmd] observer pass done in {:.1}s: focus={:?} errors={} ledger={}",
                        obs_started.elapsed().as_secs_f32(),
                        output.plan.session_focus,
                        output.plan.recurring_errors.len(),
                        output.plan.taught_ledger.len(),
                    );
                    emit(&event_channel, GuidedEvent::PlanUpdated {
                        plan: output.plan,
                        profile: output.profile,
                    });
                }
                Err(e) => {
                    let message = format!(
                        "The teaching plan was not updated after this turn ({e}).                          The tutor is still working from the previous plan."
                    );
                    log::error!("[cmd] observer pass failed after {:.1}s: {e}", obs_started.elapsed().as_secs_f32());
                    emit(
                        &event_channel,
                        GuidedEvent::Fault {
                            context: "Observer".into(),
                            message,
                        },
                    );
                }
            }
            // Slot freed by _running_guard's Drop — panic-safe.
        });
    }

    // ── Pass 2: analysis — four small one-shot calls run concurrently ───────
    // Each sub-task is tiny (100-500 output tokens), so the wall time is the
    // slowest single call (~3-8s) instead of one serialized 1500-token JSON
    // dump. Failures degrade per-section.

    let tokens_msgs = vec![
        json!({"role": "system", "content": prompts::guided_tokens_prompt(&tln, &native, romanization_scheme)}),
        json!({"role": "user", "content": format!("Tutor reply to tokenize:\n{reply}")}),
    ];
    let translation_msgs = vec![
        json!({"role": "system", "content": prompts::guided_translation_prompt(&tln, &native)}),
        json!({"role": "user", "content": format!("Tutor reply to translate:\n{reply}")}),
    ];
    let mechanics_msgs = vec![
        json!({"role": "system", "content": prompts::guided_mechanics_prompt(&tln, &cefr, &native, &directives)}),
        json!({"role": "user", "content": format!("Learner message ({} level):\n{}\n\nTutor reply:\n{}", cefr, learner_message, reply)}),
    ];
    let scaffolds_msgs = vec![
        json!({"role": "system", "content": prompts::guided_scaffolds_prompt(&tln, &native, &directives)}),
        json!({"role": "user", "content": format!("Learner message:\n{}\n\nTutor reply:\n{}", learner_message, reply)}),
    ];

    let analysis_channel = on_event.clone();
    let reply_for_analysis = reply.clone();
    let app_for_analysis = app.clone();
    let worker_key = settings.openrouter_key.clone();
    let worker_model = settings.openrouter_model.clone();
    // Cloned before the analysis `async move` captures them — the coach
    // spawn needs them later.
    let coach_tln = tln.clone();
    let coach_native = native.clone();
    tokio::spawn(async move {
        let analysis_started = std::time::Instant::now();

        // Each sub-call runs in its own task and hydrates the UI the moment
        // it lands (AnalysisSection). AnalysisDone at the end remains the
        // authoritative merged state, including per-section degradations —
        // so the slowest call never gates the fastest one.
        let tokens_task = {
            let provider = Provider::openrouter(&worker_key, &worker_model);
            let channel = analysis_channel.clone();
            tokio::spawn(async move {
                let result = provider
                    .structured_validated::<TokensOut, _>(
                        RunContext::new(ontology::op::TOKENIZE, Some(turn_id)),
                        &tokens_msgs,
                        0.1,
                        "TokensOut",
                        false,
                        None,
                        |t: &TokensOut| {
                            if t.tokens.is_empty() {
                                Some("tokens must not be empty".into())
                            } else { t
                                .tokens
                                .iter()
                                .find(|tok| tok.text.chars().count() > 48).map(|bad| format!(
                                    "each token must be ONE word with its punctuation attached \
                                     ('{}...' is far too long). Split the reply word by word and \
                                     return only the structured tokenization, no explanations.",
                                    bad.text.chars().take(24).collect::<String>()
                                )) }
                        },
                    )
                    .await;
                if let Ok(out) = &result {
                    emit(&channel, GuidedEvent::AnalysisSection {
                        tokens: Some(out.tokens.clone()),
                        translation: None,
                        user_tokens: None,
                        user_translation: None,
                        mechanics: None,
                        scaffolds: None,
                    });
                }
                result
            })
        };
        let translation_task = {
            let provider = Provider::openrouter(&worker_key, &worker_model);
            let channel = analysis_channel.clone();
            tokio::spawn(async move {
                let result = provider
                    .structured_validated::<TranslationOut, _>(
                        RunContext::new(ontology::op::TRANSLATE, Some(turn_id)),
                        &translation_msgs,
                        0.2,
                        "TranslationOut",
                        false,
                        None,
                        |t: &TranslationOut| {
                            if t.translation.trim().is_empty() { Some("translation must not be empty".into()) } else { None }
                        },
                    )
                    .await;
                if let Ok(out) = &result {
                    emit(&channel, GuidedEvent::AnalysisSection {
                        tokens: None,
                        translation: Some(out.translation.clone()),
                        user_tokens: None,
                        user_translation: None,
                        mechanics: None,
                        scaffolds: None,
                    });
                }
                result
            })
        };
        let mechanics_task = {
            let provider = Provider::openrouter(&worker_key, &worker_model);
            let channel = analysis_channel.clone();
            tokio::spawn(async move {
                let result = provider
                    .structured_validated::<MechanicsOut, _>(
                        RunContext::new(ontology::op::EXPLAIN, Some(turn_id)),
                        &mechanics_msgs,
                        0.4,
                        "MechanicsOut",
                        false,
                        None,
                        |m: &MechanicsOut| {
                            if m.mechanics.is_empty() { Some("mechanics must not be empty - every reply teaches something".into()) } else { None }
                        },
                    )
                    .await;
                if let Ok(out) = &result {
                    emit(&channel, GuidedEvent::AnalysisSection {
                        tokens: None,
                        translation: None,
                        user_tokens: None,
                        user_translation: None,
                        mechanics: Some(out.mechanics.clone()),
                        scaffolds: None,
                    });
                }
                result
            })
        };
        let scaffolds_task = {
            let provider = Provider::openrouter(&worker_key, &worker_model);
            let channel = analysis_channel.clone();
            tokio::spawn(async move {
                let result = provider
                    .structured_validated::<ScaffoldsOut, _>(
                        RunContext::new(ontology::op::SUGGEST, Some(turn_id)),
                        &scaffolds_msgs,
                        0.6,
                        "ScaffoldsOut",
                        false,
                        None,
                        |sc: &ScaffoldsOut| {
                            if sc.replies.is_empty()
                                || sc.frames.is_empty()
                                || sc.starters.is_empty()
                            {
                                Some("all three scaffold lists must be populated".into())
                            } else {
                                None
                            }
                        },
                    )
                    .await;
                if let Ok(out) = &result {
                    emit(&channel, GuidedEvent::AnalysisSection {
                        tokens: None,
                        translation: None,
                        user_tokens: None,
                        user_translation: None,
                        mechanics: None,
                        scaffolds: Some(Scaffolds {
                            replies: out.replies.clone(),
                            frames: out.frames.clone(),
                            starters: out.starters.clone(),
                        }),
                    });
                }
                result
            })
        };


        let (tokens_out, translation_out, mechanics_out, scaffolds_out, user_tokens_out) = (
            tokens_task
                .await
                .unwrap_or_else(|e| Err(format!("tokens task panicked: {e}"))),
            translation_task
                .await
                .unwrap_or_else(|e| Err(format!("translation task panicked: {e}"))),
            mechanics_task
                .await
                .unwrap_or_else(|e| Err(format!("mechanics task panicked: {e}"))),
            scaffolds_task
                .await
                .unwrap_or_else(|e| Err(format!("scaffolds task panicked: {e}"))),
            match learner_tokens_task {
                Some(t) => t
                    .await
                    .unwrap_or_else(|e| Err(format!("user tokens task panicked: {e}"))),
                // Not an error: this turn had no learner message.
                None => Ok(LearnerTokensOut { tokens: Vec::new(), translation: String::new() }),
            },
        );

        // Per-section degradation: a failed sub-call costs its section only.
        let mut failures: Vec<String> = Vec::new();
        let tokens = match tokens_out {
            Ok(t) => t.tokens,
            Err(e) => {
                failures.push(format!("tokens: {e}"));
                Vec::new()
            }
        };
        let translation = match translation_out {
            Ok(t) => Some(t.translation),
            Err(e) => {
                failures.push(format!("translation: {e}"));
                None
            }
        };
        let mechanics = match mechanics_out {
            Ok(m) => m.mechanics,
            Err(e) => {
                failures.push(format!("mechanics: {e}"));
                Vec::new()
            }
        };
        let scaffolds = match scaffolds_out {
            Ok(sc) => Scaffolds {
                replies: sc.replies,
                frames: sc.frames,
                starters: sc.starters,
            },
            Err(e) => {
                failures.push(format!("scaffolds: {e}"));
                Scaffolds {
                    replies: Vec::new(),
                    frames: Vec::new(),
                    starters: Vec::new(),
                }
            }
        };
        let (user_tokens, user_translation) = match user_tokens_out {
            Ok(t) => (t.tokens, Some(t.translation)),
            Err(e) => {
                failures.push(format!("your words: {e}"));
                (Vec::new(), None)
            }
        };

        if failures.is_empty() {
            info!(
                "[cmd] guided analysis done in {:.1}s: tokens={} mechanics={}",
                analysis_started.elapsed().as_secs_f32(),
                tokens.len(),
                mechanics.len(),
            );
        } else {
            warn!(
                "[cmd] guided analysis partially degraded in {:.1}s: {}",
                analysis_started.elapsed().as_secs_f32(),
                failures.join("; "),
            );
        }

        // Record taught mechanics so future analyses never repeat them.
        {
            let state = app_for_analysis.state::<AppState>();
            let mut recent = state
                .recent_mechanics
                .lock()
                .unwrap_or_else(|p| p.into_inner());
            for mech in &mechanics {
                recent.push(mech.title.clone());
            }
            let len = recent.len();
            if len > 20 {
                recent.drain(0..len - 20);
            }
        }

        emit(&analysis_channel, GuidedEvent::AnalysisDone {
            turn: GuidedTurnResult {
                reply: reply_for_analysis,
                translation,
                tokens,
                user_tokens,
                user_translation,
                mechanics,
                scaffolds,
                errors: failures,
            },
        });
    });

    // ── Coach pass: sidebar feedback on the LEARNER's message ───────────
    // Skipped on greeting turns (no learner output to coach yet). Runs on
    // the worker model; failures surface as CoachFailed, never silently.
    if !greeting {
        let app_for_coach = app.clone();
        let coach_channel = on_event.clone();
        let coach_key = settings.openrouter_key.clone();
        let coach_model = settings.openrouter_model.clone();
        let coach_transcript: Vec<String> = history
            .iter()
            .rev()
            .take(12)
            .rev()
            .map(|t| {
                format!(
                    "{}: {}",
                    if t.role == "user" { "LEARNER" } else { "NATIVE" },
                    t.content
                )
            })
            .chain(std::iter::once(format!(
                "LEARNER: {}",
                message.trim()
            )))
            .collect();
        info!("[cmd] coach pass triggered (model={coach_model})");
        tokio::spawn(async move {
            let started = std::time::Instant::now();
            let state = app_for_coach.state::<AppState>();
            let level_notes = state
                .profile
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .level_notes
                .clone();
            let provider = Provider::openrouter(&coach_key, &coach_model);
            let messages = vec![
                json!({"role": "system", "content": prompts::coach_system_prompt(&coach_tln, &coach_native)}),
                json!({"role": "user", "content": prompts::coach_user_message(
                    &coach_transcript.join("\n"),
                    message.trim(),
                    &level_notes,
                    topic.as_deref(),
                )}),
            ];
            let result = provider
                .structured_validated::<CoachFeedback, _>(
                    RunContext::new(ontology::op::REVIEW, Some(turn_id)),
                    &messages,
                    0.3,
                    "CoachFeedback",
                    false,
                    None,
                    CoachFeedback::validate,
                )
                .await;
            match result {
                Ok(feedback) => {
                    info!(
                        "[cmd] coach done in {:.1}s: corrections={} comp={} grammar={}",
                        started.elapsed().as_secs_f32(),
                        feedback.corrections.len(),
                        feedback.comprehensibility,
                        feedback.grammar,
                    );
                    emit(&coach_channel, GuidedEvent::CoachDone { feedback });
                }
                Err(e) => {
                    error!("[cmd] coach FAILED after retries: {e}");
                    emit(&coach_channel, GuidedEvent::CoachFailed {
                        error: format!("coach: {e}"),
                    });
                }
            }
        });
    }

    Ok(reply)
}

// ─── Coach thread (interactive sidebar chat — PRIVATE to the learner) ────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoachChatMessage {
    /// "user" (learner) or "coach".
    pub role: String,
    pub content: String,
}

const COACH_THREAD_FILE: &str = "coach_thread.json";
const COACH_THREAD_CAP: usize = 40;

pub fn init_coach_thread(dir: &Path, faults: &mut Vec<String>) -> Vec<CoachChatMessage> {
    let path = dir.join(COACH_THREAD_FILE);
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return Vec::new(); // first run
    };
    match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            let bad = dir.join(format!("{COACH_THREAD_FILE}.bad"));
            let mut fault = format!(
                "The coach history could not be read ({e}), so it starts empty."
            );
            match std::fs::rename(&path, &bad) {
                Ok(()) => fault.push_str(&format!(" The unreadable file is kept at {}.", bad.display())),
                Err(rename_err) => {
                    fault.push_str(&format!(" It could not be moved aside either: {rename_err}."))
                }
            }
            log::error!("{fault}");
            faults.push(fault);
            Vec::new()
        }
    }
}

fn persist_coach_thread(dir: &Path, thread: &[CoachChatMessage]) {
    match serde_json::to_string_pretty(thread) {
        Ok(raw) => {
            if let Err(e) = std::fs::write(dir.join(COACH_THREAD_FILE), raw) {
                log::error!("FAILED to persist coach thread: {e}");
            }
        }
        Err(e) => log::error!("coach thread serialization failed: {e}"),
    }
}

#[tauri::command]
pub fn get_coach_thread(state: State<'_, AppState>) -> Result<Vec<CoachChatMessage>, String> {
    Ok(state
        .coach_thread
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone())
}

#[tauri::command]
pub fn coach_thread_clear(state: State<'_, AppState>) -> Result<(), String> {
    state
        .coach_thread
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clear();
    let dir = state.config_dir.clone();
    persist_coach_thread(&dir, &[]);
    Ok(())
}

/// Ask the coach a direct question. Sees the primary conversation, the plan,
/// the profile, and this thread. PRIVATE: the native-speaker agent never
/// sees any of it (Cyrano principle).
#[tauri::command]
pub async fn coach_ask(
    state: State<'_, AppState>,
    question: String,
    context: String,
) -> Result<CoachReply, String> {
    let question = question.trim().to_string();
    if question.is_empty() {
        return Err("empty question".into());
    }
    let started = std::time::Instant::now();
    let stored = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    if stored.openrouter_key.trim().is_empty() {
        return Err("No OpenRouter API key configured.".into());
    }
    let tln = crate::languages::language_display(&stored.target_language);
    let native = crate::languages::native_display(&stored.native_language);

    let thread = state
        .coach_thread
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    let (plan, profile) = {
        let plan = state.plan.lock().unwrap_or_else(|p| p.into_inner());
        let profile = state.profile.lock().unwrap_or_else(|p| p.into_inner());
        (plan.clone(), profile.clone())
    };

    let mut messages = vec![json!({
        "role": "system",
        "content": format!(
            "{}\n\nCURRENT TEACHING PLAN:\n{}\n\nLEARNER PROFILE:\n{}",
            prompts::coach_thread_system_prompt(&tln, &native),
            serde_json::to_string_pretty(&plan).unwrap_or_default(),
            serde_json::to_string_pretty(&profile).unwrap_or_default(),
        ),
    })];
    for m in thread.iter().rev().take(COACH_THREAD_CAP).rev() {
        let role = if m.role == "user" { "user" } else { "assistant" };
        messages.push(json!({"role": role, "content": m.content}));
    }
    messages.push(json!({
        "role": "user",
        "content": format!("PRIMARY CONVERSATION (recent lines):\n{context}\n\nYOUR MESSAGE:\n{question}")
    }));

    let provider = Provider::openrouter(&stored.openrouter_key, &stored.openrouter_model);
    let reply = provider
        .chat_streaming(
            RunContext::new(ontology::op::ANSWER, None),
            &messages,
            0.5,
            &mut |_| {},
        )
        .await
        .map_err(|e| format!("coach ask failed: {e}"))?;
    let reply = sanitize_reply(&reply);
    info!(
        "[cmd] coach ask answered in {:.1}s: {} chars",
        started.elapsed().as_secs_f32(),
        reply.len()
    );

    {
        let mut thread = state
            .coach_thread
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        thread.push(CoachChatMessage {
            role: "user".into(),
            content: question.clone(),
        });
        thread.push(CoachChatMessage {
            role: "coach".into(),
            content: reply.clone(),
        });
        let len = thread.len();
        if len > COACH_THREAD_CAP {
            thread.drain(0..len - COACH_THREAD_CAP);
        }
        let dir = state.config_dir.clone();
        persist_coach_thread(&dir, &thread);
    }
    Ok(CoachReply { reply })
}

// ─── Standalone scaffold generation (steer-row driven) ───────────────────────

#[derive(Debug, Deserialize)]
pub struct ScaffoldRequest {
    history: Vec<ChatTurn>,
    level: Option<String>,
    topic: Option<String>,
    dialect: Option<String>,
}

/// Regenerate next-message scaffolds on demand — the steer row calls this
/// when the learner changes level or topic, so suggestions never go stale.
#[tauri::command]
pub async fn generate_scaffolds(
    state: State<'_, AppState>,
    req: ScaffoldRequest,
) -> Result<Scaffolds, String> {
    let stored = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    if stored.openrouter_key.trim().is_empty() {
        return Err("No OpenRouter API key configured.".into());
    }
    let tln = language_display(&stored.target_language);
    let native = native_display(&stored.native_language);
    let _cefr = match req.level.as_deref() {
        Some("intermediate") => "B1",
        Some("advanced") => "C1",
        _ => "A2",
    };
    let topic_directive = match req.topic.as_deref() {
        Some(t) if !t.trim().is_empty() => format!(
            "\n- TOPIC STEERING: the learner chose the topic \"{t}\". Steer the \
             conversation toward it when natural; if the conversation stalls, \
             offer one question about it."
        ),
        _ => String::new(),
    };
    let plan_directives = {
        let plan = state.plan.lock().unwrap_or_else(|p| p.into_inner());
        observer::directives_block(&plan, &[])
    };
    let dialect_overlay =
        overlay(&stored.target_language, req.dialect.as_deref());
    let directives = format!(
        "{dialect_overlay}{plan_directives}{topic_directive}"
    );
    let transcript: Vec<String> = req
        .history
        .iter()
        .rev()
        .take(8)
        .rev()
        .map(|t| {
            format!(
                "{}: {}",
                if t.role == "user" { "LEARNER" } else { "NATIVE" },
                t.content
            )
        })
        .collect();
    let messages = vec![
        json!({"role": "system", "content": prompts::guided_scaffolds_prompt(&tln, &native, &directives)}),
        json!({"role": "user", "content": format!(
            "CONVERSATION SO FAR:\n{}\n\nWrite scaffolds for the learner's NEXT message.",
            transcript.join("\n")
        )}),
    ];
    let provider = Provider::openrouter(&stored.openrouter_key, &stored.openrouter_model);
    let out = provider
        .structured_validated::<ScaffoldsOut, _>(
            RunContext::new(ontology::op::SUGGEST, None),
            &messages,
            0.6,
            "ScaffoldsOut",
            false,
            None,
            |sc: &ScaffoldsOut| {
                if sc.replies.is_empty() || sc.frames.is_empty() || sc.starters.is_empty() {
                    Some("all three scaffold lists must be populated".into())
                } else {
                    None
                }
            },
        )
        .await?;
    Ok(Scaffolds {
        replies: out.replies,
        frames: out.frames,
        starters: out.starters,
    })
}

// ─── Word insight (hold-to-inspect modal) ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct WordInsight {
    /// Dictionary form of the word.
    #[schemars(length(min = 1))]
    pub lemma: String,
    /// Part of speech as used in the sentence.
    #[schemars(length(min = 1))]
    pub pos: String,
    /// Conjugation/declension details: tense, mood, person, number, gender.
    #[schemars(length(min = 1))]
    pub form: String,
    /// Grammatical role in the sentence.
    #[schemars(length(min = 1))]
    pub role: String,
    /// One practical usage note, in the learner's native language.
    #[schemars(length(min = 1))]
    pub usage: String,
}

/// Deep word analysis: lemma, morphology, grammatical role, usage note.
#[tauri::command]
pub async fn word_insight(
    state: State<'_, AppState>,
    word: String,
    sentence: String,
) -> Result<WordInsight, String> {
    let word = word.trim().to_string();
    let sentence = sentence.trim().to_string();
    if word.is_empty() {
        return Err("no word given".into());
    }
    let stored = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    if stored.openrouter_key.trim().is_empty() {
        return Err("No OpenRouter API key configured.".into());
    }
    let tln = language_display(&stored.target_language);
    let native = native_display(&stored.native_language);
    let messages = vec![
        json!({"role": "system", "content": prompts::word_insight_system_prompt(&tln, &native)}),
        json!({"role": "user", "content": format!("WORD: {word}\n\nSENTENCE: {sentence}")}),
    ];
    let provider = Provider::openrouter(&stored.openrouter_key, &stored.openrouter_model);
    provider
        .structured_validated::<WordInsight, _>(
            RunContext::new(ontology::op::WORD_INSIGHT, None),
            &messages,
            0.2,
            "WordInsight",
            false,
            None,
            |w: &WordInsight| {
                if w.lemma.trim().is_empty() || w.usage.trim().is_empty() {
                    Some("lemma and usage must be filled".into())
                } else {
                    None
                }
            },
        )
        .await
}

// ─── Stories ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct StoryToken {
    /// The exact word from the story, punctuation attached.
    pub text: String,
    /// Short native-language meaning of the word in this context.
    #[serde(default)]
    pub gloss: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct StoryParagraph {
    /// The paragraph split word by word, in order. Each token is an object.
    pub tokens: Vec<StoryToken>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct StoryResponse {
    /// Short story title in the target language.
    pub title: String,
    /// The story as 1-4 paragraphs, in order.
    #[schemars(length(min = 1, max = 4))]
    pub paragraphs: Vec<StoryParagraph>,
}

impl StoryResponse {
    fn validate(&self) -> Option<String> {
        let glossed = self
            .paragraphs
            .iter()
            .flat_map(|p| p.tokens.iter())
            .filter(|t| t.gloss.is_some())
            .count();
        if glossed == 0 {
            Some(
                "at least some tokens must carry a native-language gloss — the reader \
                 relies on them for tap-to-translate"
                    .into(),
            )
        } else {
            None
        }
    }
}

#[tauri::command]
pub async fn generate_story(
    state: State<'_, AppState>,
    level: String,
) -> Result<StoryResponse, String> {
    let settings = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    if settings.openrouter_key.is_empty() {
        return Err("No OpenRouter API key configured. Open Settings and add your key.".into());
    }
    if !matches!(level.as_str(), "beginner" | "intermediate" | "advanced") {
        warn!("[cmd] generate_story rejected: unknown level {level}");
        return Err(format!("Unknown level: {level}"));
    }
    let started = std::time::Instant::now();
    info!("[cmd] generate_story: level={level} target={}", settings.target_language);

    let target = settings.target_language.clone();
    let tln = language_display(&target);
    let native = native_display(&settings.native_language);
    let cefr = prompts::resolve_cefr(&level);

    let system = prompts::story_prompt(
        &tln,
        cefr,
        &native,
        &level,
        &overlay(&target, Some(settings.target_dialect.as_str())),
    );
    let messages = vec![
        json!({"role": "system", "content": system}),
        json!({
            "role": "user",
            "content": "Write a new story. Vary the topic — do not repeat common everyday scenarios you have used recently."
        }),
    ];

    let provider = Provider::openrouter(&settings.openrouter_key, &settings.openrouter_model);
    provider
        .structured_validated::<StoryResponse, _>(
            RunContext::new(ontology::op::STORY, None),
            &messages,
            0.7,
            "StoryResponse",
            false, // workers never think
            None,
            |st: &StoryResponse| st.validate(),
        )
        .await
        .inspect(|story| {
            let tokens: usize = story.paragraphs.iter().map(|p| p.tokens.len()).sum();
            info!(
                "[cmd] generate_story done in {:.1}s: paragraphs={} tokens={}",
                started.elapsed().as_secs_f32(),
                story.paragraphs.len(),
                tokens,
            );
        })
        .map_err(|e| {
            error!(
                "[cmd] generate_story failed after {:.1}s: {e}",
                started.elapsed().as_secs_f32()
            );
            format!("story generation failed: {e}")
        })
}

// ─── Observer documents ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ObserverDocuments {
    pub plan: observer::TeachingPlan,
    pub profile: observer::Profile,
}

#[tauri::command]
pub fn get_plan(state: State<'_, AppState>) -> Result<ObserverDocuments, String> {
    Ok(ObserverDocuments {
        plan: state.plan.lock().unwrap_or_else(|p| p.into_inner()).clone(),
        profile: state
            .profile
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone(),
    })
}

// ─── STT (Groq Whisper) ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn transcribe_audio(
    state: State<'_, AppState>,
    audio_base64: String,
    prompt: Option<String>,
) -> Result<String, String> {
    let settings = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    if settings.groq_key.is_empty() {
        warn!("[cmd] transcribe_audio rejected: no Groq key");
        return Err("No Groq API key configured. Open Settings and add your key.".into());
    }

    let started = std::time::Instant::now();
    let audio = base64::engine::general_purpose::STANDARD
        .decode(&audio_base64)
        .map_err(|e| format!("invalid audio data: {e}"))?;
    info!(
        "[cmd] transcribe_audio: {} bytes, target={}",
        audio.len(),
        settings.target_language
    );

    let target = settings.target_language.clone();
    let language = iso639(&target);
    let file_part = reqwest::multipart::Part::bytes(audio)
        .file_name(STT_UPLOAD_NAME)
        .mime_str(STT_UPLOAD_MIME)
        .map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new()
        .text("model", GROQ_STT_MODEL)
        .text("language", language)
        .text("response_format", "json")
        // Context hint: biases recognition toward live vocabulary. Whisper
        // leans on this heavily for lower-resource languages like Arabic.
        .text("prompt", prompt.unwrap_or_default())
        .part("file", file_part);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .post(GROQ_STT_URL)
        .bearer_auth(settings.groq_key.trim())
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("transcription request failed: {e}"))?;

    let status = response.status();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("invalid transcription response: {e}"))?;
    if !status.is_success() {
        error!("[cmd] transcription API error {status}: {}", body);
        return Err(format!(
            "transcription API error {status}: {}",
            body
        ));
    }
    let text = body["text"].as_str().unwrap_or_default().trim().to_string();
    info!(
        "[cmd] transcribe_audio done in {:.1}s: {:?}",
        started.elapsed().as_secs_f32(),
        text
    );
    Ok(text)
}

#[cfg(test)]
mod wav_tests {
    use super::wav_container;

    #[test]
    fn wav_header_is_wellformed() {
        let pcm = vec![0xABu8; 4800]; // 0.1s at 24kHz mono 16-bit
        let w = wav_container(&pcm, 24_000);
        assert_eq!(&w[0..4], b"RIFF");
        assert_eq!(&w[8..12], b"WAVE");
        assert_eq!(&w[12..16], b"fmt ");
        assert_eq!(u16::from_le_bytes([w[20], w[21]]), 1);
        assert_eq!(u16::from_le_bytes([w[22], w[23]]), 1);
        assert_eq!(u32::from_le_bytes([w[24], w[25], w[26], w[27]]), 24_000);
        assert_eq!(u32::from_le_bytes([w[28], w[29], w[30], w[31]]), 48_000);
        assert_eq!(u32::from_le_bytes([w[4], w[5], w[6], w[7]]), (36 + pcm.len() as u32));
        assert_eq!(&w[36..40], b"data");
        assert_eq!(u32::from_le_bytes([w[40], w[41], w[42], w[43]]), pcm.len() as u32);
        assert_eq!(w.len(), 44 + pcm.len());
    }

    #[test]
    fn wav_empty_pcm_still_valid_header() {
        let w = wav_container(&[], 24_000);
        assert_eq!(w.len(), 44);
        assert_eq!(u32::from_le_bytes([w[40], w[41], w[42], w[43]]), 0);
    }
}
