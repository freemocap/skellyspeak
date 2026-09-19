//! Read-only projection of the same validated registry used by conversation execution.
use super::*;
use documents::*;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContentSource {
    pub path: String,
    pub yaml: String,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContentRule {
    pub scope: String,
    pub text: String,
    pub source: String,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContentValue {
    pub field: String,
    pub value: String,
    pub source: String,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SchemeInspection {
    pub id: String,
    pub label: String,
    pub instructions: String,
    pub examples: Vec<(String, String)>,
    pub sources: Vec<String>,
    pub review: String,
    pub source: String,
    pub selected: bool,
    pub used_by: Vec<String>,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LanguageInspection {
    pub fingerprint: String,
    pub language: model::Language,
    pub variety_id: String,
    pub review: String,
    pub family: String,
    pub values: Vec<ContentValue>,
    pub rules: Vec<ContentRule>,
    pub schemes: Vec<SchemeInspection>,
    pub sources: Vec<ContentSource>,
    pub partner: model::PersonaDetails,
    pub schema_json: String,
    pub resolved_json: String,
    pub learning_json: String,
    pub conversation_json: String,
}
impl Registry {
    pub fn inspect_language(
        &self,
        language: &str,
        variety: Option<&str>,
        explanation: &str,
        explanation_variety: Option<&str>,
    ) -> Result<LanguageInspection> {
        let context = self.resolve_pair(language, variety, explanation, explanation_variety)?;
        let doc = self
            .documents
            .get(language)
            .ok_or_else(|| error(language, "unknown_language", language))?;
        let v = doc
            .varieties
            .iter()
            .find(|v| v.id == context.variety_id)
            .expect("resolved variety");
        let path = format!("languages/{language}.yaml");
        let orth = v
            .overrides
            .orthography
            .as_ref()
            .unwrap_or(&doc.defaults.orthography);
        let selected = v
            .overrides
            .romanization
            .as_ref()
            .unwrap_or(&doc.defaults.romanization)
            .key(language);
        let supported = v
            .overrides
            .supported_romanizations
            .as_ref()
            .unwrap_or(&doc.defaults.supported_romanizations);
        let schemes = supported
            .iter()
            .map(|reference| {
                let id = reference.key(language);
                let scheme = self
                    .romanizations
                    .iter()
                    .find(|s| s.id == id)
                    .expect("validated scheme");
                let mut used_by = vec![];
                for (lid, l) in &self.documents {
                    for variety in &l.varieties {
                        if variety
                            .overrides
                            .supported_romanizations
                            .as_ref()
                            .unwrap_or(&l.defaults.supported_romanizations)
                            .iter()
                            .any(|r| r.key(lid) == id)
                        {
                            used_by.push(format!("{} — {}", l.identity.name, variety.name));
                        }
                    }
                }
                SchemeInspection {
                    id: id.clone(),
                    label: scheme.label.clone(),
                    instructions: scheme.instructions.clone(),
                    examples: scheme.examples.clone(),
                    sources: scheme.sources.clone(),
                    review: scheme.review.clone(),
                    source: reference.source(language, "romanization_schemes"),
                    selected: selected.as_ref() == Some(&id),
                    used_by,
                }
            })
            .collect();
        let scalar_source = |field: &str, overridden: bool, defaulted: bool| {
            if overridden {
                format!("{path}#varieties.{}.overrides.scalars.{field}", v.id)
            } else if defaulted {
                format!("{path}#defaults.scalars.{field}")
            } else {
                format!(
                    "shared/language-foundations.yaml#scripts.{}.{field}",
                    context.script
                )
            }
        };
        let values = vec![
            ContentValue {
                field: "script".into(),
                value: context.script.clone(),
                source: orth.source(language, "orthographies"),
            },
            ContentValue {
                field: "direction".into(),
                value: context.direction.clone(),
                source: scalar_source(
                    "direction",
                    v.overrides.scalars.direction.is_some(),
                    doc.defaults.scalars.direction.is_some(),
                ),
            },
            ContentValue {
                field: "font_scale".into(),
                value: context.font_scale.to_string(),
                source: scalar_source(
                    "font_scale",
                    v.overrides.scalars.font_scale.is_some(),
                    doc.defaults.scalars.font_scale.is_some(),
                ),
            },
            ContentValue {
                field: "word_spacing".into(),
                value: context.word_spacing.to_string(),
                source: scalar_source(
                    "word_spacing",
                    v.overrides.scalars.word_spacing.is_some(),
                    doc.defaults.scalars.word_spacing.is_some(),
                ),
            },
            ContentValue {
                field: "romanization".into(),
                value: selected.unwrap_or_else(|| "disabled".into()),
                source: if v.overrides.romanization.is_some() {
                    format!("{path}#varieties.{}.overrides.romanization", v.id)
                } else {
                    format!("{path}#defaults.romanization")
                },
            },
        ];
        // The language document shows authored language-specific guidance, not the
        // assembled prompt (which repeats shared policy and scheme instructions).
        // The complete effective context remains available in resolved_json.
        let mut rules = vec![];
        let mut append_guidance = |guidance: &[Guidance], source: String| {
            for (index, rule) in guidance.iter().enumerate() {
                rules.push(ContentRule {
                    scope: rule.scope.to_string(),
                    text: rule.text.clone(),
                    source: format!(
                        "{source}{}guidance.{index}",
                        if source.contains('#') { "." } else { "#" }
                    ),
                });
            }
        };
        if let DefinitionRef::Local { local } = orth {
            append_guidance(
                &doc.definitions.orthographies[&local.0].guidance,
                orth.source(language, "orthographies"),
            );
        }
        append_guidance(&doc.guidance, path.clone());
        append_guidance(&v.guidance, format!("{path}#varieties.{}", v.id));
        let sources = self
            .source_files
            .iter()
            .filter(|(name, _)| {
                *name == &path
                    || *name == &format!("languages/{explanation}.yaml")
                    || name.starts_with("shared/")
                    || name.as_str() == "references.bib"
            })
            .map(|(path, yaml)| ContentSource {
                path: path.clone(),
                yaml: yaml.clone(),
            })
            .collect();
        let mut language_projection = self
            .language(language)
            .map_err(|e| error(&path, "language", e))?;
        language_projection.direction = context.direction.clone();
        language_projection.language_tag = context.external_tags.get("language_tag").cloned();
        language_projection.romanization = v
            .overrides
            .romanization
            .as_ref()
            .unwrap_or(&doc.defaults.romanization)
            .key(language);
        language_projection.font_scale = context.font_scale;
        Ok(LanguageInspection {
            fingerprint: self.hash.clone(),
            language: language_projection,
            variety_id: context.variety_id.clone(),
            review: doc.identity.review.to_string(),
            family: doc.identity.family.clone(),
            values,
            rules,
            schemes,
            sources,
            partner: doc.conversation.default_partner.clone(),
            schema_json: serde_json::to_string_pretty(&schemas()["language.json"]).unwrap(),
            resolved_json: serde_json::to_string_pretty(
                &serde_json::json!({"language":self.language_config(language)?,"context":context}),
            )
            .unwrap(),
            learning_json: serde_json::to_string_pretty(&doc.learning).unwrap(),
            conversation_json: serde_json::to_string_pretty(&doc.conversation).unwrap(),
        })
    }
}
