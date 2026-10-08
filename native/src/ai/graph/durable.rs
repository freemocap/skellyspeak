use super::{model::fault, *};
use std::sync::Arc;

/// Captured authority to compare with the owner's CURRENT state in its transaction.
pub struct Authority<'a> {
    pub run: &'a str,
    pub node: Option<&'a str>,
    pub artifact: &'a str,
    pub scope: &'a str,
}

pub enum CommitIntent<'a> {
    Record,
    Begin {
        authority: Authority<'a>,
        inputs: &'a Values,
    },
    Dispatch {
        authority: Authority<'a>,
        work: &'a Work,
        attempt: AttemptId,
    },
    Adopt {
        authority: Authority<'a>,
        execution: ExecutionId,
        attempt: AttemptId,
        values: &'a Values,
    },
}

#[derive(Debug)]
pub enum CommitFailure {
    /// Adapter guarantees no checkpoint or domain effects were committed.
    Rejected(Fault),
    /// Commit may have happened. Reload storage before any more effects.
    Indeterminate(Fault),
}

pub struct CommitRequest<'a> {
    pub expected: Option<&'a Stamp>,
    pub next: &'a Checkpoint,
    pub intent: CommitIntent<'a>,
}

/// One owner transaction: compare stamp, check current authority, publish Adopt
/// values, replace checkpoint, commit. Err(Rejected) MUST roll back all effects.
/// Implementations must serialize with owner mutation/reset and workspace locking.
pub trait CommitStore {
    fn commit(&mut self, request: CommitRequest<'_>) -> std::result::Result<(), CommitFailure>;
}

/// Durable effect boundary. No mutable engine access or cloning; invocations are
/// returned only after dispatch intent has committed in the owner's transaction.
pub struct DurableEngine {
    engine: Engine,
    checkpoint: Checkpoint,
    limits: CheckpointLimits,
    poisoned: bool,
}

impl DurableEngine {
    pub fn create(
        graphs: impl IntoIterator<Item = Arc<Executable>>,
        limits: CheckpointLimits,
        store: &mut impl CommitStore,
    ) -> Result<Self> {
        let engine = Engine::new(graphs)?;
        let checkpoint = Checkpoint::capture(&engine, &uuid::Uuid::new_v4().to_string(), limits)?;
        store
            .commit(CommitRequest {
                expected: None,
                next: &checkpoint,
                intent: CommitIntent::Record,
            })
            .map_err(commit_fault)?;
        Ok(Self {
            engine,
            checkpoint,
            limits,
            poisoned: false,
        })
    }

    pub fn recover(
        checkpoint: Checkpoint,
        graphs: impl IntoIterator<Item = Arc<Executable>>,
        limits: CheckpointLimits,
        store: &mut impl CommitStore,
    ) -> Result<Self> {
        let engine = checkpoint.replay(graphs)?;
        let mut host = Self {
            engine,
            checkpoint,
            limits,
            poisoned: false,
        };
        host.apply(Event::Recover, store)?;
        Ok(host)
    }

    pub fn stamp(&self) -> &Stamp {
        self.checkpoint.stamp()
    }
    pub fn inspection_snapshot(
        &self,
        run: &str,
        limits: ExportLimits,
    ) -> Result<InspectionSnapshot> {
        self.check_live()?;
        self.engine.project(self.stamp(), run, limits)
    }
    pub fn inspect(&self, run: &str) -> Result<Inspection<'_>> {
        self.check_live()?;
        self.engine.inspect(run)
    }
    pub fn outputs(&self, run: &str) -> Result<Option<Values>> {
        self.check_live()?;
        self.engine.outputs(run)
    }
    pub fn poisoned(&self) -> bool {
        self.poisoned
    }

    fn check_live(&self) -> Result<()> {
        if self.poisoned {
            Err(fault(CoreFaultCode::ReloadRequired, "checkpoint"))
        } else {
            Ok(())
        }
    }

    fn commit(
        &mut self,
        candidate: Engine,
        intent: CommitIntent<'_>,
        store: &mut impl CommitStore,
    ) -> Result<()> {
        let next = Checkpoint::capture(&candidate, &self.stamp().engine, self.limits)?;
        match store.commit(CommitRequest {
            expected: Some(self.stamp()),
            next: &next,
            intent,
        }) {
            Ok(()) => {
                self.engine = candidate;
                self.checkpoint = next;
                Ok(())
            }
            Err(CommitFailure::Rejected(f)) => Err(f),
            Err(CommitFailure::Indeterminate(f)) => {
                self.poisoned = true;
                Err(f)
            }
        }
    }

    pub fn apply(&mut self, event: Event, store: &mut impl CommitStore) -> Result<Vec<Work>> {
        self.check_live()?;
        if matches!(event, Event::Dispatch { .. } | Event::Adopt { .. }) {
            return Err(fault(CoreFaultCode::EffectRequiresOwner, "event"));
        }
        let mut candidate = self.engine.clone();
        let work = candidate.apply(event.clone())?;
        let intent = match &event {
            Event::Begin {
                run,
                artifact,
                scope,
                inputs,
                ..
            } => CommitIntent::Begin {
                authority: Authority {
                    run,
                    node: None,
                    artifact,
                    scope,
                },
                inputs,
            },
            _ => CommitIntent::Record,
        };
        self.commit(candidate, intent, store)?;
        Ok(work)
    }

    pub fn claim(
        &mut self,
        run: &str,
        node: &str,
        attempt: AttemptId,
        store: &mut impl CommitStore,
    ) -> Result<Invocation> {
        self.check_live()?;
        let owner = self.engine.run(run)?.clone();
        let a = owner
            .attempts
            .get(node)
            .and_then(|a| a.last())
            .ok_or_else(|| fault(CoreFaultCode::UnknownAttempt, "attempt"))?;
        if !owner.active
            || owner.paused
            || owner.cancelled.contains(node)
            || a.id != attempt
            || a.state != AttemptState::Prepared
        {
            return Err(fault(CoreFaultCode::InvalidDispatch, "attempt"));
        }
        let mut candidate = self.engine.clone();
        let work = self.engine.executions[&a.execution].work.clone();
        let invocation = candidate.claim(a.execution)?;
        self.commit(
            candidate,
            CommitIntent::Dispatch {
                authority: Authority {
                    run,
                    node: Some(node),
                    artifact: &owner.artifact,
                    scope: &owner.scope,
                },
                work: &work,
                attempt,
            },
            store,
        )?;
        Ok(invocation)
    }

    pub fn adopt(
        &mut self,
        run: &str,
        node: &str,
        attempt: AttemptId,
        store: &mut impl CommitStore,
    ) -> Result<()> {
        self.check_live()?;
        let values = self.engine.available(run, node, attempt)?.clone();
        let owner = self.engine.run(run)?.clone();
        let execution = owner.attempts[node].last().unwrap().execution;
        let mut candidate = self.engine.clone();
        candidate.apply(Event::Adopt {
            run: run.into(),
            node: node.into(),
            attempt,
        })?;
        self.commit(
            candidate,
            CommitIntent::Adopt {
                authority: Authority {
                    run,
                    node: Some(node),
                    artifact: &owner.artifact,
                    scope: &owner.scope,
                },
                execution,
                attempt,
                values: &values,
            },
            store,
        )
    }
}

fn commit_fault(failure: CommitFailure) -> Fault {
    match failure {
        CommitFailure::Rejected(f) | CommitFailure::Indeterminate(f) => f,
    }
}
