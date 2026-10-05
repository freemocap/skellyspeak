//! Authored teaching documents, independent of runtime language processing and credit.
use super::{Registry, Result, fingerprint, identity::ReviewStatus};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum GuideTarget {
    Script { script: String },
    Reading { language: String },
    Skill { language: String, skill: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "snake_case")]
pub enum GuideOrigin {
    Human,
    Ai,
    Mixed,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(deny_unknown_fields)]
pub struct GuideSection {
    pub title: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(deny_unknown_fields)]
pub struct GuideExample {
    pub text: String,
    pub meaning: String,
    pub note: String,
}

/// A connected realization of the language-wide core, never a replacement guide.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(deny_unknown_fields)]
pub struct GuideVariant {
    pub variety: String,
    pub summary: String,
    pub sections: Vec<GuideSection>,
    pub examples: Vec<GuideExample>,
    pub guidance: String,
    pub sources: Vec<String>,
    #[ts(inline)]
    pub review: ReviewStatus,
    #[ts(inline)]
    pub origin: GuideOrigin,
    pub authorship: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(deny_unknown_fields)]
pub struct TeachingGuide {
    pub id: String,
    #[ts(inline)]
    pub target: GuideTarget,
    pub explanation_language: String,
    pub title: String,
    pub summary: String,
    pub sections: Vec<GuideSection>,
    pub examples: Vec<GuideExample>,
    /// Compact authored guidance; not automatically added to existing prompts.
    pub guidance: String,
    pub shared_guides: Vec<String>,
    pub variants: Vec<GuideVariant>,
    pub sources: Vec<String>,
    #[ts(inline)]
    pub review: ReviewStatus,
    #[ts(inline)]
    pub origin: GuideOrigin,
    pub authorship: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GuideInspection {
    pub guide: TeachingGuide,
    pub fingerprint: String,
    /// The UI and later assessment projection compose this supplement with the core.
    pub selected_variety: Option<String>,
    pub source: String,
    pub explanation_name: String,
    pub explanation_tag: Option<String>,
    pub explanation_direction: String,
}

impl Registry {
    /// Authoring inspection lists saved guides with their actual explanation language.
    /// Missing files remain the responsibility of the separate completeness gate.
    pub fn inspect_guides(
        &self,
        language: &str,
        variety: Option<&str>,
    ) -> Result<Vec<GuideInspection>> {
        let config = self.language_config(language)?;
        let variety = variety.unwrap_or(&config.default_variety);
        self.resolve_pair(language, Some(variety), language, Some(variety))?;
        self.authored
            .guides
            .iter()
            .filter(|(_, g)| g.language == language)
            .map(|(path, document)| {
                let shared = &self.authored.explanations[&document.shared_explanation];
                let assessment = self.skill_prompt(language, variety, &document.skill_id)?;
                let explanation = self.resolve(
                    &document.explanation_language,
                    None,
                    &document.explanation_language,
                )?;
                let sections = document
                    .sections
                    .iter()
                    .map(|section| {
                        let concept = shared
                            .sections
                            .iter()
                            .find(|s| s.subskill_id == section.subskill_id)
                            .expect("validated subskill reference");
                        GuideSection {
                            title: concept.title.clone(),
                            text: format!("{}\n\n{}", concept.concept, section.explanation),
                        }
                    })
                    .collect();
                let examples = document
                    .sections
                    .iter()
                    .flat_map(|section| {
                        section.examples.iter().map(|example| GuideExample {
                            text: example.text.clone(),
                            meaning: example.meaning.clone(),
                            note: example.note.clone(),
                        })
                    })
                    .collect();
                let variants = document
                    .varieties
                    .iter()
                    .filter_map(|(id, disposition)| match disposition {
                        super::authoring::Disposition::UseCore { .. } => None,
                        super::authoring::Disposition::Supplement { text, provenance } => {
                            Some(GuideVariant {
                                variety: id.clone(),
                                summary: text.clone(),
                                sections: vec![],
                                examples: vec![],
                                guidance: String::new(),
                                sources: provenance.sources.clone(),
                                review: provenance.review.status.clone(),
                                origin: provenance.origin.clone(),
                                authorship: provenance.authorship.clone(),
                            })
                        }
                    })
                    .collect();
                let sources = document
                    .provenance
                    .sources
                    .iter()
                    .chain(&shared.provenance.sources)
                    .cloned()
                    .collect::<BTreeSet<_>>()
                    .into_iter()
                    .collect();
                Ok(GuideInspection {
                    guide: TeachingGuide {
                        id: format!(
                            "{}:{}:{}",
                            language, document.skill_id, document.explanation_language
                        ),
                        target: GuideTarget::Skill {
                            language: language.into(),
                            skill: document.skill_id.clone(),
                        },
                        explanation_language: document.explanation_language.clone(),
                        title: shared.title.clone(),
                        summary: shared.introduction.clone(),
                        sections,
                        examples,
                        guidance: assessment.language_guidance,
                        shared_guides: vec![],
                        variants,
                        sources,
                        review: document.provenance.review.status.clone(),
                        origin: document.provenance.origin.clone(),
                        authorship: document.provenance.authorship.clone(),
                    },
                    fingerprint: fingerprint(&(document, shared)),
                    selected_variety: Some(variety.into()),
                    source: path.clone(),
                    explanation_name: explanation.target_name,
                    explanation_tag: explanation.external_tags.get("language_tag").cloned(),
                    explanation_direction: explanation.direction,
                })
            })
            .collect()
    }
}
