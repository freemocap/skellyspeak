use super::*;

#[test]
fn bundled_and_disk_language_content_match() {
    let bundled = Registry::bundled().unwrap();
    let disk = Registry::load(&Path::new(env!("CARGO_MANIFEST_DIR")).join("../content")).unwrap();
    assert_eq!(bundled.hash(), disk.hash());
}

#[test]
fn every_target_and_explanation_variety_respects_authored_starter_coverage() {
    let registry = Registry::bundled().unwrap();
    for target in &registry.languages {
        for variety in &target.varieties {
            for explanation in &registry.languages {
                for explanation_variety in &explanation.varieties {
                    let context = registry
                        .resolve_pair(
                            &target.id,
                            Some(&variety.id),
                            &explanation.id,
                            Some(&explanation_variety.id),
                        )
                        .unwrap();
                    let starters = registry
                        .starters(&context, "A1", &[], &[], &[], &[])
                        .unwrap();
                    let expected = if variety.id == "arabic-levantine"
                        || explanation_variety.id == "arabic-levantine"
                    {
                        0
                    } else {
                        3
                    };
                    assert_eq!(
                        starters.len(),
                        expected,
                        "{}/{} -> {}/{}",
                        target.id,
                        variety.id,
                        explanation.id,
                        explanation_variety.id
                    );
                    for selected in starters {
                        assert!(!selected.starter.previews[&target.id].is_empty());
                        assert!(!selected.starter.translations[&explanation.id].is_empty());
                    }
                    let mut settings = registry.defaults(&target.id, &explanation.id).unwrap();
                    settings.variety_id = variety.id.clone();
                    settings.explanation_variety_id = explanation_variety.id.clone();
                    registry.validate_settings(&target.id, &settings).unwrap();
                }
            }
        }
    }
}

#[test]
fn courtesy_retrieval_uses_only_the_target_languages_material() {
    let mut registry = Registry::bundled().unwrap();
    // Isolate optional retrieval: the shipped catalog currently has 44 mandatory
    // goals, exceeding the 25 total budget before any lexical hints are read.
    // Audit records that separate policy defect; do not hide it in this fixture.
    registry.constructs.retain(|goal| goal.id == "courtesy");
    let examples = [
        ("english", "thanks"),
        ("spanish", "gracias"),
        ("french", "merci"),
        ("german", "danke"),
        ("portuguese", "obrigado"),
        ("arabic", "شكرا"),
        ("mandarin", "谢谢"),
        ("hindi", "धन्यवाद"),
        ("malayalam", "നന്ദി"),
    ];
    for (language, local) in examples {
        let ctx = registry.resolve(language, None, "english").unwrap();
        for (_, token) in examples {
            let candidates = registry
                .candidates(&ctx, "A1", &[], &[], &[token.into()])
                .unwrap();
            assert_eq!(
                candidates.iter().any(|c| c.id == "courtesy"),
                token == local,
                "{language}: {token}"
            );
        }
        // Explicit learning focus remains independent of lexical hints.
        assert!(
            registry
                .candidates(&ctx, "A1", &["courtesy".into()], &[], &[])
                .unwrap()
                .iter()
                .any(|c| c.id == "courtesy")
        );
    }
}

#[test]
fn indic_scripts_and_romanization_resolve_in_both_language_roles() {
    let registry = Registry::bundled().unwrap();
    for (language, script, tag) in [
        ("hindi", "devanagari", "hi"),
        ("malayalam", "malayalam", "ml"),
    ] {
        let context = registry.resolve(language, None, "english").unwrap();
        assert_eq!(context.script, script);
        assert_eq!(context.external_tags["transcription"], tag);
        let script = registry.scripts.iter().find(|s| s.id == script).unwrap();
        assert!(script.shaping && script.word_spacing && !script.has_case);
        assert_eq!(script.font_scale, 1.0);
        let projection = registry.language(language).unwrap();
        assert_eq!(projection.language_tag.as_deref(), Some(tag));
        assert!(projection.romanization.is_some());
        let guidance = registry.romanization_guidance(language).unwrap().unwrap();
        assert!(guidance.contains("pronunciation"));
        let target = serde_json::to_string(&context).unwrap();
        let explanation =
            serde_json::to_string(&registry.resolve("english", None, language).unwrap()).unwrap();
        let writing = &registry.documents[language]
            .definitions
            .orthographies
            .values()
            .next()
            .unwrap()
            .guidance[0]
            .text;
        assert!(target.contains(writing));
        assert!(explanation.contains(writing));
    }
}
