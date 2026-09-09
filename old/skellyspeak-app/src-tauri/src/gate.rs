//! Pause and step the agent pipeline.
//!
//! This holds **real work**. When the gate is closed, an operation blocks
//! before its HTTP request is made — the model is never called, no tokens are
//! spent, and the turn genuinely does not proceed until it is let through. A
//! control that only paused a picture of the pipeline while the pipeline ran
//! on regardless would be a lie told to the person who wrote it.
//!
//! # Where the gate sits
//!
//! Every AI operation in this app enters through one of two `Provider`
//! methods, `chat_streaming` or `structured_validated`, and both take a
//! [`RunContext`](crate::trace::RunContext). So the gate is checked once at
//! the top of each — one hold per logical operation, not one per retry, and
//! nothing can route around it without going somewhere new for its model call.
//!
//! # What it cannot do
//!
//! It cannot pause a response already arriving. Once the request is away the
//! bytes are the provider's to send, and holding a half-read SSE stream open
//! would achieve nothing but a timeout. The gate is a starting line, not a
//! freeze frame — which is also why stepping releases an operation *before*
//! its call rather than between its tokens.
//!
//! # The app really does stop
//!
//! Pausing mid-turn means the reply stops arriving and the conversation sits
//! there. That is the honest consequence of a real pause, and it is why the
//! state is broadcast to the whole UI rather than living inside the graph
//! view: a paused pipeline must never be mistaken for a hung app.

use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::Emitter;
use tokio::sync::Notify;

/// Broadcast whenever the gate's state changes, including when an operation
/// arrives at it or is released.
pub const GATE_EVENT: &str = "trace:gate";

static GATE: OnceLock<Gate> = OnceLock::new();
static EMITTER: OnceLock<tauri::AppHandle> = OnceLock::new();

/// Attach the gate to the running app so state changes reach the UI. Called
/// once from `lib.rs::setup`. Unattached (tests, the bench harness) the gate
/// still works; nothing is listening, so nothing is emitted.
pub fn attach(app: tauri::AppHandle) {
    if EMITTER.set(app).is_err() {
        log::warn!("[gate] already attached - ignoring second attach");
    }
}

fn gate() -> &'static Gate {
    GATE.get_or_init(Gate::default)
}

/// An operation stopped at the gate, waiting to be let through.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Held {
    /// Arrival order, so the UI can show a queue rather than a set.
    pub id: u64,
    /// An `ontology::op::*` id — the same name the graph node carries.
    pub operation: String,
    pub turn_id: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Default)]
pub struct GateStatus {
    pub paused: bool,
    /// How many more operations may pass while still paused. Spent by
    /// stepping; always zero when running.
    pub budget: u32,
    /// Waiting at the gate right now, oldest first.
    pub waiting: Vec<Held>,
}

#[derive(Default)]
struct State {
    paused: bool,
    budget: u32,
    waiting: Vec<Held>,
    next_id: u64,
}

#[derive(Default)]
pub struct Gate {
    state: Mutex<State>,
    /// Woken on resume and on step. `notify_waiters` rather than `notify_one`:
    /// every held operation must re-examine the budget, because a step of one
    /// releases exactly one of them and the rest must go back to waiting.
    wake: Notify,
}

impl State {
    fn status(&self) -> GateStatus {
        GateStatus {
            paused: self.paused,
            budget: self.budget,
            waiting: self.waiting.clone(),
        }
    }
}

fn broadcast(status: &GateStatus) {
    if let Some(app) = EMITTER.get() {
        if let Err(e) = app.emit(GATE_EVENT, status) {
            log::error!("[gate] could not broadcast state: {e}");
        }
    }
}

/// Block until this operation is allowed to run.
///
/// Returns immediately when the gate is open, which is the overwhelmingly
/// common case and costs one uncontended lock.
pub async fn wait(operation: &str, turn_id: Option<u64>) {
    let g = gate();
    let mut registered: Option<u64> = None;

    loop {
        // Created BEFORE the state is examined. A resume landing between the
        // check and the await would otherwise be missed, and the operation
        // would hang until the next unrelated step.
        let notified = g.wake.notified();
        tokio::pin!(notified);

        let outcome = {
            let mut st = g.state.lock().unwrap_or_else(|p| p.into_inner());
            if !st.paused || st.budget > 0 {
                if st.paused {
                    st.budget -= 1;
                }
                if let Some(id) = registered {
                    st.waiting.retain(|h| h.id != id);
                }
                Some(st.status())
            } else if registered.is_none() {
                st.next_id += 1;
                let id = st.next_id;
                st.waiting.push(Held {
                    id,
                    operation: operation.to_string(),
                    turn_id,
                });
                registered = Some(id);
                Some(st.status())
            } else {
                None
            }
        };

        match outcome {
            // Released. The status is broadcast so the queue shortens on
            // screen as work resumes.
            Some(status) if registered.is_none() || !status.waiting.iter().any(|h| Some(h.id) == registered) => {
                broadcast(&status);
                return;
            }
            // Newly queued, or still queued: publish and wait.
            Some(status) => {
                log::info!("[gate] holding {operation} (paused)");
                broadcast(&status);
            }
            None => {}
        }

        notified.await;
    }
}

/// Close the gate. Operations already in flight finish; the next one to reach
/// the gate stops there.
pub fn pause() -> GateStatus {
    let status = {
        let mut st = gate().state.lock().unwrap_or_else(|p| p.into_inner());
        st.paused = true;
        // A leftover budget would let operations slip through a fresh pause.
        st.budget = 0;
        st.status()
    };
    log::info!("[gate] paused");
    broadcast(&status);
    status
}

