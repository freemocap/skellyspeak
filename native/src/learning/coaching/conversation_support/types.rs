use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ConversationFeedback {
    pub remark: String,
    pub used_target: Vec<String>,
    pub used_native: Vec<String>,
    pub corrections: Vec<ConversationCorrection>,
    pub grammar: u8,
    pub conversation: u8,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ConversationCorrection {
    pub said: String,
    pub corrected: String,
    pub explanation: String,
    pub kind: String,
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
