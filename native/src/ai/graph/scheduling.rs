use super::{compile::digest, model::fault, runtime::Execution, *};

pub(super) enum Resolved {
    Value(serde_json::Value),
    Absent,
    Waiting,
    Blocked,
}
impl Engine {
    pub(super) fn resolve(&self, run: &Run, source: &Source) -> Resolved {
        self.resolve_with(run, source, &self.states(run))
    }
    pub(super) fn resolve_with(
        &self,
        run: &Run,
        source: &Source,
        states: &std::collections::BTreeMap<String, Disposition>,
    ) -> Resolved {
        match source {
            Source::Input(name) => run
                .inputs
                .get(name)
                .cloned()
                .map_or(Resolved::Absent, Resolved::Value),
            Source::Constant { value, .. } => Resolved::Value(value.clone()),
            Source::Absent(_) => Resolved::Absent,
            Source::Output { node, port } => {
                if let Some(a) = run.attempts.get(node).and_then(|xs| xs.last()) {
                    return match &a.state {
                        AttemptState::Adopted => self.executions[&a.execution]
                            .outcome
                            .as_ref()
                            .and_then(|r| r.as_ref().ok())
                            .and_then(|xs| xs.get(port))
                            .cloned()
                            .map_or(Resolved::Absent, Resolved::Value),
                        AttemptState::Failed(_)
                        | AttemptState::Unknown
                        | AttemptState::Cancelled => Resolved::Blocked,
                        _ => Resolved::Waiting,
                    };
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
        }
    }
    pub fn disposition(&self, run: &str, node: &str) -> Result<Disposition> {
        self.node(run, node)?;
        Ok(self.states(self.run(run)?)[node].clone())
    }
    // One topological pass avoids exponential revisits through diamond graphs.
    pub(super) fn states(&self, r: &Run) -> std::collections::BTreeMap<String, Disposition> {
        let mut states = std::collections::BTreeMap::new();
        for node in &self.graphs[&r.artifact].order {
            let state = self.state_with(r, node, &states);
            states.insert(node.clone(), state);
        }
        states
    }
    fn state_with(
        &self,
        r: &Run,
        node: &str,
        states: &std::collections::BTreeMap<String, Disposition>,
    ) -> Disposition {
        let graph = &self.graphs[&r.artifact];
        let n = &graph.artifact.definition.nodes[node];
        if !r.retry_requested.contains(node)
            && let Some(a) = r.attempts.get(node).and_then(|xs| xs.last())
        {
            return match a.state {
                AttemptState::Prepared => Disposition::Prepared,
                AttemptState::Running => Disposition::Running,
                AttemptState::Available => Disposition::Available,
                AttemptState::Adopted => Disposition::Adopted,
                AttemptState::Failed(_) => Disposition::Failed,
                AttemptState::Unknown => Disposition::Unknown,
                AttemptState::Cancelled => Disposition::Cancelled,
            };
        }
        if !r.active || r.cancelled.contains(node) {
            return Disposition::Cancelled;
        }
        if r.policy[node] == Activation::Disabled {
            return Disposition::Disabled;
        }
        if r.policy[node] == Activation::OnDemand && !r.demanded.contains(node) {
            return Disposition::Unrequested;
        }
        if let Some(guard) = &n.guard {
            match self.resolve_with(r, guard, states) {
                Resolved::Value(v) if v == false => return Disposition::Skipped,
                Resolved::Value(_) => (),
                Resolved::Blocked | Resolved::Absent => return Disposition::Blocked,
                Resolved::Waiting => return Disposition::Waiting,
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
                | Disposition::Blocked => return Disposition::Blocked,
                _ => waiting = true,
            }
        }
        for (port, source) in &n.inputs {
            match self.resolve_with(r, source, states) {
                Resolved::Value(_) => (),
                Resolved::Absent if graph.operation(node).inputs[port].optional => (),
                Resolved::Absent | Resolved::Blocked => return Disposition::Blocked,
                Resolved::Waiting => waiting = true,
            }
        }
        if waiting {
            Disposition::Waiting
        } else if r.paused {
            Disposition::Paused
        } else {
            Disposition::Ready
        }
    }
    pub(super) fn start(&mut self, run: &str, node: &str, fresh: bool) -> Result<()> {
        let r = self.run(run)?;
        let graph = &self.graphs[&r.artifact];
        let n = &graph.artifact.definition.nodes[node];
        let mut inputs = Values::new();
        for (name, source) in &n.inputs {
            match self.resolve(r, source) {
                Resolved::Value(v) => {
                    inputs.insert(name.clone(), v);
                }
                Resolved::Absent if graph.operation(node).inputs[name].optional => (),
                _ => return Err(fault("inputs_unavailable", "node")),
            }
        }
        let op = graph.operation(node);
        // Include actual type definitions and implementation identity. Product
        // ownership stays outside equality; authority/configuration scope does not.
        let contracts: Vec<_> = op
            .inputs
            .values()
            .chain(op.outputs.values())
            .map(|p| (&p.contract, &graph.artifact.types[&p.contract]))
            .collect();
        let key = digest(&(op, contracts, &inputs, &r.scope))?;
        let shared = if !fresh && op.reuse == Reuse::Exact {
            self.executions
                .iter()
                .find(|(_, e)| e.key == key && !e.unknown && !matches!(e.outcome, Some(Err(_))))
                .map(|(id, e)| {
                    (
                        *id,
                        if e.outcome.is_some() {
                            AttemptState::Available
                        } else if e.dispatched {
                            AttemptState::Running
                        } else {
                            AttemptState::Prepared
                        },
                    )
                })
        } else {
            None
        };
        let artifact = r.artifact.clone();
        let operation = op.contract.clone();
        let resource = op.resource;
        self.next_id = self
            .next_id
            .checked_add(1)
            .ok_or_else(|| fault("identity_limit", "engine"))?;
        let attempt = AttemptId(self.next_id);
        let (execution, state, acquisition) = if let Some((id, state)) = shared {
            let mode = if state == AttemptState::Available {
                Acquisition::Retained
            } else {
                Acquisition::Subscribed
            };
            (id, state, mode)
        } else {
            self.next_id = self
                .next_id
                .checked_add(1)
                .ok_or_else(|| fault("identity_limit", "engine"))?;
            let execution = ExecutionId(self.next_id);
            self.executions.insert(
                execution,
                Execution {
                    key,
                    work: Work {
                        execution,
                        artifact,
                        operation,
                        inputs,
                        resource,
                    },
                    outcome: None,
                    unknown: false,
                    dispatched: false,
                },
            );
            (execution, AttemptState::Prepared, Acquisition::Produced)
        };
        self.runs
            .get_mut(run)
            .unwrap()
            .attempts
            .entry(node.into())
            .or_default()
            .push(Attempt {
                id: attempt,
                execution,
                state,
                acquisition,
            });
        self.runs.get_mut(run).unwrap().retry_requested.remove(node);
        Ok(())
    }
    pub(super) fn advance(&mut self, capacity: Capacity) -> Result<Vec<Work>> {
        self.capacity = capacity;
        self.held.clear();
        let candidates: Vec<_> = self
            .runs
            .iter()
            .flat_map(|(id, r)| {
                self.graphs[&r.artifact]
                    .artifact
                    .definition
                    .nodes
                    .keys()
                    .map(move |n| (id.clone(), n.clone()))
            })
            .collect();
        for (run, node) in candidates {
            if self.disposition(&run, &node)? != Disposition::Ready {
                continue;
            }
            let before = self.next_id;
            // Prepare speculatively: a cache hit or pending join needs no slot.
            let mut planned = self.clone();
            planned.start(&run, &node, self.runs[&run].retry_requested.contains(&node))?;
            let a = planned.runs[&run].attempts[&node].last().unwrap();
            let ex = &planned.executions[&a.execution];
            if a.execution.0 > before {
                let limit = match ex.work.resource {
                    Resource::Local => capacity.local,
                    Resource::Provider => capacity.provider,
                };
                let busy = self
                    .executions
                    .iter()
                    .filter(|(id, e)| {
                        e.outcome.is_none()
                            && !e.unknown
                            && e.work.resource == ex.work.resource
                            && (e.dispatched || self.execution_eligible(**id))
                    })
                    .count();
                if busy >= limit {
                    self.held.insert((run, node));
                    continue;
                }
            }
            *self = planned;
        }
        // A new subscriber can make a paused producer eligible again. Collect
        // after all subscriptions are applied, once per execution identity.
        Ok(self
            .executions
            .iter()
            .filter(|(id, e)| {
                !e.dispatched && e.outcome.is_none() && !e.unknown && self.execution_eligible(**id)
            })
            .map(|(_, e)| e.work.clone())
            .collect())
    }
}
