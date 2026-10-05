use super::*;
use crate::configuration::{Result, error};
use serde::de::DeserializeOwned;
use std::{collections::BTreeSet, fs, path::Path};

#[derive(Debug, Clone, Serialize)]
pub struct Content {
    pub guide_policy: guide_policy::GuidePolicy,
    #[serde(skip)]
    pub(super) files: BTreeMap<String, String>,
    pub definitions: BTreeMap<String, Definition>,
    pub subskills: BTreeMap<String, Subskills>,
    pub languages: BTreeMap<String, Language>,
    pub explanations: BTreeMap<String, Explanation>,
    pub assessments: BTreeMap<String, Assessment>,
    pub guides: BTreeMap<String, Guide>,
}

#[derive(Debug, Serialize)]
pub struct Coverage {
    pub required_missing: Vec<String>,
    pub bundled_explanation_languages: Vec<String>,
    pub definitions: usize,
    pub subskills: usize,
    pub languages: usize,
    pub shared_explanations: usize,
    pub assessments: usize,
    pub learner_guides: usize,
    pub missing: Vec<String>,
}

fn fail(path: &str, message: impl ToString) -> crate::configuration::ConfigLoadError {
    error(path, "authored_content", message)
}

pub(super) fn parse<T: DeserializeOwned>(
    files: &BTreeMap<String, String>,
    path: &str,
) -> Result<T> {
    let text = files
        .get(path)
        .ok_or_else(|| fail(path, "Required file missing."))?;
    let _: serde_yaml_ng::Value = serde_yaml_ng::from_str(text).map_err(|e| fail(path, e))?;
    serde_yaml_ng::from_str(text).map_err(|e| fail(path, e))
}

pub(super) fn slug(id: &str) -> String {
    id.replace('_', "-")
}

pub(super) fn text(path: &str, value: &str) -> Result<()> {
    if value.trim().is_empty()
        || value.contains('\0')
        || value.contains("__")
        || value.len() > 16000
    {
        return Err(fail(
            path,
            "Text must be nonempty, bounded and contain no template placeholders or NUL.",
        ));
    }
    Ok(())
}

fn metadata(
    path: &str,
    version: u32,
    revision: &str,
    p: &Provenance,
    citations: &BTreeSet<String>,
) -> Result<()> {
    if version != 1 {
        return Err(fail(path, "Expected schema_version 1."));
    }
    text(path, revision)?;
    provenance(path, revision, p, citations)
}

fn provenance(
    path: &str,
    revision: &str,
    p: &Provenance,
    citations: &BTreeSet<String>,
) -> Result<()> {
    text(path, &p.authorship)?;
    text(path, &p.review.scope)?;
    if p.review.revision != revision {
        return Err(fail(
            path,
            "Review disposition must name the document revision.",
        ));
    }
    let unique: BTreeSet<_> = p.sources.iter().collect();
    if unique.is_empty()
        || unique.len() != p.sources.len()
        || p.sources.iter().any(|s| !citations.contains(s))
    {
        return Err(fail(
            path,
            "Provenance needs distinct known bibliography keys.",
        ));
    }
    if let GenerationRecord::Known(generation) = &p.generation {
        text(path, &generation.model)?;
        if generation.source_revisions.is_empty() {
            return Err(fail(path, "Generation must record source revisions."));
        }
        for (source, revision) in &generation.source_revisions {
            text(path, source)?;
            text(path, revision)?;
        }
    }
    Ok(())
}

impl Content {
    pub fn load(root: &Path) -> Result<Self> {
        templates::validate(root)?;
        let files =
            crate::configuration::content_files::read(root).map_err(|e| fail("content", e))?;
        let bib = fs::read_to_string(root.parent().unwrap_or(root).join("references.bib"))
            .map_err(|e| fail("references.bib", e))?;
        Self::from_files(&files, &bib)
    }

