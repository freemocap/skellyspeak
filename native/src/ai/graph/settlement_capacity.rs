use super::{encoding::bounded_json, model::fault, *};

/// Owner admission bounds. Settlement bytes include the complete serialized
/// Event::Settle, not only its output values. No evidence is discarded to fit.
#[derive(Clone, Copy)]
pub struct DurableLimits {
    pub checkpoint: CheckpointLimits,
    pub settlement_event_bytes: usize,
    pub history: HistoryLimits,
}

impl DurableLimits {
    pub(super) fn validate(&self) -> Result<()> {
        if self.settlement_event_bytes == 0 {
            return Err(fault(CoreFaultCode::SettlementLimit, "policy"));
        }
        Ok(())
    }

    pub(super) fn validate_event(&self, event: &Event) -> Result<()> {
        if matches!(event, Event::Settle { .. }) {
            bounded_json(
                event,
                self.settlement_event_bytes,
                CoreFaultCode::SettlementLimit,
            )?;
        }
        Ok(())
    }

    pub(super) fn reserve(&self, engine: &Engine, checkpoint: &Checkpoint) -> Result<()> {
        let mut events = engine.journal().len();
        let mut bytes = checkpoint.bytes().len();
        let mut reserve = |size: usize| -> Result<()> {
            events = events
                .checked_add(1)
                .filter(|n| *n <= self.checkpoint.events)
                .ok_or_else(|| fault(CoreFaultCode::CheckpointEventLimit, "checkpoint"))?;
            bytes = size
                .checked_add(1)
                .and_then(|n| bytes.checked_add(n))
                .filter(|n| *n <= self.checkpoint.bytes)
                .ok_or_else(|| fault(CoreFaultCode::CheckpointByteLimit, "checkpoint"))?;
            Ok(())
        };
        for ex in engine.executions.values() {
            if ex.dispatched && ex.outcome.is_none() && !ex.unknown {
                reserve(self.settlement_event_bytes)?;
            }
        }
        for (run_id, run) in &engine.runs {
            if !run.active {
                continue;
            }
            for (node, attempts) in &run.attempts {
                if !run.cancelled.contains(node)
                    && let Some(a) = attempts.last()
                    && matches!(a.state, AttemptState::Running | AttemptState::Available)
                {
                    let event = Event::Adopt {
                        run: run_id.clone(),
                        node: node.clone(),
                        attempt: a.id,
                    };
                    reserve(
                        bounded_json(
                            &event,
                            self.checkpoint.bytes,
                            CoreFaultCode::CheckpointByteLimit,
                        )?
                        .len(),
                    )?;
                }
            }
        }
        if engine.needs_recovery() {
            reserve(
                bounded_json(
                    &Event::Recover,
                    self.checkpoint.bytes,
                    CoreFaultCode::CheckpointByteLimit,
                )?
                .len(),
            )?;
        }
        Ok(())
    }
}

impl Engine {
    /// Exactly the fields changed by Recover. An already recovered journal must
    /// remain restartable without consuming another event on every startup.
    pub(super) fn needs_recovery(&self) -> bool {
        self.executions
            .values()
            .any(|ex| ex.outcome.is_none() && !ex.unknown)
            || self.runs.values().any(|run| {
                !run.paused
                    || run.attempts.values().any(|attempts| {
                        attempts.last().is_some_and(|a| {
                            matches!(a.state, AttemptState::Prepared | AttemptState::Running)
                        })
                    })
            })
    }
}
