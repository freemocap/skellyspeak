use super::*;

#[test]
fn wave2_partner_opening_is_real_history_without_learner_evidence() {
    let (_dir, mut store, conversation) = setup();
    let command = Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::StartConversation {
            conversation_id: conversation.clone(),
            configuration: configuration(&store, &conversation),
            message: None,
            input: None,
            expected_revision: store.snapshot().unwrap().revision,
        },
    };
    let receipt = store.execute(command.clone()).unwrap();
    assert_eq!(store.execute(command).unwrap().entity_id, receipt.entity_id);
    let turn = receipt.entity_id;
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM messages WHERE turn_id=?1",
                [&turn],
                |r| r.get::<_, i32>(0)
            )
            .unwrap(),
        0
    );
    assert_eq!(store.connection.query_row("SELECT count(*) FROM operations WHERE turn_id=?1 AND kind IN ('coach_feedback','coach_retry_check','user_word_gloss')",[&turn],|r|r.get::<_,i32>(0)).unwrap(),0);
    assert!(store.dispatch().unwrap().is_none());
    let opening = store.dispatch().unwrap().unwrap();
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT kind FROM operations WHERE id=?1",
                [&opening.operation],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "persona_opening"
    );
    store
        .finish(&opening, Ok(reply("¿Qué te gusta cocinar?")))
        .unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["records"]
            .as_array()
            .unwrap()
            .len(),
        0
    );
    let mut answer = send(&store, &conversation);
    if let Action::SendMessage { text, .. } = &mut answer.action {
        *text = "Sí, me gusta cocinar en casa.".into();
    }
    let next = store.execute(answer).unwrap().entity_id;
    let captured = wave2_context(&store, &next);
    assert!(
        captured["messages"]
            .as_array()
            .unwrap()
            .iter()
            .any(|m| m["role"] == "assistant" && m["content"] == "¿Qué te gusta cocinar?")
    );
    let wire = captured["messages"].as_array().unwrap();
    assert_eq!(wire.len(), 3);
    assert_eq!(wire[1]["role"], "assistant");
    assert_eq!(wire[1]["content"], "¿Qué te gusta cocinar?");
    assert_eq!(wire[2]["role"], "user");
    assert_eq!(wire[2]["content"], "Sí, me gusta cocinar en casa.");
    let serialized = crate::ai::transport::provider::payload(
        "google/gemini-2.5-flash",
        &serde_json::from_value::<Vec<PromptMessage>>(captured["messages"].clone()).unwrap(),
        ConnectionRoute::Hosted,
    )
    .unwrap();
    assert_eq!(serialized["messages"], captured["messages"]);
    assert!(
        wire[0]["content"]
            .as_str()
            .unwrap()
            .contains("never answer your own previous question")
    );
    assert_eq!(captured["sourceIds"].as_array().unwrap().len(), 1);
    finish_fixture_exchange(&mut store, &next, "¿Qué preparas?");
    let edited = store
        .execute(revision_command(
            &store,
            &conversation,
            &next,
            "No, no me gusta cocinar.",
        ))
        .unwrap()
        .entity_id;
    let revised = wave2_context(&store, &edited);
    let revised_wire = revised["messages"].as_array().unwrap();
    assert_eq!(revised_wire.len(), 3);
    assert_eq!(revised_wire[1], wire[1]);
    assert_eq!(revised_wire[2]["role"], "user");
    assert_eq!(revised_wire[2]["content"], "No, no me gusta cocinar.");
    let repeated = Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::StartConversation {
            conversation_id: conversation.clone(),
            configuration: configuration(&store, &conversation),
            message: Some("Hello".into()),
            input: Some(Default::default()),
            expected_revision: store.snapshot().unwrap().revision,
        },
    };
    assert!(store.execute(repeated).is_err());
}

#[test]
fn wave2_cancelled_opening_cannot_publish_late_result() {
    let (_dir, mut store, conversation) = setup();
    let revision = store.snapshot().unwrap().revision;
    let mut config = configuration(&store, &conversation);
    config.direction.topic = Some(crate::conversations::direction::TopicChoice::Custom {
        text: "A train journey".into(),
    });
    let turn = apply(
        &mut store,
        Action::StartConversation {
            conversation_id: conversation.clone(),
            configuration: config,
            message: None,
            input: None,
            expected_revision: revision,
        },
    )
    .entity_id;
    assert!(
        wave2_context(&store, &turn)["messages"][0]["content"]
            .as_str()
            .unwrap()
            .contains("A train journey")
    );
    assert!(wave2_context(&store, &turn)["expressionHelp"].is_null());
    store.dispatch().unwrap();
    let dispatched = store.dispatch().unwrap().unwrap();
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn.clone(),
            control: TurnControl::Cancel,
        },
    );
    store
        .finish(&dispatched, Ok(reply("Late opening")))
        .unwrap();
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM messages WHERE turn_id=?1",
                [&turn],
                |r| r.get::<_, i32>(0)
            )
            .unwrap(),
        0
    );
    assert!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["records"]
            .as_array()
            .unwrap()
            .is_empty()
    );
}