    pub fn from_files(files: &BTreeMap<String, String>, bibliography: &str) -> Result<Self> {
        super::support::require_files(files)?;
        let citations = crate::configuration::citations::parse_bib(bibliography)
            .map_err(|e| fail("references.bib", e))?
            .into_keys()
            .collect();
        let mut content = Self {
            guide_policy: parse(files, guide_policy::PATH)?,
            files: files.clone(),
            definitions: BTreeMap::new(),
            subskills: BTreeMap::new(),
            languages: BTreeMap::new(),
            explanations: BTreeMap::new(),
            assessments: BTreeMap::new(),
            guides: BTreeMap::new(),
        };
        for path in files.keys() {
            if path.starts_with("skills/") && path.ends_with("-definition.yaml") {
                let d: Definition = parse(files, path)?;
                metadata(
                    path,
                    d.schema_version,
                    &d.revision,
                    &d.provenance,
                    &citations,
                )?;
                let stem = slug(&d.id);
                exact(path, &format!("skills/{stem}/{stem}-definition.yaml"))?;
                if content.definitions.insert(d.id.clone(), d).is_some() {
                    return Err(fail(path, "Duplicate skill."));
                }
            } else if path.starts_with("skills/") && path.ends_with("-subskills.yaml") {
                let d: Subskills = parse(files, path)?;
                metadata(
                    path,
                    d.schema_version,
                    &d.revision,
                    &d.provenance,
                    &citations,
                )?;
                let stem = slug(&d.skill_id);
                exact(path, &format!("skills/{stem}/{stem}-subskills.yaml"))?;
                content.subskills.insert(d.skill_id.clone(), d);
            } else if path.starts_with("skills/") && path.contains("-explained-in-") {
                let d: Explanation = parse(files, path)?;
                metadata(
                    path,
                    d.schema_version,
                    &d.revision,
                    &d.provenance,
                    &citations,
                )?;
                let stem = slug(&d.skill_id);
                exact(
                    path,
                    &format!(
                        "skills/{stem}/{stem}-explained-in-{}.yaml",
                        d.explanation_language
                    ),
                )?;
                content.explanations.insert(path.clone(), d);
            } else if path.starts_with("languages/") && path.ends_with("-language.yaml") {
                let d: Language = parse(files, path)?;
                exact(
                    path,
                    &format!("languages/{0}/{0}-language.yaml", d.identity.id),
                )?;
                if d.schema_version != 1 || d.varieties.is_empty() {
                    return Err(fail(path, "Expected version 1 and declared varieties."));
                }
                let ids: BTreeSet<_> = d.varieties.iter().map(|v| &v.id).collect();
                if ids.len() != d.varieties.len() || !ids.contains(&d.defaults.variety) {
                    return Err(fail(
                        path,
                        "Varieties must be unique and include the default.",
                    ));
                }
                content.languages.insert(d.identity.id.to_string(), d);
            } else if path.starts_with("languages/") && path.ends_with("-assessment.yaml") {
                let d: Assessment = parse(files, path)?;
                metadata(
                    path,
                    d.schema_version,
                    &d.revision,
                    &d.provenance,
                    &citations,
                )?;
                let stem = slug(&d.skill_id);
                exact(
                    path,
                    &format!(
                        "languages/{0}/skills/{stem}/{0}-{stem}-assessment.yaml",
                        d.language
                    ),
                )?;
                text(path, &d.guidance)?;
                content.assessments.insert(path.clone(), d);
            } else if path.starts_with("languages/") && path.contains("-explained-in-") {
                let d: Guide = parse(files, path)?;
                metadata(
                    path,
                    d.schema_version,
                    &d.revision,
                    &d.provenance,
                    &citations,
                )?;
                let stem = slug(&d.skill_id);
                exact(
                    path,
                    &format!(
                        "languages/{0}/skills/{stem}/{0}-{stem}-explained-in-{1}.yaml",
                        d.language, d.explanation_language
                    ),
                )?;
                content.guides.insert(path.clone(), d);
            } else {
                super::support::validate_file(files, path)?;
            }
        }
        content.guide_policy.validate(&content.languages)?;
        prompts::instructions(files)?;
        prompts::criteria(
            files,
            "grammar",
            &[
                "acceptable",
                "local_errors",
                "major_errors",
                "insufficient_evidence",
            ],
        )?;
        prompts::criteria(
            files,
            "understandability",
            &[
                "understandable",
                "needs_clarification",
                "unrecoverable",
                "insufficient_evidence",
            ],
        )?;
        content.validate(&citations)?;
        Ok(content)
    }

