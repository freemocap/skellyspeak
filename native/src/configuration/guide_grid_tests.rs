use super::Registry;

/// Product authoring scope: these seven target and explanation languages form
/// a complete grid. Other explanation combinations remain optional.
#[test]
fn primary_language_grid_has_authored_guides_for_every_selected_variety() {
    let registry = Registry::bundled().unwrap();
    let languages = [
        "english",
        "spanish",
        "french",
        "arabic",
        "mandarin",
        "cantonese",
        "portuguese",
    ];
    let mut editions = 0;
    for target in languages {
        let language = registry
            .languages
            .iter()
            .find(|language| language.id == target)
            .unwrap();
        for explanation in languages {
            for skill in &registry.shared_skills().skills {
                let edition = registry
                    .guide_edition(target, explanation, &skill.id)
                    .unwrap()
                    .unwrap_or_else(|| {
                        panic!(
                            "Missing authored guide: {target}/{explanation}/{}",
                            skill.id
                        )
                    });
                let source = registry.guide_source(target, &skill.id).unwrap();
                let stem = skill.id.replace('_', "-");
                let path = format!(
                    "languages/{target}/skills/{stem}/{target}-{stem}-explained-in-{explanation}.yaml"
                );
                let guide = &registry.authored.guides[&path];
                let shared = &registry.authored.explanations[&guide.shared_explanation];
                assert_eq!(guide.language, target, "{path}");
                assert_eq!(guide.explanation_language, explanation, "{path}");
                assert_eq!(shared.explanation_language, explanation, "{path}");
                for variety in &language.varieties {
                    let translated = guide.sections_for(&variety.id);
                    let original = source.guide.sections_for(&variety.id);
                    assert_eq!(translated.len(), original.len(), "{path}/{}", variety.id);
                    let markdown = edition.markdown(&variety.id);
                    assert!(markdown.starts_with(&format!("# {}", shared.title)));
                    for (translated, original) in translated.iter().zip(original) {
                        assert_eq!(translated.subskill_id, original.subskill_id, "{path}");
                        assert_eq!(translated.examples.len(), original.examples.len(), "{path}");
                        assert!(!translated.explanation.trim().is_empty(), "{path}");
                        assert!(markdown.contains(&translated.explanation), "{path}");
                        for (translated, original) in
                            translated.examples.iter().zip(&original.examples)
                        {
                            assert_eq!(translated.text, original.text, "{path}");
                            assert!(!translated.meaning.trim().is_empty(), "{path}");
                            assert!(!translated.note.trim().is_empty(), "{path}");
                            assert!(markdown.contains(&translated.text), "{path}");
                        }
                    }
                }
                editions += 1;
            }
        }
    }
    assert_eq!(editions, 49 * 8);
}
