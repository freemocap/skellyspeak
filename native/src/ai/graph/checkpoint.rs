use super::{compile::digest, model::fault, *};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, io::Write, sync::Arc};

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

struct BoundedWriter {
    bytes: Vec<u8>,
    limit: usize,
}
impl Write for BoundedWriter {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        if bytes.len() > self.limit.saturating_sub(self.bytes.len()) {
            return Err(std::io::Error::other("checkpoint limit"));
        }
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
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
            return Err(fault("checkpoint_event_limit", "checkpoint"));
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
        let mut writer = BoundedWriter {
            bytes: Vec::new(),
            limit: limits.bytes,
        };
        serde_json::to_writer(&mut writer, &payload)
            .map_err(|_| fault("checkpoint_byte_limit", "checkpoint"))?;
        let checksum = digest(&payload)?;
        let envelope = Envelope { payload, checksum };
        writer.bytes.clear();
        serde_json::to_writer(&mut writer, &envelope)
            .map_err(|_| fault("checkpoint_byte_limit", "checkpoint"))?;
        Self::validated(envelope, writer.bytes, limits)
    }

    pub fn decode(bytes: &[u8], limits: CheckpointLimits) -> Result<Self> {
        if bytes.len() > limits.bytes {
            return Err(fault("checkpoint_byte_limit", "checkpoint"));
        }
        let envelope =
            serde_json::from_slice(bytes).map_err(|_| fault("invalid_checkpoint", "checkpoint"))?;
        Self::validated(envelope, bytes.to_vec(), limits)
    }

    fn validated(envelope: Envelope, bytes: Vec<u8>, limits: CheckpointLimits) -> Result<Self> {
        let p = &envelope.payload;
        if p.format != FORMAT {
            return Err(fault("checkpoint_version", "checkpoint"));
        }
        if !uuid::Uuid::parse_str(&p.engine).is_ok_and(|id| id.to_string() == p.engine) {
            return Err(fault("checkpoint_identity", "checkpoint"));
        }
        if p.events.len() > limits.events {
            return Err(fault("checkpoint_event_limit", "checkpoint"));
        }
        if digest(p)? != envelope.checksum {
            return Err(fault("checkpoint_corrupt", "checkpoint"));
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
            return Err(fault("checkpoint_artifact_mismatch", "artifacts"));
        }
        for (id, saved) in &self.envelope.payload.artifacts {
            if engine.graphs.get(id).is_none_or(|g| g.artifact() != saved) {
                return Err(fault("checkpoint_artifact_mismatch", "artifacts"));
            }
        }
        for event in &self.envelope.payload.events {
            engine.apply(event.clone())?;
        }
        Ok(engine)
    }
}