    fn validate(&self, citations: &BTreeSet<String>) -> Result<()> {
        if self.languages.is_empty()
            || self.definitions.len() != 8
            || self.subskills.keys().ne(self.definitions.keys())
        {
            return Err(fail(
                "skills",
                "Exactly eight definitions and matching subskill documents required.",
            ));
        }
        let first = self.definitions.values().next().unwrap();
        let catalog = crate::configuration::communication::Catalog {
            schema_version: 1,
            revision: first.revision.clone(),
            definition_language: "english".into(),
            origin: first.provenance.origin.clone(),
            authorship: first.provenance.authorship.clone(),
            review: first.provenance.review.status.clone(),
            sources: first.provenance.sources.clone(),
            groups: self
                .definitions
                .values()
                .map(|d| crate::configuration::communication::Group {
                    id: d.id.clone(),
                    name: d.name.clone(),
                    purpose: d.purpose.clone(),
                    boundary: d.boundary.clone(),
                    subskills: self.subskills[&d.id].subskills.clone(),
                })
                .collect(),
        };
        catalog.validate(citations).map_err(|mut e| {
            if let Some(field) = e
                .path
                .split_once("#groups.")
                .map(|(_, field)| field.to_owned())
            {
                let (index, suffix) = field.split_once('.').unwrap_or((&field, ""));
                if let Some(group) = index
                    .parse::<usize>()
                    .ok()
                    .and_then(|index| catalog.groups.get(index))
                {
                    let stem = slug(&group.id);
                    let file = if suffix.starts_with("subskills") {
                        "subskills"
                    } else {
                        "definition"
                    };
                    e.path = format!("skills/{stem}/{stem}-{file}.yaml#{suffix}");
                }
            } else {
                e.path = "skills".into();
            }
            e
        })?;
        for (path, d) in &self.explanations {
            self.language(path, &d.explanation_language)?;
            self.sections(
                path,
                &d.skill_id,
                d.sections.iter().map(|s| s.subskill_id.as_str()),
            )?;
            text(path, &d.title)?;
            text(path, &d.introduction)?;
            for s in &d.sections {
                text(path, &s.title)?;
                text(path, &s.concept)?;
            }
        }
        for (path, d) in &self.assessments {
            self.skill(path, &d.skill_id)?;
            self.varieties(path, &d.language, &d.revision, &d.varieties, citations)?;
        }
        for (path, d) in &self.guides {
            self.language(path, &d.explanation_language)?;
            self.sections(
                path,
                &d.skill_id,
                d.sections.iter().map(|s| s.subskill_id.as_str()),
            )?;
            let stem = slug(&d.skill_id);
            let expected = format!(
                "skills/{stem}/{stem}-explained-in-{}.yaml",
                d.explanation_language
            );
            if d.shared_explanation != expected || !self.explanations.contains_key(&expected) {
                return Err(fail(
                    path,
                    format!("Expected existing shared explanation {expected}."),
                ));
            }
            self.varieties(path, &d.language, &d.revision, &d.varieties, citations)?;
            for s in &d.sections {
                text(path, &s.explanation)?;
                if s.examples.is_empty() {
                    return Err(fail(path, "Every teaching section requires examples."));
                }
                for example in &s.examples {
                    text(path, &example.text)?;
                    text(path, &example.meaning)?;
                    text(path, &example.note)?;
                }
            }
        }
        Ok(())
    }

