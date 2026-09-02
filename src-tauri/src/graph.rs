//! The execution graph, declared as data.
//!
//! Graph-engineering vocabulary: **nodes** (agent steps, tools, faculties,
//! and the barriers between them), **edges** (routing: sequential, fan-out,
//! hydrate, fan-in, conditional, background), and the **shared state** that
//! flows along them.
//!
//! # The rule
//!
//! **One declaration. The Runner executes it; the UI renders it.** A graph
//! drawn by hand in React would drift from `commands.rs` within a week — the
//! exact failure this repo has already hit twice (docs drifting from code, a
//! duplicated language table). So the picture is generated from this file,
//! and `trace` logs an ERROR if a run arrives for a node that is not declared
//! here. The declaration is allowed to be wrong; it is not allowed to lie
//! quietly.
//!
//! # Hydration is not a barrier
//!
//! Every fan-out node hydrates the UI *the moment it lands* — that is what
//! `EdgeKind::Hydrate` means, and it is why it is a distinct kind from
//! `FanIn`. The fan-in (`analysis_done`) only reconciles the authoritative
//! merged state; the learner has already seen each section as it arrived. A
//! spinner that blocks the pane until the slowest sibling returns is the
//! failure mode this design exists to prevent: a slow `explain` must never
//! hold up a fast `translate`.

use serde::Serialize;

use crate::ontology::{self, Actor};
use crate::turn_plan;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    /// Where a turn enters the graph.
    Input,
    /// A step performed by an agent (`ontology::Operation` with an agent actor).
    AgentStep,
    /// A single transformation the Runner invokes.
    Tool,
    /// Perception or action — ears and voice.
    Faculty,
    /// A join point. Reconciles; never gates the UI.
    Barrier,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeKind {
    /// Plain hand-off, one to one.
    Sequential,
    /// One node starts many, in parallel.
    FanOut,
    /// Node → the learner's screen, the instant this node finishes.
    /// The whole point of the design: no sibling waits on another.
    Hydrate,
    /// Many nodes converge. Reconciliation only — NEVER a gate.
    FanIn,
    /// Taken only when `condition` holds.
    Conditional,
    /// Detached: the turn does not wait for it.
    Background,
}

#[derive(Debug, Clone, Serialize)]
pub struct Node {
    pub id: &'static str,
    pub label: &'static str,
    pub kind: NodeKind,
    /// The `ontology::Operation` this node runs, if any. Input and Barrier
    /// nodes have none.
    pub operation: Option<&'static str>,
    pub purpose: &'static str,
    /// Declared layout. The graph is small and known, so positions live here
    /// rather than pulling in dagre/elkjs.
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct Edge {
    pub from: &'static str,
    pub to: &'static str,
    pub kind: EdgeKind,
    /// Human-readable guard for `Conditional` / `Background` edges.
    pub condition: Option<&'static str>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Graph {
    pub id: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
    /// Keys carried along the edges of this graph.
    pub shared_state: &'static [&'static str],
}

/// The pseudo-node standing for the learner's screen. Every `Hydrate` edge
/// ends here — that is how "this lands in front of you immediately" is
/// represented structurally rather than as a note.
pub const UI: &str = "ui";
pub const INPUT: &str = "input";
pub const ANALYSIS_DONE: &str = "analysis_done";

const TURN_STATE: &[&str] = &[
    "message",
    "history (≤30 turns)",
    "level → CEFR",
    "topic",
    "dialect overlay",
    "plan directives",
    "profile",
];

fn n(
    id: &'static str,
    label: &'static str,
    kind: NodeKind,
    operation: Option<&'static str>,
    purpose: &'static str,
    x: f32,
    y: f32,
) -> Node {
    Node { id, label, kind, operation, purpose, x, y }
}

fn e(from: &'static str, to: &'static str, kind: EdgeKind) -> Edge {
    Edge { from, to, kind, condition: None }
}

