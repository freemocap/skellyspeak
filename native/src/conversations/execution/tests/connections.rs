use super::*;

#[test]
fn model_selection_is_shared_across_routes_without_changing_credentials() {
    let (_dir, mut store, _) = setup();
    let credentials: (Option<String>, Option<String>, Option<String>) = store
        .connection
        .query_row(
            "SELECT credential_id,hosted_credential_id,custom_credential_id FROM ai_config",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    let revision = store.connection_config().unwrap().revision;
    store
        .set_models(
            revision,
            "provider/model@version+variant",
            "shared-fast",
            "shared-transcription",
        )
        .unwrap();
    for route in [
        ConnectionRoute::Hosted,
        ConnectionRoute::Openrouter,
        ConnectionRoute::Custom,
    ] {
        let revision = store.connection_config().unwrap().revision;
        store.select_route(revision, route).unwrap();
        let config = store.connection_config().unwrap();
        assert_eq!(config.standard_model, "provider/model@version+variant");
        assert_eq!(config.fast_model, "shared-fast");
        assert_eq!(config.transcription_model, "shared-transcription");
    }
    let after: (Option<String>, Option<String>, Option<String>) = store
        .connection
        .query_row(
            "SELECT credential_id,hosted_credential_id,custom_credential_id FROM ai_config",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!(after, credentials);
}

#[test]
fn credential_changes_never_select_a_route() {
    let (_dir, mut store, _) = setup();
    store.select_route(2, ConnectionRoute::Custom).unwrap();
    store
        .set_connection(3, Some("replacement"), "standard", "fast")
        .unwrap();
    assert_eq!(
        store.connection_config().unwrap().route,
        ConnectionRoute::Custom
    );
    store
        .set_hosted_connection(4, Some("session"), "test@example.com")
        .unwrap();
    assert_eq!(
        store.connection_config().unwrap().route,
        ConnectionRoute::Custom
    );
    store.set_hosted_connection(5, None, "").unwrap();
    assert_eq!(
        store.connection_config().unwrap().route,
        ConnectionRoute::Custom
    );
    assert!(
        crate::ai::connections::access::resolve(
            &store.connection,
            crate::ai::connections::access::Capability::Chat
        )
        .is_err()
    );
}

#[test]
fn hosted_revocation_blocks_publication_and_keeps_own_key() {
    let (_dir, mut store, conversation) = setup();
    store
        .set_hosted_connection(2, Some("hosted-token"), "test@example.com")
        .unwrap();
    store.select_route(3, ConnectionRoute::Hosted).unwrap();
    let dispatch = begin(&mut store, &conversation);
    assert_eq!(dispatch.route, ConnectionRoute::Hosted);
    assert_eq!(dispatch.credential, "hosted-token");
    store.set_hosted_connection(4, None, "").unwrap();
    store.finish(&dispatch, Ok(reply("Hola."))).unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .len(),
        1
    );
    assert_eq!(
        store.credential_id().unwrap().as_deref(),
        Some("test-credential")
    );
    assert!(!store.connection_config().unwrap().signed_in);
}

#[test]
fn route_switch_preserves_dispatched_route_and_profile_reports_real_usage() {
    let (_dir, mut store, conversation) = setup();
    store
        .set_hosted_connection(2, Some("hosted-token"), "test@example.com")
        .unwrap();
    store.select_route(3, ConnectionRoute::Hosted).unwrap();
    let dispatch = begin(&mut store, &conversation);
    store.select_route(4, ConnectionRoute::Openrouter).unwrap();
    store.finish(&dispatch, Ok(reply("Hola."))).unwrap();
    let chat = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(chat.turns[0].route, ConnectionRoute::Hosted);
    assert_eq!(chat.messages.len(), 2);
    store.set_hosted_connection(5, None, "").unwrap();
    assert_eq!(
        store.connection_config().unwrap().route,
        ConnectionRoute::Openrouter
    );
    let profile = store.profile().unwrap();
    assert_eq!(profile.global.attempts, 1);
    assert_eq!(profile.global.input_tokens, 21);
    assert_eq!(profile.global.output_tokens, 8);
    assert_eq!(profile.global.unknown_usage, 0);
    assert_eq!(profile.personas[0].learner_messages, 1);
    assert_eq!(
        profile
            .languages
            .iter()
            .find(|l| l.id == "spanish")
            .unwrap()
            .persona_messages,
        1
    );
    assert_eq!(
        profile
            .languages
            .iter()
            .find(|l| l.id == "french")
            .unwrap()
            .attempts,
        0
    );
}

#[test]
fn hosted_turn_dispatches_captured_task_models_and_records_each_attempt() {
    let (_dir, mut store, conversation) = setup();
    store
        .set_hosted_connection(2, Some("hosted-token"), "test@example.com")
        .unwrap();
    store.select_route(3, ConnectionRoute::Hosted).unwrap();
    store.execute(send(&store, &conversation)).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let reply_work = store.dispatch().unwrap().unwrap();
    assert_eq!(reply_work.model, "google/gemini-2.5-flash");
    assert_eq!(reply_work.target.model, reply_work.model);
    assert_eq!(reply_work.credential, "hosted-token");
    assert_eq!(reply_work.messages.last().unwrap().role, "user");
    store
        .finish(&reply_work, Ok(reply("¿Qué te gusta leer?")))
        .unwrap();
    let mut kinds = std::collections::HashSet::new();
    while let Some(work) = store.dispatch().unwrap() {
        let kind: String = store
            .connection
            .query_row(
                "SELECT kind FROM operations WHERE id=?1",
                [&work.operation],
                |r| r.get(0),
            )
            .unwrap();
        let expected = match kind.as_str() {
            "skill_assessment" | "user_translation" | "reply_translation" => {
                "google/gemini-2.5-flash-lite"
            }
            "user_word_gloss"
            | "persona_word_gloss"
            | "conversation_feedback"
            | "reply_assistance"
            | "reply_explanations" => "google/gemini-2.5-flash",
            _ => panic!("Unexpected automatic task: {kind}"),
        };
        assert_eq!(work.model, expected);
        assert_eq!(work.target.model, expected);
        let recorded: String = store
            .connection
            .query_row(
                "SELECT requested_model FROM attempts WHERE id=?1",
                [&work.attempt],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(recorded, expected);
        kinds.insert(kind);
        store
            .finish(&work, Err(fail("Routing fixture complete")))
            .unwrap();
    }
    for kind in [
        "user_translation",
        "reply_translation",
        "user_word_gloss",
        "persona_word_gloss",
        "conversation_feedback",
        "reply_assistance",
        "reply_explanations",
    ] {
        assert!(kinds.contains(kind), "Missing {kind}");
    }
}

#[test]
fn custom_turn_captures_endpoint_and_revocation_blocks_publication() {
    let (_dir, mut store, conversation) = setup();
    let custom = CustomEndpoint {
        base_url: "http://localhost:1234/v1".into(),
        bearer_auth: false,
    };
    store
        .connection
        .execute(
            "UPDATE ai_config SET custom_config=?1",
            [serde_json::to_string(&custom).unwrap()],
        )
        .unwrap();
    store.select_route(2, ConnectionRoute::Custom).unwrap();
    let dispatched = begin(&mut store, &conversation);
    assert_eq!(dispatched.target.url, "http://localhost:1234/v1/operations");
    assert_eq!(dispatched.model, "google/gemini-2.5-flash");
    assert!(dispatched.credential.is_empty());
    assert!(dispatched.target.credential.is_none());
    invalidate(&store.connection, Some(ConnectionRoute::Custom)).unwrap();
    store.finish(&dispatched, Ok(reply("Late reply"))).unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .len(),
        1
    );
}
