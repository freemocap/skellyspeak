//! Authored content contracts. Runtime records are built only after linking these documents.
use super::identity::{DefinitionId, LanguageId, ReviewStatus, VarietyId};
use super::types::*;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

macro_rules! document {
    ($name:ident { $($field:ident: $kind:ty),* $(,)? }) => {
        #[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
        #[serde(deny_unknown_fields)]
        pub struct $name { $(pub $field: $kind),* }
    };
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(untagged, deny_unknown_fields)]
pub enum DefinitionRef {
    Local { local: DefinitionId },
    Shared { shared: DefinitionId },
}
impl DefinitionRef {
    pub fn key(&self, language: &str) -> String {
        match self {
            Self::Local { local } => format!("{language}:{local}"),
            Self::Shared { shared } => format!("shared:{shared}"),
        }
    }
    pub fn source(&self, language: &str, collection: &str) -> String {
        match self {
            Self::Local { local } => {
                format!("languages/{language}.yaml#definitions.{collection}.{local}")
            }
            Self::Shared { shared } => {
                format!("shared/language-foundations.yaml#{collection}.{shared}")
            }
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "mode", rename_all = "snake_case", deny_unknown_fields)]
pub enum RomanizationSelection {
    Disabled,
    Scheme { scheme: DefinitionRef },
}
impl RomanizationSelection {
    pub fn key(&self, language: &str) -> Option<String> {
        match self {
            Self::Disabled => None,
            Self::Scheme { scheme } => Some(scheme.key(language)),
        }
    }
}

document!(LanguageDocument {
    schema_version: u32,
    identity: LanguageIdentity,
    integrations: Integrations,
    definitions: Definitions,
    defaults: LanguageDefaults,
    traits: Vec<String>,
    varieties: Vec<VarietyDocument>,
    guidance: Vec<Guidance>,
    learning: LearningContent,
    conversation: ConversationContent,
});
document!(LanguageIdentity {
    id: LanguageId,
    name: String,
    native_name: String,
    family: String,
    review: ReviewStatus
});
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Integrations {
    pub language_tag: Option<String>,
    /// A mapping for the current transcription adapters, not a language identity.
    pub transcription: Option<String>,
}
impl Integrations {
    pub fn tags(&self) -> BTreeMap<String, String> {
        let mut tags = BTreeMap::new();
        if let Some(tag) = &self.language_tag {
            tags.insert("language_tag".into(), tag.clone());
        }
        if let Some(tag) = &self.transcription {
            tags.insert("transcription".into(), tag.clone());
        }
        tags
    }
}
document!(Definitions {
    orthographies: BTreeMap<String, OrthographyDefinition>,
    romanization_schemes: BTreeMap<String, RomanizationDefinition>,
});
document!(OrthographyDefinition { script: String, guidance: Vec<Guidance> });
document!(RomanizationDefinition { label: String, instructions: String, examples: Vec<RomanizationExample>, sources: Vec<String>, review: ReviewStatus });
document!(RomanizationExample {
    original: String,
    romanized: String
});
document!(LanguageDefaults {
    variety: VarietyId,
    orthography: DefinitionRef,
    scalars: ScalarOverrides,
    romanization: RomanizationSelection,
    supported_romanizations: Vec<DefinitionRef>,
});
document!(VarietyDocument { id: VarietyId, name: String, description: String, review: ReviewStatus, sources: Vec<String>, overrides: VarietyOverrides, guidance: Vec<Guidance> });
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct VarietyOverrides {
    pub orthography: Option<DefinitionRef>,
    pub romanization: Option<RomanizationSelection>,
    pub supported_romanizations: Option<Vec<DefinitionRef>>,
    #[serde(default)]
    pub scalars: ScalarOverrides,
    #[serde(default)]
    pub integrations: Integrations,
}
document!(LearningContent { goals: Vec<Construct>, goal_material: BTreeMap<String, GoalMaterial> });
document!(GoalMaterial { tokens: Vec<String> });
document!(ConversationContent { default_partner: crate::model::PersonaDetails, starters: BTreeMap<String, StarterText>, starter_reasons: StarterReasons });
document!(StarterText { label: String, preview: String, translation: String, varieties: Vec<String> });
document!(StarterReasons {
    focus: String,
    due: String,
    contact: String,
    general: String
});
impl StarterReasons {
    pub fn entries(&self) -> [(&str, &str); 4] {
        [
            ("focus", &self.focus),
            ("due", &self.due),
            ("contact", &self.contact),
            ("general", &self.general),
        ]
    }
}
document!(Foundations {
    scripts: Vec<Script>, families: Vec<Family>, traits: Vec<TraitDefinition>,
    orthographies: BTreeMap<String, OrthographyDefinition>, romanization_schemes: BTreeMap<String, RomanizationDefinition>,
});
document!(TraitDefinition {
    id: String,
    review: ReviewStatus
});
document!(TeachingPolicy { guidance: Vec<Guidance>, feedback: FeedbackPolicy, estimator: EstimatorPolicy, game: GamePolicy });
document!(ConversationTopic {
    id: String, functions: Vec<String>, constructs_any: Vec<String>, bands: Vec<String>,
    contact_tags: Vec<String>, opener_kind: String, partner_brief: String, sources: Vec<String>, review: ReviewStatus,
});
