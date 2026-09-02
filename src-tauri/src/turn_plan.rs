//! The turn plan — **the** declaration of what a conversational turn does.
//!
//! This table is the single source of truth for three facts that the graph
//! view asserts and the Runner must honour:
//!
//!   1. which operations a turn fires,
//!   2. what each one actually *depends on*, and
//!   3. whether it hydrates the screen on its own.
//!
//! `graph.rs` generates the turn graph from this table — it does not
//! transcribe `commands.rs` by hand. That transcription is how the first
//! version of the graph came to claim `tokenize_learner` depended on the
//! reply, when it only ever needed the learner's own message: a false edge
//! that both lied in the picture and hid ~700ms of available latency.
//!
//! # Derived / reconciled / attested
//!
//! Observability artifacts must be *derived*, not *maintained* — anything
//! maintained independently is a claim, and claims rot. Three strengths:
//!
//! - **Derived** — one artifact; execution and view read the same structure.
//!   Cannot drift by construction. *(this table → the graph's nodes, edges
//!   and hydration)*
//! - **Reconciled** — runtime observation is diffed against the declaration
//!   and disagreement is surfaced. Can still be wrong, but it says so.
//!   *(`trace::reconcile` → the graph view's fidelity banner)*
//! - **Attested** — a human wrote it; only internal consistency is checked.
//!   *(node layout, and prose)*
//!
//! The line: **structure derived, position authored.** Layout being wrong is
//! visible and harmless; a false edge is neither.

use serde::Serialize;

use crate::ontology::op;

/// What a step consumes. These are the real data dependencies — the reason
/// an edge exists at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Input {
    /// The learner's own message. Available the instant the turn starts.
    LearnerMessage,
    /// The tutor's reply text. Only available once `reply` has finished.
    Reply,
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Step {
    /// An `ontology::op::*` id.
    pub op: &'static str,
    /// Real data dependencies. An edge in the graph exists because of this
    /// and nothing else.
    pub needs: &'static [Input],
    /// Emits its own `AnalysisSection` (or stream) the moment it lands, so
    /// the learner sees it without waiting for siblings.
    pub hydrates: bool,
    /// Participates in the `analysis_done` reconciliation barrier.
    pub joins: bool,
    /// Runs detached — the turn does not wait for it.
    pub background: bool,
    /// Human-readable guard, when the step is skipped under some condition.
    pub condition: Option<&'static str>,
}

/// Everything one conversational turn fires.
///
/// **`tokenize_learner` needs only `LearnerMessage`.** It can and does start
/// before the reply exists. Anything that changes this table changes the
/// graph automatically; anything that changes `commands.rs` without changing
/// this table gets caught by reconciliation.
pub const TURN_STEPS: &[Step] = &[
    Step {
        op: op::REPLY,
        needs: &[Input::LearnerMessage],
        hydrates: true, // streamed, token by token
        joins: false,
        background: false,
        condition: None,
    },
    Step {
        op: op::TOKENIZE_LEARNER,
        // NOT the reply. Starts the instant you hit send.
        needs: &[Input::LearnerMessage],
        hydrates: true,
        joins: true,
        background: false,
        condition: Some(
            "skipped when there is no learner message - the greeting and a settings change have nothing of yours to analyse",
        ),
    },
    Step {
        op: op::TOKENIZE,
        needs: &[Input::Reply],
        hydrates: true,
        joins: true,
        background: false,
        condition: None,
    },
    Step {
        op: op::TRANSLATE,
        needs: &[Input::Reply],
        hydrates: true,
        joins: true,
        background: false,
        condition: None,
    },
    Step {
        op: op::EXPLAIN,
        needs: &[Input::Reply],
        hydrates: true,
        joins: true,
        background: false,
        condition: None,
    },
    Step {
        op: op::SUGGEST,
        needs: &[Input::Reply],
        hydrates: true,
        joins: true,
        background: false,
        condition: None,
    },
    Step {
        op: op::REVIEW,
        // The coach grades what the learner wrote; it also reads the reply
        // for context, so it waits.
        needs: &[Input::LearnerMessage, Input::Reply],
        hydrates: true,
        joins: false,
        background: false,
        condition: Some("skipped on the greeting turn — there is nothing of yours to review yet"),
    },
    Step {
        op: op::REFLECT,
        needs: &[Input::Reply],
        hydrates: true,
        joins: false,
        background: true,
        condition: Some(
            "skipped while a previous reflection is still thinking — the plan is never more than one turn stale",
        ),
    },
];

pub fn step(op_id: &str) -> Option<&'static Step> {
    TURN_STEPS.iter().find(|s| s.op == op_id)
}

/// Steps that can start immediately, before the reply exists. The Runner
/// spawns these first; the graph draws them straight off the input node.
pub fn early_steps() -> impl Iterator<Item = &'static Step> {
    TURN_STEPS
        .iter()
        .filter(|s| s.op != op::REPLY && !s.needs.contains(&Input::Reply))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ontology;

    #[test]
    fn every_step_names_a_real_operation() {
        for s in TURN_STEPS {
            assert!(
                ontology::operation(s.op).is_some(),
                "step {} is not a declared operation",
                s.op
            );
        }
    }

    #[test]
    fn every_step_hydrates() {
        // The design promise: nothing waits for a sibling. If a step ever
        // stops hydrating, the learner sits behind the slowest call.
        for s in TURN_STEPS {
            assert!(s.hydrates, "{} does not hydrate the screen on its own", s.op);
        }
    }

    #[test]
    fn learner_tokenization_does_not_wait_for_the_reply() {
        // Regression on the false edge the hand-drawn graph asserted.
        let s = step(op::TOKENIZE_LEARNER).expect("declared");
        assert!(
            !s.needs.contains(&Input::Reply),
            "tokenize_learner reads only the learner's message - making it wait \
             for the reply costs ~700ms and asserts a dependency that is not real"
        );
        assert!(early_steps().any(|s| s.op == op::TOKENIZE_LEARNER));
    }

    #[test]
    fn only_reply_dependent_steps_are_late() {
        for s in early_steps() {
            assert!(!s.needs.contains(&Input::Reply), "{} mis-classified", s.op);
        }
    }
}