    fn skill(&self, path: &str, id: &str) -> Result<&Definition> {
        self.definitions
            .get(id)
            .ok_or_else(|| fail(path, format!("Unknown skill: {id}")))
    }
    fn language(&self, path: &str, id: &str) -> Result<&Language> {
        self.languages
            .get(id)
            .ok_or_else(|| fail(path, format!("Unknown language: {id}")))
    }
    fn sections<'a>(
        &self,
        path: &str,
        skill: &str,
        actual: impl Iterator<Item = &'a str>,
    ) -> Result<()> {
        self.skill(path, skill)?;
        let expected: Vec<_> = self.subskills[skill]
            .subskills
            .iter()
            .map(|s| s.id.as_str())
            .collect();
        if expected != actual.collect::<Vec<_>>() {
            return Err(fail(
                path,
                "Sections must cover every subskill exactly once, in catalog order.",
            ));
        }
        Ok(())
    }
    fn varieties(
        &self,
        path: &str,
        language: &str,
        revision: &str,
        actual: &BTreeMap<String, Disposition>,
        citations: &BTreeSet<String>,
    ) -> Result<()> {
        let expected: BTreeSet<_> = self
            .language(path, language)?
            .varieties
            .iter()
            .map(|v| v.id.to_string())
            .collect();
        if expected != actual.keys().cloned().collect() {
            return Err(fail(
                path,
                "Declare exactly every offered variety; no implicit inheritance.",
            ));
        }
        for (id, disposition) in actual {
            let path = format!("{path}#varieties.{id}");
            let p = match disposition {
                Disposition::UseCore { provenance } => provenance,
                Disposition::Supplement {
                    text: detail,
                    provenance,
                } => {
                    text(&path, detail)?;
                    provenance
                }
            };
            provenance(&path, revision, p, citations)?;
        }
        Ok(())
    }

    pub fn coverage(&self) -> Coverage {
        let mut missing = Vec::new();
        for id in self.definitions.keys() {
            let stem = slug(id);
            for explanation in &self.guide_policy.bundled_explanation_languages {
                let path = format!("skills/{stem}/{stem}-explained-in-{explanation}.yaml");
                if !self.explanations.contains_key(&path) {
                    missing.push(path);
                }
            }
            for language in self.languages.keys() {
                let prefix = format!("languages/{language}/skills/{stem}/{language}-{stem}");
                let path = format!("{prefix}-assessment.yaml");
                if !self.assessments.contains_key(&path) {
                    missing.push(path);
                }
                for explanation in &self.guide_policy.bundled_explanation_languages {
                    let path = format!("{prefix}-explained-in-{explanation}.yaml");
                    if !self.guides.contains_key(&path) {
                        missing.push(path);
                    }
                }
            }
        }
        missing.sort();
        let mut required = BTreeSet::new();
        for id in self.definitions.keys() {
            let stem = slug(id);
            for (language, explanation) in &self.guide_policy.source_explanation_languages {
                required.insert(format!(
                    "skills/{stem}/{stem}-explained-in-{explanation}.yaml"
                ));
                required.insert(format!(
                    "languages/{language}/skills/{stem}/{language}-{stem}-assessment.yaml"
                ));
                required.insert(format!("languages/{language}/skills/{stem}/{language}-{stem}-explained-in-{explanation}.yaml"));
            }
        }
        Coverage {
            required_missing: missing
                .iter()
                .filter(|path| required.contains(*path))
                .cloned()
                .collect(),
            bundled_explanation_languages: self.guide_policy.bundled_explanation_languages.clone(),
            definitions: self.definitions.len(),
            subskills: self.subskills.values().map(|d| d.subskills.len()).sum(),
            languages: self.languages.len(),
            shared_explanations: self.explanations.len(),
            assessments: self.assessments.len(),
            learner_guides: self.guides.len(),
            missing,
        }
    }

    pub fn require_complete(&self) -> Result<()> {
        let coverage = self.coverage();
        if !coverage.required_missing.is_empty() {
            return Err(fail(
                "content",
                format!(
                    "{} required documents missing; inspect --coverage for exact paths.",
                    coverage.required_missing.len()
                ),
            ));
        }
        Ok(())
    }
}

fn exact(actual: &str, expected: &str) -> Result<()> {
    if actual != expected {
        return Err(fail(actual, format!("Expected path {expected}.")));
    }
    Ok(())
}
