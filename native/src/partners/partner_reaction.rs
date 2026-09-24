//! Evidence of understanding in the actual reply, not inferred emotion.
use serde::{Deserialize, Serialize};
use ts_rs::TS;
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum ReactionKind {
    Understood,
    Partial,
    Misunderstood,
    ClarificationRequested,
    Unclear,
    NoReply,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct PartnerReaction {
    pub kind: ReactionKind,
    pub answer: crate::learning::coaching::message_assessment::ChoiceAssessment,
}
