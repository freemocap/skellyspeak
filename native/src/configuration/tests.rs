use super::*;
#[test]
fn script_scale_defaults_to_standard_and_language_overrides_remain_effective() {
    let mut r = Registry::bundled().unwrap();
    assert!(r.scripts.iter().all(|script| script.font_scale == 1.0));
    assert_eq!(r.language("english").unwrap().font_scale, 1.0);
    assert_eq!(r.language("arabic").unwrap().font_scale, 1.5);
    assert_eq!(r.language("mandarin").unwrap().font_scale, 1.3);
    let ar = r
        .languages
        .iter_mut()
        .find(|language| language.id == "arabic")
        .unwrap();
    ar.scalars.font_scale = None;
    assert_eq!(r.language("arabic").unwrap().font_scale, 1.0);
}

#[test]
fn shipped_config_loads_resolves_and_projects() {
    let r = Registry::bundled().unwrap();
    assert!(!r.languages.is_empty());
    assert_eq!(r.constructs().len(), 47);
    let c = r
        .resolve("arabic", Some("arabic-modern-standard"), "mandarin")
        .unwrap();
    assert!(
        c.guidance("assessment")
            .join(" ")
            .contains("never add diacritics")
    );
    assert!(
        c.guidance("explanation_writing")
            .join(" ")
            .contains("Simplified Chinese")
    );
    assert!(
        c.guidance("romanization")
            .join(" ")
            .contains("ALA-LC Arabic")
    );
    assert_eq!(c.hash.len(), 64);
    assert_ne!(c.hash, r.resolve("arabic", None, "english").unwrap().hash);
    assert_eq!(r.catalog().as_array().unwrap().len(), 54);
    assert_eq!(
        r.catalog()
            .as_array()
            .unwrap()
            .iter()
            .find(|n| n["id"] == "greeting")
            .unwrap()["criterion"],
        r.construct("greeting").unwrap().criterion
    );
    assert!(
        r.resolve("arabic", Some("mandarin-mainland-china"), "english")
            .is_err()
    );
    assert!(r.resolve("xx", None, "english").is_err());
}
#[test]
fn candidates_preserve_required_members_and_starters_have_real_reasons() {
    let r = Registry::bundled().unwrap();
    let ctx = r.resolve("spanish", None, "english").unwrap();
    let candidates = r
        .candidates(&ctx, "A1", &["nested_reference".into()], &[], &[])
        .unwrap();
    assert!(candidates.iter().any(|c| c.id == "nested_reference"));
    assert!(candidates.iter().any(|c| c.id == "ix.self_repair"));
    // Most migrated criteria are functional; mandatory coverage legitimately exceeds25.
    assert!(candidates.len() > 25);
    let cards = r
        .starters(
            &ctx,
            "PreA1",
            &["future_reference".into()],
            &[],
            &["music".into()],
            &[],
        )
        .unwrap();
    assert_eq!(cards[0].starter.id, "weekend");
    assert_eq!(cards[0].reason, "From your focus");
    assert_eq!(cards[1].starter.id, "music");
    assert_eq!(cards[1].reason, "From your contact’s interests");
    let recent: Vec<_> = cards.iter().map(|c| c.starter.id.clone()).collect();
    assert!(
        r.starters(&ctx, "PreA1", &[], &[], &[], &recent)
            .unwrap()
            .iter()
            .all(|c| !recent.contains(&c.starter.id))
    );
    assert!(r.starters(&ctx, "bogus", &[], &[], &[], &[]).is_err());
}
#[test]
fn export_schemas() {
    let schemas = super::schemas();
    if std::env::var_os("SKELLY_WRITE_CONFIG_SCHEMAS").is_some() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../content/schemas");
        for (name, value) in &schemas {
            fs::write(
                root.join(name),
                format!("{}\n", serde_json::to_string_pretty(value).unwrap()),
            )
            .unwrap();
        }
    }
    for (name, value) in schemas {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../content/schemas")
            .join(name);
        let actual: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(actual, value, "{}", path.display());
    }
}

