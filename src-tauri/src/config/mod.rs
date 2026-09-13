//! Readable local configuration. Existing directories are never repaired or
//! replaced on error; callers expose ConfigLoadError as a blocking startup state.
mod citations;
mod types;
use crate::model;
use serde::{Serialize, de::DeserializeOwned};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
};
pub use types::*;

impl From<ConfigLoadError> for model::AppError {
    fn from(e: ConfigLoadError) -> Self {
        Self::new(
            model::ErrorCode::Validation,
            format!("Configuration {}: {} [{}]", e.path, e.message, e.code),
        )
    }
}
fn error(path: impl ToString, code: &str, message: impl ToString) -> ConfigLoadError {
    ConfigLoadError {
        path: path.to_string(),
        code: code.into(),
        message: message.to_string(),
    }
}
fn fingerprint<T: Serialize>(value: &T) -> String {
    let bytes = serde_json::to_vec(value).expect("serializable validated configuration");
    format!("{:x}", Sha256::digest(bytes))
}
#[derive(Debug, Clone, Serialize)]
pub struct Registry {
    pub languages: Vec<Language>,
    pub scripts: Vec<Script>,
    pub orthographies: Vec<Orthography>,
    pub romanizations: Vec<Romanization>,
    pub traits: Vec<Trait>,
    pub families: Vec<Family>,
    pub universal: Vec<Guidance>,
    constructs: Vec<Construct>,
    navigation: Vec<NavigationNode>,
    feedback: FeedbackPolicy,
    estimator: EstimatorPolicy,
    game: GamePolicy,
    starter_config: Vec<Starter>,
    reasons: BTreeMap<String, BTreeMap<String, String>>,
    hash: String,
}
include!("seeds.rs");

