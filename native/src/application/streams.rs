//! Streamed text of running attempts, held in memory between the transport and
//! the windows. Every change raises the attempt's sequence number; the pump
//! pushes changed entries to every window and periodically saves the text of
//! running attempts, without ever moving the snapshot revision.
use super::{Application, Arc, Emitter};
use crate::ai::transport::provider::Completion;
use crate::conversations::execution::Dispatch;
use crate::diagnostics::failures::{platform, poisoned, report};
use crate::model::{AttemptStreamRead, AttemptStreamUpdate, Result};
use std::collections::HashMap;
use tauri::AppHandle;
fn emit_update(app: &AppHandle, update: AttemptStreamUpdate) {
    if let Err(error) = app.emit("ai-attempt-stream", update) {
        report(
            "stream_delivery",
            &platform(&error, "stream_delivery", &[], super::internal()),
        );
    }
}

struct Entry {
    update: AttemptStreamUpdate,
    emitted_seq: u32,
    saved_seq: u32,
}

pub(crate) struct StreamRegistry {
    generation: u32,
    entries: HashMap<String, Entry>,
}

impl StreamRegistry {
    pub(crate) fn new(generation: u32) -> Self {
        Self {
            generation,
            entries: HashMap::new(),
        }
    }

    pub(crate) fn generation(&self) -> u32 {
        self.generation
    }

    /// A new workspace generation: everything from the old one is dropped, and
    /// callbacks that still carry it are rejected.
    pub(crate) fn reset(&mut self) {
        self.generation = self.generation.wrapping_add(1);
        self.entries.clear();
    }

    pub(crate) fn register(
        &mut self,
        generation: u32,
        attempt: &str,
        conversation: String,
        turn: String,
        operation: String,
        kind: String,
    ) {
        if generation != self.generation {
            return;
        }
        self.entries.insert(
            attempt.to_owned(),
            Entry {
                update: AttemptStreamUpdate {
                    generation,
                    attempt_id: attempt.to_owned(),
                    conversation_id: conversation,
                    turn_id: turn,
                    operation_id: operation,
                    kind,
                    seq: 0,
                    text: String::new(),
                    terminal: None,
                },
                emitted_seq: 0,
                saved_seq: 0,
            },
        );
    }

    /// New text for a running attempt. Rejected for another generation, an
    /// unregistered attempt, or one that already ended.
    pub(crate) fn delta(&mut self, generation: u32, attempt: &str, text: &str) -> bool {
        if generation != self.generation {
            return false;
        }
        let Some(entry) = self.entries.get_mut(attempt) else {
            return false;
        };
        if entry.update.terminal.is_some() || entry.update.text == text {
            return false;
        }
        entry.update.text = text.to_owned();
        entry.update.seq += 1;
        true
    }

    /// The attempt ended. The change gets its own sequence number, and is
    /// returned so the caller can push it at once.
    pub(crate) fn terminal(
        &mut self,
        generation: u32,
        attempt: &str,
        state: &str,
    ) -> Option<AttemptStreamUpdate> {
        if generation != self.generation {
            return None;
        }
        let entry = self.entries.get_mut(attempt)?;
        if entry.update.terminal.as_deref() == Some(state) {
            return None;
        }
        entry.update.terminal = Some(state.to_owned());
        entry.update.seq += 1;
        entry.emitted_seq = entry.update.seq;
        Some(entry.update.clone())
    }

    pub(crate) fn text(&self, attempt: &str) -> Option<String> {
        self.entries
            .get(attempt)
            .map(|entry| entry.update.text.clone())
            .filter(|text| !text.is_empty())
    }

    pub(crate) fn remove(&mut self, attempt: &str) {
        self.entries.remove(attempt);
    }

    /// Entries that changed since they were last pushed.
    pub(crate) fn pending(&mut self) -> Vec<AttemptStreamUpdate> {
        self.entries
            .values_mut()
            .filter(|entry| entry.update.seq > entry.emitted_seq)
            .map(|entry| {
                entry.emitted_seq = entry.update.seq;
                entry.update.clone()
            })
            .collect()
    }

    /// Running entries whose text changed since it was last saved.
    pub(crate) fn unsaved(&mut self) -> Vec<(String, String)> {
        self.entries
            .values_mut()
            .filter(|entry| {
                entry.update.terminal.is_none()
                    && entry.update.seq > entry.saved_seq
                    && !entry.update.text.is_empty()
            })
            .map(|entry| {
                entry.saved_seq = entry.update.seq;
                (entry.update.attempt_id.clone(), entry.update.text.clone())
            })
            .collect()
    }

