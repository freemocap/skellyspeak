use super::*;

/// Selected-pair regression snapshot, updated for the reviewed 2026-10-05 variety
/// guidance changes. New languages are exercised by the all-pair coverage tests
/// rather than multiplying this snapshot indefinitely. This is not a migration fixture.
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
        let actual = serde_json::json!({"context": context, "persona": registry.starter_persona(ids[0]).unwrap()});
        compare(&actual, &value, &key);
    }
}

fn compare(actual: &serde_json::Value, expected: &serde_json::Value, path: &str) {
    match (actual, expected) {
        (serde_json::Value::Object(a), serde_json::Value::Object(e)) => {
            assert_eq!(
                a.keys().collect::<Vec<_>>(),
                e.keys().collect::<Vec<_>>(),
                "{path}"
            );
            for (key, value) in a {
                compare(value, &e[key], &format!("{path}/{key}"));
            }
        }
        (serde_json::Value::Array(a), serde_json::Value::Array(e)) => {
            assert_eq!(a.len(), e.len(), "{path}");
            for (index, (a, e)) in a.iter().zip(e).enumerate() {
                compare(a, e, &format!("{path}/{index}"));
            }
        }
        _ => assert_eq!(actual, expected, "{path}"),
    }
}
