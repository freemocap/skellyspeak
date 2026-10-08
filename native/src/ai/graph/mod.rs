//! Domain-independent executable DAGs. No provider, database, UI or product imports.
//! See docs/notes/ai-graph-foundations.md and ai-graph-core-semantics.md.
mod checkpoint;
mod compile;
mod composition;
mod durable;
mod inspection;
mod model;
mod registry;
mod runtime;
mod scheduling;
mod transitions;

pub use checkpoint::{Checkpoint, CheckpointLimits, Stamp};
pub use compile::Executable;
pub use durable::{
    Authority, CommitFailure, CommitIntent, CommitRequest, CommitStore, DurableEngine,
};
pub use model::*;
pub use registry::{Handler, Registry};
pub use runtime::{
    Attempt, AttemptState, Capacity, Disposition, Engine, Event, Inspection, Invocation, Run, Work,
};

#[cfg(test)]
mod tests;
