//! The AI vocabulary — agents, operations, faculties.
//!
//! **Standard: the OpenAI Agents SDK.** An Agent is an LLM configured with
//! `instructions`, `tools`, and optionally `handoffs`, `guardrails`,
//! `output_type` and `sessions`. The operative test is **instructions plus
//! tools it can invoke**. Something with a prompt and no tools is a model
//! call, not an agent.
//!
//! Measured against that, SkellySpeak has **two agents** — Chat and Coach — and
//! everything else is either a *tool* (a single transformation the Runner
//! invokes) or a *faculty* (perception or action: ears and voice). The
//! orchestrator in `commands.rs::guided_turn` is a **Runner**: deterministic
//! Rust that walks the graph. It is not an agent and must not be called one.
//!
//! This vocabulary is curriculum, not bookkeeping. SkellySpeak is autogogical —
//! using it teaches how it works — so calling a tokenizer an "agent" would
//! actively teach the wrong thing. The `mechanical` flag below is the proof
//! of the distinction: an operation a dictionary lookup can replace
//! (docs/future-work.md) was never an agent.

use serde::Serialize;

/// Who a unit of work belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "type", content = "id", rename_all = "snake_case")]
pub enum Actor {
    /// One of the two agents — it has instructions and a session.
    Agent(&'static str),
    /// The deterministic orchestrator. Tools and faculties run here.
    Runner,
}

/// Perception or action — the capacities an agent *has*, never an agent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Faculty {
    /// Sensing the world: speech in.
    Perception,
    /// Acting on the world: speech out.
    Action,
}

/// An agent: instructions + memory (+ tools, once it has any).
pub struct Agent {
    pub id: &'static str,
    pub label: &'static str,
    pub purpose: &'static str,
    /// What survives beyond a single call. This is the property that makes
    /// it an agent rather than a prompt.
    pub memory: &'static str,
    pub operations: &'static [&'static str],
}

/// One unit of work — one model call.
pub struct Operation {
    pub id: &'static str,
    pub label: &'static str,
    /// Plain-language description in the learner's register. This is the
    /// depth-1 ("what just happened") copy, not a code comment.
    pub purpose: &'static str,
    pub actor: Actor,
    /// Set when this operation is perception or action rather than reasoning.
    pub faculty: Option<Faculty>,
    /// True when this is deterministic text processing that a dictionary
    /// will replace (docs/future-work.md). A hash map can stand in for it —
    /// which is exactly why it was never an agent.
    pub mechanical: bool,
}

pub mod agent {
    pub const CHAT: &str = "chat";
    pub const COACH: &str = "coach";
}

/// Operation ids. Call sites use these constants, never string literals.
pub mod op {
    pub const REPLY: &str = "reply";
    pub const REVIEW: &str = "review";
    pub const ANSWER: &str = "answer";
    pub const REFLECT: &str = "reflect";
    pub const TOKENIZE: &str = "tokenize";
    pub const TRANSLATE: &str = "translate";
    pub const TOKENIZE_LEARNER: &str = "tokenize_learner";
    pub const EXPLAIN: &str = "explain";
    pub const SUGGEST: &str = "suggest";
    pub const WORD_INSIGHT: &str = "word_insight";
    pub const STORY: &str = "story";
    pub const TRANSCRIBE: &str = "transcribe";
    pub const SYNTHESIZE: &str = "synthesize";
}

pub const AGENTS: &[Agent] = &[
    Agent {
        id: agent::CHAT,
        label: "Chat",
        purpose: "Your conversation partner. Speaks only the language you are learning, and never learns the coach exists.",
        memory: "The conversation so far (last 30 turns). In memory only — it resets when the app closes.",
        operations: &[op::REPLY],
    },
    Agent {
        id: agent::COACH,
        label: "Coach",
        purpose: "Your private tutor. Reads everything, corrects you honestly, answers your questions, and quietly keeps track of how you are doing. The chat partner never sees any of it.",
        memory: "Its own thread with you (coach_thread.json), plus the teaching plan and your profile (plan.json, profile.json) — all of which survive restarts.",
        operations: &[op::REVIEW, op::ANSWER, op::REFLECT],
    },
];

