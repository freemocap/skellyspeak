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
    pub context: crate::instruction::Context,
    pub epoch: u64,
    pub app: AppHandle,
    pub channel: Channel<GuidedEvent>,
    pub turn_id: u64,
    pub tln: String,
    pub transcript: Vec<String>,
    pub provider: crate::ai::Provider,
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
    info!("[cmd] observer pass triggered (model={})", pass.provider.model);
    tokio::spawn(async move {
        let started = std::time::Instant::now();
        let ObserverPass {
            mut context,
            epoch,
            app,
            channel,
            turn_id,
            tln,
            transcript,
            provider,
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

        let lesson = match crate::lesson::load(&docs) {
            Ok(lesson) => lesson,
            Err(error) => {
                emit(&channel, GuidedEvent::Fault { context: "Lesson choices".into(), message: error });
                return;
            }
        };
        let (plan_snapshot, profile_snapshot, mechanics) = {
            let context = state.context_epoch.lock().expect("context lock poisoned");
            if *context != epoch { return; }
            let plan = state.plan.lock().unwrap_or_else(|p| p.into_inner());
            let profile = state.profile.lock().unwrap_or_else(|p| p.into_inner());
            let mechanics = state
                .recent_mechanics
                .lock()
                .unwrap_or_else(|p| p.into_inner());
            (plan.clone(), profile.clone(), mechanics.clone())
        };

        context.lesson_revision = lesson.revision;
        context.inferred_level_notes = profile_snapshot.level_notes.clone();
        let observer_directives = format!("{}\n{}", lesson.choices.directives(), context.difficulty.coaching_context());
        // Observer documents use the captured provider and conversation context.
        let result = observer::run_observer(
            &provider,
            RunContext::new(ontology::op::REFLECT, Some(turn_id)).with_context(&context),
            &tln,
            &transcript.join("\n"),
            &plan_snapshot,
            &profile_snapshot,
            &mechanics,
            &observer_directives,
        )
        .await;

        match result {
            Ok(output) => {
                let context = state.context_epoch.lock().expect("context lock poisoned");
                if *context != epoch { return; }
                match crate::lesson::load(&docs) {
                    Ok(current) if current.revision == lesson.revision => {}
                    Ok(_) => {
                        emit(&channel, GuidedEvent::Fault { context: "Observer".into(), message: "Lesson choices changed during observation. Your choices are saved; observations will refresh on a later turn.".into() });
                        return;
                    }
                    Err(error) => {
                        emit(&channel, GuidedEvent::Fault { context: "Lesson choices".into(), message: error });
                        return;
                    }
                }
                let faults = observer::persist_documents(&docs, &output.plan, &output.profile);
                let failed = !faults.is_empty();
                for fault in faults {
                    emit(
                        &channel,
                        GuidedEvent::Fault {
                            context: "Saving teaching plan".into(),
                            message: fault,
                        },
                    );
                }
                if failed { return; }
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