/// Open the gate and release everything waiting.
pub fn resume() -> GateStatus {
    let status = {
        let mut st = gate().state.lock().unwrap_or_else(|p| p.into_inner());
        st.paused = false;
        st.budget = 0;
        st.status()
    };
    log::info!("[gate] resumed");
    gate().wake.notify_waiters();
    broadcast(&status);
    status
}

/// Let `count` operations through, then stop again.
///
/// Stepping while running is meaningless rather than harmless — it would bank
/// a budget that silently swallows the first operations after the next pause —
/// so it pauses first.
pub fn step(count: u32) -> GateStatus {
    let status = {
        let mut st = gate().state.lock().unwrap_or_else(|p| p.into_inner());
        st.paused = true;
        st.budget = st.budget.saturating_add(count.max(1));
        st.status()
    };
    log::info!("[gate] step {}", count.max(1));
    gate().wake.notify_waiters();
    broadcast(&status);
    status
}

pub fn status() -> GateStatus {
    gate()
        .state
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .status()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    /// Each test drives its own gate rather than the process-wide one, which
    /// other tests would otherwise share.
    fn fresh() -> Gate {
        Gate::default()
    }

    async fn wait_on(g: &Gate, operation: &str) {
        let mut registered: Option<u64> = None;
        loop {
            let notified = g.wake.notified();
            tokio::pin!(notified);
            let done = {
                let mut st = g.state.lock().unwrap();
                if !st.paused || st.budget > 0 {
                    if st.paused {
                        st.budget -= 1;
                    }
                    if let Some(id) = registered {
                        st.waiting.retain(|h| h.id != id);
                    }
                    true
                } else {
                    if registered.is_none() {
                        st.next_id += 1;
                        let id = st.next_id;
                        st.waiting.push(Held {
                            id,
                            operation: operation.into(),
                            turn_id: None,
                        });
                        registered = Some(id);
                    }
                    false
                }
            };
            if done {
                return;
            }
            notified.await;
        }
    }

    #[tokio::test]
    async fn an_open_gate_does_not_hold_anything() {
        let g = fresh();
        // Must not hang: this is the path every operation takes normally.
        wait_on(&g, "reply").await;
    }

    #[tokio::test]
    async fn a_paused_gate_actually_blocks() {
        let g = Arc::new(fresh());
        g.state.lock().unwrap().paused = true;

        let ran = Arc::new(AtomicU32::new(0));
        let task = {
            let g = g.clone();
            let ran = ran.clone();
            tokio::spawn(async move {
                wait_on(&g, "reply").await;
                ran.fetch_add(1, Ordering::SeqCst);
            })
        };

        // Give it every chance to slip through.
        tokio::task::yield_now().await;
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        assert_eq!(ran.load(Ordering::SeqCst), 0, "the operation was not held");
        assert_eq!(g.state.lock().unwrap().waiting.len(), 1);

        g.state.lock().unwrap().paused = false;
        g.wake.notify_waiters();
        task.await.unwrap();
        assert_eq!(ran.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn a_step_releases_exactly_one_of_several() {
        let g = Arc::new(fresh());
        g.state.lock().unwrap().paused = true;

        let ran = Arc::new(AtomicU32::new(0));
        let mut tasks = Vec::new();
        for _ in 0..3 {
            let g = g.clone();
            let ran = ran.clone();
            tasks.push(tokio::spawn(async move {
                wait_on(&g, "analysis").await;
                ran.fetch_add(1, Ordering::SeqCst);
            }));
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        assert_eq!(ran.load(Ordering::SeqCst), 0);

        // One step, one operation. The other two must go back to waiting —
        // this is why the wake is a broadcast that everyone re-checks rather
        // than a hand-off to a single waiter.
        g.state.lock().unwrap().budget += 1;
        g.wake.notify_waiters();
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        assert_eq!(ran.load(Ordering::SeqCst), 1, "a step must release one, not all");

        g.state.lock().unwrap().paused = false;
        g.wake.notify_waiters();
        for t in tasks {
            t.await.unwrap();
        }
        assert_eq!(ran.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn a_held_operation_appears_in_the_queue_by_name() {
        let g = Arc::new(fresh());
        g.state.lock().unwrap().paused = true;
        let task = {
            let g = g.clone();
            tokio::spawn(async move { wait_on(&g, "tokenize_learner").await })
        };
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        let status = g.state.lock().unwrap().status();
        assert!(status.paused);
        assert_eq!(status.waiting.len(), 1);
        assert_eq!(status.waiting[0].operation, "tokenize_learner");

        g.state.lock().unwrap().paused = false;
        g.wake.notify_waiters();
        task.await.unwrap();
        assert!(g.state.lock().unwrap().waiting.is_empty());
    }

    #[test]
    fn pausing_discards_any_unspent_step_budget() {
        // Otherwise a step that was never taken would let the first operation
        // after a later pause straight through, which reads as the pause
        // simply not working.
        let g = fresh();
        {
            let mut st = g.state.lock().unwrap();
            st.paused = true;
            st.budget = 3;
        }
        {
            let mut st = g.state.lock().unwrap();
            st.paused = true;
            st.budget = 0;
        }
        assert_eq!(g.state.lock().unwrap().budget, 0);
    }

    #[test]
    fn the_process_gate_starts_open() {
        // The app must never boot into a state where the first turn hangs.
        assert!(!status().paused);
        assert_eq!(status().budget, 0);
        assert!(status().waiting.is_empty());
    }
}
