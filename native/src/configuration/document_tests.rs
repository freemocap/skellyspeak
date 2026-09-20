use super::*;
use serde_json::{Value, json};
fn files() -> BTreeMap<String, String> {
    SEEDS
        .iter()
        .map(|(n, t)| (n.to_string(), t.to_string()))
        .collect()
}
fn edit(files: &mut BTreeMap<String, String>, path: &str, f: impl FnOnce(&mut Value)) {
    let mut value: Value = serde_yaml_ng::from_str(&files[path]).unwrap();
    f(&mut value);
    files.insert(path.into(), serde_yaml_ng::to_string(&value).unwrap());
}
#[test]
fn documents_reject_invalid_fields_references_defaults_and_content() {
    let path = "languages/arabic.yaml";
    let mutations: Vec<fn(&mut Value)> = vec![
        |v| v["extra"] = json!(true),
        |v| v["schema_version"] = json!(99),
        |v| v["defaults"]["orthography"] = json!({"local":"missing"}),
        |v| v["defaults"]["orthography"] = json!({"local":"arabic-unvocalized","shared":"latin"}),
        |v| v["defaults"]["romanization"]["scheme"] = json!({"local":"missing"}),
        |v| v["defaults"]["supported_romanizations"] = json!([]),
        |v| v["defaults"]["scalars"]["font_scale"] = json!(-1),
        |v| v["defaults"]["variety"] = json!("missing"),
        |v| v["guidance"][0]["scope"] = json!("unknown"),
        |v| v["guidance"][0]["sources"] = json!(["missing"]),
        |v| v["definitions"]["romanization_schemes"]["ala-lc-arabic"]["review"] = json!("reviewed"),
        |v| v["conversation"]["default_partner"]["age"] = json!(2),
        |v| v["conversation"]["starters"]["food"]["varieties"] = json!(["missing"]),
        |v| v["learning"]["goal_material"]["missing"] = json!({"tokens":["word"]}),
        |v| {
            v["varieties"][0]["overrides"]["romanization"] =
                json!({"mode":"disabled","scheme":{"local":"ala-lc-arabic"}})
        },
    ];
    for mutation in mutations {
        let mut source = files();
        edit(&mut source, path, mutation);
        assert!(Registry::from_files(source).is_err());
    }
}
#[test]
fn shared_schemes_have_one_owner_and_explicit_references() {
    let mut source = files();
    let mut scheme = Value::Null;
    edit(&mut source, "languages/arabic.yaml", |v| {
        scheme = v["definitions"]["romanization_schemes"]["ala-lc-arabic"].take();
        v["definitions"]["romanization_schemes"] = json!({});
        v["defaults"]["romanization"]["scheme"] = json!({"shared":"ala-lc-arabic"});
        v["defaults"]["supported_romanizations"] = json!([{"shared":"ala-lc-arabic"}]);
    });
    assert!(Registry::from_files(source.clone()).is_err());
    edit(&mut source, "shared/language-foundations.yaml", |v| {
        v["romanization_schemes"]["ala-lc-arabic"] = scheme
    });
    // Moving a scheme from a language to the shared namespace renames its key,
    // and authored romanizations are stored under that key.
    edit(&mut source, "shared/conversation-topics.yaml", |v| {
        for topic in v.as_array_mut().expect("topic list") {
            let romanizations = &mut topic["romanizations"];
            let value = romanizations["arabic:ala-lc-arabic"].take();
            romanizations["shared:ala-lc-arabic"] = value;
        }
    });
    edit(&mut source, "languages/arabic.yaml", |v| {
        let romanizations = &mut v["conversation"]["greeting"]["romanizations"];
        let value = romanizations["arabic:ala-lc-arabic"].take();
        romanizations["shared:ala-lc-arabic"] = value;
    });
    let registry = Registry::from_files(source).unwrap();
    let report = registry
        .inspect_language("arabic", None, "english", None)
        .unwrap();
    assert_eq!(report.schemes[0].id, "shared:ala-lc-arabic");
    assert!(report.schemes[0].source.starts_with("shared/"));
    assert_eq!(report.schemes[0].used_by.len(), 2);
}
#[test]
fn duplicate_yaml_keys_and_duplicate_language_varieties_fail() {
    let mut source = files();
    source
        .get_mut("languages/arabic.yaml")
        .unwrap()
        .push_str("\nschema_version: 1\n");
    assert!(Registry::from_files(source).is_err());
    let mut source = files();
    edit(&mut source, "languages/arabic.yaml", |v| {
        v["varieties"][1]["id"] = v["varieties"][0]["id"].clone()
    });
    assert!(Registry::from_files(source).is_err());
}
#[test]
fn content_hash_is_semantic_and_includes_bibliography() {
    let source = files();
    let baseline = Registry::from_files(source.clone()).unwrap();
    let mut formatted = source.clone();
    edit(&mut formatted, "languages/arabic.yaml", |_| {});
    assert_eq!(
        baseline.hash(),
        Registry::from_files(formatted).unwrap().hash()
    );
    let mut changed = source.clone();
    edit(&mut changed, "languages/arabic.yaml", |v| {
        v["identity"]["name"] = json!("Arabic fixture")
    });
    assert_ne!(
        baseline.hash(),
        Registry::from_files(changed).unwrap().hash()
    );
    let mut changed = source.clone();
    let bib = changed.get_mut("references.bib").unwrap();
    *bib = bib.replace(
        "Reference for MSA constructions",
        "Reference supporting MSA constructions",
    );
    assert_ne!(
        baseline.hash(),
        Registry::from_files(changed).unwrap().hash()
    );
    let mut bad = source;
    let bib = bad.get_mut("references.bib").unwrap();
    *bib = bib.replace("review = {abstract}", "review = {}");
    assert!(Registry::from_files(bad).is_err());
}
#[test]
fn language_without_browser_or_speech_mapping_loads_and_resolves() {
    let mut source = files();
    let mut custom: Value = serde_yaml_ng::from_str(&source["languages/spanish.yaml"]).unwrap();
    custom["identity"]["id"] = json!("test-language");
    custom["integrations"] = json!({});
    source.insert(
        "languages/test-language.yaml".into(),
        serde_yaml_ng::to_string(&custom).unwrap(),
    );
    // A reachable language needs a name for every starter card, because each
    // card is also the translation shown to learners explaining into it.
    edit(&mut source, "shared/conversation-topics.yaml", |v| {
        for topic in v.as_array_mut().expect("topic list") {
            let spanish = topic["labels"]["spanish"].clone();
            topic["labels"]["test-language"] = spanish;
        }
    });
    let registry = Registry::from_files(source).unwrap();
    let context = registry.resolve("test-language", None, "english").unwrap();
    assert!(context.external_tags.is_empty());
    assert!(
        registry
            .language("test-language")
            .unwrap()
            .language_tag
            .is_none()
    );
    assert_eq!(registry.topics().len(), 6);
}
#[test]
fn policy_bounds_and_learner_protections_remain_required() {
    for (field, key, value) in [
        ("estimator", "due_recall", json!(1.0)),
        ("estimator", "learning_rate", json!(-1)),
        ("game", "never_from", json!([])),
        ("feedback", "correct_only", json!("all_errors")),
    ] {
        let mut source = files();
        edit(&mut source, "shared/teaching-policy.yaml", |v| {
            v[field][key] = value
        });
        assert!(Registry::from_files(source).is_err());
    }
}
#[test]
fn browser_reports_effective_values_and_ordered_rule_sources() {
    let registry = Registry::bundled().unwrap();
    for l in &registry.languages {
        for v in &l.varieties {
            let report = registry
                .inspect_language(&l.id, Some(&v.id), "mandarin", None)
                .unwrap();
            assert_eq!(report.fingerprint, registry.hash());
            assert!(report.rules.iter().all(|r| !r.source.is_empty()));
            assert!(
                report
                    .sources
                    .iter()
                    .any(|s| s.path == format!("languages/{}.yaml", l.id))
            );
        }
    }
    let report = registry
        .inspect_language("arabic", None, "english", None)
        .unwrap();
    let scale = report
        .values
        .iter()
        .find(|v| v.field == "font_scale")
        .unwrap();
    assert_eq!(scale.value, "1.5");
    assert!(scale.source.ends_with("defaults.scalars.font_scale"));
}
#[test]
fn fresh_workspace_uses_bundled_content_without_config_directory() {
    let dir = tempfile::tempdir().unwrap();
    let store = crate::storage::store::Store::open(&dir.path().join("workspace.sqlite")).unwrap();
    assert_eq!(store.config.hash(), Registry::bundled().unwrap().hash());
    assert!(!dir.path().join("config").exists());
}

#[test]
fn language_browser_separates_local_content_from_assembled_policy() {
    let registry = Registry::bundled().unwrap();
    let report = registry
        .inspect_language("arabic", None, "english", None)
        .unwrap();
    assert_eq!(report.rules.len(), 1);
    assert_eq!(report.rules[0].source, "languages/arabic.yaml#guidance.0");
    assert!(report.rules[0].text.contains("Arabic learner evidence"));
    let serialized = serde_json::to_value(&report).unwrap();
    assert!(serialized.get("goals").is_none());
    assert!(serialized.get("topics").is_none());
    assert!(report.learning_json.contains("goal_material"));
    let instructions = &report.schemes[0].instructions;
    assert!(
        !report
            .rules
            .iter()
            .any(|rule| rule.text.contains(instructions))
    );
    let resolved: serde_json::Value = serde_json::from_str(&report.resolved_json).unwrap();
    assert!(
        resolved["context"]["guidance"]["assessment"]
            .as_array()
            .unwrap()
            .len()
            > report.rules.len()
    );
    assert!(
        report
            .sources
            .iter()
            .any(|source| source.path == "shared/teaching-policy.yaml")
    );
}
