use super::*;

#[test]
fn added_languages_resolve_through_the_standard_registry() {
    let registry = Registry::bundled().unwrap();
    for (id, tag, script, romanized) in [
        ("cantonese", "yue-Hant-HK", "traditional-chinese", true),
        ("greek", "el", "greek", true),
        ("thai", "th", "thai", true),
        ("korean", "ko", "hangul", true),
        ("japanese", "ja", "japanese", true),
        ("vietnamese", "vi", "latin", false),
        ("indonesian", "id", "latin", false),
        ("turkish", "tr", "latin", false),
        ("russian", "ru", "cyrillic", true),
        ("ukrainian", "uk", "cyrillic", true),
    ] {
        let language = registry.language(id).unwrap();
        assert_eq!(language.language_tag.as_deref(), Some(tag));
        let context = registry.resolve(id, None, "english").unwrap();
        assert_eq!(context.script, script);
        assert_eq!(
            context
                .external_tags
                .get("language_tag")
                .map(String::as_str),
            Some(tag)
        );
        assert_eq!(
            registry
                .active_romanization_scheme(id, None)
                .unwrap()
                .is_some(),
            romanized
        );
        assert_eq!(
            registry
                .starter_persona(id)
                .unwrap()
                .romanized_name
                .is_some(),
            romanized
        );
        assert!(registry.resolve(id, Some("english-us"), "english").is_err());
        let target = serde_json::to_value(&context).unwrap();
        let explanation =
            serde_json::to_value(registry.resolve("english", None, id).unwrap()).unwrap();
        assert!(
            !target["guidance"]["target_writing"]
                .as_array()
                .unwrap()
                .is_empty()
        );
        assert!(
            !explanation["guidance"]["explanation_writing"]
                .as_array()
                .unwrap()
                .is_empty()
        );
    }
}
