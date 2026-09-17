//! Conversation-owned short lessons. Generation and review use durable turns;
//! content and lifecycle live together in the originating turn's captured context.
//! Reading is assistance, never an assessment event. [@british_council_task_based]
use crate::ai::transport::provider::Completion;
use crate::ai::transport::provider::PromptMessage;
use crate::configuration::Registry;
use crate::model::*;
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use ts_rs::TS;

/// Temporarily frozen while conversation, coaching and XP are rebuilt.
pub(crate) const ENABLED: bool = false;
pub(crate) fn require_enabled() -> Result<()> {
    if !ENABLED {
        return Err(invalid(
            "Lessons are disabled while conversation coaching is being rebuilt.",
        ));
    }
    Ok(())
}

mod suspension;
pub(crate) use suspension::suspend_pending;
mod lifecycle;
mod prompts;
mod quiz;
mod repository;
mod results;
mod types;

pub(crate) use lifecycle::check;
pub(crate) use lifecycle::choices;
pub(crate) use lifecycle::control;
pub(crate) use lifecycle::generate;
use lifecycle::stop_reviews;
pub(crate) use prompts::attach_question;
pub(crate) use prompts::context_block;
pub(crate) use prompts::prompt;
use prompts::review_sources;
pub(crate) use prompts::schema;
pub(crate) use quiz::answer_quiz;
pub(crate) use quiz::quiz_credits;
pub(crate) use repository::active;
pub(crate) use repository::capture_exposure;
#[cfg(test)]
use repository::has_exposure;
pub(crate) use repository::owned;
use repository::save;
pub(crate) use repository::views;
use results::evidence_valid;
pub(crate) use results::publish;
pub(crate) use results::validate;
pub(crate) use types::LessonRequest;
pub use types::{
    LessonCategory, LessonControl, LessonEvidence, LessonExample, LessonPlan, LessonQuizAnswer,
    LessonQuizCredit, LessonQuizQuestion, LessonRecap, LessonView,
};

fn invalid(s: &str) -> AppError {
    AppError::new(ErrorCode::Validation, s)
}

#[cfg(test)]
mod tests;
