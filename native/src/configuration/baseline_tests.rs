use super::*;
#[test]
fn resolved_behavior_baseline() {
    let registry = Registry::bundled().unwrap();
    let mut cases = BTreeMap::new();
    for language in &registry.languages {
        for variety in &language.varieties {
            for explanation in &registry.languages {
                for explanation_variety in &explanation.varieties {
                    let mut context = registry
                        .resolve_pair(
                            &language.id,
                            Some(&variety.id),
                            &explanation.id,
                            Some(&explanation_variety.id),
                        )
                        .unwrap();
                    context.hash.clear();
                    context.external_tags.remove("language_tag");
                    let cards = registry
                        .starters(&context, "A1", &[], &[], &[], &[])
                        .unwrap();
                    let value = serde_json::json!({"context": context, "persona": registry.starter_persona(&language.id).unwrap(), "cards": cards.iter().map(|c| (&c.starter.id, &c.reason)).collect::<Vec<_>>()});
                    cases.insert(
                        format!(
                            "{}/{}/{}/{}",
                            language.id, variety.id, explanation.id, explanation_variety.id
                        ),
                        value,
                    );
                }
            }
        }
    }
    let text = serde_json::to_string_pretty(&cases).unwrap();
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("src/configuration/fixtures/resolved-baseline.json");
    if std::env::var_os("SKELLY_CAPTURE_BASELINE").is_some() {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, &text).unwrap();
    }
    let expected: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
    for (key, value) in cases {
        assert_eq!(value, expected[&key], "{key}");
    }
}
