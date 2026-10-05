use super::*;
use documents::*;

pub(super) fn parse<T: DeserializeOwned>(
    files: &BTreeMap<String, String>,
    name: &str,
) -> Result<T> {
    let text = files
        .get(name)
        .ok_or_else(|| error(name, "missing", "Required content file is missing."))?;
    let _: serde_yaml_ng::Value =
        serde_yaml_ng::from_str(text).map_err(|e| error(name, "yaml", e))?;
    serde_yaml_ng::from_str(text).map_err(|e| error(name, "yaml", e))
}
fn required_text<'a>(files: &'a BTreeMap<String, String>, name: &str) -> Result<&'a str> {
    let text = files
        .get(name)
        .ok_or_else(|| error(name, "missing", "Required content file is missing."))?;
    if text.trim().is_empty() || text.len() > 16000 || text.contains('\0') {
        return Err(error(
            name,
            "text",
            "Expected nonempty, bounded, NUL-free content.",
        ));
    }
    Ok(text)
}
fn conversation_prompt(files: &BTreeMap<String, String>) -> Result<ConversationPromptContent> {
    let markdown = |name: &str| {
        required_text(files, &format!("prompts/conversation/{name}.md")).map(String::from)
    };
    Ok(ConversationPromptContent {
        base: markdown("base")?,
        persona: markdown("persona")?,
        interaction: markdown("interaction")?,
        examples_intro: markdown("examples-intro")?,
        ceiling: markdown("ceiling")?,
        coach_focus: markdown("coach-focus")?,
        past: markdown("past")?,
        future: markdown("future")?,
        opening: markdown("opening")?,
        phrase_opening: markdown("phrase-opening")?,
        response: markdown("response")?,
        subject: markdown("subject")?,
        examples: parse(files, "prompts/conversation/examples.yaml")?,
        difficulty: parse(files, "prompts/conversation/difficulty.yaml")?,
        opening_angles: parse(files, "prompts/conversation/opening-angles.yaml")?,
    })
}

impl Registry {
    pub fn bundled() -> Result<Self> {
        Self::from_files(
            SEEDS
                .iter()
                .map(|(n, t)| (n.to_string(), t.to_string()))
                .collect(),
        )
    }
    /// Repository tooling only. Runtime always loads the packaged content.
    pub fn load(dir: &Path) -> Result<Self> {
        authoring::templates::validate(dir)?;
        let mut files =
            super::content_files::read(dir).map_err(|e| error(dir.display(), "inventory", e))?;
        let bibliography = dir.parent().unwrap_or(dir).join("references.bib");
        files.insert(
            "references.bib".into(),
            fs::read_to_string(&bibliography)
                .map_err(|e| error(bibliography.display(), "io", e))?,
        );
        Self::from_files(files)
    }
    pub(super) fn from_files(mut files: BTreeMap<String, String>) -> Result<Self> {
        let bib = files.remove("references.bib").ok_or_else(|| {
            error(
                "references.bib",
                "missing",
                "Citation bibliography is missing.",
            )
        })?;
        let authored = authoring::Content::from_files(&files, &bib)?;
        let speech: speech::Catalog = parse(&files, "speech/speech-routing.yaml")?;
        let foundations: Foundations =
            parse(&files, "language-foundations/language-foundations.yaml")?;
        let policy: TeachingPolicy = parse(&files, "policies/teaching-policy.yaml")?;
        let topics: Vec<ConversationTopic> =
            parse(&files, "conversation-topics/conversation-topics.yaml")?;
        let communication = communication::Catalog {
            schema_version: 1,
            revision: fingerprint(&authored.definitions),
            definition_language: "english".into(),
            origin: guides::GuideOrigin::Mixed,
            authorship: "Assembled from the authored skill definitions and subskills.".into(),
            review: identity::ReviewStatus::NeedsReview,
            sources: authored
                .definitions
                .values()
                .flat_map(|d| d.provenance.sources.clone())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
            groups: authored
                .definitions
                .values()
                .map(|d| communication::Group {
                    id: d.id.clone(),
                    name: d.name.clone(),
                    purpose: d.purpose.clone(),
                    boundary: d.boundary.clone(),
                    subskills: authored.subskills[&d.id].subskills.clone(),
                })
                .collect(),
        };
        let skills = skills::Catalog {
            skills: authored
                .definitions
                .values()
                .map(|d| skills::Skill {
                    id: d.id.clone(),
                    name: d.name.clone(),
                    overview: d.purpose.clone(),
                    boundary: d.boundary.clone(),
                })
                .collect(),
        };
        let mut registry = Self {
            languages: vec![],
            scripts: foundations.scripts,
            families: foundations.families,
            traits: foundations
                .traits
                .into_iter()
                .map(|t| Trait {
                    id: t.id,
                    review: t.review.to_string(),
                    requires: vec![],
                    guidance: vec![],
                    scalars: ScalarOverrides::default(),
                })
                .collect(),
            orthographies: vec![],
            romanizations: vec![],
            universal: policy.guidance,
            skills,
            communication,
            authored,
            assessment_instructions: authoring::prompts::instructions(&files)?,
            feedback: policy.feedback,
            estimator: policy.estimator,
            game: policy.game,
            topics,
            conversation_prompt: conversation_prompt(&files)?,
            drill_instruction: required_text(&files, "prompts/practice/practice.md")?.into(),
            hash: String::new(),
            documents: BTreeMap::new(),
            source_files: files,
        };
        registry
            .source_files
            .insert("references.bib".into(), bib.clone());
        registry.add_definitions(
            "shared",
            &foundations.orthographies,
            &foundations.romanization_schemes,
        )?;
        for (id, document) in registry.authored.languages.clone() {
            speech.validate_preferences(&document.defaults.speech_routes)?;
            for variety in &document.varieties {
                speech.validate_preferences(&variety.overrides.speech_routes)?;
            }
            registry.add_language(&format!("languages/{id}/{id}-language.yaml"), document)?;
        }
        registry.validate_starter_content()?;
        registry.validate_practice_content()?;
        registry.validate(&bib).map_err(|mut e| {
            if let Some(path) = registry.entity_source(&e.path) {
                e.path = path;
            }
            e
        })?;
        let citations =
            citations::parse_bib(&bib).map_err(|e| error("references.bib", "bib", e))?;
        for source in &speech.sources {
            if !citations.contains_key(source) {
                return Err(error("speech/speech-routing.yaml", "citation", source));
            }
        }
        registry.hash = fingerprint(&(&registry, &registry.documents, &speech, citations));
        Ok(registry)
    }
}
