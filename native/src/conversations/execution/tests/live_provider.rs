use super::*;

#[tokio::test]
#[ignore = "uses live provider credentials and incurs two requests"]
async fn live_cooking_feedback_regression() {
    let path =
        std::env::var("SKELLYSPEAK_LIVE_KEYS").expect("Set the local key-file path explicitly");
    let keys = std::fs::read_to_string(path).unwrap();
    let key = keys
        .lines()
        .find_map(|line| line.strip_prefix("OPENROUTER_API_KEY="))
        .expect("Missing OpenRouter key")
        .trim()
        .trim_matches(['\"', '\'']);
    let (_dir, mut store, conversation) = setup();
    let mut command = send(&store, &conversation);
    if let Action::SendMessage { text, .. } = &mut command.action {
        *text = "si me gusta cosenar".into();
    }
    store.execute(command).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let mut persona = store.dispatch().unwrap().unwrap();
    let feedback = store.dispatch().unwrap().unwrap();
    let last = persona.messages.len() - 1;
    persona.messages.insert(
        last,
        PromptMessage {
            role: "assistant".into(),
            content: "¿Te gusta cocinar?".into(),
        },
    );
    let client = crate::ai::transport::provider::client().unwrap();
    let reply = crate::ai::transport::provider::complete(&client, key, &persona)
        .await
        .unwrap();
    println!("LIVE PARTNER: {}", reply.text);
    assert!(
        !reply
            .text
            .to_lowercase()
            .starts_with("sí, me gusta cocinar"),
        "Partner echoed the learner instead of responding"
    );
    store.finish(&persona, Ok(reply)).unwrap();
    let result = crate::ai::transport::provider::complete_with_output(
        &client,
        key,
        &feedback,
        crate::ai::transport::provider::RequestOutput::JsonSchema {
            name: "coach_observation",
            schema: feedback.coaching_schema.as_ref().unwrap(),
        },
    )
    .await
    .unwrap();
    println!("LIVE COACH: {}", result.text);
    let turn: String = store
        .connection
        .query_row(
            "SELECT turn_id FROM operations WHERE id=?1",
            [&feedback.operation],
            |r| r.get(0),
        )
        .unwrap();
    let validated = crate::learning::coaching::coach_observation::validate(
        &store.connection,
        &turn,
        "coach_feedback",
        &result,
    )
    .unwrap();
    let observation: crate::learning::coaching::CoachObservation =
        serde_json::from_value(validated["observation"].clone()).unwrap();
    assert!(
        observation.items.iter().any(|item| item.error.is_some()),
        "Spelling error was missed"
    );
    assert!(
        observation
            .items
            .iter()
            .filter(|item| item.error.is_some() || !item.rationale.is_empty())
            .count()
            <= 1
    );
    store.finish(&feedback, Ok(result)).unwrap();
}
