//! Pausing and stepping the agent pipeline.
//!
//! These hold real work. Pausing stops the next operation before its model
//! call is made — the conversation genuinely does not advance until it is
//! released, which is the point and also the reason the UI has to say so
//! loudly. See `crate::gate`.

use crate::gate::{self, GateStatus};

/// Close the gate. Work already in flight finishes; the next operation to
/// reach the gate stops there.
#[tauri::command]
pub fn gate_pause() -> GateStatus {
    gate::pause()
}

/// Open the gate and release everything waiting.
#[tauri::command]
pub fn gate_resume() -> GateStatus {
    gate::resume()
}

/// Let `count` operations through, then stop again. Pauses first if running,
/// so "step" always means the same thing from either state.
#[tauri::command]
pub fn gate_step(count: Option<u32>) -> GateStatus {
    gate::step(count.unwrap_or(1))
}

/// The current state, for a view that has just mounted. Live changes arrive on
/// the `trace:gate` event instead.
#[tauri::command]
pub fn gate_status() -> GateStatus {
    gate::status()
}
