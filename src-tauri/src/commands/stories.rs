//! Generated reading practice.

use serde::{Deserialize, Serialize};
use log::{error, info, warn};
use serde_json::json;
use tauri::{State};
use crate::ontology;
use crate::languages::{language_display, native_display, overlay};
use crate::prompts;
use crate::trace::{RunContext};
use crate::AppState;

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

    let provider = settings.chat_provider(&settings.openrouter_model)?;
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
