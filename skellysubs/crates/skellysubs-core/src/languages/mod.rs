//! Loader for the canonical 78-language configuration asset.

use std::collections::BTreeMap;

use crate::models::LanguageConfig;

/// Embedded at compile time so the app carries its language config.
pub const LANGUAGE_CONFIGS_JSON: &str = include_str!("../../assets/language_configs.json");

/// Load all language configs, keyed by lowercase snake_case key.
pub fn load_language_configs() -> BTreeMap<String, LanguageConfig> {
    serde_json::from_str(LANGUAGE_CONFIGS_JSON).expect("embedded language_configs.json must be valid")
}

/// Look up a config by key, case-insensitively.
pub fn get(language_key: &str) -> Option<LanguageConfig> {
    load_language_configs()
        .get(&language_key.to_lowercase())
        .cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_78_languages() {
        let cfgs = load_language_configs();
        assert!(cfgs.len() >= 70, "expected 78 languages, got {}", cfgs.len());

        let english = &cfgs["english"];
        assert_eq!(english.language_code, "en");
        assert!(english.romanization_method.is_none());

        let arabic = &cfgs["arabic_levantine"];
        assert_eq!(arabic.romanization_method.as_deref(), Some("ALA_LC"));
        assert!(arabic.background.family_tree.iter().any(|f| f.contains("Semitic")));
    }

    #[test]
    fn get_is_case_insensitive() {
        assert!(get("ENGLISH").is_some());
        assert!(get("english").is_some());
        assert!(get("Arabic_Levantine").is_some());
    }
}