/// First launch installs the shipped editable seed only when the whole directory
/// is absent. A interrupted seed leaves an explicit error on the next launch.
pub fn initialize(dir: &Path) -> Result<Registry> {
    if !dir
        .try_exists()
        .map_err(|e| error(dir.display(), "io", e))?
    {
        fs::create_dir(dir).map_err(|e| error(dir.display(), "io", e))?;
        for (name, text) in SEEDS {
            let path = dir.join(name);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| error(parent.display(), "io", e))?;
            }
            use std::io::Write;
            let mut file = fs::OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(&path)
                .map_err(|e| error(path.display(), "io", e))?;
            file.write_all(text.as_bytes())
                .map_err(|e| error(path.display(), "io", e))?;
        }
    }
    Registry::load(dir)
}
fn collect_files(dir: &Path, relative: &Path, files: &mut BTreeMap<String, String>) -> Result<()> {
    for entry in fs::read_dir(dir.join(relative))
        .map_err(|e| error(dir.join(relative).display(), "io", e))?
    {
        let entry = entry.map_err(|e| error(dir.display(), "io", e))?;
        let path = relative.join(entry.file_name());
        let kind = entry
            .file_type()
            .map_err(|e| error(path.display(), "io", e))?;
        if kind.is_symlink() {
            return Err(error(
                path.display(),
                "symlink",
                "Configuration symlinks are not allowed.",
            ));
        }
        if kind.is_dir() {
            collect_files(dir, &path, files)?;
        } else if kind.is_file() {
            let name = path
                .to_str()
                .ok_or_else(|| error(path.display(), "filename", "Use UTF-8 file names."))?
                .replace('\\', "/");
            if name.starts_with('.') || name.ends_with(".md") {
                continue;
            }
            let metadata = entry.metadata().map_err(|e| error(&name, "io", e))?;
            if metadata.len() > 2 * 1024 * 1024 {
                return Err(error(&name, "size", "Configuration file exceeds 2 MiB."));
            }
            let text = fs::read_to_string(entry.path()).map_err(|e| error(&name, "io", e))?;
            files.insert(name, text);
        }
    }
    Ok(())
}
fn parse<T: DeserializeOwned>(files: &BTreeMap<String, String>, name: &str) -> Result<T> {
    let text = files
        .get(name)
        .ok_or_else(|| error(name, "missing", "Required configuration file is missing."))?;
    // Value mappings reject duplicate keys, including maps that typed BTreeMap
    // deserialization would otherwise overwrite. Keep the second typed parse for
    // strict fields and source line diagnostics.
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
    pub fn load(dir: &Path) -> Result<Self> {
        let metadata = fs::symlink_metadata(dir).map_err(|e| error(dir.display(), "io", e))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(error(
                dir.display(),
                "directory",
                "Configuration must be an owned directory, not a symlink.",
            ));
        }
        let mut files = BTreeMap::new();
        collect_files(dir, Path::new(""), &mut files)?;
        Self::from_files(files).map_err(|mut e| {
            e.path = dir.join(&e.path).display().to_string();
            e
        })
    }
    fn from_files(files: BTreeMap<String, String>) -> Result<Self> {
        let mut languages = vec![];
        let mut constructs = vec![];
        let mut starters = vec![];
        let singles = [
            "languages/scripts.yaml",
            "languages/orthographies.yaml",
            "languages/romanizations.yaml",
            "languages/traits.yaml",
            "languages/families.yaml",
            "languages/universal.yaml",
            "constructs/navigation.yaml",
            "policy/feedback.yaml",
            "policy/estimator.yaml",
            "policy/game.yaml",
            "references.bib",
            "starters/reasons.yaml",
        ];
        for name in files.keys() {
            if singles.contains(&name.as_str()) {
                continue;
            }
            if name.starts_with("languages/languages/") && name.ends_with(".yaml") {
                languages.push(parse(&files, name)?);
            } else if name.starts_with("constructs/") && name.ends_with(".yaml") {
                constructs.extend(parse::<Vec<Construct>>(&files, name)?);
            } else if name.starts_with("starters/") && name.ends_with(".yaml") {
                starters.extend(parse::<Vec<Starter>>(&files, name)?);
            } else {
                return Err(error(name, "unknown_file", "Unknown configuration file."));
            }
        }
        let bib = files.get("references.bib").ok_or_else(|| {
            error(
                "references.bib",
                "missing",
                "Citation bibliography is missing.",
            )
        })?;
        let mut registry = Self {
            languages,
            scripts: parse(&files, singles[0])?,
            orthographies: parse(&files, singles[1])?,
            romanizations: parse(&files, singles[2])?,
            traits: parse(&files, singles[3])?,
            families: parse(&files, singles[4])?,
            universal: parse(&files, singles[5])?,
            constructs,
            navigation: parse(&files, singles[6])?,
            feedback: parse(&files, singles[7])?,
            estimator: parse(&files, "policy/estimator.yaml")?,
            game: parse(&files, "policy/game.yaml")?,
            starter_config: starters,
            reasons: parse(&files, "starters/reasons.yaml")?,
            hash: String::new(),
        };
        registry.validate(bib)?;
        let citations = citations::parse_bib(bib).map_err(|e| error("references.bib", "bib", e))?;
        registry.hash = fingerprint(&(&registry, citations));
        Ok(registry)
    }
    pub fn hash(&self) -> &str {
        &self.hash
    }
    pub fn constructs(&self) -> &[Construct] {
        &self.constructs
    }
    pub fn construct(&self, id: &str) -> Result<&Construct> {
        self.constructs
            .iter()
            .find(|c| c.id == id)
            .ok_or_else(|| error("constructs", "unknown_construct", id))
    }
    pub fn game_policy(&self) -> &GamePolicy {
        &self.game
    }
    pub fn game_hash(&self) -> String {
        fingerprint(&self.game)
    }
    pub fn estimator_policy(&self) -> &EstimatorPolicy {
        &self.estimator
    }
    pub fn estimator_hash(&self) -> String {
        fingerprint(&self.estimator)
    }
    pub fn feedback_policy(&self) -> &FeedbackPolicy {
        &self.feedback
    }
    pub fn catalog(&self) -> serde_json::Value {
        let mut nodes = self.navigation.clone();
        for c in &self.constructs {
            let node = nodes
                .iter_mut()
                .find(|n| n.id == c.id)
                .expect("validated navigation entry");
            node.label = c.label.clone();
            node.criterion = c.criterion.clone();
            node.description = c.opportunity.clone();
        }
        serde_json::to_value(nodes).expect("catalog is serializable")
    }
    fn language_config(&self, id: &str) -> Result<&Language> {
        self.languages
            .iter()
            .find(|l| l.id == id)
            .ok_or_else(|| error("languages", "unknown_language", id))
    }
    pub fn language(&self, id: &str) -> model::Result<model::Language> {
        let l = self.language_config(id)?;
        Ok(model::Language {
            id: l.id.clone(),
            name: l.name.clone(),
            native_name: l.native_name.clone(),
            font_scale: self.resolved_scalars(l, &l.default_variety).1,
            direction: self.resolved_scalars(l, &l.default_variety).0,
            romanization: l.romanization.clone(),
            varieties: l
                .varieties
                .iter()
                .map(|v| model::Variety {
                    id: v.id.clone(),
                    name: v.name.clone(),
                })
                .collect(),
        })
    }
    pub fn language_projection(&self) -> Vec<model::Language> {
        self.languages
            .iter()
            .map(|l| self.language(&l.id).expect("validated language"))
            .collect()
    }
    pub fn defaults(
        &self,
        language: &str,
        explanation: &str,
    ) -> model::Result<model::PracticeSettings> {
        let l = self.language_config(language)?;
        self.language_config(explanation)?;
        Ok(model::PracticeSettings {
            difficulty: model::Difficulty::Beginner,
            explanation_language: explanation.into(),
            variety_id: l.default_variety.clone(),
            composing_help: model::HelpAmount::Balanced,
            coach_proactivity: model::CoachProactivity::OnRequest,
            translation: false,
            pronunciation: false,
            romanization: false,
            auto_send: true,
            read_aloud: true,
            speech_voice: "alloy".into(),
        })
    }
    pub fn validate_settings(
        &self,
        language: &str,
        settings: &model::PracticeSettings,
    ) -> model::Result<()> {
        self.resolve(
            language,
            Some(&settings.variety_id),
            &settings.explanation_language,
        )?;
        if settings.speech_voice != "alloy" {
            return Err(model::AppError::new(
                model::ErrorCode::Validation,
                "Choose a supported speech voice.",
            ));
        }
        Ok(())
    }
    pub fn romanization_guidance(&self, id: &str) -> Result<Option<String>> {
        let l = self.language_config(id)?;
        Ok(l.romanization.as_ref().map(|id| {
            let s = self
                .romanizations
                .iter()
                .find(|s| s.id == *id)
                .expect("validated scheme");
            let examples = s
                .examples
                .iter()
                .map(|(a, b)| format!("{a} → {b}"))
                .collect::<Vec<_>>()
                .join("; ");
            format!(
                "Romanization: {} ({}). {} Examples: {}. Sources: {}.",
                s.label,
                s.id,
                s.instructions,
                examples,
                s.sources.join(", ")
            )
        }))
    }
    pub fn resolve(
        &self,
        language: &str,
        variety: Option<&str>,
        explanation: &str,
    ) -> Result<LanguageContext> {
        let target = self.language_config(language)?;
        let explanation = self.language_config(explanation)?;
        let variety = variety.unwrap_or(&target.default_variety);
        if !target.varieties.iter().any(|v| v.id == variety) {
            return Err(error("languages", "unknown_variety", variety));
        }
        let mut guidance = BTreeMap::<String, Vec<String>>::new();
        for scope in SCOPES {
            let lang = if *scope == "explanation_writing" {
                explanation
            } else {
                target
            };
            let v = if *scope == "explanation_writing" {
                &lang.default_variety
            } else {
                variety
            };
            let mut rules = vec![];
            let mut add = |notes: &[Guidance]| {
                rules.extend(
                    notes
                        .iter()
                        .filter(|g| g.scope == *scope)
                        .map(|g| g.text.clone()),
                );
            };
            add(&self.universal);
            let mut seen = BTreeSet::new();
            let mut ordered = vec![];
            for id in &lang.traits {
                self.trait_order(id, &mut seen, &mut ordered);
            }
            for t in ordered {
                add(&t.guidance);
            }
            add(&self
                .orthographies
                .iter()
                .find(|o| o.id == lang.orthography)
                .expect("validated orthography")
                .guidance);
            add(&lang.guidance);
            add(&lang
                .varieties
                .iter()
                .find(|x| x.id == v)
                .expect("validated variety")
                .guidance);
            if *scope == "romanization"
                && let Some(text) = self.romanization_guidance(language)?
            {
                rules.push(text);
            }
            guidance.insert(scope.to_string(), rules);
        }
        let (direction, font_scale, word_spacing) = self.resolved_scalars(target, variety);
        let mut ctx = LanguageContext {
            script: target.script.clone(),
            direction,
            font_scale,
            word_spacing,
            language_id: language.into(),
            variety_id: variety.into(),
            explanation_language_id: explanation.id.clone(),
            hash: String::new(),
            guidance,
        };
        ctx.hash = fingerprint(&(&self.hash, &ctx));
        Ok(ctx)
    }
    fn resolved_scalars(&self, language: &Language, variety: &str) -> (String, f64, bool) {
        let script = self
            .scripts
            .iter()
            .find(|s| s.id == language.script)
            .expect("validated script");
        let mut result = (
            script.direction.clone(),
            script.font_scale,
            script.word_spacing,
        );
        let mut apply = |overrides: &ScalarOverrides| {
            if let Some(value) = &overrides.direction {
                result.0 = value.clone();
            }
            if let Some(value) = overrides.font_scale {
                result.1 = value;
            }
            if let Some(value) = overrides.word_spacing {
                result.2 = value;
            }
        };
        let mut ordered = vec![];
        let mut seen = BTreeSet::new();
        for id in &language.traits {
            self.trait_order(id, &mut seen, &mut ordered);
        }
        for item in ordered {
            apply(&item.scalars);
        }
        apply(&language.scalars);
        apply(
            &language
                .varieties
                .iter()
                .find(|v| v.id == variety)
                .expect("validated variety")
                .scalars,
        );
        result
    }
    fn trait_order<'a>(
        &'a self,
        id: &str,
        seen: &mut BTreeSet<String>,
        ordered: &mut Vec<&'a Trait>,
    ) {
        if !seen.insert(id.into()) {
            return;
        }
        let t = self
            .traits
            .iter()
            .find(|t| t.id == id)
            .expect("validated trait");
        for dep in &t.requires {
            self.trait_order(dep, seen, ordered);
        }
        ordered.push(t);
    }
    /// Mandatory focus/prerequisites, due, function and interaction constructs
    /// are never silently truncated. Optional neighboring-band/token matches fill
    /// up to 25. Explicit tokens are literal lexical hints, not a UD parser.
    pub fn candidates(
        &self,
        ctx: &LanguageContext,
        band: &str,
        focus: &[String],
        due: &[String],
        tokens: &[String],
    ) -> Result<Vec<Construct>> {
        let band_index = BANDS
            .iter()
            .position(|b| *b == band)
            .ok_or_else(|| error("constructs", "unknown_band", band))?;
        let mut selected = BTreeSet::new();
        for id in focus.iter().chain(due) {
            self.add_required(id, &ctx.language_id, &mut selected)?;
        }
        for c in &self.constructs {
            if self.applies(c, &ctx.language_id)
                && ["function", "interaction"].contains(&c.lens.as_str())
            {
                selected.insert(c.id.clone());
            }
        }
        for c in &self.constructs {
            if selected.len() >= 25 {
                break;
            }
            if self.applies(c, &ctx.language_id)
                && BANDS
                    .iter()
                    .position(|b| *b == c.band)
                    .expect("validated band")
                    .abs_diff(band_index)
                    <= 1
                && (!c.traits.is_empty()
                    && c.traits.iter().any(|t| {
                        self.language_config(&ctx.language_id)
                            .expect("resolved language")
                            .traits
                            .contains(t)
                    })
                    || c.tokens
                        .iter()
                        .any(|t| tokens.iter().any(|x| x.eq_ignore_ascii_case(t))))
            {
                selected.insert(c.id.clone());
            }
        }
        Ok(self
            .constructs
            .iter()
            .filter(|c| selected.contains(&c.id))
            .cloned()
            .collect())
    }
    fn applies(&self, c: &Construct, language: &str) -> bool {
        c.language.as_ref().is_none_or(|l| l == language)
    }
    fn add_required(&self, id: &str, language: &str, out: &mut BTreeSet<String>) -> Result<()> {
        let c = self.construct(id)?;
        if !self.applies(c, language) {
            return Err(error("constructs", "language_mismatch", id));
        }
        if out.insert(id.into()) {
            for dep in &c.requires {
                self.add_required(dep, language, out)?;
            }
        }
        Ok(())
    }
    pub fn starters(
        &self,
        ctx: &LanguageContext,
        band: &str,
        focus: &[String],
        due: &[String],
        contact_tags: &[String],
        recent: &[String],
    ) -> Result<Vec<SelectedStarter>> {
        if !BANDS.contains(&band) {
            return Err(error("starters", "unknown_band", band));
        }
        for id in focus.iter().chain(due) {
            self.construct(id)?;
        }
        let eligible: Vec<_> = self
            .starter_config
            .iter()
            .filter(|s| {
                s.languages.contains(&ctx.language_id)
                    && s.bands.iter().any(|b| b == band)
                    && !recent.iter().take(3).any(|id| *id == s.id)
            })
            .collect();
        let mut selected = vec![];
        let mut used = BTreeSet::new();
        for reason in ["focus", "due", "contact", "general"] {
            if selected.len() == 3 {
                break;
            }
            // Focus and due share one slot, in that priority order.
            if reason == "due" && !selected.is_empty() {
                continue;
            }
            if let Some(starter) = eligible.iter().find(|s| {
                !used.contains(&s.id)
                    && match reason {
                        "focus" => s
                            .constructs_any
                            .iter()
                            .chain(&s.functions)
                            .any(|id| focus.contains(id)),
                        "due" => s
                            .constructs_any
                            .iter()
                            .chain(&s.functions)
                            .any(|id| due.contains(id)),
                        "contact" => s.contact_tags.iter().any(|tag| {
                            contact_tags.iter().any(|interest| {
                                interest
                                    .split_whitespace()
                                    .collect::<Vec<_>>()
                                    .join(" ")
                                    .to_lowercase()
                                    == tag
                                        .split_whitespace()
                                        .collect::<Vec<_>>()
                                        .join(" ")
                                        .to_lowercase()
                            })
                        }),
                        _ => true,
                    }
            }) {
                used.insert(starter.id.clone());
                selected.push(SelectedStarter {
                    starter: (*starter).clone(),
                    reason: self.reasons[reason][&ctx.explanation_language_id].clone(),
                });
            }
        }
        for starter in eligible {
            if selected.len() == 3 {
                break;
            }
            if used.insert(starter.id.clone()) {
                selected.push(SelectedStarter {
                    starter: starter.clone(),
                    reason: self.reasons["general"][&ctx.explanation_language_id].clone(),
                });
            }
        }
        Ok(selected)
    }
}
const SCOPES: &[&str] = &[
    "target_writing",
    "explanation_writing",
    "segmentation",
    "reading",
    "romanization",
    "assessment",
    "pragmatics",
];
const BANDS: &[&str] = &["PreA1", "A1", "A2", "B1", "B2", "C1", "C2"];
#[cfg(test)]
mod tests;
mod validation;

/// Exported schemas derive from the same strict types used by the startup loader.
pub fn schemas() -> BTreeMap<String, serde_json::Value> {
    macro_rules! schema {
        ($name:literal,$type:ty) => {
            (
                $name.into(),
                serde_json::to_value(schemars::schema_for!($type)).expect("schema serialization"),
            )
        };
    }
    BTreeMap::from([
        schema!("language.json", Language),
        schema!("scripts.json", Vec<Script>),
        schema!("orthographies.json", Vec<Orthography>),
        schema!("romanizations.json", Vec<Romanization>),
        schema!("traits.json", Vec<Trait>),
        schema!("families.json", Vec<Family>),
        schema!("universal.json", Vec<Guidance>),
        schema!("constructs.json", Vec<Construct>),
        schema!("navigation.json", Vec<NavigationNode>),
        schema!("feedback.json", FeedbackPolicy),
        schema!("estimator.json", EstimatorPolicy),
        schema!("game.json", GamePolicy),
        schema!("starters.json", Vec<Starter>),
        schema!("starter-reasons.json",BTreeMap<String,BTreeMap<String,String>>),
    ])
}
