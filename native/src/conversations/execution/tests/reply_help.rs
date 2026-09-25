use super::*;
use crate::learning::coaching::conversation_support::{self as support, ReplyHelpKind};

fn partner(store: &mut Store, conversation: &str, opening: bool) -> (String, String, Dispatch) {
    let turn = if opening {
        let settings = store
            .snapshot()
            .unwrap()
            .conversations
            .into_iter()
            .find(|c| c.id == conversation)
            .unwrap()
            .settings;
        let configuration = crate::conversations::direction::ConversationStartConfig {
            difficulty: settings.difficulty,
            variety_id: settings.variety_id,
            direction: settings.direction,
        };
        let expected_revision = store.snapshot().unwrap().revision;
        apply(
            store,
            Action::StartConversation {
                conversation_id: conversation.into(),
                configuration,
                message: None,
                input: None,
                expected_revision,
            },
        )
        .entity_id
    } else {
        store.execute(send(store, conversation)).unwrap().entity_id
    };
    assert_eq!(store.connection.query_row("SELECT count(*) FROM operations WHERE turn_id=?1 AND kind IN ('reply_assistance','reply_explanations')", [&turn], |r| r.get::<_,i64>(0)).unwrap(), 0);
    // Keep the real brief dependency while isolating unrelated automatic tasks.
    store.connection.execute("DELETE FROM operations WHERE turn_id=?1 AND kind NOT IN ('persona_context','persona_reply','persona_opening','reply_brief')", [&turn]).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let source = store.dispatch().unwrap().unwrap();
    assert!(store.dispatch().unwrap().is_none());
    store
        .finish(&source, Ok(reply("¿Con quién fuiste?")))
        .unwrap();
    let brief = store.dispatch().unwrap().unwrap();
    assert_eq!(
        brief.coaching_schema.as_ref().unwrap(),
        &support::schema(support::BRIEF)
    );
    let message = store
        .conversation_snapshot(conversation, None)
        .unwrap()
        .messages
        .iter()
        .find(|m| m.role == "assistant")
        .unwrap()
        .id
        .clone();
    (turn, message, brief)
}

