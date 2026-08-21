//! Tauri commands: the thin layer tying skellysubs-core + the vendored
//! machinery to the frontend.

use std::sync::{Arc, LazyLock, Mutex};

use tauri::Emitter;

use crate::audio_toolkit::VadPolicy;
use crate::managers::audio::AudioRecordingManager;
use crate::managers::model::ModelManager;
use crate::managers::transcription::TranscriptionManager;
use crate::stt::OpenAiSttClient;

use skellysubs_core::grammar::cards::{CardLibrary, SPANISH_CARDS_JSON, SUPER7_VOCAB_JSON};
use skellysubs_core::grammar::{run_turn, LearnerModel, TutorTurn};
use skellysubs_core::llm::AiClient;
use skellysubs_core::tutor::tutor_stream_prompt;
use skellysubs_core::{
    run_turn_with_reply, ApiFormat, HistoryTurn, LlmClient, ProviderMode, TutorReply,
};

/// Build the LLM client from the persisted provider config.
fn build_llm_client(app: &tauri::AppHandle) -> Result<LlmClient, String> {
    let settings = crate::provider_settings::load(app)?;
    LlmClient::from_config(&settings.llm).map_err(|e| e.to_string())
}

/// Per-process learner state (in-memory for MVP), seeded with the Super-7 vocab.
static LEARNER: LazyLock<Mutex<LearnerModel>> = LazyLock::new(|| {
    let seed: Vec<String> = serde_json::from_str(SUPER7_VOCAB_JSON).unwrap_or_default();
    Mutex::new(LearnerModel::with_vocab(&seed))
});

/// The Spanish mechanics card library (embedded).
static LIBRARY: LazyLock<CardLibrary> = LazyLock::new(|| {
    CardLibrary::from_json(SPANISH_CARDS_JSON).expect("embedded cards/spanish.json must parse")
});

/// Handy's recommended multilingual STT model (catalog rank #2, and the #1
/// multilingual pick): Nemotron Streaming 3.5 — 28 languages incl. English +
/// Spanish, with auto language detection. Registry id = "{repo_id}/{filename}".
const DEFAULT_STT_MODEL_ID: &str =
    "handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf/nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf";

/// The pure (non-streaming) turn logic — kept for the unit test.
#[allow(dead_code)]
fn tutor_turn<C: AiClient>(client: &C, text: &str) -> Result<TutorTurn, String> {
    let shared = skellysubs_core::languages::get("english")
        .ok_or_else(|| "english config missing".to_string())?;
    let target = skellysubs_core::languages::get("spanish")
        .ok_or_else(|| "spanish config missing".to_string())?;
    let mut learner = LEARNER.lock().map_err(|e| e.to_string())?;
    run_turn(client, &shared, &target, &LIBRARY, &mut learner, text).map_err(|e| e.to_string())
}

/// Stream the tutor reply as plain text via `tutor-stream-delta` events, then
/// compute the grammar breakdown and return the full turn.
fn tutor_turn_streaming(
    app: &tauri::AppHandle,
    client: &LlmClient,
    history: &[HistoryTurn],
    text: &str,
) -> Result<TutorTurn, String> {
    let shared = skellysubs_core::languages::get("english")
        .ok_or_else(|| "english config missing".to_string())?;
    let target = skellysubs_core::languages::get("spanish")
        .ok_or_else(|| "spanish config missing".to_string())?;

    // 1. Stream the reply (no learner lock held during the slow network call).
    let vocab = {
        let learner = LEARNER.lock().map_err(|e| e.to_string())?;
        learner.sorted_known_vocab()
    };
    let prompt = tutor_stream_prompt(&shared, &target, &vocab, history, text);
    let reply_text = client
        .stream_text(&prompt, |delta| {
            let _ = app.emit("tutor-stream-delta", delta.to_string());
        })
        .map_err(|e| e.to_string())?;
    let reply = TutorReply {
        reply: reply_text,
        target_phrase: None,
        romanization: None,
        explanation: None,
    };

    // 2. Grammar breakdown + suggested replies run CONCURRENTLY — both depend
    // only on the streamed reply, not on each other.
    let reply_for_analysis = reply.clone();
    let reply_text_for_suggestions = reply.reply.clone();
    std::thread::scope(|scope| {
        let analysis = scope.spawn(move || {
            let mut learner = LEARNER.lock().map_err(|e| e.to_string())?;
            run_turn_with_reply(client, &LIBRARY, &mut learner, reply_for_analysis)
                .map_err(|e| e.to_string())
        });
        let suggestions = scope.spawn(move || {
            skellysubs_core::tutor::suggest_replies(client, &reply_text_for_suggestions)
                .map_err(|e| e.to_string())
        });

        let mut turn = analysis
            .join()
            .map_err(|e| format!("analysis thread panicked: {e:?}"))??;

        // Suggestions are best-effort — ignore failure.
        if let Ok(Ok(s)) = suggestions.join() {
            turn.suggestions = s;
        }

        Ok(turn)
    })
}

/// Send the user's message to the tutor; return the reply + grammar analysis + cards.
#[tauri::command]
pub async fn send_message(
    app: tauri::AppHandle,
    history: Vec<HistoryTurn>,
    text: String,
) -> Result<TutorTurn, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let client = build_llm_client(&app)?;
        tutor_turn_streaming(&app, &client, &history, &text)
    })
    .await
    .map_err(|e| e.to_string())?
}

