use super::{runtime::Execution, *};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

/// Format-2 native state. These are the reducer's own records, not a separately
/// maintained interpretation. Loading verifies equality with retained replay;
/// arbitrary deserialized snapshots are never installed into a live engine.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct StateSnapshot {
    runs: BTreeMap<String, Run>,
    executions: BTreeMap<ExecutionId, Execution>,
    next_id: u64,
    capacity: Capacity,
    held: BTreeSet<(String, String)>,
}
impl StateSnapshot {
    pub fn capture(engine: &Engine) -> Self {
        Self {
            runs: engine.runs.clone(),
            executions: engine.executions.clone(),
            next_id: engine.next_id,
            capacity: engine.capacity,
            held: engine.held.clone(),
        }
    }
}