#[test]
fn scoped_resolution_orders_traits_and_honors_leaf_scalar_overrides() {
    let mut r = Registry::bundled().unwrap();
    let t = r
        .traits
        .iter_mut()
        .find(|t| t.id == "abjad-vowel-omission")
        .unwrap();
    t.scalars.font_scale = Some(1.6);
    let ar = r.languages.iter_mut().find(|l| l.id == "arabic").unwrap();
    ar.scalars.font_scale = Some(1.7);
    ar.varieties[0].scalars.font_scale = Some(1.8);
    ar.guidance.push(Guidance {
        scope: "assessment".into(),
        text: "Language rule".into(),
        sources: vec!["ryding2005".into()],
    });
    ar.varieties[0].guidance.push(Guidance {
        scope: "assessment".into(),
        text: "Variety rule".into(),
        sources: vec!["ryding2005".into()],
    });
    let ctx = r.resolve("arabic", None, "english").unwrap();
    let notes = ctx.guidance("assessment");
    assert!(notes[2].contains("Copy evidence"));
    assert!(notes[3].contains("never add diacritics"));
    assert_eq!(&notes[4..], &["Language rule", "Variety rule"]);
    assert_eq!(ctx.font_scale, 1.8);
    assert_eq!(r.language("arabic").unwrap().font_scale, 1.8);
}
#[test]
fn optional_form_candidates_respect_language_band_and_prerequisites() {
    let r = Registry::bundled().unwrap();
    let ar = r.resolve("arabic", None, "english").unwrap();
    let es = r.resolve("spanish", None, "english").unwrap();
    // The required set already exceeds the optional budget. Requested focus must
    // still carry its actual form and prerequisite, regardless of that soft cap.
    let selected = r
        .candidates(&ar, "C2", &["arabic.idafa".into()], &[], &[])
        .unwrap();
    assert!(selected.iter().any(|c| c.id == "arabic.idafa"));
    assert!(selected.iter().any(|c| c.id == "possession"));
    assert!(
        r.candidates(&es, "A2", &["arabic.idafa".into()], &[], &[])
            .is_err()
    );
    let mut small = r.clone();
    small
        .constructs
        .retain(|c| ["arabic.idafa", "possession"].contains(&c.id.as_str()));
    assert!(
        small
            .candidates(&ar, "A1", &[], &[], &[])
            .unwrap()
            .iter()
            .any(|c| c.id == "arabic.idafa")
    );
    assert!(
        !small
            .candidates(&ar, "C2", &[], &[], &[])
            .unwrap()
            .iter()
            .any(|c| c.id == "arabic.idafa")
    );
}
#[test]
fn captured_custom_language_context_reaches_gloss_prompt_and_decoder() {
    use crate::language::linguistics::ANALYSIS_VERSION;
    use crate::language::linguistics::SourceIdentity;
    use crate::language::linguistics::adapter;
    let mut r = Registry::bundled().unwrap();
    let mut custom = r
        .languages
        .iter()
        .find(|l| l.id == "spanish")
        .unwrap()
        .clone();
    custom.id = "custom".into();
    custom.default_variety = "custom-1".into();
    custom.varieties[0].id = "custom-1".into();
    custom.varieties.truncate(1);
    custom.guidance.push(Guidance {
        scope: "segmentation".into(),
        text: "Custom segmentation rule".into(),
        sources: vec!["ud".into()],
    });
    r.languages.push(custom);
    let ctx = r.resolve("custom", None, "english").unwrap();
    let id = SourceIdentity {
        message_id: "fixture".into(),
        target_language_id: "custom".into(),
        explanation_language_id: "english".into(),
        analysis_version: ANALYSIS_VERSION.into(),
    };
    let prompt = adapter::build_word_gloss_prompt_with_context(&id, "Hola", &ctx).unwrap();
    assert!(
        prompt.messages[0]
            .content
            .contains("Custom segmentation rule")
    );
    adapter::decode_word_gloss_with_context(&id, "Hola", r#"{"spans":[]}"#, &ctx).unwrap();
    assert!(adapter::build_word_gloss_prompt(&id, "Hola").is_err());
    let other = r.resolve("spanish", None, "english").unwrap();
    assert!(adapter::build_word_gloss_prompt_with_context(&id, "Hola", &other).is_err());
}

#[test]
fn contact_starter_tags_normalize_case_and_whitespace_but_require_exact_meaning_label() {
    let registry = Registry::bundled().unwrap();
    let context = registry.resolve("english", None, "english").unwrap();
    let cards = registry
        .starters(&context, "A1", &[], &[], &[" Music ".into()], &[])
        .unwrap();
    assert_eq!(cards[0].starter.id, "music");
    assert_eq!(cards[0].reason, "From your contact’s interests");
    let cards = registry
        .starters(&context, "A1", &[], &[], &[" Music criticism ".into()], &[])
        .unwrap();
    assert!(
        cards
            .iter()
            .all(|card| card.reason != "From your contact’s interests")
    );
}

#[test]
fn every_configured_pair_resolves_and_starters_respect_explicit_coverage() {
    let registry = Registry::bundled().unwrap();
    for target in &registry.languages {
        let persona = registry.starter_persona(&target.id).unwrap();
        crate::partners::persona::validate_for_language(
            &persona,
            &registry.language(&target.id).unwrap(),
        )
        .unwrap();
        for explanation in &registry.languages {
            let settings = registry.defaults(&target.id, &explanation.id).unwrap();
            registry.validate_settings(&target.id, &settings).unwrap();
            let context = registry.resolve(&target.id, None, &explanation.id).unwrap();
            assert_eq!(context.language_id, target.id);
            assert_eq!(context.explanation_language_id, explanation.id);
            let compatible = registry.starter_config.iter().any(|starter| {
                starter
                    .compatible_varieties
                    .get(&target.id)
                    .is_some_and(|ids| ids.contains(&context.variety_id))
                    && starter
                        .compatible_varieties
                        .get(&explanation.id)
                        .is_some_and(|ids| ids.contains(&context.explanation_variety_id))
            });
            let cards = registry.starters(&context, "A1", &[], &[], &[], &[]);
            if compatible {
                assert!(!cards.unwrap().is_empty());
            } else {
                assert!(cards.unwrap().is_empty());
            }
        }
    }
}

#[test]
fn varieties_resolve_independently_with_script_overrides_and_owned_defaults() {
    let mut registry = Registry::bundled().unwrap();
    let en = registry
        .languages
        .iter_mut()
        .find(|l| l.id == "english")
        .unwrap();
    for (variety, marker) in en.varieties.iter_mut().zip(["US fixture", "UK fixture"]) {
        for scope in ["target_writing", "explanation_writing"] {
            variety.guidance.push(Guidance {
                scope: scope.into(),
                text: marker.into(),
                sources: vec!["ryding2005".into()],
            });
        }
    }
    let context = registry
        .resolve_pair(
            "english",
            Some("english-united-kingdom"),
            "english",
            Some("english-united-states"),
        )
        .unwrap();
    assert!(
        context
            .guidance("target_writing")
            .contains(&"UK fixture".into())
    );
    assert!(
        !context
            .guidance("target_writing")
            .contains(&"US fixture".into())
    );
    assert!(
        context
            .guidance("explanation_writing")
            .contains(&"US fixture".into())
    );
    let reverse = registry
        .resolve_pair(
            "english",
            Some("english-united-states"),
            "english",
            Some("english-united-kingdom"),
        )
        .unwrap();
    assert_ne!(context.hash, reverse.hash);
    assert!(
        registry
            .resolve_pair("english", None, "english", Some("french-france"))
            .is_err()
    );
    let en = registry
        .languages
        .iter_mut()
        .find(|l| l.id == "english")
        .unwrap();
    en.varieties[1].script = Some("arabic".into());
    en.varieties[1].orthography = Some("arabic:arabic-unvocalized".into());
    en.varieties[1].romanization = Some("arabic:ala-lc-arabic".into());
    let overridden = registry
        .resolve_pair(
            "english",
            Some("english-united-kingdom"),
            "english",
            Some("english-united-states"),
        )
        .unwrap();
    assert_eq!(overridden.direction, "rtl");
    assert_eq!(overridden.script, "arabic");
    assert!(
        overridden
            .guidance("romanization")
            .join(" ")
            .contains("ALA-LC")
    );
    assert_eq!(context.direction, "ltr"); // Captured context is independent of later config edits.
    let en = registry
        .languages
        .iter_mut()
        .find(|l| l.id == "english")
        .unwrap();
    en.varieties[1].romanization = None;
    en.varieties[1].romanization_disabled = true;
    assert!(
        registry.language("english").unwrap().varieties[1]
            .romanization
            .is_none()
    );
    assert!(
        !registry
            .resolve("english", Some("english-united-kingdom"), "english")
            .unwrap()
            .guidance("romanization")
            .join(" ")
            .contains("ALA-LC")
    );
}