    /// Attempts still believed running, to check against the store.
    pub(crate) fn running(&self) -> Vec<String> {
        self.entries
            .values()
            .filter(|entry| entry.update.terminal.is_none())
            .map(|entry| entry.update.attempt_id.clone())
            .collect()
    }

    pub(crate) fn read(&self, conversation: &str) -> AttemptStreamRead {
        AttemptStreamRead {
            generation: self.generation,
            entries: self
                .entries
                .values()
                .filter(|entry| entry.update.conversation_id == conversation)
                .map(|entry| entry.update.clone())
                .collect(),
        }
    }
}

/// Pushes stream changes to every window at up to 20 per second per attempt.
const PUMP_INTERVAL: std::time::Duration = std::time::Duration::from_millis(50);
/// Checks that registered attempts are still running, so a cancelled one is
/// marked ended even while its transport keeps delivering.
const ACTIVITY_TICKS: u32 = 4;
/// Saves running text about once per second, whether or not deltas arrive.
const SAVE_TICKS: u32 = 20;

impl Application {
    /// Register a dispatched attempt's stream; returns the generation its
    /// callbacks must carry.
    pub(super) fn register_stream(&self, dispatch: &Dispatch) -> u32 {
        let scope = self
            .lock()
            .and_then(|store| store.attempt_scope(&dispatch.attempt));
        let Ok(mut streams) = self.streams.lock() else {
            report("stream_registration", &poisoned(super::internal()));
            return 0;
        };
        let generation = streams.generation();
        if let Err(error) = &scope {
            report("stream_registration_scope", error);
        }
        if let Ok(Some((conversation, turn, operation, kind))) = scope {
            streams.register(
                generation,
                &dispatch.attempt,
                conversation,
                turn,
                operation,
                kind,
            );
        }
        generation
    }

    pub(super) fn stream_delta(&self, generation: u32, attempt: &str, text: &str) {
        if let Ok(mut streams) = self.streams.lock() {
            streams.delta(generation, attempt, text);
        } else {
            report("stream_delta_lock", &poisoned(super::internal()));
        }
    }

    /// Finish an attempt with everything it streamed, then tell every window
    /// it ended. The terminal push happens after the store commit (and its
    /// revision bump), so the first snapshot showing the end already holds
    /// the retained text.
    pub(super) fn finish_attempt(
        &self,
        app: &AppHandle,
        generation: u32,
        dispatch: &Dispatch,
        outcome: Result<Completion>,
    ) -> Result<()> {
        let streamed = self
            .streams
            .lock()
            .map_err(|_| poisoned(super::internal()))?
            .text(&dispatch.attempt);
        let ended = {
            let mut store = self.lock()?;
            store.finish_retaining(dispatch, outcome, streamed.as_deref())?;
            store.attempt_state(&dispatch.attempt)?
        };
        if let Ok(mut streams) = self.streams.lock() {
            if let Some(update) = streams.terminal(
                generation,
                &dispatch.attempt,
                ended.as_deref().unwrap_or("unknown"),
            ) {
                emit_update(app, update);
            }
            streams.remove(&dispatch.attempt);
        }
        Ok(())
    }

    pub(super) fn read_streams(
        &self,
        conversation: &str,
    ) -> Result<crate::model::AttemptStreamRead> {
        Ok(self
            .streams
            .lock()
            .map_err(|_| {
                crate::model::AppError::new(
                    crate::model::ErrorCode::Internal,
                    "Stream state is unavailable.",
                )
            })?
            .read(conversation))
    }

    /// Whether a grouped target can stream deltas (protocol version 2), read
    /// once per target and connection revision from its `/v1/protocol`.
    pub(super) async fn grouped_deltas(
        &self,
        client: &reqwest::Client,
        key: &str,
        dispatch: &Dispatch,
    ) -> bool {
        let target = (dispatch.target.url.clone(), dispatch.target.revision);
        if let Some(known) = self
            .delta_support
            .lock()
            .ok()
            .and_then(|cache| cache.get(&target).copied())
        {
            return known;
        }
        match crate::ai::transport::grouped::supports_deltas(client, key, &dispatch.text_request())
            .await
        {
            Ok(supported) => {
                if let Ok(mut cache) = self.delta_support.lock() {
                    cache.insert(target, supported);
                }
                supported
            }
            Err(error) => {
                report("stream_capability_probe", &error);
                false
            }
        }
    }

