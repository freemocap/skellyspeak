use super::*;
use serde_json::{Value, json};

fn edited(edit: impl FnOnce(&mut Value)) -> types::Result<Registry> {
    let mut files: BTreeMap<String, String> = SEEDS
        .iter()
        .map(|(name, text)| (name.to_string(), text.to_string()))
        .collect();
    let path = "languages/spanish.yaml";
    let mut document: Value = serde_yaml_ng::from_str(&files[path]).unwrap();
    edit(&mut document);
    files.insert(path.into(), serde_yaml_ng::to_string(&document).unwrap());
    Registry::from_files(files)
}

#[test]
fn every_language_and_variety_has_six_complete_sets_and_real_samples() {
    let registry = Registry::bundled().unwrap();
    for language in &registry.languages {
        for variety in &language.varieties {
            let sets = registry
                .practice_phrases(&language.id, Some(&variety.id))
                .unwrap();
            let summaries = registry
                .practice_summaries(&language.id, Some(&variety.id))
                .unwrap();
            assert_eq!(summaries.len(), 6);
            for summary in summaries {
                assert!(summary.count >= 8);
                assert_eq!(summary.count, sets.phrases(summary.set).len());
                assert_eq!(summary.sample, sets.phrases(summary.set)[0]);
            }
        }
    }
}

#[test]
fn missing_sets_short_sets_duplicates_and_invalid_text_refuse_to_load() {
    assert!(
        edited(|d| {
            d.as_object_mut().unwrap().remove("practice");
        })
        .is_err()
    );
    assert!(
        edited(|d| {
            d["practice"]["sets"]
                .as_object_mut()
                .unwrap()
                .remove("idiomatic");
        })
        .is_err()
    );
    for replacement in [json!([]), json!(["one", "two"])] {
        assert_eq!(
            edited(|d| d["practice"]["sets"]["beginner"] = replacement)
                .unwrap_err()
                .code,
            "phrase_count"
        );
    }
    for text in ["", "  hola", "hola\n", "hola\0", &"x".repeat(513)] {
        let error = edited(|d| d["practice"]["sets"]["beginner"][0] = json!(text)).unwrap_err();
        assert!(error.path.ends_with("practice.sets.beginner[0]"));
        assert_eq!(error.code, "invalid_phrase");
    }
    assert_eq!(
        edited(
            |d| d["practice"]["sets"]["beginner"][1] = d["practice"]["sets"]["beginner"][0].clone()
        )
        .unwrap_err()
        .code,
        "duplicate_phrase"
    );
    assert_eq!(
        edited(|d| d["practice"]["varieties"]["missing"] = d["practice"]["sets"].clone())
            .unwrap_err()
            .code,
        "unknown_variety"
    );
}

#[test]
fn authored_encodings_are_preserved_and_social_is_not_a_difficulty() {
    let text = "Cafe\u{301}.";
    let registry = edited(|d| d["practice"]["sets"]["social"][0] = json!(text)).unwrap();
    assert_eq!(
        registry.practice_phrases("spanish", None).unwrap().social[0],
        text
    );
    assert!(serde_json::from_value::<crate::model::Difficulty>(json!("social")).is_err());
    assert!(serde_json::from_value::<crate::model::Difficulty>(json!("idiomatic")).is_err());
    assert!(serde_json::from_value::<practice::PracticeSet>(json!("fluent")).is_err());
}
