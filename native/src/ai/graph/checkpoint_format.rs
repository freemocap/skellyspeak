use super::{state_snapshot::StateSnapshot, *};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

// Preserve format-1 field order and encoding for its existing integrity digest.
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct JournalPayload {
    pub format: u32,
    pub engine: String,
    pub artifacts: BTreeMap<String, Artifact>,
    pub events: Vec<Event>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Base {
    pub revision: u64,
    pub state: StateSnapshot,
    pub archive: Stamp,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct SnapshotPayload {
    pub format: u32,
    pub engine: String,
    pub artifacts: BTreeMap<String, Artifact>,
    pub base: Base,
    pub events: Vec<Event>,
}

#[derive(Serialize)]
#[serde(untagged)]
pub(super) enum Payload {
    Snapshot(SnapshotPayload),
    Journal(JournalPayload),
}
impl Payload {
    pub fn version_valid(&self) -> bool {
        match self {
            Self::Journal(p) => p.format == 1,
            Self::Snapshot(p) => p.format == 2,
        }
    }
    pub fn engine(&self) -> &str {
        match self {
            Self::Journal(p) => &p.engine,
            Self::Snapshot(p) => &p.engine,
        }
    }
    pub fn artifacts(&self) -> &BTreeMap<String, Artifact> {
        match self {
            Self::Journal(p) => &p.artifacts,
            Self::Snapshot(p) => &p.artifacts,
        }
    }
    pub fn events(&self) -> &[Event] {
        match self {
            Self::Journal(p) => &p.events,
            Self::Snapshot(p) => &p.events,
        }
    }
    pub fn base(&self) -> Option<&Base> {
        match self {
            Self::Journal(_) => None,
            Self::Snapshot(p) => Some(&p.base),
        }
    }
}

#[derive(Serialize)]
pub(super) struct Envelope {
    pub payload: Payload,
    pub checksum: String,
}

/// Select a concrete decoder explicitly. The discriminator reads only version;
/// the selected full decoder rejects every unknown field. In particular, avoid
/// serde's untagged buffering of numeric execution IDs used as JSON map keys.
pub(super) fn decode(bytes: &[u8]) -> Result<Envelope> {
    #[derive(Deserialize)]
    struct Version {
        format: u32,
    }
    #[derive(Deserialize)]
    struct Header {
        payload: Version,
    }
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Wire<T> {
        payload: T,
        checksum: String,
    }
    let invalid = |_| super::model::fault(CoreFaultCode::InvalidCheckpoint, "checkpoint");
    let header: Header = serde_json::from_slice(bytes).map_err(invalid)?;
    match header.payload.format {
        1 => {
            let wire: Wire<JournalPayload> = serde_json::from_slice(bytes).map_err(invalid)?;
            Ok(Envelope {
                payload: Payload::Journal(wire.payload),
                checksum: wire.checksum,
            })
        }
        2 => {
            let wire: Wire<SnapshotPayload> = serde_json::from_slice(bytes).map_err(invalid)?;
            Ok(Envelope {
                payload: Payload::Snapshot(wire.payload),
                checksum: wire.checksum,
            })
        }
        _ => Err(super::model::fault(
            CoreFaultCode::CheckpointVersion,
            "checkpoint",
        )),
    }
}
