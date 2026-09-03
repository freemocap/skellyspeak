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

/// The exchange leading UP TO the message under review.
///
/// It deliberately stops short of that message. `prompts::coach_user_message`
/// presents it separately, under "LEARNER'S LATEST MESSAGE (analyze this)", so
/// appending it here as well put the same sentence twice in a row in one
/// prompt. Models answered the duplication instead of the message — remarking
/// that the learner had repeated themselves, which they had not.
pub(super) fn transcript(history: &[super::ChatTurn]) -> Vec<String> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::guided::ChatTurn;

    fn turn(role: &str, content: &str) -> ChatTurn {
        ChatTurn {
            role: role.into(),
            content: content.into(),
        }
    }

    #[test]
    fn the_message_under_review_is_not_repeated_in_the_transcript() {
        // The prompt names the latest message in its own labelled block. A copy
        // at the end of the transcript put it twice in a row, and the coach
        // commented on the repetition instead of the language.
        let history = vec![turn("assistant", "Hola, como estas?"), turn("user", "estoy bien")];
        let lines = transcript(&history);
        assert_eq!(
            lines,
            vec![
                "NATIVE: Hola, como estas?".to_string(),
                "LEARNER: estoy bien".to_string(),
            ]
        );
        assert_eq!(
            lines.iter().filter(|l| l.contains("estoy bien")).count(),
            1,
            "the learner's line must appear once"
        );
    }

    #[test]
    fn roles_are_relabelled_for_the_coach() {
        // The coach's prompt talks about LEARNER and NATIVE, not user/assistant.
        let lines = transcript(&[turn("user", "hola"), turn("assistant", "hola")]);
        assert_eq!(lines[0], "LEARNER: hola");
        assert_eq!(lines[1], "NATIVE: hola");
    }

    #[test]
    fn only_the_most_recent_turns_are_kept_and_they_stay_in_order() {
        let history: Vec<ChatTurn> = (0..COACH_TRANSCRIPT_TURNS + 5)
            .map(|i| turn("user", &i.to_string()))
            .collect();
        let lines = transcript(&history);
        assert_eq!(lines.len(), COACH_TRANSCRIPT_TURNS);
        assert_eq!(lines[0], "LEARNER: 5", "oldest kept turn");
        assert_eq!(
            lines[lines.len() - 1],
            format!("LEARNER: {}", COACH_TRANSCRIPT_TURNS + 4),
            "newest turn stays last"
        );
    }

    #[test]
    fn a_first_message_has_no_transcript_rather_than_a_stub() {
        assert!(transcript(&[]).is_empty());
    }
}
