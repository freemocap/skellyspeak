use super::*;
use crate::configuration::{Result, error};
use std::collections::BTreeSet;

pub const PATH: &str = "policies/guide-authoring.yaml";

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GuidePolicy {
    pub schema_version: u32,
    pub bundled_explanation_languages: Vec<String>,
    pub source_explanation_languages: BTreeMap<String, String>,
}

impl GuidePolicy {
    pub fn validate(&self, languages: &BTreeMap<String, Language>) -> Result<()> {
        let bundled: BTreeSet<_> = self.bundled_explanation_languages.iter().collect();
        if self.schema_version != 1
            || bundled.is_empty()
            || bundled.len() != self.bundled_explanation_languages.len()
            || bundled.iter().any(|id| !languages.contains_key(*id))
            || self
                .source_explanation_languages
                .keys()
                .collect::<BTreeSet<_>>()
                != languages.keys().collect()
            || self
                .source_explanation_languages
                .values()
                .any(|id| !bundled.contains(id))
        {
            return Err(error(
                PATH,
                "guide_policy",
                "Declare unique known bundled languages and one bundled source edition for every target language.",
            ));
        }
        Ok(())
    }
}
