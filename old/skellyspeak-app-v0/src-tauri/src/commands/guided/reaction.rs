//! The conversation partner's retrospective self-report, separate from coach assessment.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{ipc::Channel, AppHandle};
use crate::{ai::{MaxTokens, Provider}, instruction::{Block, Context}, ontology, trace::RunContext};
use super::types::{emit, GuidedEvent};

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReactionKind { Confused, Understood, Curious, Surprised, Concerned }

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct PartnerReaction {
    pub kind: ReactionKind,
    pub interpretation: String,
    pub explanation: String,
}

impl PartnerReaction {
    fn validate(&self) -> Option<String> {
        if self.interpretation.trim().is_empty() || self.explanation.trim().is_empty() {
            return Some("Interpretation and explanation must not be empty".into());
        }
        None
    }
}

pub struct ReactionPass {
    pub app: AppHandle,
    pub provider: Provider,
    pub context: Context,
    pub turn_id: u64,
    pub channel: Channel<GuidedEvent>,
    pub messages: Vec<Value>,
    pub blocks: Vec<Block>,
    pub reply: String,
    pub native: String,
}


pub fn spawn(pass: ReactionPass) {
    tokio::spawn(async move {
        let ReactionPass { app: _app, provider, context, turn_id, channel, messages, blocks, reply, native } = pass;
        let (messages, blocks) = match crate::prompts::reaction::request(messages, blocks, &reply, &native) {
            Ok(request) => request,
            Err(error) => { emit(&channel, GuidedEvent::ReactionFailed { error }); return; }
        };
        let result = provider.structured_validated::<PartnerReaction, _>(
            RunContext::new(ontology::op::REACTION, Some(turn_id)).with_context(&context).with_blocks(blocks),
            &messages, 0.2, "PartnerReaction", false, Some(MaxTokens(1600)), PartnerReaction::validate,
        ).await;
        match result {
            Ok(reaction) => emit(&channel, GuidedEvent::ReactionDone { reaction }),
            Err(error) => emit(&channel, GuidedEvent::ReactionFailed { error }),
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn reaction_requires_a_supported_kind_and_explanation() {
        assert!(serde_json::from_value::<PartnerReaction>(json!({"kind":"happy","interpretation":"Yes","explanation":"Yes"})).is_err());
        let mut reaction: PartnerReaction = serde_json::from_value(json!({"kind":"confused","interpretation":"Two possible meanings","explanation":"Please clarify the reference."})).unwrap();
        assert!(reaction.validate().is_none());
        reaction.explanation.clear();
        assert!(reaction.validate().is_some());
    }
}
