use super::*;
#[test]
fn conversation_opening_situations_require_variety_and_content() {
    let bib = SEEDS
        .iter()
        .find(|(name, _)| *name == "references.bib")
        .unwrap()
        .1;
    let mut r = Registry::bundled().unwrap();
    assert!(r.validate(bib).is_ok());
    r.conversation_prompt.opening_angles = vec!["situation".into(); 3];
    assert!(r.validate(bib).is_err());
    let mut r = Registry::bundled().unwrap();
    r.conversation_prompt.opening_angles = vec![" ".into(); 4];
    assert!(r.validate(bib).is_err());
}

#[test]
fn conversation_examples_require_known_varieties_and_nonempty_content() {
    let bib = SEEDS
        .iter()
        .find(|(name, _)| *name == "references.bib")
        .unwrap()
        .1;
    let mut r = Registry::bundled().unwrap();
    r.conversation_prompt
        .examples
        .insert("unknown-variety".into(), "Example".into());
    assert!(r.validate(bib).is_err());
    r.conversation_prompt.examples.remove("unknown-variety");
    r.conversation_prompt
        .examples
        .insert("spanish-spain".into(), "  ".into());
    assert!(r.validate(bib).is_err());
    r.conversation_prompt.examples.clear();
    assert!(
        r.validate(bib).is_ok(),
        "Examples are opt-in, not a cross-variety fallback"
    );
    r.conversation_prompt.interaction.clear();
    assert!(r.validate(bib).is_err());
}

#[test]
fn script_scale_defaults_to_standard_and_language_overrides_remain_effective() {
    let mut r = Registry::bundled().unwrap();
    assert!(r.scripts.iter().all(|script| script.font_scale == 1.0));
    assert_eq!(r.language("english").unwrap().font_scale, 1.0);
    assert_eq!(r.language("arabic").unwrap().font_scale, 1.0);
    assert_eq!(r.language("mandarin").unwrap().font_scale, 1.3);
    let ar = r
        .languages
        .iter_mut()
        .find(|language| language.id == "arabic")
        .unwrap();
    ar.scalars.font_scale = Some(1.8);
    assert_eq!(r.language("arabic").unwrap().font_scale, 1.8);
    r.languages
        .iter_mut()
        .find(|language| language.id == "arabic")
        .unwrap()
        .scalars
        .font_scale = None;
    assert_eq!(r.language("arabic").unwrap().font_scale, 1.0);
}

#[test]
fn shipped_config_loads_resolves_and_projects() {
    let r = Registry::bundled().unwrap();
    assert!(!r.languages.is_empty());
    assert_eq!(r.shared_skills().skills.len(), 8);
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
    assert_eq!(r.catalog().as_array().unwrap().len(), 9);
    assert_eq!(
        r.catalog()
            .as_array()
            .unwrap()
            .iter()
            .find(|n| n["id"] == "managing_conversation")
            .unwrap()["criterion"],
        r.skill_definition("managing_conversation")
            .unwrap()
            .boundary
    );
    assert!(
        r.resolve("arabic", Some("mandarin-mainland-china"), "english")
            .is_err()
    );
    assert!(r.resolve("xx", None, "english").is_err());
}
#[test]
fn export_schemas() {
    let schemas = super::schemas();
    if std::env::var_os("SKELLY_WRITE_CONFIG_SCHEMAS").is_some() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../content/rust-schemas");
        for (name, value) in &schemas {
            fs::write(root.join(name), serde_yaml_ng::to_string(value).unwrap()).unwrap();
        }
    }
    for (name, value) in schemas {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../content/rust-schemas")
            .join(name);
        let actual: serde_json::Value =
            serde_yaml_ng::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
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
    assert!(notes[3].contains("A valid form from another variety"));
    assert!(notes[4].contains("never add diacritics"));
    assert_eq!(&notes[5..], &["Language rule", "Variety rule"]);
    assert_eq!(ctx.font_scale, 1.8);
    assert_eq!(r.language("arabic").unwrap().font_scale, 1.8);
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
fn every_configured_pair_resolves_with_shared_topics() {
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
            assert_eq!(registry.topics().len(), 6);
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
    en.varieties[1].orthography = Some("arabic:arabic-vocalized".into());
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
