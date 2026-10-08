//! Domain-independent executable DAGs. No provider, database, UI or product imports.
//! See docs/notes/ai-graph-foundations.md and ai-graph-core-semantics.md.
mod checkpoint;
mod compile;
mod composition;
mod durable;
mod encoding;
mod fault_codes;
mod inspection;
mod model;
mod projection;
mod projection_map;
mod registry;
mod runtime;
mod scheduling;
mod transitions;

pub use checkpoint::{Checkpoint, CheckpointLimits, Stamp};
pub use compile::Executable;
pub use durable::{
    Authority, CommitFailure, CommitIntent, CommitRequest, CommitStore, DurableEngine,
};
pub use fault_codes::CoreFaultCode;
pub use model::*;
pub use projection::bindings as inspection_bindings;
pub use projection::{
    ConstantDisclosure, DefinitionSnapshot, ExportLimits, FaultDisclosure, InspectionSnapshot,
    Omission,
};
pub use registry::{Handler, Registry};
pub use runtime::{
    Attempt, AttemptState, Capacity, Disposition, Engine, Event, Inspection, Invocation, Run, Work,
};

#[cfg(test)]
mod tests;
