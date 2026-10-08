use super::{model::fault, *};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Arc,
};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
pub enum AttemptState<F = Fault> {
    Prepared,
    Running,
    Available,
    Adopted,
    Failed(F),
    Unknown,
    Cancelled,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct Attempt<F = Fault, I = AttemptId, E = ExecutionId> {
    pub id: I,
    pub execution: E,
    pub state: AttemptState<F>,
    pub acquisition: Acquisition,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Run {
    pub(super) artifact: String,
    pub(super) inputs: Values,
    /// Caller-supplied validated authority/configuration scope, opaque to the core.
    pub(super) scope: String,
    pub(super) policy: BTreeMap<String, Activation>,
    pub(super) demanded: BTreeSet<String>,
    pub(super) retry_requested: BTreeSet<String>,
    pub(super) cancelled: BTreeSet<String>,
    pub(super) attempts: BTreeMap<String, Vec<Attempt>>,
    pub(super) paused: bool,
    pub(super) active: bool,
}
#[derive(Clone)]
pub(super) struct Execution {
    pub work: Work,
    pub key: String,
    pub outcome: Option<Result<Values>>,
    pub unknown: bool,
    pub dispatched: bool,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Work {
    pub execution: ExecutionId,
    pub artifact: String,
    pub operation: Contract,
    pub inputs: Values,
    pub resource: Resource,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Capacity {
    pub local: usize,
    pub provider: usize,
}

/// Commands/results are explicit state-machine inputs. The journal contains
/// source data; it is a checkpoint format, NEVER a diagnostic/inspection payload.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum Event {
    Begin {
        run: String,
        artifact: String,
        inputs: Values,
        scope: String,
        policy: BTreeMap<String, Activation>,
    },
    Demand {
        run: String,
        node: String,
    },
    Pause {
        run: String,
        paused: bool,
    },
    Cancel {
        run: String,
        node: Option<String>,
    },
    Retry {
        run: String,
        node: String,
    },
    Advance(Capacity),
    Dispatch {
        execution: ExecutionId,
    },
    Settle {
        execution: ExecutionId,
        outcome: Result<Values>,
    },
    Adopt {
        run: String,
        node: String,
        attempt: AttemptId,
    },
    Recover,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
pub enum Disposition {
    Disabled,
    Unrequested,
    Skipped,
    Waiting,
    Blocked,
    Ready,
    Paused,
    Held,
    Prepared,
    Running,
    Available,
    Adopted,
    Failed,
    Unknown,
    Cancelled,
}
/// Borrows the artifact used by execution. No topology copy or operation catalog.
/// Internal inspection only: constants and adapter faults can contain source
/// data. An explicit sensitivity policy is required before diagnostic export.
#[derive(Serialize)]
pub struct Inspection<'a> {
    pub reasons: BTreeMap<String, Vec<Reason>>,
    pub artifact_id: &'a str,
    pub artifact: &'a Artifact,
    pub revision: usize,
    pub nodes: BTreeMap<String, Disposition>,
    pub activation: &'a BTreeMap<String, Activation>,
    pub attempts: &'a BTreeMap<String, Vec<Attempt>>,
}

#[derive(Clone, Default)]
pub struct Engine {
    pub(super) graphs: BTreeMap<String, Arc<Executable>>,
    pub(super) runs: BTreeMap<String, Run>,
    pub(super) executions: BTreeMap<ExecutionId, Execution>,
    pub(super) next_id: u64,
    pub(super) capacity: Capacity,
    pub(super) held: BTreeSet<(String, String)>,
    journal: Vec<Event>,
}
/// A single-use invocation claimed from the state machine. Dropping it after
/// claim leaves an uncertain execution until settlement/recovery; never replay it.
pub struct Invocation {
    graph: Arc<Executable>,
    work: Work,
}
impl Invocation {
    pub async fn execute(self) -> Result<Values> {
        self.graph.execute(&self.work).await
    }
}
impl Engine {
    pub fn claim(&mut self, execution: ExecutionId) -> Result<Invocation> {
        let work = self
            .apply(Event::Dispatch { execution })?
            .pop()
            .ok_or_else(|| fault(CoreFaultCode::MissingWork, "execution"))?;
        Ok(Invocation {
            graph: self.graphs[&work.artifact].clone(),
            work,
        })
    }
    pub(super) fn execution_eligible(&self, execution: ExecutionId) -> bool {
        self.has_consumer(execution, false)
    }
    pub(super) fn has_consumer(&self, execution: ExecutionId, allow_paused: bool) -> bool {
        self.runs.values().any(|r| {
            r.active
                && (allow_paused || !r.paused)
                && r.attempts.iter().any(|(node, attempts)| {
                    !r.cancelled.contains(node)
                        && attempts.last().is_some_and(|a| {
                            a.execution == execution
                                && matches!(a.state, AttemptState::Prepared | AttemptState::Running)
                        })
                })
        })
    }
    /// Read the exact validated value before atomically adopting it with domain
    /// publication. No raw completion is reconstructed or parsed a second time.
    pub fn available(&self, run: &str, node: &str, attempt: AttemptId) -> Result<&Values> {
        self.node(run, node)?;
        let r = self.run(run)?;
        if !r.active || r.cancelled.contains(node) {
            return Err(fault(CoreFaultCode::Revoked, "node"));
        }
        let a = r
            .attempts
            .get(node)
            .and_then(|xs| xs.last())
            .ok_or_else(|| fault(CoreFaultCode::UnknownAttempt, "attempt"))?;
        if a.id != attempt || a.state != AttemptState::Available {
            return Err(fault(CoreFaultCode::InvalidAdoption, "attempt"));
        }
        self.executions[&a.execution]
            .outcome
            .as_ref()
            .and_then(|r| r.as_ref().ok())
            .ok_or_else(|| fault(CoreFaultCode::MissingResult, "execution"))
    }
    pub fn new(graphs: impl IntoIterator<Item = Arc<Executable>>) -> Result<Self> {
        let mut engine = Self::default();
        for graph in graphs {
            if engine
                .graphs
                .insert(graph.identity.clone(), graph)
                .is_some()
            {
                return Err(fault(CoreFaultCode::DuplicateArtifact, "graphs"));
            }
        }
        Ok(engine)
    }
    /// Rejected events leave the machine unchanged, including IDs and history.
    /// This in-memory transaction must be committed with owner adoption when
    /// integrated with persistence; it is not a replacement for SQL transactions.
    pub fn apply(&mut self, event: Event) -> Result<Vec<Work>> {
        let mut next = self.clone();
        let work = next.transition(&event)?;
        next.journal.push(event);
        *self = next;
        Ok(work)
    }
    pub fn journal(&self) -> &[Event] {
        &self.journal
    }
    /// Replay validates artifact identity and all transitions without invoking
    /// handlers. Recovery makes uncertain executions explicit and pauses runs.
    pub fn restore(
        graphs: impl IntoIterator<Item = Arc<Executable>>,
        journal: &[Event],
    ) -> Result<Self> {
        let mut engine = Self::new(graphs)?;
        for event in journal {
            engine.apply(event.clone())?;
        }
        engine.apply(Event::Recover)?;
        Ok(engine)
    }
    pub fn inspect(&self, run: &str) -> Result<Inspection<'_>> {
        let r = self.run(run)?;
        let graph = &self.graphs[&r.artifact];
        let states = self.states(r);
        let mut reasons = self.reasons(r, &states);
        for (node, state) in &states {
            if *state == Disposition::Ready && self.held.contains(&(run.into(), node.clone())) {
                reasons
                    .get_mut(node)
                    .unwrap()
                    .push(Reason::Admission(graph.operation(node).resource));
            }
        }
        let nodes = graph
            .artifact
            .definition
            .nodes
            .keys()
            .map(|n| {
                let state = states[n].clone();
                (
                    n.clone(),
                    if state == Disposition::Ready && self.held.contains(&(run.into(), n.clone())) {
                        Disposition::Held
                    } else {
                        state
                    },
                )
            })
            .collect();
        Ok(Inspection {
            reasons,
            artifact_id: &graph.identity,
            artifact: &graph.artifact,
            revision: self.journal.len(),
            nodes,
            activation: &r.policy,
            attempts: &r.attempts,
        })
    }
    pub fn outputs(&self, run: &str) -> Result<Option<Values>> {
        let r = self.run(run)?;
        let graph = &self.graphs[&r.artifact];
        let mut values = Values::new();
        for (port, source) in &graph.artifact.definition.results {
            match self.resolve(r, source) {
                super::scheduling::Resolved::Value(value) => {
                    values.insert(port.clone(), value);
                }
                super::scheduling::Resolved::Absent
                    if graph.artifact.definition.outputs[port].optional => {}
                _ => return Ok(None),
            }
        }
        Ok(Some(values))
    }
    pub(super) fn run(&self, id: &str) -> Result<&Run> {
        self.runs
            .get(id)
            .ok_or_else(|| fault(CoreFaultCode::UnknownRun, "run"))
    }
    pub(super) fn node(&self, run: &str, node: &str) -> Result<&Node> {
        let r = self.run(run)?;
        self.graphs[&r.artifact]
            .artifact
            .definition
            .nodes
            .get(node)
            .ok_or_else(|| fault(CoreFaultCode::UnknownNode, "node"))
    }
}
