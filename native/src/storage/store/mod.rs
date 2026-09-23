//! Workspace store, transaction entry point and durable record projections.
#[cfg(test)]
use crate::language::languages;
use crate::model::*;
use rusqlite::{Connection, OptionalExtension, params};
use std::path::Path;
use uuid::Uuid;

mod commands;
mod creation;
mod schema;
mod snapshot;
mod startup;
mod workspace;

use creation::{create_conversation, create_persona};
pub(crate) use schema::SCHEMA_VERSION;
use schema::{GENERATION_SCHEMA, validate_current_schema, validate_database};
use snapshot::read_snapshot;
pub(crate) use workspace::prepare_private_directory as private_directory;
pub(crate) use workspace::{
    WORKSPACE_FILE, WORKSPACE_LOCK, WorkspaceOwnership, prepare_private_directory,
};

pub struct Store {
    pub(crate) config: crate::configuration::Registry,
    pub(crate) connection: Connection,
    pub(crate) session_id: String,
    pub(crate) credential_writes: std::collections::HashSet<String>,
    /// Where credential identifiers are recorded outside the database, so a
    /// factory reset can remove secrets even when the workspace will not open.
    pub(crate) credential_index: std::path::PathBuf,
    pub(crate) speech_cache: crate::speech::cache::Cache,
    /// Where drill attempt audio is stored, beside the workspace database.
    pub(crate) drill_audio: std::path::PathBuf,
    ownership: WorkspaceOwnership,
}

fn id() -> String {
    Uuid::new_v4().to_string()
}

fn missing() -> AppError {
    AppError::new(
        ErrorCode::NotFound,
        "This item no longer exists. Refresh the view.",
    )
}

/// A bounded, nonempty, single-line label. Persona fields have their own limits
/// in `crate::partners::persona`.
fn short_text(value: &str, label: &str, max: usize) -> Result<()> {
    if value.trim().is_empty() || value.chars().count() > max || value.contains('\0') {
        return Err(AppError::new(
            ErrorCode::Validation,
            format!("{label} must be nonempty and at most {max} characters."),
        ));
    }
    Ok(())
}

fn check_revision(actual: i32, expected: i32) -> Result<()> {
    if actual != expected {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "This item changed. Review the saved value before applying your edit again.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests;