fn configuration(
    store: &Store,
    conversation: &str,
) -> crate::conversations::direction::ConversationStartConfig {
    let snapshot = store.snapshot().unwrap();
    let settings = &snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap()
        .settings;
    crate::conversations::direction::ConversationStartConfig {
        difficulty: settings.difficulty.clone(),
        variety_id: settings.variety_id.clone(),
        direction: settings.direction.clone(),
    }
}

#[test]
fn preview_matches_captured_opening_and_does_not_admit_work() {
    let (_dir, mut store, conversation) = setup();
    let mut config = configuration(&store, &conversation);
    config.difficulty = Difficulty::AbsoluteZero;
    config.direction.use_persona_details = false;
    config.direction.time_reference = crate::conversations::direction::TimeReference::Future;
    config.direction.topic =
        Some(crate::conversations::direction::TopicChoice::Builtin { id: "food".into() });
    let before = store.snapshot().unwrap();
    let preview = crate::conversations::conversation_prompt::preview(
        &store.config,
        &before,
        &conversation,
        &config,
    )
    .unwrap();
    assert_eq!(store.snapshot().unwrap().revision, before.revision);
    assert_eq!(
        store
            .connection
            .query_row("SELECT count(*) FROM turns", [], |r| r.get::<_, i32>(0))
            .unwrap(),
        0
    );
    assert_eq!(preview.difficulty_prompts.len(), 5);
    assert!(preview.system_prompt.contains("Absolute zero difficulty"));
    assert!(!preview.system_prompt.contains("Persona background"));
    let turn = apply(
        &mut store,
        Action::StartConversation {
            conversation_id: conversation.clone(),
            configuration: config,
            message: None,
            input: None,
            expected_revision: before.revision,
        },
    )
    .entity_id;
    let captured = wave2_context(&store, &turn);
    assert_eq!(
        captured["messages"],
        serde_json::json!([{ "role": "system", "content": preview.system_prompt }])
    );
    assert!(captured["sourceIds"].as_array().unwrap().is_empty());
}

#[test]
fn invalid_start_rolls_back_settings_and_learner_start_keeps_real_input() {
    let (_dir, mut store, conversation) = setup();
    let before = store.snapshot().unwrap();
    let mut config = configuration(&store, &conversation);
    config.direction.topic = Some(crate::conversations::direction::TopicChoice::Custom {
        text: "My last trip".into(),
    });
    config.direction.time_reference = crate::conversations::direction::TimeReference::Past;
    let command = |message: &str| Command {
        session_id: before.session_id.clone(),
        action_id: id(),
        action: Action::StartConversation {
            conversation_id: conversation.clone(),
            configuration: config.clone(),
            message: Some(message.into()),
            input: Some(Default::default()),
            expected_revision: before.revision,
        },
    };
    assert!(store.execute(command(" ")).is_err());
    assert_eq!(
        serde_json::to_value(store.snapshot().unwrap()).unwrap(),
        serde_json::to_value(&before).unwrap()
    );
    let turn = store.execute(command("Viajé a Madrid.")).unwrap().entity_id;
    let captured = wave2_context(&store, &turn);
    assert_eq!(captured["messages"][1]["content"], "Viajé a Madrid.");
    assert_eq!(
        captured["practiceSettings"]["direction"]["timeReference"],
        "past"
    );
    assert_eq!(captured["input"]["scaffold"], false);
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM messages WHERE turn_id=?1 AND role='user'",
                [&turn],
                |r| r.get::<_, i32>(0)
            )
            .unwrap(),
        1
    );
}

#[test]
fn saved_topic_edits_and_conversation_settings_apply_atomically() {
    let (_dir, mut store, conversation) = setup();
    let mut snapshot = store.snapshot().unwrap();
    let command = Command {
        session_id: snapshot.session_id.clone(),
        action_id: id(),
        action: Action::SaveTopics {
            additions: vec!["My hometown".into()],
            deletions: vec![],
            expected_revision: snapshot.revision,
        },
    };
    store.execute(command.clone()).unwrap();
    store.execute(command).unwrap();
    snapshot = store.snapshot().unwrap();
    assert_eq!(snapshot.saved_topics.len(), 1);
    let saved = snapshot.saved_topics[0].clone();
    let mut config = configuration(&store, &conversation);
    config.direction.topic = Some(crate::conversations::direction::TopicChoice::Custom {
        text: saved.text.clone(),
    });
    let current = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap();
    let command = |revision| Command {
        session_id: snapshot.session_id.clone(),
        action_id: id(),
        action: Action::UpdateConversationPrompt {
            conversation_id: conversation.clone(),
            configuration: config.clone(),
            additions: vec![],
            deletions: vec![saved.id.clone()],
            expected_revision: snapshot.revision,
            expected_settings_revision: revision,
        },
    };
    assert!(
        store
            .execute(command(current.settings_revision + 1))
            .is_err()
    );
    assert_eq!(store.snapshot().unwrap().saved_topics.len(), 1);
    store.execute(command(current.settings_revision)).unwrap();
    let after = store.snapshot().unwrap();
    assert!(after.saved_topics.is_empty());
    assert_eq!(
        after
            .conversations
            .iter()
            .find(|c| c.id == conversation)
            .unwrap()
            .settings
            .direction,
        config.direction
    );
    assert_eq!(
        store
            .connection
            .query_row("SELECT count(*) FROM turns", [], |r| r.get::<_, i32>(0))
            .unwrap(),
        0
    );
}
