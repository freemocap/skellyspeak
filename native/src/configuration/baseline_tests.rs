use super::*;

/// Frozen pre-audit refactor baseline. New languages are exercised by the all-pair
/// coverage tests rather than multiplying this historical snapshot indefinitely.
#[test]
fn resolved_behavior_baseline() {
    let registry = Registry::bundled().unwrap();
    let expected: BTreeMap<String, serde_json::Value> =
        serde_json::from_str(include_str!("fixtures/resolved-baseline.json")).unwrap();
    assert!(!expected.is_empty());
    for (key, value) in expected {
        let ids: Vec<_> = key.split('/').collect();
        assert_eq!(ids.len(), 4);
        let mut context = registry
            .resolve_pair(ids[0], Some(ids[1]), ids[2], Some(ids[3]))
            .unwrap();
        context.hash.clear();
        context.external_tags.remove("language_tag");
        let cards = registry
            .starters(&context, "A1", &[], &[], &[], &[])
            .unwrap();
        let actual = serde_json::json!({"context": context, "persona": registry.starter_persona(ids[0]).unwrap(), "cards": cards.iter().map(|c| (&c.starter.id, &c.reason)).collect::<Vec<_>>()});
        assert_eq!(actual, value, "{key}");
    }
}
