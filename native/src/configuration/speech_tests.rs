use super::{speech::*, *};

#[test]
fn capabilities_select_without_language_specific_overrides() {
    let catalog = Catalog::bundled();
    for (tag, expected) in [
        ("ga-IE", "scribe_v2"),
        ("gle", "scribe_v2"),
        ("ast", "scribe_v2"),
        ("ig", "scribe_v2"),
        ("en-US", "whisper-large-v3"),
        ("ar-LB", "whisper-large-v3"),
        ("zh-Hans", "whisper-large-v3"),
        ("yue", "whisper-large-v3"),
    ] {
        let resolution = catalog
            .resolve(
                Task::Transcription,
                tag,
                &Preferences::default(),
                "whisper-large-v3",
                None,
            )
            .unwrap();
        assert_eq!(resolution.model, expected, "{tag}");
    }
    for task in [Task::Transcription, Task::Speech] {
        for tag in ["chr", "gd"] {
            assert!(
                catalog
                    .resolve(
                        task,
                        tag,
                        &Preferences::default(),
                        if task == Task::Speech {
                            "eleven_v3"
                        } else {
                            "whisper-large-v3"
                        },
                        None
                    )
                    .is_err()
            );
        }
    }
    assert!(
        catalog
            .resolve(
                Task::Speech,
                "ga",
                &Preferences::default(),
                "eleven_v3",
                None
            )
            .is_ok()
    );
    // Recognition support does not imply synthesis support.
    assert!(
        catalog
            .resolve(
                Task::Transcription,
                "ast",
                &Preferences::default(),
                "whisper-large-v3",
                None
            )
            .is_ok()
    );
    assert!(
        catalog
            .resolve(
                Task::Speech,
                "ast",
                &Preferences::default(),
                "eleven_v3",
                None
            )
            .is_err()
    );
}

#[test]
fn preferences_and_availability_are_ordered_and_never_change_access() {
    let catalog = Catalog::bundled();
    let preferred = Preferences {
        transcription: Some(vec!["scribe_v2".into()]),
        ..Default::default()
    };
    let choice = catalog
        .resolve(
            Task::Transcription,
            "en",
            &preferred,
            "whisper-large-v3",
            None,
        )
        .unwrap();
    assert_eq!(choice.model, "scribe_v2");
    assert_eq!(choice.reason, "language_preference");
    let choice = catalog
        .resolve(
            Task::Transcription,
            "en",
            &preferred,
            "whisper-large-v3",
            Some(&["whisper-large-v3".into()]),
        )
        .unwrap();
    assert_eq!(choice.model, "whisper-large-v3");
    assert!(
        catalog
            .resolve(
                Task::Transcription,
                "ga",
                &preferred,
                "whisper-large-v3",
                Some(&["whisper-large-v3".into()])
            )
            .is_err()
    );
    assert!(
        catalog
            .resolve(
                Task::Speech,
                "en",
                &Preferences::default(),
                "eleven_v3",
                Some(&[])
            )
            .is_err()
    );
    assert_eq!(
        catalog
            .resolve(
                Task::Transcription,
                "en",
                &Preferences::default(),
                "custom-model",
                None
            )
            .unwrap()
            .reason,
        "custom_model_unverified"
    );
}

#[test]
fn authored_preferences_inherit_per_task_and_invalid_references_fail_loading() {
    let mut files: BTreeMap<String, String> = SEEDS
        .iter()
        .map(|(n, t)| (n.to_string(), t.to_string()))
        .collect();
    let path = "languages/irish.yaml";
    let mut doc: serde_json::Value = serde_yaml_ng::from_str(&files[path]).unwrap();
    doc["defaults"]["speech_routes"] =
        serde_json::json!({"transcription":["scribe_v2"],"speech":["eleven_v3"]});
    doc["varieties"][0]["overrides"]["speech_routes"] =
        serde_json::json!({"transcription":["whisper-large-v3-turbo","scribe_v2"]});
    files.insert(path.into(), serde_yaml_ng::to_string(&doc).unwrap());
    let registry = Registry::from_files(files.clone()).unwrap();
    let context = registry.resolve("irish", None, "english").unwrap();
    assert_eq!(
        context.speech_routes.transcription.unwrap(),
        ["whisper-large-v3-turbo", "scribe_v2"]
    );
    assert_eq!(context.speech_routes.speech.unwrap(), ["eleven_v3"]);
    for value in [
        serde_json::json!([]),
        serde_json::json!(["unknown"]),
        serde_json::json!(["scribe_v2"]),
        serde_json::json!(["eleven_v3", "eleven_v3"]),
    ] {
        doc["defaults"]["speech_routes"]["speech"] = value;
        files.insert(path.into(), serde_yaml_ng::to_string(&doc).unwrap());
        assert!(Registry::from_files(files.clone()).is_err());
    }
}

#[test]
fn malformed_tags_do_not_become_provider_defaults() {
    for tag in [
        "",
        "ga_IE",
        "en--US",
        "EN",
        "en-",
        "en-toolongsubtag",
        "en\n",
    ] {
        assert!(
            Catalog::bundled()
                .resolve(
                    Task::Transcription,
                    tag,
                    &Preferences::default(),
                    "whisper-large-v3",
                    None
                )
                .is_err()
        );
    }
}

#[test]
fn every_offered_language_has_listed_recognition_and_synthesis() {
    let catalog = Catalog::bundled();
    let registry = Registry::bundled().unwrap();
    for language in &registry.languages {
        let tag = language
            .external_tags
            .get("language_tag")
            .expect("language tag");
        for task in [Task::Transcription, Task::Speech] {
            let resolution = catalog
                .resolve(
                    task,
                    tag,
                    &Preferences::default(),
                    if task == Task::Speech {
                        "eleven_v3"
                    } else {
                        "whisper-large-v3"
                    },
                    None,
                )
                .unwrap_or_else(|error| panic!("{}: {error:?}", language.id));
            assert_ne!(resolution.reason, "unlisted_language_attempt");
            assert_ne!(resolution.reason, "custom_model_unverified");
        }
    }
}
