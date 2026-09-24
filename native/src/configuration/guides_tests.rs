use super::*;
use serde_json::{Value, json};

// Synthetic contract fixtures, not learner-facing linguistic content.
fn files() -> BTreeMap<String, String> {
    let mut files: BTreeMap<_, _> = SEEDS
        .iter()
        .map(|(n, t)| (n.to_string(), t.to_string()))
        .collect();
    let variant = |variety: &str| {
        json!({
            "variety": variety, "summary": format!("Realization for {variety}"),
            "sections": [{"title": "Realization", "text": "Synthetic variety-specific teaching material."}],
            "examples": [{"text": "é e\u{301} العربية कि", "meaning": "Synthetic Unicode fixture", "note": "Preserve source."}],
            "guidance": format!("Synthetic assessment criteria for {variety}"),
            "sources": ["unicode17_arabic"], "review": "needs_review", "origin": "ai", "authorship": "Test fixture"
        })
    };
    let guide = json!({
        "id": "arabic-question", "target": {"kind": "skill", "language": "arabic", "skill": "question"},
        "explanation_language": "english", "title": "Questions", "summary": "Language-wide core",
        "sections": [{"title": "Shared capability", "text": "Synthetic shared teaching material."}],
        "examples": [], "guidance": "Synthetic shared assessment criteria", "shared_guides": [],
        "variants": [variant("arabic-levantine"), variant("arabic-modern-standard")],
        "sources": ["unicode17_arabic"], "review": "needs_review", "origin": "ai", "authorship": "Test fixture"
    });
    files.insert(
        "guides/test.yaml".into(),
        serde_yaml_ng::to_string(&json!({"schema_version": 1, "guides": [guide]})).unwrap(),
    );
    files
}
fn change(files: &mut BTreeMap<String, String>, update: impl FnOnce(&mut Value)) {
    let path = "guides/test.yaml";
    let mut doc: Value = serde_yaml_ng::from_str(&files[path]).unwrap();
    update(&mut doc);
    files.insert(path.into(), serde_yaml_ng::to_string(&doc).unwrap());
}

#[test]
fn varieties_share_one_core_with_explicit_connected_realizations() {
    let r = Registry::from_files(files()).unwrap();
    let levantine = r
        .inspect_language("arabic", Some("arabic-levantine"), "mandarin", None)
        .unwrap();
    let standard = r
        .inspect_language("arabic", Some("arabic-modern-standard"), "english", None)
        .unwrap();
    let l = &levantine.guides[0];
    let s = &standard.guides[0];
    assert_eq!(l.guide.id, s.guide.id);
    assert_eq!(l.fingerprint, s.fingerprint);
    assert_eq!(l.guide.summary, s.guide.summary);
    assert_eq!(l.guide.variants.len(), 2);
    assert_eq!(l.selected_variety.as_deref(), Some("arabic-levantine"));
    assert_eq!(
        s.selected_variety.as_deref(),
        Some("arabic-modern-standard")
    );
    let selected = |g: &guides::GuideInspection| {
        g.guide
            .variants
            .iter()
            .find(|v| Some(&v.variety) == g.selected_variety.as_ref())
            .unwrap()
            .guidance
            .clone()
    };
    assert_ne!(selected(l), selected(s));
    assert_eq!(l.guide.explanation_language, "english");
    assert_eq!(l.explanation_name, "English");
    assert!(
        levantine
            .sources
            .iter()
            .any(|source| l.source.starts_with(&format!("{}#", source.path)))
    );
    assert_eq!(
        r.inspect_guides("arabic", None).unwrap()[0]
            .selected_variety
            .as_deref(),
        Some("arabic-levantine")
    );
    assert!(r.inspect_guides("arabic", Some("spanish-spain")).is_err());
    assert!(r.inspect_guides("spanish", None).unwrap().is_empty());
}

#[test]
fn missing_foreign_duplicate_and_empty_variety_material_fail_explicitly() {
    let cases: Vec<fn(&mut Value)> = vec![
        |d| {
            d["guides"][0]["variants"].as_array_mut().unwrap().pop();
        },
        |d| d["guides"][0]["variants"][0]["variety"] = json!("spanish-spain"),
        |d| d["guides"][0]["variants"][0]["variety"] = json!("arabic-modern-standard"),
        |d| d["guides"][0]["variants"][0]["guidance"] = json!(" "),
        |d| d["guides"][0]["variants"][0]["examples"] = json!([]),
        |d| d["guides"][0]["variants"][0]["sources"] = json!(["missing"]),
        |d| d["guides"][0]["target"]["varieties"] = json!(["arabic-modern-standard"]),
        |d| d["schema_version"] = json!(2),
        |d| d["guides"][0]["target"]["language"] = json!("missing"),
        |d| d["guides"][0]["target"]["skill"] = json!("missing"),
        |d| d["guides"][0]["shared_guides"] = json!(["missing"]),
        |d| d["guides"][0]["sources"] = json!(["missing"]),
        |d| d["guides"][0]["explanation_language"] = json!("missing"),
        |d| {
            let mut g = d["guides"][0].clone();
            g["id"] = json!("different-id");
            d["guides"].as_array_mut().unwrap().push(g);
        },
    ];
    for mutation in cases {
        let mut f = files();
        change(&mut f, mutation);
        let e = Registry::from_files(f).unwrap_err();
        assert!(e.path.starts_with("guides/"), "{e}");
    }
}

#[test]
fn editing_variety_material_preserves_source_and_does_not_rewrite_credit() {
    let source = files();
    let before = Registry::from_files(source.clone()).unwrap();
    let mut changed = source;
    change(&mut changed, |d| {
        d["guides"][0]["variants"][0]["summary"] = json!("Human edit")
    });
    let after = Registry::from_files(changed).unwrap();
    assert_ne!(before.hash(), after.hash());
    assert_eq!(
        before.learning_content_hash(),
        after.learning_content_hash()
    );
    assert_eq!(before.game_hash(), after.game_hash());
    assert_eq!(
        before.resolve("arabic", None, "english").unwrap().guidance,
        after.resolve("arabic", None, "english").unwrap().guidance
    );
    let guide = &after.inspect_guides("arabic", None).unwrap()[0].guide;
    assert_eq!(guide.variants[0].examples[0].text, "é e\u{301} العربية कि");
    assert_eq!(
        guide.variants[1].summary,
        "Realization for arabic-modern-standard"
    );
}
