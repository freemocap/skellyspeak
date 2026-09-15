//! Application composition and shared runtime entry points.
use crate::ai::connections::access;
use crate::ai::connections::credentials;
use crate::ai::policy::admission;
use crate::ai::policy::holds;
use crate::ai::transport::grouped;
use crate::ai::transport::provider;
use crate::ai::transport::speech_provider;
use crate::conversations::conversation_export;
use crate::conversations::execution;
use crate::conversations::gloss;
use crate::diagnostics;
#[cfg(test)]
use crate::language::languages;
use crate::language::linguistics;
use crate::learning::learner::learner_state;
use crate::learning::learner::progression;
use crate::learning::rewards;
use crate::learning::rewards::reward_settings;
use crate::model;
use crate::partners::generation;
use crate::partners::generation::generation_receipts;
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
use tauri::Manager;
#[cfg(desktop)]
use tauri::{
    Emitter,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
};
use zeroize::Zeroizing;

mod commands;
mod scheduler;
mod startup;
mod state;

pub(crate) use commands::partners::generation_identity;
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