#[test]
fn normal_and_opening_turns_generate_only_brief_then_save_requested_empty_grammar() {
    for opening in [false, true] {
        let (dir, mut store, conversation) = setup();
        let (turn, message, brief) = partner(&mut store, &conversation, opening);
        store
            .finish(
                &brief,
                Ok(reply(r#"{"explanation":"They ask who went with you."}"#)),
            )
            .unwrap();
        assert!(store.dispatch().unwrap().is_none());
        let command = Command {
            session_id: store.session_id.clone(),
            action_id: id(),
            action: Action::RequestExplanations {
                message_id: message.clone(),
            },
        };
        let receipt = store.execute(command.clone()).unwrap();
        assert_eq!(store.execute(command).unwrap().entity_id, receipt.entity_id);
        assert_eq!(
            apply(
                &mut store,
                Action::RequestExplanations {
                    message_id: message.clone()
                }
            )
            .entity_id,
            receipt.entity_id
        );
        let graph = store.conversation_snapshot(&conversation, None).unwrap();
        let graph = graph.turns.iter().find(|item| item.id == turn).unwrap();
        let parent = graph
            .operations
            .iter()
            .find(|item| {
                item.kind
                    == if opening {
                        "persona_opening"
                    } else {
                        "persona_reply"
                    }
            })
            .unwrap();
        let help = graph
            .operations
            .iter()
            .find(|item| item.kind == "reply_explanations")
            .unwrap();
        assert_eq!(help.dependencies, vec![parent.id.clone()]);
        let grammar = store.dispatch().unwrap().unwrap();
        let input: serde_json::Value =
            serde_json::from_str(&grammar.messages.last().unwrap().content).unwrap();
        assert_eq!(input["actualPartnerReply"], "¿Con quién fuiste?");
        store
            .finish(&grammar, Ok(reply(r#"{"cards":[]}"#)))
            .unwrap();
        let view = store.conversation_snapshot(&conversation, None).unwrap();
        let saved = view.messages.iter().find(|m| m.id == message).unwrap();
        assert!(saved.reply_brief.is_some());
        assert!(saved.reply_explanations.as_ref().unwrap().cards.is_empty());
        assert_eq!(saved.explanations_state.as_deref(), Some("succeeded"));
        assert!(saved.reply_assistance.is_none());
        assert_eq!(saved.reading_scope.as_ref().unwrap().language, "spanish");
        let count = store.profile().unwrap().global.attempts;
        drop(store);
        let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
        assert_eq!(
            request_explanations(&store.connection, &message).unwrap().1,
            receipt.entity_id
        );
        assert!(store.dispatch().unwrap().is_none());
        assert_eq!(store.profile().unwrap().global.attempts, count);
        let restored = store.conversation_snapshot(&conversation, None).unwrap();
        assert_eq!(
            restored
                .turns
                .iter()
                .find(|t| t.id == turn)
                .unwrap()
                .operations
                .len(),
            4
        );
        assert!(
            restored
                .messages
                .iter()
                .find(|m| m.id == message)
                .unwrap()
                .reply_explanations
                .as_ref()
                .unwrap()
                .cards
                .is_empty()
        );
    }
}

#[test]
fn requests_and_scoped_retries_bind_current_access_without_retrying_siblings() {
    let (_dir, mut store, conversation) = setup();
    let (turn, message, brief) = partner(&mut store, &conversation, false);
    store.finish(&brief, Err(fail("Brief failed"))).unwrap();
    store.connection.execute("UPDATE ai_config SET custom_config=json_set(custom_config,'$.baseUrl','http://127.0.0.1:8765/v1','$.bearerAuth',json('false'))", []).unwrap();
    let revision = store.connection_config().unwrap().revision;
    store
        .select_route(revision, ConnectionRoute::Custom)
        .unwrap();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.explanationLanguage','french','$.explanationVarietyId','french-france') WHERE conversation_id=?1", [&conversation]).unwrap();
    let suggestions = apply(
        &mut store,
        Action::RequestSuggestions {
            message_id: message.clone(),
        },
    )
    .entity_id;
    let work = store.dispatch().unwrap().unwrap();
    assert_eq!(work.operation, suggestions);
    let graph = store.conversation_snapshot(&conversation, None).unwrap();
    let graph = graph.turns.iter().find(|item| item.id == turn).unwrap();
    let parent = graph
        .operations
        .iter()
        .find(|item| item.kind == "persona_reply")
        .unwrap();
    let help = graph
        .operations
        .iter()
        .find(|item| item.id == suggestions)
        .unwrap();
    assert_eq!(help.dependencies, vec![parent.id.clone()]);
    let input: serde_json::Value =
        serde_json::from_str(&work.messages.last().unwrap().content).unwrap();
    assert_eq!(input["actualPartnerReply"], "¿Con quién fuiste?");
    assert!(work.messages[0].content.contains("english"));
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages[1]
            .reading_scope
            .as_ref()
            .unwrap()
            .explanation,
        "english"
    );
    assert_eq!(work.route, ConnectionRoute::Custom);
    assert!(work.credential.is_empty());
    assert_eq!(work.target.url, "http://127.0.0.1:8765/v1/operations");
    store
        .finish(&work, Err(fail("Suggestions failed")))
        .unwrap();
    let retry = Action::RetryReplyHelp {
        message_id: message.clone(),
        help_kind: ReplyHelpKind::Replies,
    };
    assert_eq!(apply(&mut store, retry.clone()).entity_id, suggestions);
    assert_eq!(apply(&mut store, retry).entity_id, suggestions);
    let second = store.dispatch().unwrap().unwrap();
    assert_eq!(second.operation, work.operation);
    assert_ne!(second.attempt, work.attempt);
    assert!(store.dispatch().unwrap().is_none());
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT state FROM operations WHERE id=?1",
                [&brief.operation],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "failed"
    );
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn,
            control: TurnControl::Cancel,
        },
    );
    store
        .finish(
            &second,
            Ok(reply(r#"{"replies":[],"frames":[],"starters":[]}"#)),
        )
        .unwrap();
    assert!(request_suggestions(&store.connection, &message).is_err());
    assert!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages[1]
            .reply_assistance
            .is_none()
    );
}

#[test]
fn held_requests_wait_and_invalid_brief_keeps_attempt_metadata() {
    let (_dir, mut store, conversation) = setup();
    let (_, message, brief) = partner(&mut store, &conversation, false);
    let mut invalid = reply(r#"{"explanation":""}"#);
    invalid.provider_id = "brief-request".into();
    invalid.input_tokens = Some(12);
    store.finish(&brief, Ok(invalid)).unwrap();
    apply(&mut store, Action::SetPaused { paused: true });
    let receipt = apply(
        &mut store,
        Action::RequestExplanations {
            message_id: message.clone(),
        },
    );
    assert!(store.dispatch().unwrap().is_none());
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    let turn = &view.turns[0];
    assert_eq!(
        turn.operations
            .iter()
            .find(|o| o.id == receipt.entity_id)
            .unwrap()
            .state,
        "held"
    );
    let attempt = turn
        .attempts
        .iter()
        .find(|a| a.id == brief.attempt)
        .unwrap();
    assert_eq!(attempt.provider_id.as_deref(), Some("brief-request"));
    assert_eq!(attempt.input_tokens, Some(12));
    assert!(view.messages[1].reply_brief.is_none());
    assert!(view.messages[1].brief_error.is_some());
    apply(&mut store, Action::SetPaused { paused: false });
    let grammar = store.dispatch().unwrap().unwrap();
    store
        .finish(&grammar, Ok(reply(r#"{"cards":[]}"#)))
        .unwrap();
    store
        .connection
        .execute(
            "UPDATE conversations SET archived=1 WHERE id=?1",
            [&conversation],
        )
        .unwrap();
    assert!(request_suggestions(&store.connection, &message).is_err());
    assert!(retry_reply_help(&store.connection, &message, ReplyHelpKind::Brief).is_err());
}

#[test]
fn explicit_reading_explanations_use_the_explanation_turn_contract() {
    let (_dir, mut store, conversation) = setup();
    let (_turn, message, brief) = partner(&mut store, &conversation, false);
    store
        .finish(
            &brief,
            Ok(reply(r#"{"explanation":"They ask who went with you."}"#)),
        )
        .unwrap();
    request_explanations(&store.connection, &message).unwrap();
    let turn = store.dispatch().unwrap().unwrap();
    let (variety, explanation, explanation_variety): (String, String, String) = store
        .connection
        .query_row(
            "SELECT json_extract(settings,'$.varietyId'),json_extract(settings,'$.explanationLanguage'),json_extract(settings,'$.explanationVarietyId') FROM conversation_settings WHERE conversation_id=?1",
            [&conversation],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();
    let request = crate::language::reading::Request::capture(
        &store,
        crate::language::reading::ReadingInput {
            reference_item: None,
            text: "¿Con quién fuiste?".into(),
            language: "spanish".into(),
            variety: Some(variety),
            explanation,
            explanation_variety: Some(explanation_variety),
            aid: crate::language::reading::ReadingAid::Explanations,
        },
    )
    .unwrap();
    let (reading, schema) = request.explanations_dispatch().unwrap();
    // The same instruction; the explained text is the partner reply, without
    // the conversation's surrounding exchange.
    assert_eq!(reading.messages[0].role, turn.messages[0].role);
    assert_eq!(reading.messages[0].content, turn.messages[0].content);
    let data: serde_json::Value = serde_json::from_str(&reading.messages[1].content).unwrap();
    let turn_data: serde_json::Value = serde_json::from_str(&turn.messages[1].content).unwrap();
    assert_eq!(data["actualPartnerReply"], turn_data["actualPartnerReply"]);
    assert_eq!(data["precedingExchange"], serde_json::json!([]));
    assert!(data["latestLearnerInput"].is_null());
    assert_eq!(Some(&schema), turn.coaching_schema.as_ref());
    assert_eq!(&schema, &support::schema(support::EXPLANATIONS));
    assert_eq!(reading.model, turn.model);
    assert_eq!(reading.temperature, turn.temperature);
    assert_eq!(
        (reading.route, &reading.target.url, &reading.credential),
        (turn.route, &turn.target.url, &turn.credential)
    );
    // Both validate quotes against the explained text.
    let card = |quote: &str| {
        reply(&serde_json::json!({"cards":[{"quote":quote,"title":"Question word","body":"Asks who.","example":"¿Con quién vas?","contrast":""}]}).to_string())
    };
    assert!(
        support::validate_source(
            "¿Con quién fuiste?",
            support::EXPLANATIONS,
            &card("Con quién")
        )
        .is_ok()
    );
    assert!(
        support::validate_source("¿Con quién fuiste?", support::EXPLANATIONS, &card("Dónde"))
            .is_err()
    );
    store.finish(&turn, Ok(card("Dónde"))).unwrap();
    let saved = store.conversation_snapshot(&conversation, None).unwrap();
    let saved = saved.messages.iter().find(|m| m.id == message).unwrap();
    assert!(saved.reply_explanations.is_none());
}
