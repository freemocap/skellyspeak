use super::*;
use crate::application::test_server::structured_server;

#[tokio::test]
async fn english_with_spanish_interface_and_explanations_opens_without_inference() {
    let dir = tempfile::tempdir().unwrap();
    let state = Application::start(&dir.path().join("english.sqlite3"), None);
    {
        let store = state.lock().unwrap();
        store
            .connection
            .execute("UPDATE ai_config SET paused=1", [])
            .unwrap();
        store.connection.execute("UPDATE learner SET preferences=json_set(preferences,'$.interfaceLocale','spanish','$.explanationLanguage','spanish','$.explanationVarietyId','spanish-mexico')", []).unwrap();
        let snapshot = crate::learning::learner::progression::snapshot(&store, "english").unwrap();
        assert_eq!(snapshot["guide_explanation_language"], "spanish");
        assert_eq!(snapshot["guides"].as_array().unwrap().len(), 2);
        assert!(snapshot["guides"][0]["skills"]["coordinating_action"].is_string());
    }
    let guide = load(
        &state,
        "english",
        "english-united-states",
        "coordinating_action",
        "spanish",
        false,
    )
    .await
    .unwrap();
    assert!(!guide.generated);
    assert_eq!(guide.explanation_language, "spanish");
    assert_eq!(guide.context.unwrap().reference.edition_language, "spanish");
    assert!(
        guide
            .markdown
            .contains("> Could you hold this box for a moment?")
    );
    let count: i64 = state
        .lock()
        .unwrap()
        .connection
        .query_row(
            "SELECT count(*) FROM inference_executions WHERE task='guide_translation'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn translation_is_shared_cached_and_survives_restart_without_credit() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("guide.sqlite3");
    let state = Application::start(&path, None);
    assert!(
        state
            .lock()
            .unwrap()
            .config
            .guide_edition("spanish", "german", "time_events")
            .unwrap()
            .is_none()
    );
    let (base, worker) = structured_server(|source| {
        let data: serde_json::Value = serde_json::from_str(source).unwrap();
        let texts: Vec<_> = data["fields"]
            .as_array()
            .unwrap()
            .iter()
            .map(|field| format!("Translation {}", field[1].as_str().unwrap()))
            .collect();
        json!({"texts":texts}).to_string()
    });
    state.lock().unwrap().connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl',?1,'$.bearerAuth',json('false'))", [&base]).unwrap();
    let (a, b) = tokio::join!(
        load(
            &state,
            "spanish",
            "spanish-spain",
            "time_events",
            "german",
            false
        ),
        load(
            &state,
            "spanish",
            "spanish-spain",
            "time_events",
            "german",
            false
        )
    );
    let first = a.unwrap();
    let second = b.unwrap();
    worker.join().unwrap();
    assert_eq!(first.markdown, second.markdown);
    assert_eq!(
        first.provenance["execution"],
        second.provenance["execution"]
    );
    assert!(first.generated);
    assert_eq!(first.provenance["response"]["actualModel"], "actual-fast");
    assert_eq!(
        first.provenance["response"]["providerId"],
        "structured-receipt"
    );
    assert_eq!(first.provenance["response"]["inputTokens"], 21);
    assert!(
        !first.provenance["response"]
            .to_string()
            .contains("Ayer fui al mercado")
    );
    assert!(first.markdown.contains("> Ayer fui al mercado."));
    let store = state.lock().unwrap();
    let count: i64 = store
        .connection
        .query_row(
            "SELECT count(*) FROM inference_executions WHERE task='guide_translation'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
    let profile = store.profile().unwrap();
    assert_eq!(profile.global.attempts, 1);
    assert_eq!(
        profile
            .languages
            .iter()
            .find(|l| l.id == "spanish")
            .unwrap()
            .attempts,
        1
    );
    assert!(profile.personas.iter().all(|p| p.attempts == 0));
    let evidence: i64 = store
        .connection
        .query_row("SELECT count(*) FROM turns", [], |r| r.get(0))
        .unwrap();
    assert_eq!(evidence, 0);
    drop(store);
    drop(state);
    let state = Application::start(&path, None);
    state
        .lock()
        .unwrap()
        .connection
        .execute("UPDATE ai_config SET paused=1", [])
        .unwrap();
    let cached = load(
        &state,
        "spanish",
        "spanish-spain",
        "time_events",
        "german",
        false,
    )
    .await
    .unwrap();
    assert_eq!(cached.markdown, first.markdown);
    assert_eq!(cached.provenance["cacheHit"], true);
    let authored = load(
        &state,
        "spanish",
        "spanish-spain",
        "time_events",
        "english",
        false,
    )
    .await
    .unwrap();
    assert!(!authored.generated);
}

#[tokio::test]
async fn invalid_translation_has_metadata_and_requires_explicit_retry() {
    let dir = tempfile::tempdir().unwrap();
    let state = Application::start(&dir.path().join("guide.sqlite3"), None);
    assert!(
        state
            .lock()
            .unwrap()
            .config
            .guide_edition("spanish", "german", "time_events")
            .unwrap()
            .is_none()
    );
    let (base, worker) = structured_server(|_| json!({"texts":[]}).to_string());
    state.lock().unwrap().connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl',?1,'$.bearerAuth',json('false'))", [&base]).unwrap();
    let first = load(
        &state,
        "spanish",
        "spanish-spain",
        "time_events",
        "german",
        false,
    )
    .await
    .unwrap_err();
    worker.join().unwrap();
    assert!(first.diagnostics.is_some());
    let second = load(
        &state,
        "spanish",
        "spanish-spain",
        "time_events",
        "german",
        false,
    )
    .await
    .unwrap_err();
    assert!(second.message.contains("explicit retry"));
    assert!(
        load(
            &state,
            "arabic",
            "arabic-egypt",
            "time_events",
            "english",
            false
        )
        .await
        .is_err()
    );
}
