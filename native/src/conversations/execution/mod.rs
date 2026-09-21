//! Durable conversation execution: admission, dispatch and source-bound publication.
use crate::ai::transport::provider::Completion;
use crate::ai::transport::provider::PromptMessage;
use crate::conversations::turn_plan::COACH_PLAN;
use crate::conversations::turn_plan::OPENING_PLAN;
use crate::conversations::turn_plan::PLAN;
use crate::model::*;
use crate::storage::store::Store;
use rusqlite::{Connection, OptionalExtension, params};
use uuid::Uuid;

mod admission;
mod assistance;
mod connections;
mod dispatch;
mod graph;
mod holds;
mod publication;
mod reading;
mod recovery;
mod retry_diagnostics;
mod snapshots;
mod speech;
mod turns;

#[cfg(test)]
use admission::OUTSTANDING_NETWORK_LIMIT;
use admission::TURN_ATTEMPT_LIMIT;
use admission::admit_network_work;
use admission::admit_turn_retry;
use admission::budget_error;
pub use assistance::{request_explanations, request_suggestions, retry_reply_help};
pub(crate) use connections::active_credential;
pub use connections::config;
pub(crate) use connections::invalidate;
pub(crate) use connections::new_attempt_id;
use holds::pause_related;
use holds::release_hold;
use publication::ops_succeeded;
use publication::plan_for;
pub(crate) use publication::refresh_turn;
use reading::analysis_role;
use reading::gloss_error_path;
use reading::gloss_path;
pub use reading::retry_gloss;
use reading::translation_path;
pub use speech::cancel_speech;
use speech::prepare_speech;
pub use speech::request_speech;
use speech::speech_binding;
use speech::speech_owner;
pub use turns::accept_coach;
pub(crate) use turns::accept_opening;
pub(crate) use turns::accept_revision_send;
pub use turns::accept_send;
pub use turns::control_turn;

pub struct Dispatch {
    pub decisions: Option<serde_json::Value>,
    pub temperature: f64,
    pub target: crate::ai::connections::access::ResolvedTarget,
    pub attempt: String,
    pub operation: String,
    pub credential: String,
    pub model: String,
    pub route: ConnectionRoute,
    pub install_id: String,
    pub messages: Vec<PromptMessage>,
    pub gloss_schema: Option<serde_json::Value>,
    pub coaching_schema: Option<serde_json::Value>,
    pub gloss_source: Option<crate::conversations::gloss::Source>,
    pub speech_source: Option<crate::speech::cache::Source>,
}

fn fail(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}

fn id() -> String {
    Uuid::new_v4().to_string()
}

fn bump(db: &Connection) -> Result<()> {
    db.execute("UPDATE metadata SET revision=revision+1", [])?;
    Ok(())
}

#[cfg(test)]
mod tests;
