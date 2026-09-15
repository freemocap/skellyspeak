use super::*;

#[test]
fn wave2_partner_opening_is_real_history_without_learner_evidence() {
    let (_dir, mut store, conversation) = setup();
    let command = Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::StartConversation {
            conversation_id: conversation.clone(),
            opening: Opening::Surprise,
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
        crate::learning::learner::progression::snapshot(&store, "es").unwrap()["records"]
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
            .contains("never answer your own question")
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
            conversation_id: conversation,
            opening: Opening::Learner,
            expected_revision: store.snapshot().unwrap().revision,
        },
    };
    assert!(store.execute(repeated).is_err());
}

#[test]
fn wave2_cancelled_opening_cannot_publish_late_result() {
    let (_dir, mut store, conversation) = setup();
    let revision = store.snapshot().unwrap().revision;
    let turn = apply(
        &mut store,
        Action::StartConversation {
            conversation_id: conversation.clone(),
            opening: Opening::Described {
                text: "A train journey".into(),
            },
            expected_revision: revision,
        },
    )
    .entity_id;
    assert_eq!(
        wave2_context(&store, &turn)["expressionHelp"]["text"],
        "A train journey"
    );
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
        crate::learning::learner::progression::snapshot(&store, "es").unwrap()["records"]
            .as_array()
            .unwrap()
            .is_empty()
    );
}
