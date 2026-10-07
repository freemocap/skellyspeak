//! File contracts for authored skills. Assessment and translated teaching have separate owners.
pub mod guide_policy;
pub mod prompts;
mod support;
pub mod templates;
#[cfg(test)]
mod tests;
mod validation;

use super::{communication::Subskill, documents, guides::GuideOrigin, identity::ReviewStatus};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
pub use validation::{Content, Coverage};

pub fn read_files(root: &std::path::Path) -> super::Result<BTreeMap<String, String>> {
    super::content_files::read(root).map_err(|e| super::error("content", "inventory", e))
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Provenance {
    pub origin: GuideOrigin,
    pub authorship: String,
    pub sources: Vec<String>,
    /// Null is an explicit statement that generation metadata was not recorded.
    pub generation: GenerationRecord,
    pub review: Review,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Generation {
    pub model: String,
    pub source_revisions: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(untagged)]
pub enum GenerationRecord {
    Known(Generation),
    Unrecorded(()),
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Review {
    pub status: ReviewStatus,
    pub revision: String,
    pub scope: String,
}

macro_rules! document {
    ($name:ident { $($(#[$meta:meta])* $field:ident: $ty:ty),* $(,)? }) => {
        #[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
        #[serde(deny_unknown_fields)]
        pub struct $name {
            pub schema_version: u32,
            pub revision: String,
            $($(#[$meta])* pub $field: $ty,)*
            pub provenance: Provenance,
        }
    };
}

document!(Definition {
    id: String,
    name: String,
    purpose: String,
    boundary: String
});
document!(Subskills { skill_id: String, subskills: Vec<Subskill> });
document!(Explanation {
    skill_id: String, explanation_language: String, title: String,
    introduction: String, sections: Vec<Concept>,
});
document!(Assessment {
    language: String, skill_id: String, guidance: String,
    varieties: BTreeMap<String, Disposition>,
});
document!(Guide {
    language: String, skill_id: String, explanation_language: String,
    shared_explanation: String, sections: Vec<Section>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    variety_sections: BTreeMap<String, Vec<Section>>,
    varieties: BTreeMap<String, Disposition>,
});

impl Guide {
    /// Authored teaching for a declared variety; other guides keep their shared sections.
    pub fn sections_for(&self, variety: &str) -> &[Section] {
        self.variety_sections
            .get(variety)
            .map_or(&self.sections, Vec::as_slice)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Concept {
    pub subskill_id: String,
    pub title: String,
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Section {
    pub subskill_id: String,
    pub explanation: String,
    pub examples: Vec<super::communication_guides::Example>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "disposition", rename_all = "snake_case", deny_unknown_fields)]
pub enum Disposition {
    UseCore {
        provenance: Provenance,
    },
    Supplement {
        text: String,
        provenance: Provenance,
    },
}

/// Language capabilities and practice material; skill content has its own files.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Language {
    pub schema_version: u32,
    pub identity: documents::LanguageIdentity,
    pub integrations: documents::Integrations,
    pub definitions: documents::Definitions,
    pub defaults: documents::LanguageDefaults,
    pub traits: Vec<String>,
    pub varieties: Vec<documents::VarietyDocument>,
    pub guidance: Vec<super::Guidance>,
    pub conversation: documents::ConversationContent,
    pub practice: super::practice::PracticeContent,
}

pub fn schemas() -> BTreeMap<String, serde_json::Value> {
    macro_rules! schema {
        ($name:literal, $ty:ty) => {
            (
                $name.into(),
                serde_json::to_value(schemars::schema_for!($ty)).unwrap(),
            )
        };
    }
    BTreeMap::from([
        schema!("language.yaml", Language),
        schema!("guide-authoring.yaml", guide_policy::GuidePolicy),
        schema!("skill-definition.yaml", Definition),
        schema!("skill-subskills.yaml", Subskills),
        schema!("skill-explanation.yaml", Explanation),
        schema!("language-skill-assessment.yaml", Assessment),
        schema!("language-skill-guide.yaml", Guide),
        schema!("language-foundations.yaml", documents::Foundations),
        schema!(
            "conversation-topics.yaml",
            Vec<documents::ConversationTopic>
        ),
        schema!("teaching-policy.yaml", documents::TeachingPolicy),
        schema!("speech-routing.yaml", super::speech::Catalog),
        schema!("assessment-criteria.yaml", prompts::Criteria),
        schema!("skill-credit.yaml", prompts::CreditPolicy),
        schema!("prompt-options.yaml", BTreeMap<String, String>),
        schema!("prompt-list.yaml", Vec<String>),
    ])
}
