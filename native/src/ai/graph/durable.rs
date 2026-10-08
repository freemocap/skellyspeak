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
    /// Retain these exact source bytes immutably in the SAME transaction that
    /// installs next. The old stamp must match both expected and next's parent.
    Compact {
        archive: &'a Checkpoint,
    },
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
    /// Check the stored length against max_bytes BEFORE allocating/reading its
    /// body. A missing, changed, oversized or unreadable archive is an error.
    fn read_archive(&mut self, expected: &Stamp, max_bytes: usize) -> Result<Vec<u8>>;
}

/// Durable effect boundary. No mutable engine access or cloning; invocations are
/// returned only after dispatch intent has committed in the owner's transaction.
pub struct DurableEngine {
    engine: Engine,
    checkpoint: Checkpoint,
    limits: DurableLimits,
    poisoned: bool,
    history_usage: super::archive::HistoryUsage,
}

impl DurableEngine {
    pub fn create(
        graphs: impl IntoIterator<Item = Arc<Executable>>,
        limits: DurableLimits,
        store: &mut impl CommitStore,
    ) -> Result<Self> {
        limits.validate()?;
        let engine = Engine::new(graphs)?;
        let checkpoint = Checkpoint::capture(
            &engine,
            &uuid::Uuid::new_v4().to_string(),
            limits.checkpoint,
        )?;
        limits.reserve(&engine, &checkpoint)?;
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
            history_usage: super::archive::HistoryUsage::default(),
        })
    }

    pub fn recover(
        checkpoint: Checkpoint,
        graphs: impl IntoIterator<Item = Arc<Executable>>,
        limits: DurableLimits,
        store: &mut impl CommitStore,
    ) -> Result<Self> {
        limits.validate()?;
        let (engine, history_usage) = checkpoint.replay_history(graphs, limits.history, store)?;
        let mut host = Self {
            engine,
            checkpoint,
            limits,
            poisoned: false,
            history_usage,
        };
        if host.engine.needs_recovery() {
            host.apply(Event::Recover, store)?;
        } else {
            // Recheck caller limits even when recovery is already a fixed point.
            let checked = Checkpoint::decode(host.checkpoint.bytes(), limits.checkpoint)?;
            limits.reserve(&host.engine, &checked)?;
        }
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
        let next = self
            .checkpoint
            .capture_next(&candidate, self.limits.checkpoint)?;
        self.limits.reserve(&candidate, &next)?;
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

    /// Preserve the complete current checkpoint as an immutable archive before
    /// replacing its journal with an identical native state at the same revision.
    /// Returns false for an empty suffix; repeated compaction is a true no-op.
    pub fn compact(&mut self, store: &mut impl CommitStore) -> Result<bool> {
        self.check_live()?;
        if self.engine.journal().is_empty() {
            return Ok(false);
        }
        let usage = self
            .history_usage
            .add(&self.checkpoint, self.limits.history)?;
        let mut candidate = self.engine.clone();
        candidate.rebase();
        let next = self
            .checkpoint
            .compacted(&candidate, self.limits.checkpoint)?;
        self.limits.reserve(&candidate, &next)?;
        match store.commit(CommitRequest {
            expected: Some(self.stamp()),
            next: &next,
            intent: CommitIntent::Compact {
                archive: &self.checkpoint,
            },
        }) {
            Ok(()) => {
                self.engine = candidate;
                self.checkpoint = next;
                self.history_usage = usage;
                Ok(true)
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
        self.limits.validate_event(&event)?;
        if matches!(event, Event::Recover) && !self.engine.needs_recovery() {
            return Ok(Vec::new());
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
