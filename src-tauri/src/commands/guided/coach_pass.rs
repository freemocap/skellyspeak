//! The coach pass: private feedback on what the LEARNER said, for the sidebar.
//!
//! Runs only when there is a learner message to react to. A greeting has no
//! learner output yet, and a steering turn carries an empty message — coaching
//! either asks the model to review nothing and shows the learner the failure.

use log::{error, info};
use serde_json::json;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use crate::ai::Provider;
use crate::ontology;
use crate::prompts;
use crate::trace::RunContext;
use crate::AppState;

use super::super::coach::CoachFeedback;
use super::types::{emit, GuidedEvent};

/// How much of the conversation the coach sees. Its job is the latest message,
/// not the whole history — enough context to judge it, no more.
const COACH_TRANSCRIPT_TURNS: usize = 12;

pub(super) struct CoachPass {
    pub app: AppHandle,
    pub channel: Channel<GuidedEvent>,
    pub provider: Provider,
    pub turn_id: u64,
    pub tln: String,
    pub native: String,
    /// What the learner just said — never empty; the caller checks.
    pub message: String,
    pub transcript: Vec<String>,
    pub topic: Option<String>,
}

/// The recent exchange as the coach sees it, ending with the message under
/// review.
pub(super) fn transcript(history: &[super::ChatTurn], message: &str) -> Vec<String> {
    history
        .iter()
        .rev()
        .take(COACH_TRANSCRIPT_TURNS)
        .rev()
        .map(|t| {
            format!(
                "{}: {}",
                if t.role == "user" { "LEARNER" } else { "NATIVE" },
                t.content
            )
        })
        .chain(std::iter::once(format!("LEARNER: {message}")))
        .collect()
}

pub(super) fn spawn(pass: CoachPass) {
    info!("[cmd] coach pass triggered (model={})", pass.provider.model);
    tokio::spawn(async move {
        let started = std::time::Instant::now();
        let CoachPass {
            app,
            channel,
            provider,
            turn_id,
            tln,
            native,
            message,
            transcript,
            topic,
        } = pass;

        let level_notes = app
            .state::<AppState>()
            .profile
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .level_notes
            .clone();

        let messages = vec![
            json!({"role": "system", "content": prompts::coach_system_prompt(&tln, &native)}),
            json!({"role": "user", "content": prompts::coach_user_message(
                &transcript.join("\n"),
                &message,
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
                emit(&channel, GuidedEvent::CoachDone { feedback });
            }
            Err(e) => {
                error!("[cmd] coach FAILED after retries: {e}");
                emit(
                    &channel,
                    GuidedEvent::CoachFailed {
                        error: format!("coach: {e}"),
                    },
                );
            }
        }
    });
}
