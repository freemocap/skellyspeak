//! Opt-in live verification against the loopback development service.
use super::*;

#[tokio::test]
#[ignore = "Requires the local development server and makes two paid feedback requests"]
async fn local_feedback_and_clarification_round_trip() {
    let (_dir, mut store, conversation) = setup();
    store
        .connection
        .execute(
            "UPDATE ai_config SET custom_config=?1",
            [serde_json::to_string(&CustomEndpoint {
                base_url: "http://127.0.0.1:8765/v1".into(),
                bearer_auth: false,
            })
            .unwrap()],
        )
        .unwrap();
    store.select_route(2, ConnectionRoute::Custom).unwrap();
    let mut command = send(&store, &conversation);
    if let Action::SendMessage { text, .. } = &mut command.action {
        *text = "Ayer yo cocina huevos.".into();
    }
    let turn = store.execute(command).unwrap().entity_id;
    store
        .connection
        .execute(
            "DELETE FROM operations WHERE kind NOT IN ('persona_context','coach_feedback')",
            [],
        )
        .unwrap();
    store.dispatch().unwrap();
    let token = std::fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../server/.local-server/session-token.txt"),
    )
    .unwrap();
    let client = crate::ai::transport::provider::client().unwrap();
    let mut corrections = Vec::new();
    for note in [
        None,
        Some(
            "I meant that she cooked eggs yesterday, not that I cooked them. The pronoun was transcribed incorrectly.",
        ),
    ] {
        if let Some(note) = note {
            apply(
                &mut store,
                Action::ReassessFeedback {
                    turn_id: turn.clone(),
                    note: note.into(),
                },
            );
        }
        let work = store.dispatch().unwrap().unwrap();
        assert_eq!(work.target.url, "http://127.0.0.1:8765/v1/operations");
        let output = crate::ai::transport::provider::structured_output(
            work.coaching_schema.as_ref().unwrap(),
        );
        let result = crate::ai::transport::provider::complete_with_output(
            &client,
            token.trim(),
            &work,
            output,
        )
        .await;
        store.finish(&work, result).unwrap();
        let raw: String = store
            .connection
            .query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
                r.get(0)
            })
            .unwrap();
        let context: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert!(
            context["coach_feedbackError"].is_null(),
            "feedback failed: {}",
            context["coach_feedbackError"]
        );
        let shown = &context["coachDecision"]["shown"];
        assert_eq!(shown["move"], "explicit");
        assert!(!shown["quote"].as_str().unwrap().is_empty());
        assert!(!shown["explanation"].as_str().unwrap().is_empty());
        corrections.push(shown["text"].as_str().unwrap().to_owned());
        if let Some(note) = note {
            assert_eq!(context["feedbackContext"], note);
        }
        assert!(context.get("rewardEvents").is_none());
    }
    assert_ne!(
        corrections[0], corrections[1],
        "clarified subject should change the correction"
    );
    let source: String = store
        .connection
        .query_row(
            "SELECT text FROM messages WHERE turn_id=?1 AND role='user'",
            [&turn],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(source, "Ayer yo cocina huevos.");
    eprintln!("Local correction and clarification completed; source preserved and no XP awarded.");
}
