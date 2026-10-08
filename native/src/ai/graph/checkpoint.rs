use super::{compile::digest, model::fault, *};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, sync::Arc};

const FORMAT: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Stamp {
    pub engine: String,
    pub revision: usize,
    pub checksum: String,
}

#[derive(Clone, Copy)]
pub struct CheckpointLimits {
    pub bytes: usize,
    pub events: usize,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Payload {
    format: u32,
    engine: String,
    artifacts: BTreeMap<String, Artifact>,
    events: Vec<Event>,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    payload: Payload,
    checksum: String,
}

/// Validated source-containing checkpoint, never a diagnostics payload.
pub struct Checkpoint {
    envelope: Envelope,
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

    pub(super) fn capture(
        engine: &Engine,
        identity: &str,
        limits: CheckpointLimits,
    ) -> Result<Self> {
        if engine.journal().len() > limits.events {
            return Err(fault(CoreFaultCode::CheckpointEventLimit, "checkpoint"));
        }
        let payload = Payload {
            format: FORMAT,
            engine: identity.into(),
            artifacts: engine
                .graphs
                .iter()
                .map(|(id, g)| (id.clone(), g.artifact().clone()))
                .collect(),
            events: engine.journal().to_vec(),
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
        Self::validated(envelope, bytes, limits)
    }

    pub fn decode(bytes: &[u8], limits: CheckpointLimits) -> Result<Self> {
        if bytes.len() > limits.bytes {
            return Err(fault(CoreFaultCode::CheckpointByteLimit, "checkpoint"));
        }
        let envelope = serde_json::from_slice(bytes)
            .map_err(|_| fault(CoreFaultCode::InvalidCheckpoint, "checkpoint"))?;
        Self::validated(envelope, bytes.to_vec(), limits)
    }

    fn validated(envelope: Envelope, bytes: Vec<u8>, limits: CheckpointLimits) -> Result<Self> {
        let p = &envelope.payload;
        if p.format != FORMAT {
            return Err(fault(CoreFaultCode::CheckpointVersion, "checkpoint"));
        }
        if !uuid::Uuid::parse_str(&p.engine).is_ok_and(|id| id.to_string() == p.engine) {
            return Err(fault(CoreFaultCode::CheckpointIdentity, "checkpoint"));
        }
        if p.events.len() > limits.events {
            return Err(fault(CoreFaultCode::CheckpointEventLimit, "checkpoint"));
        }
        if digest(p)? != envelope.checksum {
            return Err(fault(CoreFaultCode::CheckpointCorrupt, "checkpoint"));
        }
        let stamp = Stamp {
            engine: p.engine.clone(),
            revision: p.events.len(),
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
        if engine.graphs.len() != self.envelope.payload.artifacts.len() {
            return Err(fault(
                CoreFaultCode::CheckpointArtifactMismatch,
                "artifacts",
            ));
        }
        for (id, saved) in &self.envelope.payload.artifacts {
            if engine.graphs.get(id).is_none_or(|g| g.artifact() != saved) {
                return Err(fault(
                    CoreFaultCode::CheckpointArtifactMismatch,
                    "artifacts",
                ));
            }
        }
        for event in &self.envelope.payload.events {
            engine.apply(event.clone())?;
        }
        Ok(engine)
    }
}
