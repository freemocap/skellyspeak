//! The observer pass: rewrites the teaching plan and learner profile from the
//! transcript, on its own cadence and never overlapping itself.

use log::info;
use tauri::{AppHandle, Manager};
use tauri::ipc::Channel;

use crate::conversation;
use crate::observer;
use crate::ontology;
use crate::trace::RunContext;
use crate::AppState;

use super::types::{emit, GuidedEvent};

pub(super) struct ObserverPass {
    pub app: AppHandle,
    pub channel: Channel<GuidedEvent>,
    pub turn_id: u64,
    pub tln: String,
    pub transcript: Vec<String>,
    pub model: String,
    /// The pairing this turn belongs to, captured BEFORE the task starts.
    /// Reading it at the end would file the observer's conclusions under
    /// whatever conversation the learner had switched to while it was thinking.
    pub pairing: (String, String),
}

/// Claim the observer slot, if it is free.
///
/// Returns false when a previous pass is still thinking: that turn is skipped
/// and the next one picks it up, so the plan is never more than one turn stale.
pub(super) fn try_claim_slot(state: &AppState) -> bool {
    let mut running = state
        .observer_running
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    if *running {
        false
    } else {
        *running = true;
        true
    }
}

/// Frees the observer slot however the task ends — return, error, or panic.
///
/// A stuck flag permanently and silently disables the observer, which is
/// exactly the bug a panicking task caused once before.
struct ClearRunning<'a>(&'a std::sync::Mutex<bool>);

impl Drop for ClearRunning<'_> {
    fn drop(&mut self) {
        *self.0.lock().unwrap_or_else(|p| p.into_inner()) = false;
    }
}

/// Caller must have claimed the slot with `try_claim_slot` first.
pub(super) fn spawn(pass: ObserverPass) {
    info!("[cmd] observer pass triggered (model={})", pass.model);
    tokio::spawn(async move {
        let started = std::time::Instant::now();
        let ObserverPass {
            app,
            channel,
            turn_id,
            tln,
            transcript,
            model,
            pairing,
        } = pass;
        let state = app.state::<AppState>();
        let _running_guard = ClearRunning(&state.observer_running);

        let docs = match conversation::pair_dir(&state.config_dir, &pairing.0, &pairing.1) {
            Ok(dir) => dir,
            Err(e) => {
                emit(
                    &channel,
                    GuidedEvent::Fault {
                        context: "Saving teaching plan".into(),
                        message: e,
                    },
                );
                return;
            }
        };

        let (plan_snapshot, profile_snapshot, mechanics) = {
            let plan = state.plan.lock().unwrap_or_else(|p| p.into_inner());
            let profile = state.profile.lock().unwrap_or_else(|p| p.into_inner());
            let mechanics = state
                .recent_mechanics
                .lock()
                .unwrap_or_else(|p| p.into_inner());
            (plan.clone(), profile.clone(), mechanics.clone())
        };

        let provider = {
            let settings = state
                .settings
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .clone();
            match settings.chat_provider(&model) {
                Ok(provider) => provider,
                Err(e) => {
                    // Background work has no caller to return to, so an
                    // unusable provider is reported to the webview rather than
                    // ending the task quietly.
                    emit(
                        &channel,
                        GuidedEvent::Fault {
                            context: "Observer".into(),
                            message: format!("The teaching plan was not updated: {e}"),
                        },
                    );
                    return;
                }
            }
        };

        // The observer USES its reasoning budget — no disable here.
        let result = observer::run_observer(
            &provider,
            RunContext::new(ontology::op::REFLECT, Some(turn_id)),
            &tln,
            &transcript.join("\n"),
            &plan_snapshot,
            &profile_snapshot,
            &mechanics,
        )
        .await;

        match result {
            Ok(output) => {
                for fault in observer::persist_documents(&docs, &output.plan, &output.profile) {
                    emit(
                        &channel,
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
                    started.elapsed().as_secs_f32(),
                    output.plan.session_focus,
                    output.plan.recurring_errors.len(),
                    output.plan.taught_ledger.len(),
                );
                emit(
                    &channel,
                    GuidedEvent::PlanUpdated {
                        plan: output.plan,
                        profile: output.profile,
                    },
                );
            }
            Err(e) => {
                log::error!(
                    "[cmd] observer pass failed after {:.1}s: {e}",
                    started.elapsed().as_secs_f32()
                );
                emit(
                    &channel,
                    GuidedEvent::Fault {
                        context: "Observer".into(),
                        message: format!(
                            "The teaching plan was not updated after this turn ({e}). \
                             The tutor is still working from the previous plan."
                        ),
                    },
                );
            }
        }
        // Slot freed by _running_guard's Drop — panic-safe.
    });
}
