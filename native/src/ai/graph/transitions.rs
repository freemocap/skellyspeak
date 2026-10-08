use super::{model::fault, registry::valid_name, *};
use std::collections::{BTreeMap, BTreeSet};

impl Engine {
    pub(super) fn transition(&mut self, event: &Event) -> Result<Vec<Work>> {
        match event {
            Event::Begin {
                run,
                artifact,
                inputs,
                scope,
                policy,
            } => {
                valid_name(run)?;
                valid_name(scope)?;
                if self.runs.contains_key(run) {
                    return Err(fault(CoreFaultCode::DuplicateRun, "run"));
                }
                let graph = self
                    .graphs
                    .get(artifact)
                    .ok_or_else(|| fault(CoreFaultCode::UnknownArtifact, "artifact"))?;
                graph.values(&graph.artifact.definition.inputs, inputs)?;
                if policy
                    .keys()
                    .any(|key| !graph.artifact.definition.nodes.contains_key(key))
                {
                    return Err(fault(CoreFaultCode::UnknownPolicyNode, "policy"));
                }
                let policy = graph
                    .artifact
                    .definition
                    .nodes
                    .iter()
                    .map(|(id, node)| {
                        (
                            id.clone(),
                            policy.get(id).copied().unwrap_or(node.activation),
                        )
                    })
                    .collect();
                self.runs.insert(
                    run.clone(),
                    Run {
                        artifact: artifact.clone(),
                        inputs: inputs.clone(),
                        scope: scope.clone(),
                        policy,
                        demanded: BTreeSet::new(),
                        retry_requested: BTreeSet::new(),
                        cancelled: BTreeSet::new(),
                        attempts: BTreeMap::new(),
                        paused: false,
                        active: true,
                    },
                );
            }
            Event::Demand { run, node } => {
                self.node(run, node)?;
                if self.run(run)?.policy[node] != Activation::OnDemand || !self.run(run)?.active {
                    return Err(fault(CoreFaultCode::InvalidDemand, "node"));
                }
                self.runs
                    .get_mut(run)
                    .unwrap()
                    .demanded
                    .insert(node.clone());
            }
            Event::Pause { run, paused } => {
                self.run(run)?;
                self.runs.get_mut(run).unwrap().paused = *paused;
            }
            Event::Cancel { run, node } => {
                self.run(run)?;
                if let Some(node) = node {
                    self.node(run, node)?;
                }
                let r = self.runs.get_mut(run).unwrap();
                if let Some(node) = node {
                    r.cancelled.insert(node.clone());
                } else {
                    r.active = false;
                }
                for (id, attempts) in &mut r.attempts {
                    if node.as_ref().is_none_or(|n| n == id)
                        && let Some(a) = attempts.last_mut()
                        && matches!(
                            a.state,
                            AttemptState::Prepared
                                | AttemptState::Running
                                | AttemptState::Available
                        )
                    {
                        a.state = AttemptState::Cancelled;
                    }
                }
                let abandoned: Vec<_> = self
                    .executions
                    .iter()
                    .filter(|(id, e)| {
                        !e.dispatched && e.outcome.is_none() && !self.has_consumer(**id, true)
                    })
                    .map(|(id, _)| *id)
                    .collect();
                for id in abandoned {
                    self.executions.get_mut(&id).unwrap().outcome = Some(Err(fault(
                        CoreFaultCode::CancelledBeforeDispatch,
                        "execution",
                    )));
                }
            }
            Event::Retry { run, node } => {
                self.node(run, node)?;
                let r = self.run(run)?;
                if !r.active || r.cancelled.contains(node) {
                    return Err(fault(CoreFaultCode::InvalidRetry, "node"));
                }
                let previous = r
                    .attempts
                    .get(node)
                    .and_then(|a| a.last())
                    .ok_or_else(|| fault(CoreFaultCode::InvalidRetry, "node"))?;
                if !matches!(
                    previous.state,
                    AttemptState::Failed(_) | AttemptState::Unknown
                ) {
                    return Err(fault(CoreFaultCode::InvalidRetry, "node"));
                }
                // Fresh retry records a new attempt; previous outcome remains immutable.
                self.runs
                    .get_mut(run)
                    .unwrap()
                    .retry_requested
                    .insert(node.clone());
            }
            Event::Advance(capacity) => return self.advance(*capacity),
            Event::Dispatch { execution } => {
                let ex = self
                    .executions
                    .get(execution)
                    .ok_or_else(|| fault(CoreFaultCode::UnknownExecution, "execution"))?;
                if ex.dispatched || ex.unknown || ex.outcome.is_some() {
                    return Err(fault(CoreFaultCode::InvalidDispatch, "execution"));
                }
                if !self.execution_eligible(*execution) {
                    return Err(fault(CoreFaultCode::RevokedOrPaused, "execution"));
                }
                let limit = match ex.work.resource {
                    Resource::Local => self.capacity.local,
                    Resource::Provider => self.capacity.provider,
                };
                let busy = self
                    .executions
                    .values()
                    .filter(|e| {
                        e.dispatched
                            && e.outcome.is_none()
                            && !e.unknown
                            && e.work.resource == ex.work.resource
                    })
                    .count();
                if busy >= limit {
                    return Err(fault(CoreFaultCode::AdmissionHeld, "execution"));
                }
                let work = ex.work.clone();
                self.executions.get_mut(execution).unwrap().dispatched = true;
                for run in self.runs.values_mut() {
                    for attempts in run.attempts.values_mut() {
                        if let Some(a) = attempts.last_mut()
                            && a.execution == *execution
                            && a.state == AttemptState::Prepared
                        {
                            a.state = AttemptState::Running;
                        }
                    }
                }
                return Ok(vec![work]);
            }
            Event::Settle { execution, outcome } => {
                let ex = self
                    .executions
                    .get(execution)
                    .ok_or_else(|| fault(CoreFaultCode::UnknownExecution, "execution"))?;
                if !ex.dispatched || ex.outcome.is_some() || ex.unknown {
                    return Err(fault(CoreFaultCode::AlreadySettled, "execution"));
                }
                let graph = &self.graphs[&ex.work.artifact];
                let op = &graph.artifact.operations[&ex.work.operation];
                // Malformed success settles as a validation failure and releases
                // capacity. It can never reach adoption or downstream consumers.
                let validated = outcome.clone().and_then(|values| {
                    graph.values(&op.outputs, &values)?;
                    Ok(values)
                });
                self.executions.get_mut(execution).unwrap().outcome = Some(validated.clone());
                for run in self.runs.values_mut() {
                    for attempts in run.attempts.values_mut() {
                        if let Some(a) = attempts.last_mut()
                            && a.execution == *execution
                            && a.state == AttemptState::Running
                        {
                            a.state = match &validated {
                                Ok(_) => AttemptState::Available,
                                Err(e) => AttemptState::Failed(e.clone()),
                            };
                        }
                    }
                }
            }
            Event::Adopt { run, node, attempt } => {
                self.available(run, node, *attempt)?;
                self.runs
                    .get_mut(run)
                    .unwrap()
                    .attempts
                    .get_mut(node)
                    .unwrap()
                    .last_mut()
                    .unwrap()
                    .state = AttemptState::Adopted;
            }
            Event::Recover => {
                for ex in self.executions.values_mut() {
                    if ex.outcome.is_none() {
                        if ex.dispatched {
                            ex.unknown = true;
                        } else {
                            ex.outcome = Some(Err(fault(
                                CoreFaultCode::InterruptedBeforeDispatch,
                                "execution",
                            )));
                        }
                    }
                }
                for run in self.runs.values_mut() {
                    run.paused = true;
                    for attempts in run.attempts.values_mut() {
                        if let Some(a) = attempts.last_mut() {
                            if a.state == AttemptState::Running {
                                a.state = AttemptState::Unknown;
                            } else if a.state == AttemptState::Prepared {
                                a.state = AttemptState::Failed(fault(
                                    CoreFaultCode::InterruptedBeforeDispatch,
                                    "execution",
                                ));
                            }
                        }
                    }
                }
            }
        }
        Ok(Vec::new())
    }
}