    /// A new workspace generation (factory reset): drop every stream.
    pub(crate) fn reset_streams(&self) {
        if let Ok(mut streams) = self.streams.lock() {
            streams.reset();
        }
    }
}

/// Push stream changes, mark attempts that ended elsewhere, and save running
/// text periodically. Never holds the stream lock while taking the store lock.
pub(super) async fn stream_pump(state: Arc<Application>, app: AppHandle) {
    let mut tick: u32 = 0;
    loop {
        tokio::time::sleep(PUMP_INTERVAL).await;
        tick = tick.wrapping_add(1);
        if tick.is_multiple_of(ACTIVITY_TICKS) {
            let (generation, running) = match state.streams.lock() {
                Ok(streams) => (streams.generation(), streams.running()),
                Err(_) => {
                    report("stream_pump_lock", &poisoned(super::internal()));
                    continue;
                }
            };
            let ended: Vec<(String, String)> = match state.lock() {
                Ok(store) => running
                    .into_iter()
                    .filter_map(|attempt| match store.attempt_state(&attempt) {
                        Ok(Some(value)) if value != "running" => Some((attempt, value)),
                        Ok(None) => Some((attempt, "invalidated".to_owned())),
                        Err(error) => {
                            report("stream_attempt_state", &error);
                            None
                        }
                        _ => None,
                    })
                    .collect(),
                Err(error) => {
                    report("stream_pump_store", &error);
                    Vec::new()
                }
            };
            if let Ok(mut streams) = state.streams.lock() {
                for (attempt, value) in ended {
                    if let Some(update) = streams.terminal(generation, &attempt, &value) {
                        emit_update(&app, update);
                    }
                }
            }
        }
        let pending = state
            .streams
            .lock()
            .map(|mut streams| streams.pending())
            .unwrap_or_default();
        for update in pending {
            emit_update(&app, update);
        }
        if tick.is_multiple_of(SAVE_TICKS) {
            let unsaved = state
                .streams
                .lock()
                .map(|mut streams| streams.unsaved())
                .unwrap_or_default();
            if !unsaved.is_empty()
                && let Ok(mut store) = state.lock()
                && let Err(error) = store.save_previews(&unsaved)
            {
                report("stream_preview_save", &error);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn registry() -> StreamRegistry {
        let mut registry = StreamRegistry::new(7);
        registry.register(
            7,
            "a",
            "c".into(),
            "t".into(),
            "o".into(),
            "persona_reply".into(),
        );
        registry
    }

    #[test]
    fn every_change_raises_the_sequence_including_terminal() {
        let mut registry = registry();
        assert!(registry.delta(7, "a", "Ho"));
        assert!(registry.delta(7, "a", "Hola"));
        assert_eq!(registry.pending()[0].seq, 2);
        // A terminal change with no new text still gets a higher number, so a
        // reconciler that discards equal sequences cannot drop it.
        let terminal = registry.terminal(7, "a", "failed").unwrap();
        assert_eq!(
            (
                terminal.seq,
                terminal.text.as_str(),
                terminal.terminal.as_deref()
            ),
            (3, "Hola", Some("failed"))
        );
        assert!(
            !registry.delta(7, "a", "Hola mundo"),
            "no text after the end"
        );
        assert!(
            registry.pending().is_empty(),
            "the terminal change was pushed directly"
        );
    }

    #[test]
    fn a_reset_rejects_callbacks_from_the_old_generation() {
        let mut registry = registry();
        registry.reset();
        assert!(!registry.delta(7, "a", "late"));
        assert!(registry.terminal(7, "a", "failed").is_none());
        registry.register(7, "b", "c".into(), "t".into(), "o".into(), "k".into());
        assert!(
            registry.read("c").entries.is_empty(),
            "old dispatches cannot repopulate it"
        );
        assert_eq!(registry.read("c").generation, 8);
    }

    #[test]
    fn unsaved_text_is_reported_once_per_change_even_without_new_deltas() {
        let mut registry = registry();
        registry.delta(7, "a", "Hola");
        assert_eq!(
            registry.unsaved(),
            vec![("a".to_owned(), "Hola".to_owned())]
        );
        assert!(
            registry.unsaved().is_empty(),
            "a stalled stream is not rewritten"
        );
        registry.delta(7, "a", "Hola m");
        assert_eq!(registry.unsaved().len(), 1);
        registry.terminal(7, "a", "cancelled");
        registry.delta(7, "a", "ignored");
        assert!(registry.unsaved().is_empty());
        assert_eq!(registry.text("a").as_deref(), Some("Hola m"));
    }
}
