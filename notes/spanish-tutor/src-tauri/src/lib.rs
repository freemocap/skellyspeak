//! App wiring: build the LLM client + Spanish analyzer, load cards and the
//! learner model, register commands.

mod analysis;
mod cards;
mod commands;
mod ir;
mod learner;
mod llm;
mod orchestrator;

use analysis::spanish::SpanishLlmAnalyzer;
use analysis::Analyzer;
use cards::CardLibrary;
use commands::AppState;
use learner::LearnerModel;
use llm::ollama::OllamaClient;
use llm::LlmClient;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

// Change these to match your local setup. Confirm the model tag with `ollama list`.
const OLLAMA_URL: &str = "http://localhost:11434";
const MODEL_TAG: &str = "gemma4:e4b"; // e.g. "gemma4:e4b" — verify against `ollama list`

const CARDS_JSON: &str = include_str!("../cards/spanish.json");
const SEED_VOCAB_JSON: &str = include_str!("../data/super7_es.json");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let client: Arc<dyn LlmClient> = Arc::new(OllamaClient::new(OLLAMA_URL, MODEL_TAG));
            let analyzer: Arc<dyn Analyzer> = Arc::new(SpanishLlmAnalyzer::new(client.clone()));

            let library = CardLibrary::from_json(CARDS_JSON)
                .expect("cards/spanish.json failed to parse");

            let seed_vocab: Vec<String> =
                serde_json::from_str(SEED_VOCAB_JSON).unwrap_or_default();

            let mut learner_path = app.path().app_data_dir()
                .expect("no app data dir");
            learner_path.push("learner.json");
            let learner = LearnerModel::load_or_seed(learner_path, &seed_vocab);

            app.manage(AppState {
                client,
                analyzer,
                library,
                learner: Mutex::new(learner),
                history: Mutex::new(Vec::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::send_message,
            commands::get_learner,
            commands::reset_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
