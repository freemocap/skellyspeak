//! Shared communicative functions, grouped for assessment and teaching.
use super::{Result, error, guides::GuideOrigin, identity::ReviewStatus};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

pub const SOURCE: &str = "skills";

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Catalog {
    pub schema_version: u32,
    pub revision: String,
    /// Editorial definitions, not a fallback for localized learner explanations.
    pub definition_language: String,
    pub origin: GuideOrigin,
    pub authorship: String,
    pub review: ReviewStatus,
    pub sources: Vec<String>,
    pub groups: Vec<Group>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Group {
    pub id: String,
    pub name: String,
    pub purpose: String,
    pub boundary: String,
    pub subskills: Vec<Subskill>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceContext {
    /// The current contribution can establish the function. Read available context
    /// to disambiguate it; this does not mean previous contributions are ignored.
    Contribution,
    /// A preceding contribution or shared proposal must be available to judge it.
    Exchange,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Subskill {
    pub id: String,
    pub name: String,
    pub purpose: String,
    pub positive_evidence: String,
    pub counterexample: String,
    pub context: EvidenceContext,
    pub boundary: String,
    pub neighbors: Vec<String>,
}

fn invalid(path: &str, message: &str) -> super::ConfigLoadError {
    error(format!("{SOURCE}#{path}"), "communication_catalog", message)
}

fn text(path: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() || value.contains('\0') || value.len() > 4000 {
        return Err(invalid(
            path,
            "Expected nonempty, NUL-free text up to 4000 bytes.",
        ));
    }
    Ok(())
}

fn identifier(path: &str, value: &str) -> Result<()> {
    if value.len() > 64
        || !value.as_bytes().first().is_some_and(u8::is_ascii_lowercase)
        || value.split('_').any(|part| {
            part.is_empty()
                || !part
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
        })
    {
        return Err(invalid(
            path,
            "Expected a lowercase underscore-separated identifier up to 64 bytes.",
        ));
    }
    Ok(())
}

impl Catalog {
    pub fn subskills(&self) -> impl Iterator<Item = &Subskill> {
        self.groups.iter().flat_map(|group| &group.subskills)
    }

    pub fn validate(&self, citations: &BTreeSet<String>) -> Result<()> {
        if self.schema_version != 1 || self.groups.len() != 8 {
            return Err(invalid(
                "groups",
                "Expected schema version 1 and eight communicative groups.",
            ));
        }
        text("revision", &self.revision)?;
        text("definition_language", &self.definition_language)?;
        text("authorship", &self.authorship)?;
        if self.sources.is_empty() {
            return Err(invalid("sources", "Catalog rationale requires citations."));
        }
        let mut seen_sources = BTreeSet::new();
        for source in &self.sources {
            if !citations.contains(source) || !seen_sources.insert(source) {
                return Err(invalid("sources", "Unknown or duplicate citation."));
            }
        }
        let mut all_ids = BTreeSet::new();
        let mut subskill_ids = BTreeSet::new();
        for (index, group) in self.groups.iter().enumerate() {
            let path = format!("groups.{index}");
            identifier(&format!("{path}.id"), &group.id)?;
            text(&format!("{path}.name"), &group.name)?;
            text(&format!("{path}.purpose"), &group.purpose)?;
            text(&format!("{path}.boundary"), &group.boundary)?;
            if !all_ids.insert(&group.id) || group.subskills.is_empty() {
                return Err(invalid(
                    &path,
                    "Groups require unique identities and at least one subskill.",
                ));
            }
            for (index, skill) in group.subskills.iter().enumerate() {
                let path = format!("{path}.subskills.{index}");
                identifier(&format!("{path}.id"), &skill.id)?;
                if !all_ids.insert(&skill.id) {
                    return Err(invalid(
                        &path,
                        "Group and subskill identities must be globally unique.",
                    ));
                }
                subskill_ids.insert(&skill.id);
                for (field, value) in [
                    ("name", &skill.name),
                    ("purpose", &skill.purpose),
                    ("positive_evidence", &skill.positive_evidence),
                    ("counterexample", &skill.counterexample),
                    ("boundary", &skill.boundary),
                ] {
                    text(&format!("{path}.{field}"), value)?;
                }
            }
        }
        for skill in self.subskills() {
            let mut neighbors = BTreeSet::new();
            for neighbor in &skill.neighbors {
                if neighbor == &skill.id
                    || !subskill_ids.contains(neighbor)
                    || !neighbors.insert(neighbor)
                {
                    return Err(invalid(
                        &skill.id,
                        "Neighbors must be distinct other subskills in this catalog.",
                    ));
                }
            }
            if neighbors.is_empty() {
                return Err(invalid(
                    &skill.id,
                    "Declare at least one neighboring boundary.",
                ));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "communication_tests.rs"]
mod tests;
