//! Tutor reply model — the conversation partner's response.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::serde::opt_none_string;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct TutorReply {
    #[schemars(description = "The mixed-language reply to the user.")]
    pub reply: String,
    #[serde(default, deserialize_with = "opt_none_string")]
    #[schemars(description = "The key target-language phrase, if the reply teaches one.")]
    pub target_phrase: Option<String>,
    #[serde(default, deserialize_with = "opt_none_string")]
    #[schemars(description = "Romanization of the target phrase, if applicable.")]
    pub romanization: Option<String>,
    #[serde(default, deserialize_with = "opt_none_string")]
    #[schemars(description = "A brief explanation in the shared language, if helpful.")]
    pub explanation: Option<String>,
}
