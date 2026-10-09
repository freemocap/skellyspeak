use super::{
    model::fault,
    record_store::Envelope,
    state::{AttemptRecord, Execution, RuntimeState},
    *,
};
use serde::de::DeserializeOwned;
use std::sync::Arc;

/// Typed native reads. Ownership is scoped to the caller; no hidden cache,
/// missing-record fallback or alternative operation semantics live here.
pub(super) trait RecordAccess {
    fn run(&mut self, id: &str) -> Result<Arc<Run>>;
    fn attempt(&mut self, id: AttemptId) -> Result<Arc<AttemptRecord>>;
    fn execution(&mut self, id: ExecutionId) -> Result<Arc<Execution>>;
}

impl RecordAccess for &RuntimeState {
    fn run(&mut self, id: &str) -> Result<Arc<Run>> {
        self.runs.get_shared(id).ok_or_else(|| {
            fault(
                if self.runs.contains_key(id) {
                    CoreFaultCode::RecordNotResident
                } else {
                    CoreFaultCode::UnknownRun
                },
                "run",
            )
        })
    }
    fn attempt(&mut self, id: AttemptId) -> Result<Arc<AttemptRecord>> {
        self.attempts.get_shared(&id).ok_or_else(|| {
            fault(
                if self.attempts.contains_key(&id) {
                    CoreFaultCode::RecordNotResident
                } else {
                    CoreFaultCode::UnknownAttempt
                },
                "attempt",
            )
        })
    }
    fn execution(&mut self, id: ExecutionId) -> Result<Arc<Execution>> {
        self.executions.get_shared(&id).ok_or_else(|| {
            fault(
                if self.executions.contains_key(&id) {
                    CoreFaultCode::RecordNotResident
                } else {
                    CoreFaultCode::UnknownExecution
                },
                "execution",
            )
        })
    }
}

/// Capacity reservation and the second, native effect transition may reuse
/// trusted resident rows. Cold rows require verified reads; a failed read is
/// propagated. This is never used to bypass the initial stored effect decision.
pub(super) struct LoadedAccess<'a, R> {
    pub state: &'a RuntimeState,
    pub records: &'a mut R,
}

impl<R: RecordAccess> RecordAccess for LoadedAccess<'_, R> {
    fn run(&mut self, id: &str) -> Result<Arc<Run>> {
        match self.state.runs.get_shared(id) {
            Some(row) => Ok(row),
            None => self.records.run(id),
        }
    }
    fn attempt(&mut self, id: AttemptId) -> Result<Arc<AttemptRecord>> {
        match self.state.attempts.get_shared(&id) {
            Some(row) => Ok(row),
            None => self.records.attempt(id),
        }
    }
    fn execution(&mut self, id: ExecutionId) -> Result<Arc<Execution>> {
        match self.state.executions.get_shared(&id) {
            Some(row) => Ok(row),
            None => self.records.execution(id),
        }
    }
}

/// Stored reads need only committed integrity evidence, not resident payloads.
/// The decoded record remains the native type used by the reducer.
pub(super) struct StoredAccess<'a, S> {
    pub evidence: &'a super::record_evidence::RecordEvidence,
    pub max_bytes: usize,
    pub store: &'a mut S,
}

impl<S: RecordStore> StoredAccess<'_, S> {
    fn read<T: DeserializeOwned>(&mut self, key: RecordKey) -> Result<Arc<T>> {
        self.evidence.require(&key)?;
        let bytes = self
            .store
            .read_record(self.evidence.stamp(), &key, self.max_bytes)?;
        if bytes.len() > self.max_bytes {
            return Err(fault(CoreFaultCode::RecordByteLimit, "record"));
        }
        self.evidence.check(&key, &bytes)?;
        let row: Envelope<RecordKey, T> = serde_json::from_slice(&bytes)
            .map_err(|_| fault(CoreFaultCode::RecordMismatch, "record"))?;
        if !(row.format == 1
            || (matches!(row.format, 2 | 3) && matches!(&key, RecordKey::Execution(_))))
            || row.key != key
        {
            return Err(fault(CoreFaultCode::RecordMismatch, "record"));
        }
        Ok(Arc::new(row.value))
    }
}

impl<S: RecordStore> RecordAccess for StoredAccess<'_, S> {
    fn run(&mut self, id: &str) -> Result<Arc<Run>> {
        self.read(RecordKey::Run(id.into()))
    }
    fn attempt(&mut self, id: AttemptId) -> Result<Arc<AttemptRecord>> {
        self.read(RecordKey::Attempt(id))
    }
    fn execution(&mut self, id: ExecutionId) -> Result<Arc<Execution>> {
        self.read(RecordKey::Execution(id))
    }
}
