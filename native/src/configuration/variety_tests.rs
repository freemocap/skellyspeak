use super::*;

#[test]
fn every_variety_has_shared_policy_and_independent_writing_roles() {
    let registry = Registry::bundled().unwrap();
    for language in &registry.languages {
        for target in &language.varieties {
            assert_ne!(target.description, target.name);
            for explanation in &language.varieties {
                let context = registry
                    .resolve_pair(
                        &language.id,
                        Some(&target.id),
                        &language.id,
                        Some(&explanation.id),
                    )
                    .unwrap();
                for (scope, selected) in [
                    ("target_writing", target),
                    ("explanation_writing", explanation),
                ] {
                    let rules = context.guidance(scope);
                    for shared in registry.universal.iter().filter(|g| g.scope == scope) {
                        assert!(rules.contains(&shared.text), "{}/{scope}", selected.id);
                    }
                    for rule in selected.guidance.iter().filter(|g| g.scope == scope) {
                        assert!(rules.contains(&rule.text), "{}/{scope}", selected.id);
                    }
                    for other in &language.varieties {
                        if other.id == selected.id {
                            continue;
                        }
                        for rule in other.guidance.iter().filter(|g| g.scope == scope) {
                            assert!(
                                !rules.contains(&rule.text),
                                "leaked {} into {scope}",
                                other.id
                            );
                        }
                    }
                }
                assert!(context.guidance("assessment").iter().any(|r| {
                    r.contains("A valid form from another variety is not a learner error")
                }));
            }
        }
    }
}

#[test]
fn selectable_alternatives_reject_missing_writing_coverage() {
    for scope in ["target_writing", "explanation_writing"] {
        let mut registry = Registry::bundled().unwrap();
        let language = registry
            .languages
            .iter_mut()
            .find(|l| l.id == "french")
            .unwrap();
        language.varieties[1].guidance.retain(|g| g.scope != scope);
        let error = registry
            .validate(&registry.source_files["references.bib"])
            .unwrap_err();
        assert_eq!(error.code, "variety_guidance");
        assert_eq!(error.path, "french-canada");
        assert!(error.message.contains(scope));
    }
    let mut registry = Registry::bundled().unwrap();
    let variety = &mut registry.languages[0].varieties[0];
    variety.description = variety.name.clone();
    assert_eq!(
        registry
            .validate(&registry.source_files["references.bib"])
            .unwrap_err()
            .code,
        "variety_description"
    );
}

#[test]
fn arabic_orthography_does_not_own_dialect_grammar() {
    let registry = Registry::bundled().unwrap();
    let language = registry.language_config("arabic").unwrap();
    let orthography = registry
        .orthographies
        .iter()
        .find(|o| o.id == language.orthography)
        .unwrap();
    for rule in &orthography.guidance {
        assert!(rule.text.contains("full vowel marks"));
        assert!(!rule.text.contains("For Levantine"));
        assert!(!rule.text.contains("For Modern Standard Arabic"));
    }
    let levantine = registry
        .resolve("arabic", Some("arabic-levantine"), "english")
        .unwrap();
    let standard = registry
        .resolve("arabic", Some("arabic-modern-standard"), "english")
        .unwrap();
    assert!(
        levantine
            .guidance("target_writing")
            .iter()
            .any(|r| r.contains("without adding Modern Standard Arabic case endings"))
    );
    assert!(
        standard
            .guidance("target_writing")
            .iter()
            .any(|r| r.contains("including appropriate grammatical vocalization"))
    );
}
