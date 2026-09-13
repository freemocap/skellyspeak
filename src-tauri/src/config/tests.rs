use super::*;
#[test]
fn shipped_config_loads_resolves_and_projects() {
    let r = Registry::bundled().unwrap();
    assert_eq!(r.languages.len(), 5);
    assert_eq!(r.constructs().len(), 47);
    let c = r.resolve("ar", Some("ar-MSA"), "zh").unwrap();
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
    assert_ne!(c.hash, r.resolve("ar", None, "en").unwrap().hash);
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
    assert!(r.resolve("ar", Some("zh-CN"), "en").is_err());
    assert!(r.resolve("xx", None, "en").is_err());
}
#[test]
fn local_initialization_never_replaces_existing_data_and_instances_are_independent() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("config");
    let a = initialize(&path).unwrap();
    let file = path.join("languages/languages/en.yaml");
    let source = fs::read_to_string(&file).unwrap();
    fs::write(&file, source.replace("United States", "US custom")).unwrap();
    let b = initialize(&path).unwrap();
    assert_ne!(a.hash(), b.hash());
    assert_eq!(a.language("en").unwrap().varieties[0].name, "United States");
    assert_eq!(b.language("en").unwrap().varieties[0].name, "US custom");
    fs::remove_file(&file).unwrap();
    assert!(initialize(&path).is_err());
}
#[test]
fn malformed_values_references_cycles_and_policy_fail() {
    let files: BTreeMap<_, _> = SEEDS
        .iter()
        .map(|(n, t)| (n.to_string(), t.to_string()))
        .collect();
    for (name, from, to) in [
        (
            "languages/languages/ar.yaml",
            "abjad-vowel-omission",
            "missing-trait",
        ),
        ("languages/universal.yaml", "assessment", "unknown_scope"),
        (
            "policy/feedback.yaml",
            "focus_and_meaning_blocking",
            "all_errors",
        ),
        (
            "languages/traits.yaml",
            "requires: []",
            "requires: [abjad-vowel-omission]",
        ),
        ("constructs/core.yaml", "cefr2020", "missing-citation"),
        (
            "languages/scripts.yaml",
            "font_scale: 1.0",
            "font_scale: -1",
        ),
    ] {
        let mut bad = files.clone();
        let value = bad.get_mut(name).unwrap();
        assert!(value.contains(from));
        *value = value.replace(from, to);
        assert!(Registry::from_files(bad).is_err(), "{name} accepted {to}");
    }
}
#[test]
fn candidates_preserve_required_members_and_starters_have_real_reasons() {
    let r = Registry::bundled().unwrap();
    let ctx = r.resolve("es", None, "en").unwrap();
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
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../schemas");
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
            .join("../schemas")
            .join(name);
        let actual: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(actual, value, "{}", path.display());
    }
}

