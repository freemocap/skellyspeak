use super::{model::fault, record_access::RecordAccess, *};
use std::collections::BTreeMap;

#[derive(Debug, PartialEq)]
pub(super) enum Resolved {
    Value(serde_json::Value),
    Absent,
    Waiting,
    Blocked,
}

impl Engine {
    pub(super) fn resolve_using(
        &self,
        records: &mut impl RecordAccess,
        run: &Run,
        source: &Source,
        states: &BTreeMap<String, Disposition>,
    ) -> Result<Resolved> {
        Ok(match source {
            Source::Input(name) => run
                .inputs
                .get(name)
                .cloned()
                .map_or(Resolved::Absent, Resolved::Value),
            Source::Constant { value, .. } => Resolved::Value(value.clone()),
            Source::Absent(_) => Resolved::Absent,
            Source::Output { node, port } => {
                if let Some(id) = run.current.get(node) {
                    let row = records.attempt(*id)?;
                    if row.attempt.id != *id || row.node != *node {
                        return Err(fault(CoreFaultCode::RecordMismatch, "attempt"));
                    }
                    return Ok(match &row.attempt.state {
                        AttemptState::Adopted => {
                            let producer = records.execution(row.attempt.execution)?;
                            if producer.work.execution != row.attempt.execution {
                                return Err(fault(CoreFaultCode::RecordMismatch, "execution"));
                            }
                            let values = producer
                                .outcome
                                .as_ref()
                                .and_then(|r| r.as_ref().ok())
                                .ok_or_else(|| fault(CoreFaultCode::MissingResult, "execution"))?;
                            values
                                .get(port)
                                .cloned()
                                .map_or(Resolved::Absent, Resolved::Value)
                        }
                        AttemptState::Failed(_)
                        | AttemptState::Unknown
                        | AttemptState::Cancelled => Resolved::Blocked,
                        _ => Resolved::Waiting,
                    });
                }
                match states[node] {
                    Disposition::Disabled | Disposition::Skipped => Resolved::Absent,
                    Disposition::Blocked
                    | Disposition::Cancelled
                    | Disposition::Failed
                    | Disposition::Unknown => Resolved::Blocked,
                    _ => Resolved::Waiting,
                }
            }
        })
    }

    pub fn disposition(&self, run: &str, node: &str) -> Result<Disposition> {
        self.node(run, node)?;
        Ok(self.states(self.run(run)?)?[node].clone())
    }

    pub(super) fn states(&self, run: &Run) -> Result<BTreeMap<String, Disposition>> {
        self.states_using(&mut &self.state, run)
    }

    // One topological pass avoids exponential revisits through diamond graphs.
    pub(super) fn states_using(
        &self,
        records: &mut impl RecordAccess,
        run: &Run,
    ) -> Result<BTreeMap<String, Disposition>> {
        let mut states = BTreeMap::new();
        for node in &self.graphs[&run.artifact].order {
            let state = self.state_using(records, run, node, &states)?;
            states.insert(node.clone(), state);
        }
        Ok(states)
    }

    fn state_using(
        &self,
        records: &mut impl RecordAccess,
        run: &Run,
        node: &str,
        states: &BTreeMap<String, Disposition>,
    ) -> Result<Disposition> {
        let graph = &self.graphs[&run.artifact];
        let n = &graph.artifact.definition.nodes[node];
        if !run.retry_requested.contains(node)
            && let Some(id) = run.current.get(node)
        {
            let row = records.attempt(*id)?;
            if row.attempt.id != *id || row.node != node {
                return Err(fault(CoreFaultCode::RecordMismatch, "attempt"));
            }
            return Ok(match row.attempt.state {
                AttemptState::Prepared => Disposition::Prepared,
                AttemptState::Running => Disposition::Running,
                AttemptState::Available => Disposition::Available,
                AttemptState::Adopted => Disposition::Adopted,
                AttemptState::Failed(_) => Disposition::Failed,
                AttemptState::Unknown => Disposition::Unknown,
                AttemptState::Cancelled => Disposition::Cancelled,
            });
        }
        if !run.active || run.cancelled.contains(node) {
            return Ok(Disposition::Cancelled);
        }
        if run.policy[node] == Activation::Disabled {
            return Ok(Disposition::Disabled);
        }
        if run.policy[node] == Activation::OnDemand && !run.demanded.contains(node) {
            return Ok(Disposition::Unrequested);
        }
        if let Some(guard) = &n.guard {
            match self.resolve_using(records, run, guard, states)? {
                Resolved::Value(v) if v == false => return Ok(Disposition::Skipped),
                Resolved::Value(_) => (),
                Resolved::Blocked | Resolved::Absent => return Ok(Disposition::Blocked),
                Resolved::Waiting => return Ok(Disposition::Waiting),
            }
        }
        let mut waiting = false;
        for parent in &n.after {
            match states[parent] {
                Disposition::Adopted => (),
                Disposition::Failed
                | Disposition::Unknown
                | Disposition::Cancelled
                | Disposition::Skipped
                | Disposition::Disabled
                | Disposition::Blocked => return Ok(Disposition::Blocked),
                _ => waiting = true,
            }
        }
        for (port, source) in &n.inputs {
            match self.resolve_using(records, run, source, states)? {
                Resolved::Value(_) => (),
                Resolved::Absent if graph.operation(node).inputs[port].optional => (),
                Resolved::Absent | Resolved::Blocked => return Ok(Disposition::Blocked),
                Resolved::Waiting => waiting = true,
            }
        }
        Ok(if waiting {
            Disposition::Waiting
        } else if run.paused {
            Disposition::Paused
        } else {
            Disposition::Ready
        })
    }
}
