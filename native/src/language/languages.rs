//! Bundled registry helpers for standalone tools and fixtures. Live operations
//! use Store's independently loaded config::Registry and captured contexts.
use crate::configuration as config;
use crate::model::*;
use std::sync::OnceLock;
pub type RomanizationScheme = config::Romanization;
fn bundled() -> &'static config::Registry {
    static REGISTRY: OnceLock<config::Registry> = OnceLock::new();
    REGISTRY.get_or_init(|| {
        config::Registry::bundled().expect("invalid bundled language configuration")
    })
}
pub fn registry() -> Vec<Language> {
    bundled().language_projection()
}
pub fn language(id: &str) -> Result<Language> {
    bundled().language(id)
}
pub fn defaults(language_id: &str, explanation_language: &str) -> Result<PracticeSettings> {
    bundled().defaults(language_id, explanation_language)
}
pub fn validate_settings(language_id: &str, settings: &PracticeSettings) -> Result<()> {
    bundled().validate_settings(language_id, settings)
}
pub fn romanization(language_id: &str) -> Result<Option<&'static RomanizationScheme>> {
    let language = bundled().language(language_id)?;
    Ok(language.romanization.map(|id| {
        bundled()
            .romanizations
            .iter()
            .find(|r| r.id == id)
            .expect("validated scheme")
    }))
}
pub fn romanization_guidance(language_id: &str) -> Result<Option<String>> {
    Ok(bundled().romanization_guidance(language_id)?)
}
pub fn writing_guidance(
    language_id: &str,
    variety_id: Option<&str>,
) -> Result<Option<&'static str>> {
    let config = bundled();
    let projection = config.language(language_id)?;
    let lang = config
        .languages
        .iter()
        .find(|l| l.id == projection.id)
        .expect("validated language");
    let variety = variety_id.unwrap_or(&lang.default_variety);
    let variety = lang
        .varieties
        .iter()
        .find(|v| v.id == variety)
        .ok_or_else(|| {
            AppError::new(
                ErrorCode::Validation,
                "The variety must belong to the conversation language.",
            )
        })?;
    // Legacy singular helper retains leaf-wins behavior. Runtime contexts carry
    // every scoped rule in resolution order rather than a single optional note.
    let orth = config
        .orthographies
        .iter()
        .find(|o| o.id == lang.orthography)
        .expect("validated orthography");
    Ok(variety
        .guidance
        .iter()
        .chain(&lang.guidance)
        .chain(&orth.guidance)
        .find(|g| g.scope == "target_writing")
        .map(|g| g.text.as_str()))
}
pub fn assessment_guidance(language_id: &str) -> Result<Option<&'static str>> {
    let config = bundled();
    config.language(language_id)?;
    let lang = config
        .languages
        .iter()
        .find(|l| l.id == language_id)
        .expect("validated language");
    Ok(lang
        .traits
        .iter()
        .filter_map(|id| config.traits.iter().find(|t| t.id == *id))
        .flat_map(|t| &t.guidance)
        .find(|g| g.scope == "assessment")
        .map(|g| g.text.as_str()))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bundled_helpers_preserve_language_coverage_and_guidance() {
        assert!(!registry().is_empty());
        for language in registry() {
            let settings = defaults(&language.id, "en").unwrap();
            assert_eq!(settings.difficulty, Difficulty::Beginner);
            validate_settings(&language.id, &settings).unwrap();
            if let Some(scheme) = romanization(&language.id).unwrap() {
                let text = romanization_guidance(&language.id).unwrap().unwrap();
                assert!(text.contains(&scheme.label));
                assert!(scheme.examples.len() >= 5);
                for (a, b) in &scheme.examples {
                    assert!(text.contains(&format!("{a} → {b}")));
                }
            }
        }
        assert!(
            writing_guidance("zh", None)
                .unwrap()
                .unwrap()
                .contains("Simplified Chinese")
        );
        assert!(
            assessment_guidance("ar")
                .unwrap()
                .unwrap()
                .contains("never add diacritics")
        );
        assert!(writing_guidance("ar", Some("zh-CN")).is_err());
        assert!(romanization("unknown").is_err());
    }
}
#[cfg(test)]
#[path = "languages_citation_tests.rs"]
mod citation_tests;