/* ------------------------------- voice ---------------------------------- */

/// Minimal STT status for the frontend (is the default model present + loaded?).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SttStatus {
    pub model_id: String,
    pub downloaded: bool,
    pub loaded: bool,
}

/// PTT press: open the mic and start capturing. We use the offline VAD
/// profile so silence is dropped and a silent hold transcribes to "" (no
/// tutor turn) instead of Whisper hallucinating text.
#[tauri::command]
pub fn start_listening(audio: tauri::State<'_, Arc<AudioRecordingManager>>) -> Result<(), String> {
    audio
        .try_start_recording("ptt", VadPolicy::Offline)
        .map(|_| ())
}

/// PTT release: stop capture, transcribe, and return the text.
#[tauri::command]
pub async fn stop_listening(
    app: tauri::AppHandle,
    audio: tauri::State<'_, Arc<AudioRecordingManager>>,
    transcription: tauri::State<'_, Arc<TranscriptionManager>>,
) -> Result<String, String> {
    let stt = crate::provider_settings::load(&app)?.stt;
    let audio = audio.inner().clone();
    let transcription = transcription.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let samples = audio
            .stop_recording("ptt", 0)
            .ok_or_else(|| "No recording in progress".to_string())?;
        if samples.is_empty() {
            return Ok(String::new());
        }
        match stt.mode {
            ProviderMode::Local => transcription.transcribe(samples).map_err(|e| e.to_string()),
            ProviderMode::Remote => {
                if stt.format == ApiFormat::Anthropic {
                    return Err(
                        "Anthropic has no transcription API — use an OpenAI-compatible STT endpoint"
                            .to_string(),
                    );
                }
                let key = if stt.api_key.trim().is_empty() {
                    None
                } else {
                    Some(stt.api_key.trim().to_string())
                };
                let client =
                    OpenAiSttClient::new(stt.base_url, stt.model, key).map_err(|e| e.to_string())?;
                client.transcribe(&samples)
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Report whether the default STT model is downloaded and loaded.
#[tauri::command]
pub fn stt_status(
    model_manager: tauri::State<'_, Arc<ModelManager>>,
    transcription: tauri::State<'_, Arc<TranscriptionManager>>,
) -> SttStatus {
    let mm = model_manager.inner().clone();
    let _ = mm.rescan_local_models();
    let downloaded = mm
        .get_model_info(DEFAULT_STT_MODEL_ID)
        .map(|m| m.is_downloaded)
        .unwrap_or(false);
    SttStatus {
        model_id: DEFAULT_STT_MODEL_ID.to_string(),
        downloaded,
        loaded: transcription.is_model_loaded(),
    }
}

/// Download (if needed) and load the recommended STT model (Nemotron
/// Streaming 3.5, ~751MB). The first call takes a while.
#[tauri::command]
pub async fn ensure_stt_model(
    model_manager: tauri::State<'_, Arc<ModelManager>>,
    transcription: tauri::State<'_, Arc<TranscriptionManager>>,
) -> Result<SttStatus, String> {
    let mm = model_manager.inner().clone();
    let _ = mm.rescan_local_models();
    let info = mm
        .get_model_info(DEFAULT_STT_MODEL_ID)
        .ok_or_else(|| format!("Unknown STT model: {DEFAULT_STT_MODEL_ID}"))?;
    if !info.is_downloaded {
        mm.download_model(DEFAULT_STT_MODEL_ID)
            .await
            .map_err(|e| e.to_string())?;
    }

    let tr = transcription.inner().clone();
    if !tr.is_model_loaded() {
        let tr2 = tr.clone();
        let result = tauri::async_runtime::spawn_blocking(move || tr2.load_model(DEFAULT_STT_MODEL_ID))
            .await
            .map_err(|e| e.to_string())?;
        result.map_err(|e| e.to_string())?;
    }

    Ok(SttStatus {
        model_id: DEFAULT_STT_MODEL_ID.to_string(),
        downloaded: true,
        loaded: tr.is_model_loaded(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use schemars::JsonSchema;
    use serde::de::DeserializeOwned;
    use skellysubs_core::llm::LlmError;

    struct Fake;
    impl AiClient for Fake {
        fn complete_structured<T>(&self, _p: &str, name: &str) -> Result<T, LlmError>
        where
            T: DeserializeOwned + JsonSchema,
        {
            let v = if name == "TutorReply" {
                serde_json::json!({ "reply": "Hablé con ella." })
            } else {
                serde_json::json!({
                    "tokens": [{"text": "Hablé", "lemma": "hablar", "pos": "VERB", "gloss": "I spoke"}],
                    "features": [{"key": "Tense", "value": "Past", "token_index": 0}],
                    "constructions": []
                })
            };
            serde_json::from_value(v).map_err(LlmError::Json)
        }
    }

    #[test]
    fn tutor_turn_returns_reply_analysis_and_cards() {
        let turn = tutor_turn(&Fake, "hi").unwrap();
        assert_eq!(turn.reply.reply, "Hablé con ella.");
        assert_eq!(turn.analysis.tokens[0].lemma, "hablar");
        assert!(turn.cards.iter().any(|c| c.id == "es-preterite"));
    }
}