pub const OPERATIONS: &[Operation] = &[
    Operation {
        id: op::REPLY,
        label: "Reply",
        purpose: "Writes the message you read, in the language you are learning.",
        actor: Actor::Agent(agent::CHAT),
        faculty: None,
        mechanical: false,
    },
    Operation {
        id: op::REVIEW,
        label: "Review",
        purpose: "Reads what you just wrote and grades it privately — corrections, scores, and an honest remark.",
        actor: Actor::Agent(agent::COACH),
        faculty: None,
        mechanical: false,
    },
    Operation {
        id: op::ANSWER,
        label: "Answer",
        purpose: "Answers a question you asked the coach directly, in your private thread.",
        actor: Actor::Agent(agent::COACH),
        faculty: None,
        mechanical: false,
    },
    Operation {
        id: op::REFLECT,
        label: "Reflect",
        purpose: "Thinks slowly in the background about how the session is going, then rewrites the teaching plan and your profile. The only operation allowed to reason at length.",
        actor: Actor::Agent(agent::COACH),
        faculty: None,
        mechanical: false,
    },
    Operation {
        id: op::TOKENIZE,
        label: "Tokenize reply",
        purpose: "Splits the tutor's reply into words and gives each one a meaning in context.",
        actor: Actor::Runner,
        faculty: None,
        mechanical: true,
    },
    Operation {
        id: op::TRANSLATE,
        label: "Translate reply",
        purpose: "Translates the tutor's reply into your own language.",
        actor: Actor::Runner,
        faculty: None,
        mechanical: true,
    },
    Operation {
        id: op::TOKENIZE_LEARNER,
        label: "Tokenize your message",
        purpose: "Does the same word-by-word work on the message YOU wrote, so you can inspect your own sentence.",
        actor: Actor::Runner,
        faculty: None,
        mechanical: true,
    },
    Operation {
        id: op::EXPLAIN,
        label: "Explain",
        purpose: "Writes one or two short grammar cards about something worth noticing.",
        actor: Actor::Runner,
        faculty: None,
        mechanical: false,
    },
    Operation {
        id: op::SUGGEST,
        label: "Suggest",
        purpose: "Prepares things you could say next: full replies, fill-in-the-blank frames, and short openers.",
        actor: Actor::Runner,
        faculty: None,
        mechanical: false,
    },
    Operation {
        id: op::WORD_INSIGHT,
        label: "Word insight",
        purpose: "Explains one word in depth: its dictionary form, its part of speech, and what it is doing in this sentence.",
        actor: Actor::Runner,
        faculty: None,
        mechanical: true,
    },
    Operation {
        id: op::STORY,
        label: "Story",
        purpose: "Writes one short story matched to the level you picked.",
        actor: Actor::Runner,
        faculty: None,
        mechanical: false,
    },
    Operation {
        id: op::TRANSCRIBE,
        label: "Hear",
        purpose: "Turns your recorded voice into text. A speech model, not a chat model — it gets no prompt.",
        actor: Actor::Runner,
        faculty: Some(Faculty::Perception),
        mechanical: false,
    },
    Operation {
        id: op::SYNTHESIZE,
        label: "Speak",
        purpose: "Reads a reply aloud. A speech model, not a chat model.",
        actor: Actor::Runner,
        faculty: Some(Faculty::Action),
        mechanical: false,
    },
];

pub fn operation(id: &str) -> Option<&'static Operation> {
    OPERATIONS.iter().find(|o| o.id == id)
}

pub fn agent_of(id: &str) -> Option<&'static Agent> {
    AGENTS.iter().find(|a| a.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL_OPS: &[&str] = &[
        op::REPLY,
        op::REVIEW,
        op::ANSWER,
        op::REFLECT,
        op::TOKENIZE,
        op::TRANSLATE,
        op::TOKENIZE_LEARNER,
        op::EXPLAIN,
        op::SUGGEST,
        op::WORD_INSIGHT,
        op::STORY,
        op::TRANSCRIBE,
        op::SYNTHESIZE,
    ];

    #[test]
    fn every_op_constant_resolves() {
        for id in ALL_OPS {
            assert!(operation(id).is_some(), "no OPERATIONS entry for {id}");
        }
        assert_eq!(OPERATIONS.len(), ALL_OPS.len());
    }

    #[test]
    fn ids_are_unique() {
        let mut ids: Vec<&str> = OPERATIONS.iter().map(|o| o.id).collect();
        ids.sort_unstable();
        let before = ids.len();
        ids.dedup();
        assert_eq!(before, ids.len(), "duplicate operation id");
    }

    #[test]
    fn agent_operation_lists_match_the_operation_table() {
        // The two directions of the relation must agree, or the graph view
        // and the trace would disagree about who owns a call.
        for a in AGENTS {
            for op_id in a.operations {
                let o = operation(op_id).expect("declared op exists");
                assert_eq!(
                    o.actor,
                    Actor::Agent(a.id),
                    "{op_id} is listed under {} but attributed elsewhere",
                    a.id
                );
            }
        }
        for o in OPERATIONS {
            if let Actor::Agent(id) = o.actor {
                let a = agent_of(id).expect("attributed agent exists");
                assert!(
                    a.operations.contains(&o.id),
                    "{} claims {} but the agent does not list it",
                    id,
                    o.id
                );
            }
        }
    }

    #[test]
    fn actor_wire_shape_matches_the_typescript_union() {
        // src/types.ts declares:
        //   { type: 'agent'; id: 'chat' | 'coach' } | { type: 'runner' }
        // A mismatch here fails silently in the UI (undefined colours,
        // blank labels), so pin it.
        assert_eq!(
            serde_json::to_string(&Actor::Agent(agent::CHAT)).unwrap(),
            r#"{"type":"agent","id":"chat"}"#
        );
        assert_eq!(
            serde_json::to_string(&Actor::Agent(agent::COACH)).unwrap(),
            r#"{"type":"agent","id":"coach"}"#
        );
        assert_eq!(
            serde_json::to_string(&Actor::Runner).unwrap(),
            r#"{"type":"runner"}"#
        );
    }

    #[test]
    fn only_two_agents_and_no_faculty_is_one() {
        // Regression on the original error: 13 "agents", including STT/TTS.
        assert_eq!(AGENTS.len(), 2);
        for o in OPERATIONS.iter().filter(|o| o.faculty.is_some()) {
            assert_eq!(
                o.actor,
                Actor::Runner,
                "{} is a faculty and must never be attributed to an agent",
                o.id
            );
        }
    }
}
