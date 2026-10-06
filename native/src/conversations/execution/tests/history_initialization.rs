use super::*;

#[test]
fn initialization_survives_capture_dispatch_and_inspection_without_becoming_learner_history() {
    for partner_first in [true, false] {
        let (_dir, mut store, conversation) = setup();
        if partner_first {
            let snapshot = store.snapshot().unwrap();
            let settings = &snapshot.conversations[0].settings;
            let config = crate::conversations::direction::ConversationStartConfig {
                prompt_editor: None,
                difficulty: settings.difficulty.clone(),
                variety_id: settings.variety_id.clone(),
                direction: settings.direction.clone(),
            };
            let opening = apply(
                &mut store,
                Action::StartConversation {
                    conversation_id: conversation.clone(),
                    configuration: config,
                    message: None,
                    input: None,
                    expected_revision: snapshot.revision,
                },
            )
            .entity_id;
            finish_fixture_exchange(&mut store, &opening, "Tengo hambre.");
        }
        // Cross the 40-source window: its first retained role must decide
        // initialization, not the original conversation's starting mode.
        for index in 0..22 {
            let turn = store
                .execute(send(&store, &conversation))
                .unwrap()
                .entity_id;
            let captured = wave2_context(&store, &turn);
            let messages = captured["messages"].as_array().unwrap();
            let sources = captured["sourceIds"].as_array().unwrap();
            let initialized = partner_first && index < 20;
            assert_eq!(messages.len(), sources.len() + 2 + usize::from(initialized));
            assert_eq!(messages[1]["role"], "user");
            assert_eq!(messages.last().unwrap()["content"], "Hola, ¿cómo estás?");
            let offset = if initialized { 2 } else { 1 };
            for (source, sent) in sources.iter().zip(&messages[offset..]) {
                let (role, text): (String, String) = store
                    .connection
                    .query_row(
                        "SELECT role,text FROM messages WHERE id=?1",
                        [source.as_str().unwrap()],
                        |r| Ok((r.get(0)?, r.get(1)?)),
                    )
                    .unwrap();
                assert_eq!(sent["role"], role);
                assert_eq!(sent["content"], text);
            }
            assert!(store.dispatch().unwrap().is_none());
            let dispatch = store.dispatch().unwrap().unwrap();
            let wire = crate::ai::transport::provider::dispatch_payload(
                &dispatch.text_request(),
                crate::ai::transport::provider::RequestOutput::Prose,
            )
            .unwrap();
            let recorded = store
                .attempt_detail(&dispatch.attempt)
                .unwrap()
                .request_messages
                .unwrap();
            assert_eq!(wire["messages"], captured["messages"]);
            assert_eq!(serde_json::to_value(recorded).unwrap(), wire["messages"]);
            let learner_rows: i32 = store
                .connection
                .query_row(
                    "SELECT count(*) FROM messages WHERE conversation_id=?1 AND role='user'",
                    [&conversation],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(learner_rows, index + 1);
            // Complete fixture work without scheduling external assistance.
            finish_fixture_exchange(&mut store, &turn, "Un cafe\u{301}. 你好。مرحبا.");
        }
    }
}
