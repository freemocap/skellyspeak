use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub type Values = BTreeMap<String, serde_json::Value>;
pub type Result<T> = std::result::Result<T, Fault>;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(transparent)]
pub struct AttemptId(pub(super) u64);
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ExecutionId(pub(super) u64);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Acquisition {
    Produced,
    Subscribed,
    Retained,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Reason {
    PolicyDisabled,
    DemandRequired,
    Paused,
    Revoked,
    GuardFalse,
    GuardUnavailable,
    Admission(Resource),
    Input {
        port: String,
        producer: Option<String>,
        availability: Availability,
    },
    Control {
        parent: String,
        state: super::Disposition,
    },
    Attempt {
        id: AttemptId,
        state: super::AttemptState,
    },
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Availability {
    Waiting,
    Blocked,
    Absent,
}

/// Structured failures. Core-generated paths name structural locations. Handler
/// failures are trusted adapter data, not an automatically redacted wire format.
/// Never insert credentials or request/response content in either field.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Fault {
    pub code: String,
    pub path: String,
}
pub(super) fn fault(code: &str, path: &str) -> Fault {
    Fault {
        code: code.into(),
        path: path.into(),
    }
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Contract {
    pub name: String,
    pub version: u32,
}
impl Serialize for Contract {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&format!("{}:{}", self.version, self.name))
    }
}
impl<'de> Deserialize<'de> for Contract {
    fn deserialize<D: serde::Deserializer<'de>>(
        deserializer: D,
    ) -> std::result::Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        let (version, name) = value
            .split_once(':')
            .ok_or_else(|| serde::de::Error::custom("invalid contract"))?;
        let version = version
            .parse()
            .map_err(|_| serde::de::Error::custom("invalid contract version"))?;
        let contract = Self::new(name, version);
        super::registry::valid_contract(&contract)
            .map_err(|_| serde::de::Error::custom("invalid contract"))?;
        Ok(contract)
    }
}
impl Contract {
    pub fn new(name: &str, version: u32) -> Self {
        Self {
            name: name.into(),
            version,
        }
    }
}

/// A small closed value algebra. Semantic refinements are explicit operations;
/// type compatibility is exact contract identity, never schema guessing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Shape {
    Boolean,
    Integer,
    Text,
    List(Box<Shape>),
    Record(BTreeMap<String, Shape>),
}
impl Shape {
    pub(super) fn accepts(&self, value: &serde_json::Value) -> bool {
        match self {
            Self::Boolean => value.is_boolean(),
            Self::Integer => value.as_i64().is_some(),
            Self::Text => value.is_string(),
            Self::List(item) => value
                .as_array()
                .is_some_and(|xs| xs.iter().all(|x| item.accepts(x))),
            Self::Record(fields) => value.as_object().is_some_and(|xs| {
                xs.len() == fields.len()
                    && fields
                        .iter()
                        .all(|(k, t)| xs.get(k).is_some_and(|v| t.accepts(v)))
            }),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Port {
    pub contract: Contract,
    /// Optional means an explicitly absent value is permitted, not a missing binding.
    pub optional: bool,
}
pub type Ports = BTreeMap<String, Port>;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Resource {
    Local,
    Provider,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Reuse {
    Fresh,
    Exact,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Activation {
    Automatic,
    OnDemand,
    Disabled,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Operation {
    pub contract: Contract,
    /// Identifies the registered implementation, not a viewer-only source label.
    pub implementation: String,
    pub inputs: Ports,
    pub outputs: Ports,
    pub resource: Resource,
    pub reuse: Reuse,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum Source {
    Input(String),
    Output {
        node: String,
        port: String,
    },
    Constant {
        contract: Contract,
        value: serde_json::Value,
    },
    Absent(Contract),
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Node {
    pub operation: Contract,
    pub inputs: BTreeMap<String, Source>,
    pub after: Vec<String>,
    /// A required boolean source; false explicitly skips the node.
    pub guard: Option<Source>,
    pub activation: Activation,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Definition {
    pub contract: Contract,
    pub inputs: Ports,
    pub outputs: Ports,
    pub nodes: BTreeMap<String, Node>,
    pub results: BTreeMap<String, Source>,
    pub compositions: BTreeMap<String, Boundary>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Boundary {
    pub artifact: String,
    pub source: Box<Definition>,
    pub bindings: BTreeMap<String, Source>,
}

/// This is the executable artifact's actual structure, not an inspector catalog.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Artifact {
    pub definition: Definition,
    pub operations: BTreeMap<Contract, Operation>,
    pub types: BTreeMap<Contract, Shape>,
}
