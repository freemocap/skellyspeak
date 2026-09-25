//! Authored teaching documents, independent of runtime language processing and credit.
use super::{Registry, Result, error, fingerprint, identity::ReviewStatus};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GuideDocument {
    pub schema_version: u32,
    pub guides: Vec<TeachingGuide>,
}

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
    pub(super) fn validate_guides(&self, citations: &BTreeSet<String>) -> Result<()> {
        let mut ids = BTreeSet::new();
        let mut coverage = BTreeSet::new();
        for (path, document) in &self.guides {
            if document.schema_version != 1 || document.guides.is_empty() {
                return Err(error(
                    path,
                    "guide_schema",
                    "Expected version 1 and nonempty guides.",
                ));
            }
            for (index, guide) in document.guides.iter().enumerate() {
                let path = format!("{path}#guides.{index}");
                let fail = |message| error(&path, "guide", message);
                if !ids.insert(&guide.id)
                    || guide.id.is_empty()
                    || !guide.id.as_bytes()[0].is_ascii_lowercase()
                    || guide.id.split('-').any(|p| {
                        p.is_empty()
                            || !p
                                .bytes()
                                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
                    })
                {
                    return Err(fail(
                        "Guide IDs must be unique lowercase hyphenated identifiers.",
                    ));
                }
                self.language_config(&guide.explanation_language)
                    .map_err(|e| error(&path, "guide_explanation", e.message))?;
                for text in [
                    &guide.title,
                    &guide.summary,
                    &guide.guidance,
                    &guide.authorship,
                ]
                .into_iter()
                .chain(guide.sections.iter().flat_map(|s| [&s.title, &s.text]))
                .chain(
                    guide
                        .examples
                        .iter()
                        .flat_map(|e| [&e.text, &e.meaning, &e.note]),
                )
                .chain(
                    guide
                        .variants
                        .iter()
                        .flat_map(|v| [&v.summary, &v.guidance, &v.authorship]),
                )
                .chain(
                    guide
                        .variants
                        .iter()
                        .flat_map(|v| &v.sections)
                        .flat_map(|s| [&s.title, &s.text]),
                )
                .chain(
                    guide
                        .variants
                        .iter()
                        .flat_map(|v| &v.examples)
                        .flat_map(|e| [&e.text, &e.meaning, &e.note]),
                ) {
                    if text.trim().is_empty() || text.contains('\0') || text.len() > 16000 {
                        return Err(fail(
                            "Guide text must be nonempty, NUL-free and at most 16000 bytes per field.",
                        ));
                    }
                }
                if guide.sections.is_empty() || guide.sources.is_empty() {
                    return Err(fail(
                        "Guide cores require sections and citations; concrete examples may belong to varieties.",
                    ));
                }
                let mut source_ids = BTreeSet::new();
                for sources in
                    std::iter::once(&guide.sources).chain(guide.variants.iter().map(|v| &v.sources))
                {
                    source_ids.clear();
                    for source in sources {
                        if !citations.contains(source) || !source_ids.insert(source) {
                            return Err(fail("Unknown or duplicate guide citation."));
                        }
                    }
                }
                let targets = match &guide.target {
                    GuideTarget::Script { script } => {
                        if !self.scripts.iter().any(|s| &s.id == script)
                            || !guide.shared_guides.is_empty()
                            || !guide.variants.is_empty()
                            || guide.examples.is_empty()
                        {
                            return Err(fail(
                                "Script guides require a known script and examples, with no language varieties or nested guides.",
                            ));
                        }
                        vec![format!("script:{script}")]
                    }
                    GuideTarget::Reading { language } | GuideTarget::Skill { language, .. } => {
                        let language_config = self
                            .language_config(language)
                            .map_err(|e| error(&path, "guide_language", e.message))?;
                        let mut selected = BTreeSet::new();
                        for variant in &guide.variants {
                            if !language_config
                                .varieties
                                .iter()
                                .any(|v| v.id == variant.variety)
                                || !selected.insert(variant.variety.clone())
                            {
                                return Err(fail("Unknown, foreign or duplicate guide variety."));
                            }
                            if variant.sections.is_empty()
                                || variant.examples.is_empty()
                                || variant.sources.is_empty()
                            {
                                return Err(fail(
                                    "Each variety requires explicit sections, examples and citations.",
                                ));
                            }
                        }
                        if selected.len() != language_config.varieties.len() {
                            return Err(fail(
                                "Language guides require connected material for every configured variety.",
                            ));
                        }
                        let kind = if let GuideTarget::Skill { skill, .. } = &guide.target {
                            self.construct(skill)
                                .map_err(|e| error(&path, "guide_skill", e.message))?;
                            format!("skill:{skill}")
                        } else {
                            "reading".into()
                        };
                        vec![format!("{kind}:{language}")]
                    }
                };
                for target in targets {
                    if !coverage.insert((target, &guide.explanation_language)) {
                        return Err(fail(
                            "Overlapping guides for the same target and explanation language.",
                        ));
                    }
                }
                let mut refs = BTreeSet::new();
                for id in &guide.shared_guides {
                    let shared = self
                        .guides
                        .values()
                        .flat_map(|d| &d.guides)
                        .find(|g| &g.id == id);
                    if !refs.insert(id)
                        || !shared.is_some_and(|g| {
                            matches!(g.target, GuideTarget::Script { .. })
                                && g.explanation_language == guide.explanation_language
                        })
                    {
                        return Err(fail(
                            "Shared guide references must identify distinct script guides in the same explanation language.",
                        ));
                    }
                }
            }
        }
        Ok(())
    }

    /// Return authored documents with their actual explanation language. No implicit translation.
    pub fn inspect_guides(
        &self,
        language: &str,
        variety: Option<&str>,
    ) -> Result<Vec<GuideInspection>> {
        let language_config = self.language_config(language)?;
        let variety = variety.unwrap_or(&language_config.default_variety);
        let context = self.resolve_pair(language, Some(variety), language, Some(variety))?;
        let applicable = |g: &TeachingGuide| match &g.target {
            GuideTarget::Script { script } => script == &context.script,
            GuideTarget::Reading { language: target }
            | GuideTarget::Skill {
                language: target, ..
            } => target == language,
        };
        let shared: BTreeSet<_> = self
            .guides
            .values()
            .flat_map(|d| &d.guides)
            .filter(|g| applicable(g))
            .flat_map(|g| &g.shared_guides)
            .collect();
        self.guides
            .iter()
            .flat_map(|(path, d)| {
                d.guides
                    .iter()
                    .enumerate()
                    .map(move |(index, g)| (path, index, g))
            })
            .filter(|(_, _, g)| applicable(g) || shared.contains(&g.id))
            .map(|(path, index, guide)| {
                let explanation = self.resolve(
                    &guide.explanation_language,
                    None,
                    &guide.explanation_language,
                )?;
                Ok(GuideInspection {
                    selected_variety: match guide.target {
                        GuideTarget::Script { .. } => None,
                        _ => Some(variety.to_string()),
                    },
                    guide: guide.clone(),
                    fingerprint: fingerprint(guide),
                    source: format!("{path}#guides.{index}"),
                    explanation_name: explanation.target_name,
                    explanation_tag: explanation.external_tags.get("language_tag").cloned(),
                    explanation_direction: explanation.direction,
                })
            })
            .collect()
    }
}