/// The graph one conversational turn walks — **generated** from
/// `turn_plan::TURN_STEPS`, never transcribed from `commands.rs`.
///
/// Nodes come from the steps; edges come from each step's declared `needs`.
/// Changing the plan changes this picture automatically, which is the whole
/// point: the first hand-drawn version claimed `tokenize_learner` depended
/// on the reply, and nothing could catch it.
///
/// Only the x/y positions below are authored — structure derived, position
/// authored.
pub fn turn_graph() -> Graph {
    use ontology::op;
    use turn_plan::{Input, TURN_STEPS};

    // Authored layout only — this is the one part of the picture a human
    // tunes, and the only part whose being wrong is visible and harmless.
    //
    // Two columns for the fan rather than one tall stack: the panel is a
    // wide, short dock, so a 2.5:1 graph reads at a glance where a 1:2 one
    // needs scrolling.
    fn position(op_id: &str) -> (f32, f32) {
        match op_id {
            op::REPLY => (250.0, 60.0),
            op::TOKENIZE_LEARNER => (250.0, 230.0),
            op::TOKENIZE => (470.0, 0.0),
            op::TRANSLATE => (470.0, 90.0),
            op::EXPLAIN => (470.0, 180.0),
            op::SUGGEST => (660.0, 0.0),
            op::REVIEW => (660.0, 90.0),
            op::REFLECT => (660.0, 180.0),
            _ => (660.0, 270.0),
        }
    }

    let mut nodes = vec![
        n(INPUT, "Your message", NodeKind::Input, None,
          "What you sent, plus the level and topic you steered with.", 40.0, 145.0),
        n(UI, "Your screen", NodeKind::Input, None,
          "Everything lands here the moment it is ready — nothing waits for anything else.",
          880.0, 100.0),
        n(ANALYSIS_DONE, "Reconcile", NodeKind::Barrier, None,
          "Publishes the final merged state once every section has settled. It does NOT gate the screen — you have already seen each part as it arrived.",
          880.0, 250.0),
    ];
    let mut edges = Vec::new();

    for st in TURN_STEPS {
        let o = ontology::operation(st.op).expect("step names a real operation");
        let kind = if o.faculty.is_some() {
            NodeKind::Faculty
        } else if matches!(o.actor, Actor::Agent(_)) {
            NodeKind::AgentStep
        } else {
            NodeKind::Tool
        };
        let (x, y) = position(st.op);
        nodes.push(n(st.op, o.label, kind, Some(st.op), o.purpose, x, y));

        // Edges exist because of declared dependencies, full stop.
        for need in st.needs {
            let (from, kind) = match need {
                // Anything reading only the learner's message starts at the
                // input node — it does not wait for the reply.
                Input::LearnerMessage => (INPUT, EdgeKind::Sequential),
                Input::Reply => (op::REPLY, EdgeKind::FanOut),
            };
            if from == st.op {
                continue;
            }
            let kind = if st.background {
                EdgeKind::Background
            } else if st.condition.is_some() {
                EdgeKind::Conditional
            } else {
                kind
            };
            edges.push(Edge { from, to: st.op, kind, condition: st.condition });
        }
        if st.hydrates {
            edges.push(e(st.op, UI, EdgeKind::Hydrate));
        }
        if st.joins {
            edges.push(e(st.op, ANALYSIS_DONE, EdgeKind::FanIn));
        }
    }
    edges.push(e(ANALYSIS_DONE, UI, EdgeKind::Hydrate));

    Graph {
        id: "turn",
        label: "One conversational turn",
        description: "What happens when you send a message. Your own words are analysed immediately; the reply streams to you; the rest run in parallel behind it and each appears the moment it is ready.",
        nodes,
        edges,
        shared_state: TURN_STATE,
    }
}

/// Work that happens outside a turn, each on its own trigger.
pub fn standalone_graphs() -> Vec<Graph> {
    use ontology::op;
    vec![
        small("coach_thread", "Asking the coach", "Your private side-conversation. The chat partner never sees it.", op::ANSWER, &["your question", "conversation so far", "plan", "profile", "coach thread"]),
        small("story", "Generating a story", "One level-matched story, tokenized for tap-to-translate.", op::STORY, &["level", "target language"]),
        small("word_insight", "Inspecting a word", "One word, explained in depth.", op::WORD_INSIGHT, &["word", "sentence it appeared in"]),
        small("hear", "Hearing you", "Your voice becomes text. Perception — a faculty, not an agent.", op::TRANSCRIBE, &["audio", "target-language hint"]),
        small("speak", "Speaking", "A reply becomes audio. Action — a faculty, not an agent.", op::SYNTHESIZE, &["text", "voice"]),
    ]
}

