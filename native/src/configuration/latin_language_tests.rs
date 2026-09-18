use super::*;

#[test]
fn new_latin_languages_keep_identity_writing_and_provider_mapping_separate() {
    let registry = Registry::bundled().unwrap();
    for (id, name, native, tag, transcription) in [
        ("italian", "Italian", "Italiano", "it", Some("it")),
        ("irish", "Irish", "Gaeilge", "ga", None),
        ("scottish-gaelic", "Scottish Gaelic", "Gàidhlig", "gd", None),
    ] {
        let language = registry.language(id).unwrap();
        assert_eq!(language.name, name);
        assert_eq!(language.native_name, native);
        assert_eq!(language.language_tag.as_deref(), Some(tag));
        assert_eq!(language.transcription_language.as_deref(), transcription);
        assert_eq!(
            language.varieties[0].transcription_language.as_deref(),
            transcription
        );
        assert!(language.romanization.is_none());
        let context = registry.resolve(id, None, "english").unwrap();
        assert_eq!(context.script, "latin");
        assert_eq!(context.font_scale, 1.0);
        // [@whisper_language_tokens] Language identity is not a speech capability.
        assert_eq!(
            context
                .external_tags
                .get("transcription")
                .map(String::as_str),
            transcription
        );
        assert!(registry.romanization_guidance(id).unwrap().is_none());
        let explanation = registry.resolve("english", None, id).unwrap();
        let doc = &registry.documents[id];
        let writing = &doc
            .definitions
            .orthographies
            .values()
            .next()
            .unwrap()
            .guidance;
        let target_json = serde_json::to_value(&context).unwrap();
        let explanation_json = serde_json::to_value(&explanation).unwrap();
        assert!(
            target_json["guidance"]["target_writing"]
                .as_array()
                .unwrap()
                .iter()
                .any(|v| v.as_str() == Some(&writing[0].text))
        );
        assert!(
            explanation_json["guidance"]["explanation_writing"]
                .as_array()
                .unwrap()
                .iter()
                .any(|v| v.as_str() == Some(&writing[1].text))
        );
        assert!(
            !target_json["guidance"]["explanation_writing"]
                .to_string()
                .contains(&writing[0].text)
        );
        assert_eq!(registry.topics().len(), 6);
        let partner = registry.starter_persona(id).unwrap();
        assert!(partner.romanized_name.is_none());
    }
}

#[test]
fn gaelic_courtesy_phrases_reach_production_candidates_without_false_fragments() {
    let registry = Registry::bundled().unwrap();
    for (id, phrase, fragment) in [
        ("irish", "Go raibh maith agaibh!", "maith"),
        ("scottish-gaelic", "Tapadh leibh!", "leibh"),
    ] {
        let context = registry.resolve(id, None, "english").unwrap();
        let fragments = phrase
            .split_whitespace()
            .map(str::to_owned)
            .collect::<Vec<_>>();
        let candidates = registry
            .candidates(&context, "A1", &[], &[], &fragments)
            .unwrap();
        assert!(candidates.len() > 25);
        assert!(candidates.iter().any(|c| c.id == "courtesy"));
        assert!(
            !registry
                .candidates(&context, "A1", &[], &[], &[fragment.into()])
                .unwrap()
                .iter()
                .any(|c| c.id == "courtesy")
        );
    }
}

#[test]
fn optional_allowance_is_bounded_and_does_not_remove_required_goals() {
    let mut registry = Registry::bundled().unwrap();
    let context = registry.resolve("italian", None, "english").unwrap();
    let required = registry.candidates(&context, "A1", &[], &[], &[]).unwrap();
    let template = registry.construct("courtesy").unwrap().clone();
    for index in 0..30 {
        let mut goal = template.clone();
        goal.id = format!("fixture-{index}");
        goal.tokens = vec!["matching phrase".into()];
        registry.constructs.push(goal);
    }
    let candidates = registry
        .candidates(
            &context,
            "A1",
            &[],
            &[],
            &["matching".into(), "phrase".into()],
        )
        .unwrap();
    assert_eq!(candidates.len(), required.len() + 25);
    for goal in required {
        assert!(candidates.iter().any(|candidate| candidate.id == goal.id));
    }
}
