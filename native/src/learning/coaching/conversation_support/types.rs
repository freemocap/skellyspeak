use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConversationFeedback {
    pub remark: String,
    pub used_target: Vec<String>,
    pub used_native: Vec<String>,
    pub corrections: Vec<ConversationCorrection>,
    pub grammar: u8,
    pub conversation: u8,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct ConversationCorrection {
    pub said: String,
    pub corrected: String,
    pub explanation: String,
    pub kind: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct AssistedReply {
    pub text: String,
    pub translation: String,
    pub romanization: String,
    pub pronunciation: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct ReplyAssistance {
    pub explanation: String,
    pub replies: Vec<AssistedReply>,
    pub frames: Vec<String>,
    pub starters: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct ReplyExplanation {
    pub quote: String,
    pub title: String,
    pub body: String,
    pub example: String,
    pub contrast: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct ReplyExplanations {
    pub cards: Vec<ReplyExplanation>,
}
