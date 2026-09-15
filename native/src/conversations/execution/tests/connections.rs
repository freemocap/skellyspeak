use super::*;

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
            .find(|l| l.id == "es")
            .unwrap()
            .persona_messages,
        1
    );
    assert_eq!(
        profile
            .languages
            .iter()
            .find(|l| l.id == "fr")
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
    assert_eq!(reply_work.model, crate::ai::connections::model_routing::OSS);
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
            "user_translation" | "reply_translation" | "coach_reaction" => {
                crate::ai::connections::model_routing::LITE
            }
            "user_word_gloss" | "persona_word_gloss" => crate::ai::connections::model_routing::OSS,
            "coach_feedback" => crate::ai::connections::model_routing::FLASH,
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
    }
    for kind in [
        "user_translation",
        "reply_translation",
        "user_word_gloss",
        "persona_word_gloss",
        "coach_feedback",
        "coach_reaction",
    ] {
        assert!(kinds.contains(kind), "Missing {kind}");
    }
}

#[test]
fn custom_turn_captures_endpoint_and_revocation_blocks_publication() {
    let (_dir, mut store, conversation) = setup();
    let custom = CustomEndpoint {
        base_url: "http://localhost:1234/v1".into(),
        standard_model: "local-model".into(),
        fast_model: "fast-model".into(),
        bearer_auth: false,
        transcription_model: None,
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
    assert_eq!(dispatched.model, "local-model");
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
