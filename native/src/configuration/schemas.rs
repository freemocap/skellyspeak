//! Schemas derive from the native authoring contracts.
use std::collections::BTreeMap;

pub fn schemas() -> BTreeMap<String, serde_json::Value> {
    super::authoring::schemas()
}
