//! Application composition and shared runtime entry points.
use crate::ai::audio;
use crate::ai::connections::access;
use crate::ai::connections::credentials;
use crate::ai::generation;
use crate::ai::generation::generation_receipts;
use crate::ai::policy::admission;
use crate::ai::policy::holds;
use crate::ai::transport::grouped;
use crate::ai::transport::provider;
use crate::conversations::conversation_export;
use crate::conversations::execution;
use crate::diagnostics;
use crate::language::gloss;
#[cfg(test)]
use crate::language::languages;
use crate::learning::learner::learner_state;
use crate::learning::learner::progression;
use crate::learning::rewards;
use crate::learning::rewards::reward_settings;
use crate::model;
use crate::partners::persona;
use crate::partners::persona::persona_prompt;
use crate::speech::recording::voice;
use crate::storage::factory_reset;
use crate::storage::store;
use crate::updates as updater;

use model::{
    AppError, Command, ConnectionConfig, ConnectionRoute, ConversationSnapshot, ErrorCode,
    HostedAccount, PersonaDetails, ProfileSnapshot, Receipt, Result, Snapshot, StartupState,
};
use std::ops::{Deref, DerefMut};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;
use store::Store;
#[cfg(desktop)]
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};
use zeroize::Zeroizing;

mod commands;
use crate::ai::policy::retry;
mod reading_results;
mod scheduler;
mod speech_results;
mod startup;
mod state;
mod streams;

use scheduler::scheduler;
pub use startup::run;
pub(crate) use state::Application;

pub(crate) fn internal() -> AppError {
    AppError::new(ErrorCode::Internal, "Application state is unavailable.")
}

pub(crate) async fn read_secret(id: String) -> Result<Zeroizing<String>> {
    static READS: std::sync::LazyLock<admission::CredentialReads> =
        std::sync::LazyLock::new(admission::CredentialReads::new);
    READS.read(move || credentials::read(&id)).await
}

#[cfg(test)]
#[path = "tests/structured_server.rs"]
mod test_server;
