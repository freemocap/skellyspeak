use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConversationFeedback {
    pub grammar: Option<u8>,
    pub conversation: Option<u8>,
    pub answers:
        std::collections::BTreeMap<String, super::super::message_assessment::ChoiceAssessment>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct AssistedReply {
    pub text: String,
    pub translation: String,
    pub romanization: String,
    pub pronunciation: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ReplyBrief {
    pub explanation: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ReplyAssistance {
    pub replies: Vec<AssistedReply>,
    pub frames: Vec<String>,
    pub starters: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ReplyExplanation {
    pub quote: String,
    pub title: String,
    pub body: String,
    pub example: String,
    pub contrast: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ReplyExplanations {
    pub cards: Vec<ReplyExplanation>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ReplyHelpKind {
    Brief,
    Grammar,
    Replies,
}
impl ReplyHelpKind {
    pub fn from_operation(kind: &str) -> Option<Self> {
        match kind {
            super::BRIEF => Some(Self::Brief),
            super::EXPLANATIONS => Some(Self::Grammar),
            super::ASSISTANCE => Some(Self::Replies),
            _ => None,
        }
    }
    pub fn operation(self) -> &'static str {
        match self {
            Self::Brief => super::BRIEF,
            Self::Grammar => super::EXPLANATIONS,
            Self::Replies => super::ASSISTANCE,
        }
    }
}
