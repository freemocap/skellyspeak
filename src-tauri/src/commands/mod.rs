//! The IPC surface, one module per domain.
//!
//! Everything the webview can call lives under here. The split is by what a
//! command is *about*: conversation storage and speech synthesis live in their
//! own modules, while the guided module owns turn execution.
//!
//! Commands are registered from `lib.rs` by their full path
//! (`commands::guided::guided_turn`), because `#[tauri::command]` generates a
//! companion macro alongside each function that a plain `pub use` would not
//! carry with it.

pub mod app_settings;
pub mod coach;
pub mod lesson;
pub mod conversations;
pub mod dev;
pub mod guided;
pub mod hosted_auth;
pub mod insight;
pub mod keys;
pub mod mic;
pub mod personas;
pub mod pipeline;
pub mod scaffolds;
pub mod stories;
pub mod stt;
pub mod tts;

// Used by the app shell at startup rather than by the webview, so these are
// re-exported for `lib.rs` to reach without naming the module.
pub use coach::{init_coach_thread, CoachChatMessage};
