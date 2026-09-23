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
        let mut files = BTreeMap::new();
        collect_files(dir, Path::new(""), &mut files)?;
        let bibliography = dir.parent().unwrap_or(dir).join("references.bib");
        files.insert(
            "references.bib".into(),
            fs::read_to_string(&bibliography)
                .map_err(|e| error(bibliography.display(), "io", e))?,
        );
        Self::from_files(files)
    }
    pub(super) fn from_files(files: BTreeMap<String, String>) -> Result<Self> {
        let foundations: Foundations = parse(&files, "shared/language-foundations.yaml")?;
        let policy: TeachingPolicy = parse(&files, "shared/teaching-policy.yaml")?;
        let topics: Vec<ConversationTopic> = parse(&files, "shared/conversation-topics.yaml")?;
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
            constructs: parse(&files, "shared/learning-goals.yaml")?,
            navigation: parse(&files, "shared/learning-map.yaml")?,
            feedback: policy.feedback,
            estimator: policy.estimator,
            game: policy.game,
            topics,
            conversation_prompt: parse(&files, "prompts/conversation/instructions.yaml")?,
            drill_instruction: parse(&files, "prompts/drill/instructions.yaml")?,
            hash: String::new(),
            documents: BTreeMap::new(),
            source_files: files.clone(),
            goal_material: BTreeMap::new(),
        };
        if registry.drill_instruction.trim().is_empty() || registry.drill_instruction.len() > 16000
        {
            return Err(error(
                "prompts/drill/instructions.yaml",
                "instruction",
                "Drill instructions must be nonempty and bounded.",
            ));
        }
        registry.add_definitions(
            "shared",
            &foundations.orthographies,
            &foundations.romanization_schemes,
        )?;
        for name in files.keys() {
            if name.starts_with("languages/") && name.ends_with(".yaml") {
                let document: LanguageDocument = parse(&files, name)?;
                let expected = format!("languages/{}.yaml", document.identity.id);
                if *name != expected {
                    return Err(error(
                        name,
                        "identity",
                        format!("Filename must be {expected}."),
                    ));
                }
                registry.add_language(name, document)?;
            } else if ![
                "shared/language-foundations.yaml",
                "shared/learning-goals.yaml",
                "shared/learning-map.yaml",
                "shared/teaching-policy.yaml",
                "shared/conversation-topics.yaml",
                "prompts/conversation/instructions.yaml",
                "prompts/drill/instructions.yaml",
                "references.bib",
            ]
            .contains(&name.as_str())
            {
                return Err(error(name, "unknown_file", "Unknown content file."));
            }
        }
        for (language, materials) in &registry.goal_material {
            for goal in materials.keys() {
                registry.construct(goal).map_err(|e| {
                    error(
                        format!("languages/{language}.yaml#learning.goal_material.{goal}"),
                        &e.code,
                        e.message,
                    )
                })?;
            }
        }
        registry.validate_starter_content()?;
        let bib = files.get("references.bib").ok_or_else(|| {
            error(
                "references.bib",
                "missing",
                "Citation bibliography is missing.",
            )
        })?;
        registry.validate(bib).map_err(|mut e| {
            // Existing semantic validators name stable entities. Attach their authored owner.
            if let Some(path) = registry.entity_source(&e.path) {
                e.path = path;
            }
            e
        })?;
        let citations = citations::parse_bib(bib).map_err(|e| error("references.bib", "bib", e))?;
        // Hash typed authored content as well as runtime projections, including unused definitions.
        registry.hash = fingerprint(&(&registry, &registry.documents, citations));
        Ok(registry)
    }
}
fn collect_files(root: &Path, relative: &Path, files: &mut BTreeMap<String, String>) -> Result<()> {
    let dir = root.join(relative);
    let metadata = fs::symlink_metadata(&dir).map_err(|e| error(dir.display(), "io", e))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(error(
            dir.display(),
            "directory",
            "Content must be a directory, not a symlink.",
        ));
    }
    for entry in fs::read_dir(&dir).map_err(|e| error(dir.display(), "io", e))? {
        let entry = entry.map_err(|e| error(dir.display(), "io", e))?;
        let path = relative.join(entry.file_name());
        let name = path
            .to_str()
            .ok_or_else(|| error(path.display(), "filename", "Use UTF-8 filenames."))?
            .replace('\\', "/");
        let kind = entry.file_type().map_err(|e| error(&name, "io", e))?;
        if kind.is_symlink() {
            return Err(error(&name, "symlink", "Content symlinks are not allowed."));
        }
        if name == "diagnostics"
            || name == "schemas"
            || entry.file_name().to_string_lossy().starts_with('.')
            || name.ends_with(".md")
        {
            continue;
        }
        if kind.is_dir() {
            collect_files(root, &path, files)?;
        } else if kind.is_file() {
            if entry.metadata().map_err(|e| error(&name, "io", e))?.len() > 2 * 1024 * 1024 {
                return Err(error(&name, "size", "Content file exceeds 2 MiB."));
            }
            files.insert(
                name.clone(),
                fs::read_to_string(entry.path()).map_err(|e| error(&name, "io", e))?,
            );
        }
    }
    Ok(())
}
