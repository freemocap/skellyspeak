use super::{
    checkpoint_format::*, compile::digest, model::fault, state_snapshot::StateSnapshot, *,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Stamp {
    pub engine: String,
    pub revision: u64,
    pub checksum: String,
}

#[derive(Clone, Copy)]
pub struct CheckpointLimits {
    pub bytes: usize,
    pub events: usize,
}

/// Validated source-containing checkpoint, never a diagnostics payload.
pub struct Checkpoint {
    pub(super) envelope: Envelope,
    bytes: Vec<u8>,
    stamp: Stamp,
}

impl Checkpoint {
    pub fn stamp(&self) -> &Stamp {
        &self.stamp
    }
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    /// Retained definitions can be inspected without registering old handlers.
    /// This is evidence access, not validation/authorization to resume execution.
    pub fn artifact_ids(&self) -> impl ExactSizeIterator<Item = &str> {
        self.envelope.payload.artifacts().keys().map(String::as_str)
    }

    pub fn inspection_definition(
        &self,
        artifact: &str,
        limits: ExportLimits,
    ) -> Result<DefinitionSnapshot> {
        self.envelope
            .payload
            .artifacts()
            .get(artifact)
            .ok_or_else(|| fault(CoreFaultCode::UnknownArtifact, "artifact"))?
            .inspection_definition(artifact, limits)
    }

    pub(super) fn capture(
        engine: &Engine,
        identity: &str,
        limits: CheckpointLimits,
    ) -> Result<Self> {
        Self::capture_base(engine, identity, None, limits)
    }

    pub fn archive_parent(&self) -> Option<&Stamp> {
        self.envelope.payload.base().map(|base| &base.archive)
    }
    pub fn base_revision(&self) -> u64 {
        self.envelope.payload.base().map_or(0, |base| base.revision)
    }
    pub fn suffix_len(&self) -> usize {
        self.envelope.payload.events().len()
    }

    pub(super) fn capture_next(&self, engine: &Engine, limits: CheckpointLimits) -> Result<Self> {
        Self::capture_base(
            engine,
            &self.stamp.engine,
            self.envelope.payload.base().cloned(),
            limits,
        )
    }

    pub(super) fn compacted(&self, engine: &Engine, limits: CheckpointLimits) -> Result<Self> {
        let base = Base {
            revision: engine.revision(),
            state: StateSnapshot::capture(engine),
            archive: self.stamp.clone(),
        };
        Self::capture_base(engine, &self.stamp.engine, Some(base), limits)
    }

    fn capture_base(
        engine: &Engine,
        identity: &str,
        base: Option<Base>,
        limits: CheckpointLimits,
    ) -> Result<Self> {
        if engine.journal_start != base.as_ref().map_or(0, |base| base.revision) {
            return Err(fault(CoreFaultCode::HistoryRequired, "checkpoint"));
        }
        if engine.journal().len() > limits.events {
            return Err(fault(CoreFaultCode::CheckpointEventLimit, "checkpoint"));
        }
        let artifacts = engine
            .graphs
            .iter()
            .map(|(id, g)| (id.clone(), g.artifact().clone()))
            .collect();
        let events = engine.journal().to_vec();
        let payload = match base {
            None => Payload::Journal(JournalPayload {
                format: 1,
                engine: identity.into(),
                artifacts,
                events,
            }),
            Some(base) => Payload::Snapshot(SnapshotPayload {
                format: 2,
                engine: identity.into(),
                artifacts,
                base,
                events,
            }),
        };
        // Bound serialization before hashing, so a large outcome cannot allocate
        // an unlimited serialized checkpoint merely to discover it exceeds limits.
        super::encoding::bounded_json(&payload, limits.bytes, CoreFaultCode::CheckpointByteLimit)?;
        let checksum = digest(&payload)?;
        let envelope = Envelope { payload, checksum };
        let bytes = super::encoding::bounded_json(
            &envelope,
            limits.bytes,
            CoreFaultCode::CheckpointByteLimit,
        )?;
        // Refuse to commit anything the versioned reader cannot load, including
        // nesting limits. Encoding success alone does not establish readability.
        Self::decode(&bytes, limits)
    }

    pub fn decode(bytes: &[u8], limits: CheckpointLimits) -> Result<Self> {
        if bytes.len() > limits.bytes {
            return Err(fault(CoreFaultCode::CheckpointByteLimit, "checkpoint"));
        }
        let envelope = super::checkpoint_format::decode(bytes)?;
        Self::validated(envelope, bytes.to_vec(), limits)
    }

    fn validated(envelope: Envelope, bytes: Vec<u8>, limits: CheckpointLimits) -> Result<Self> {
        let p = &envelope.payload;
        if !p.version_valid() {
            return Err(fault(CoreFaultCode::CheckpointVersion, "checkpoint"));
        }
        if !uuid::Uuid::parse_str(p.engine()).is_ok_and(|id| id.to_string() == p.engine()) {
            return Err(fault(CoreFaultCode::CheckpointIdentity, "checkpoint"));
        }
        if p.events().len() > limits.events {
            return Err(fault(CoreFaultCode::CheckpointEventLimit, "checkpoint"));
        }
        if digest(p)? != envelope.checksum {
            return Err(fault(CoreFaultCode::CheckpointCorrupt, "checkpoint"));
        }
        for (identity, artifact) in p.artifacts() {
            if artifact.fingerprint()? != *identity {
                return Err(fault(
                    CoreFaultCode::CheckpointArtifactMismatch,
                    "artifacts",
                ));
            }
        }
        if let Some(base) = p.base()
            && (base.archive.engine != p.engine()
                || base.archive.revision != base.revision
                || base.revision == 0)
        {
            return Err(fault(CoreFaultCode::HistoryMismatch, "checkpoint"));
        }
        let revision = p
            .base()
            .map_or(0, |base| base.revision)
            .checked_add(p.events().len() as u64)
            .ok_or_else(|| fault(CoreFaultCode::RevisionLimit, "checkpoint"))?;
        let stamp = Stamp {
            engine: p.engine().into(),
            revision,
            checksum: envelope.checksum.clone(),
        };
        Ok(Self {
            envelope,
            bytes,
            stamp,
        })
    }

    pub(super) fn replay(
        &self,
        graphs: impl IntoIterator<Item = Arc<Executable>>,
    ) -> Result<Engine> {
        let mut engine = Engine::new(graphs)?;
        self.replay_into(&mut engine)?;
        Ok(engine)
    }

    pub(super) fn replay_into(&self, engine: &mut Engine) -> Result<()> {
        if engine.graphs.len() != self.envelope.payload.artifacts().len() {
            return Err(fault(
                CoreFaultCode::CheckpointArtifactMismatch,
                "artifacts",
            ));
        }
        for (id, saved) in self.envelope.payload.artifacts() {
            if engine.graphs.get(id).is_none_or(|g| g.artifact() != saved) {
                return Err(fault(
                    CoreFaultCode::CheckpointArtifactMismatch,
                    "artifacts",
                ));
            }
        }
        if let Some(base) = self.envelope.payload.base() {
            if engine.revision() != base.revision {
                return Err(fault(CoreFaultCode::HistoryRequired, "checkpoint"));
            }
            if StateSnapshot::capture(engine) != base.state {
                return Err(fault(CoreFaultCode::SnapshotMismatch, "checkpoint"));
            }
            engine.rebase();
        } else if engine.revision() != 0 {
            return Err(fault(CoreFaultCode::HistoryMismatch, "checkpoint"));
        }
        for event in self.envelope.payload.events() {
            engine.apply(event.clone())?;
        }
        Ok(())
    }
}