#[test]
fn citation_content_changes_provenance_and_bad_bibliography_blocks_loading() {
    let files: BTreeMap<_, _> = SEEDS
        .iter()
        .map(|(n, t)| (n.to_string(), t.to_string()))
        .collect();
    let a = Registry::from_files(files.clone()).unwrap();
    let mut changed = files.clone();
    let bib = changed.get_mut("references.bib").unwrap();
    *bib = bib.replace(
        "Reference for MSA constructions",
        "Reference supporting MSA constructions",
    );
    assert_ne!(a.hash(), Registry::from_files(changed).unwrap().hash());
    let mut bad = files.clone();
    let bib = bad.get_mut("references.bib").unwrap();
    *bib = bib.replace("review = {abstract}", "review = {}");
    assert!(Registry::from_files(bad).is_err());
    let mut bad = files;
    let text = bad.get_mut("languages/romanizations.yaml").unwrap();
    *text = text.replace("needs_review", "reviewed");
    assert!(Registry::from_files(bad).is_err());
}
#[test]
fn duplicate_yaml_keys_are_not_overwritten() {
    let mut files: BTreeMap<_, _> = SEEDS
        .iter()
        .map(|(n, t)| (n.to_string(), t.to_string()))
        .collect();
    let text = files.get_mut("starters/reasons.yaml").unwrap();
    *text = text.replace(
        "  en: \"From your focus\"",
        "  en: \"From your focus\"\n  en: \"Hidden duplicate\"",
    );
    assert!(Registry::from_files(files).is_err());
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
    let ar = r.languages.iter_mut().find(|l| l.id == "ar").unwrap();
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
    let ctx = r.resolve("ar", None, "en").unwrap();
    let notes = ctx.guidance("assessment");
    assert!(notes[0].contains("Copy evidence"));
    assert!(notes[1].contains("never add diacritics"));
    assert_eq!(&notes[2..], &["Language rule", "Variety rule"]);
    assert_eq!(ctx.font_scale, 1.8);
    assert_eq!(r.language("ar").unwrap().font_scale, 1.8);
}
#[test]
fn optional_form_candidates_respect_language_band_and_prerequisites() {
    let r = Registry::bundled().unwrap();
    let ar = r.resolve("ar", None, "en").unwrap();
    let es = r.resolve("es", None, "en").unwrap();
    // The required set already exceeds the optional budget. Requested focus must
    // still carry its actual form and prerequisite, regardless of that soft cap.
    let selected = r
        .candidates(&ar, "C2", &["ar.idafa".into()], &[], &[])
        .unwrap();
    assert!(selected.iter().any(|c| c.id == "ar.idafa"));
    assert!(selected.iter().any(|c| c.id == "possession"));
    assert!(
        r.candidates(&es, "A2", &["ar.idafa".into()], &[], &[])
            .is_err()
    );
    let mut small = r.clone();
    small
        .constructs
        .retain(|c| ["ar.idafa", "possession"].contains(&c.id.as_str()));
    assert!(
        small
            .candidates(&ar, "A1", &[], &[], &[])
            .unwrap()
            .iter()
            .any(|c| c.id == "ar.idafa")
    );
    assert!(
        !small
            .candidates(&ar, "C2", &[], &[], &[])
            .unwrap()
            .iter()
            .any(|c| c.id == "ar.idafa")
    );
}
#[test]
fn captured_custom_language_context_reaches_gloss_prompt_and_decoder() {
    use crate::linguistics::{ANALYSIS_VERSION, SourceIdentity, adapter};
    let mut r = Registry::bundled().unwrap();
    let mut custom = r.languages.iter().find(|l| l.id == "es").unwrap().clone();
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
    let ctx = r.resolve("custom", None, "en").unwrap();
    let id = SourceIdentity {
        message_id: "fixture".into(),
        target_language_id: "custom".into(),
        explanation_language_id: "en".into(),
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
    let other = r.resolve("es", None, "en").unwrap();
    assert!(adapter::build_word_gloss_prompt_with_context(&id, "Hola", &other).is_err());
}

#[test]
fn contact_starter_tags_normalize_case_and_whitespace_but_require_exact_meaning_label() {
    let registry = Registry::bundled().unwrap();
    let context = registry.resolve("en", None, "en").unwrap();
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
fn estimator_policy_rejects_invalid_bounds_and_changes_hash() {
    let files: BTreeMap<_, _> = SEEDS
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();
    let baseline = Registry::from_files(files.clone()).unwrap();
    for (from, to) in [
        ("learning_rate: 0.4", "learning_rate: .nan"),
        ("due_recall: 0.7", "due_recall: 1.0"),
        ("explicit: 0.1", "explicit: 2.0"),
    ] {
        let mut bad = files.clone();
        let text = bad.get_mut("policy/estimator.yaml").unwrap();
        *text = text.replace(from, to);
        assert!(Registry::from_files(bad).is_err());
    }
    let mut changed = files;
    let text = changed.get_mut("policy/estimator.yaml").unwrap();
    *text = text.replace("learning_rate: 0.4", "learning_rate: 0.3");
    assert_ne!(
        baseline.estimator_hash(),
        Registry::from_files(changed).unwrap().estimator_hash()
    );
}

#[test]
fn game_enforces_evidence_truth_and_no_stopping_penalty() {
    let files: BTreeMap<_, _> = SEEDS
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();
    for (from, to) in [
        ("never_punish_stopping", "streak_penalty"),
        ("demonstrated: 10", "login: 10"),
        ("explicit: 0.3", "explicit: -1.0"),
        ("repair: 2", "repair: 9"),
    ] {
        let mut bad = files.clone();
        let policy = bad.get_mut("policy/game.yaml").unwrap();
        *policy = policy.replace(from, to);
        assert!(Registry::from_files(bad).is_err());
    }
}
