use super::*;

#[test]
fn added_languages_resolve_through_the_standard_registry() {
    let registry = Registry::bundled().unwrap();
    for (id, tag, script, romanized) in [
        ("korean", "ko", "hangul", true),
        ("japanese", "ja", "japanese", true),
        ("vietnamese", "vi", "latin", false),
        ("indonesian", "id", "latin", false),
        ("turkish", "tr", "latin", false),
        ("russian", "ru", "cyrillic", true),
        ("ukrainian", "uk", "cyrillic", true),
        ("cherokee", "chr", "cherokee", true),
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

#[test]
fn courtesy_hints_preserve_unicode_and_language_specific_case() {
    use unicode_normalization::UnicodeNormalization;
    let registry = Registry::bundled().unwrap();
    for (id, phrase) in [
        ("korean", "감사합니다"),
        ("japanese", "ありがとうございます"),
        ("vietnamese", "CẢM ƠN"),
        ("indonesian", "TERIMA KASIH"),
        ("turkish", "TEŞEKKÜR EDERİM"),
        ("russian", "СПАСИБО"),
        ("ukrainian", "ДЯКУЮ"),
        ("cherokee", "ᏩᏙ"),
    ] {
        let context = registry.resolve(id, None, "english").unwrap();
        for spelling in [
            phrase.to_owned(),
            phrase.nfd().collect(),
            if id == "turkish" {
                "teşekkür ederim".to_owned()
            } else {
                phrase.to_lowercase()
            },
        ] {
            let candidates = registry
                .candidates(&context, "A1", &[], &[], std::slice::from_ref(&spelling))
                .unwrap();
            assert!(
                candidates.iter().any(|c| c.id == "courtesy"),
                "{id}: {spelling}"
            );
        }
    }
}