fn small(
    id: &'static str,
    label: &'static str,
    description: &'static str,
    op_id: &'static str,
    state: &'static [&'static str],
) -> Graph {
    let o = ontology::operation(op_id).expect("declared operation");
    let kind = if o.faculty.is_some() {
        NodeKind::Faculty
    } else if matches!(o.actor, Actor::Agent(_)) {
        NodeKind::AgentStep
    } else {
        NodeKind::Tool
    };
    Graph {
        id,
        label,
        description,
        nodes: vec![
            n(INPUT, "Trigger", NodeKind::Input, None, "What starts this.", 40.0, 80.0),
            n(op_id, o.label, kind, Some(op_id), o.purpose, 260.0, 80.0),
            n(UI, "Your screen", NodeKind::Input, None, "Where the result lands.", 480.0, 80.0),
        ],
        edges: vec![
            e(INPUT, op_id, EdgeKind::Sequential),
            e(op_id, UI, EdgeKind::Hydrate),
        ],
        shared_state: state,
    }
}

/// Every graph, for the UI.
pub fn all() -> Vec<Graph> {
    let mut g = vec![turn_graph()];
    g.extend(standalone_graphs());
    g
}

/// Is this operation represented by a node somewhere? `trace` uses this to
/// shout when a run has no place on the map.
pub fn declares(op_id: &str) -> bool {
    all()
        .iter()
        .any(|g| g.nodes.iter().any(|n| n.operation == Some(op_id)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_operation_has_a_node() {
        // The declaration is the map. An operation missing from it would run
        // invisibly, which is the whole thing we are building against.
        for o in ontology::OPERATIONS {
            assert!(declares(o.id), "operation {} has no node in any graph", o.id);
        }
    }

    #[test]
    fn every_edge_connects_declared_nodes() {
        for g in all() {
            for edge in &g.edges {
                assert!(
                    g.nodes.iter().any(|n| n.id == edge.from),
                    "{}: edge from undeclared node {}",
                    g.id,
                    edge.from
                );
                assert!(
                    g.nodes.iter().any(|n| n.id == edge.to),
                    "{}: edge to undeclared node {}",
                    g.id,
                    edge.to
                );
            }
        }
    }

    #[test]
    fn every_working_node_hydrates_the_screen() {
        // The design promise: nothing waits for a sibling. Every node that
        // produces something for the learner must have its own Hydrate edge,
        // so a slow `explain` can never hold up a fast `translate`.
        let g = turn_graph();
        for node in g.nodes.iter().filter(|n| {
            matches!(n.kind, NodeKind::AgentStep | NodeKind::Tool)
        }) {
            assert!(
                g.edges.iter().any(|e| {
                    e.from == node.id && e.to == UI && e.kind == EdgeKind::Hydrate
                }),
                "{} does not hydrate the UI on its own — it would be stuck behind the fan-in",
                node.id
            );
        }
    }

    #[test]
    fn the_turn_graph_is_generated_from_the_plan() {
        // Not transcribed: every step in the plan must appear, and every
        // declared dependency must appear as an edge into it.
        let g = turn_graph();
        for st in turn_plan::TURN_STEPS {
            assert!(
                g.nodes.iter().any(|n| n.id == st.op),
                "{} is in the plan but not the graph",
                st.op
            );
            let inbound = g.edges.iter().filter(|e| e.to == st.op).count();
            assert_eq!(
                inbound,
                st.needs.len(),
                "{} declares {} dependencies but has {} inbound edges",
                st.op,
                st.needs.len(),
                inbound
            );
        }
    }

    #[test]
    fn learner_tokenization_hangs_off_the_input_not_the_reply() {
        // The bug the hand-drawn graph had. If the plan regresses, so does
        // the picture — and this fails.
        let g = turn_graph();
        assert!(g.edges.iter().any(|e| {
            e.to == ontology::op::TOKENIZE_LEARNER && e.from == INPUT
        }));
        assert!(!g.edges.iter().any(|e| {
            e.to == ontology::op::TOKENIZE_LEARNER && e.from == ontology::op::REPLY
        }));
    }

    #[test]
    fn the_barrier_never_gates_the_screen() {
        // Reconciliation publishes final state; it must not be the only path
        // to the UI for anything.
        let g = turn_graph();
        let fan_in_sources: Vec<&str> = g
            .edges
            .iter()
            .filter(|e| e.to == ANALYSIS_DONE)
            .map(|e| e.from)
            .collect();
        assert!(!fan_in_sources.is_empty());
        for src in fan_in_sources {
            assert!(
                g.edges
                    .iter()
                    .any(|e| e.from == src && e.to == UI && e.kind == EdgeKind::Hydrate),
                "{src} reaches the screen only through the barrier"
            );
        }
    }
}
