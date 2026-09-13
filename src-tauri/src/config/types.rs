use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ConfigLoadError {
    pub path: String,
    pub code: String,
    pub message: String,
}
impl std::fmt::Display for ConfigLoadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {} ({})", self.path, self.message, self.code)
    }
}
impl std::error::Error for ConfigLoadError {}
pub type Result<T> = std::result::Result<T, ConfigLoadError>;

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct LanguageContext {
    pub language_id: String,
    pub variety_id: String,
    pub explanation_language_id: String,
    pub hash: String,
    pub guidance: BTreeMap<String, Vec<String>>,
    pub script: String,
    pub direction: String,
    pub font_scale: f64,
    pub word_spacing: bool,
}
impl LanguageContext {
    pub fn guidance(&self, scope: &str) -> Vec<String> {
        self.guidance.get(scope).cloned().unwrap_or_default()
    }
    pub fn hash(&self) -> &str {
        &self.hash
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Construct {
    pub id: String,
    pub label: String,
    pub criterion: String,
    pub opportunity: String,
    pub band: String,
    pub lens: String,
    pub language: Option<String>,
    pub requires: Vec<String>,
    pub traits: Vec<String>,
    pub tokens: Vec<String>,
    pub nav: BTreeMap<String, String>,
    pub sources: Vec<String>,
    pub review: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Intensity {
    pub start_at: String,
    pub max_revisions: u8,
    pub show_logged: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct FeedbackPolicy {
    pub max_corrections_per_turn: usize,
    pub correct_only: String,
    pub skip_sources: Vec<String>,
    pub ladder: Vec<String>,
    pub intensity: BTreeMap<String, Intensity>,
    pub never: Vec<String>,
    pub sources: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Starter {
    pub id: String,
    pub labels: BTreeMap<String, String>,
    pub previews: BTreeMap<String, String>,
    pub translations: BTreeMap<String, String>,
    pub functions: Vec<String>,
    pub constructs_any: Vec<String>,
    pub bands: Vec<String>,
    pub languages: Vec<String>,
    pub contact_tags: Vec<String>,
    pub opener_kind: String,
    pub partner_brief: String,
    pub sources: Vec<String>,
    pub review: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectedStarter {
    pub starter: Starter,
    pub reason: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Guidance {
    pub scope: String,
    pub text: String,
    pub sources: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Script {
    pub id: String,
    pub direction: String,
    pub cursive: bool,
    pub shaping: bool,
    pub has_case: bool,
    pub word_spacing: bool,
    pub font_scale: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Orthography {
    pub id: String,
    pub script: String,
    pub guidance: Vec<Guidance>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Romanization {
    pub id: String,
    pub label: String,
    pub instructions: String,
    pub examples: Vec<(String, String)>,
    pub sources: Vec<String>,
    pub review: String,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ScalarOverrides {
    pub direction: Option<String>,
    pub font_scale: Option<f64>,
    pub word_spacing: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Trait {
    #[serde(default)]
    pub scalars: ScalarOverrides,
    pub id: String,
    pub requires: Vec<String>,
    pub guidance: Vec<Guidance>,
    pub review: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Family {
    pub id: String,
    pub label: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Variety {
    #[serde(default)]
    pub scalars: ScalarOverrides,
    pub id: String,
    pub name: String,
    pub guidance: Vec<Guidance>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Language {
    #[serde(default)]
    pub scalars: ScalarOverrides,
    pub id: String,
    pub name: String,
    pub native_name: String,
    pub script: String,
    pub orthography: String,
    pub family: String,
    pub romanization: Option<String>,
    pub traits: Vec<String>,
    pub default_variety: String,
    pub varieties: Vec<Variety>,
    pub guidance: Vec<Guidance>,
    pub review: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct NavigationNode {
    pub id: String,
    pub parent: Option<String>,
    pub label: String,
    pub code: String,
    pub kind: String,
    pub color: String,
    pub description: String,
    pub criterion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct EstimatorPolicy {
    pub version: u32,
    pub initial_rating: f64,
    pub learning_rate: f64,
    pub initial_half_life_days: f64,
    pub min_half_life_days: f64,
    pub max_half_life_days: f64,
    pub success_growth: f64,
    pub failure_shrink: f64,
    pub due_recall: f64,
    pub minimum_independent_observations: u32,
    pub support: BTreeMap<String, f64>,
    pub sources: Vec<String>,
}
