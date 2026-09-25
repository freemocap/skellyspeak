use super::*;
use crate::conversations::direction::{ConversationStartConfig, TopicChoice};
use crate::learning::recommendations::{self, RecommendationMode};

fn config(store: &Store, conversation: &str, mode: RecommendationMode) -> ConversationStartConfig {
    let snapshot = store.snapshot().unwrap();
    let settings = &snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap()
        .settings;
    let mut direction = settings.direction.clone();
    direction.topic = Some(TopicChoice::Coach { mode });
    ConversationStartConfig {
        difficulty: settings.difficulty.clone(),
        variety_id: settings.variety_id.clone(),
        direction,
    }
}
fn start(
    store: &mut Store,
    conversation: &str,
    configuration: ConversationStartConfig,
) -> Result<String> {
    let command = Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::StartConversation {
            conversation_id: conversation.into(),
            configuration,
            message: None,
            input: None,
            expected_revision: store.snapshot().unwrap().revision,
        },
    };
    Ok(store.execute(command)?.entity_id)
}
#[test]
fn coach_opening_captures_preview_selection_and_keeps_it_without_awarding() {
    let (_dir, mut store, conversation) = setup();
    let configuration = config(&store, &conversation, RecommendationMode::Explore);
    let snapshot = store.snapshot().unwrap();
    let mut owner = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap()
        .clone();
    owner.settings.direction = configuration.direction.clone();
    owner.settings_revision += 1;
    let expected = recommendations::capture(
        &store.connection,
        &store.config,
        &store.session_id,
        &owner,
        &configuration.direction,
    )
    .unwrap()
    .unwrap();
    let turn = start(&mut store, &conversation, configuration).unwrap();
    let captured = wave2_context(&store, &turn);
    assert_eq!(captured["practiceRecommendation"], expected);
    assert!(
        captured["messages"][0]["content"]
            .as_str()
            .unwrap()
            .contains("Practice selection (data)")
    );
    assert_eq!(captured["practiceFocus"]["id"], expected["skill"]["id"]);
    finish_fixture_exchange(&mut store, &turn, "An opening.");
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        0
    );
    let next = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    assert_eq!(
        wave2_context(&store, &next)["practiceRecommendation"],
        expected
    );
    // Credit the selected skill, changing its ranking for fresh exploration.
    // The existing conversation must retain its original selection and basis.
    let work = super::skill_assessment::assessment(&mut store, &next);
    let result = super::skill_assessment::presence(
        &work,
        &[(expected["skill"]["id"].as_str().unwrap(), "direct")],
    );
    store.finish(&work, Ok(result)).unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        1
    );
    // Unrelated preferences must not move the selected practice target.
    store
        .connection
        .execute(
            "UPDATE conversation_settings SET revision=revision+1 WHERE conversation_id=?1",
            [&conversation],
        )
        .unwrap();
    let later = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    assert_eq!(
        wave2_context(&store, &later)["practiceRecommendation"],
        expected
    );
}
#[test]
fn depth_without_effort_reports_an_error_without_starting_or_saving_settings() {
    let (_dir, mut store, conversation) = setup();
    let before = store.snapshot().unwrap().revision;
    let configuration = config(
        &store,
        &conversation,
        RecommendationMode::ContinuePracticing,
    );
    let error = start(&mut store, &conversation, configuration).unwrap_err();
    assert!(error.message.contains("No retry effort"));
    assert_eq!(store.snapshot().unwrap().revision, before);
    assert_eq!(
        store
            .connection
            .query_row("SELECT count(*) FROM turns", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
}
#[test]
fn persona_and_custom_topic_do_not_receive_coach_targets() {
    for topic in [
        None,
        Some(TopicChoice::Custom {
            text: "A train journey".into(),
        }),
    ] {
        let (_dir, mut store, conversation) = setup();
        let mut configuration = config(&store, &conversation, RecommendationMode::Explore);
        configuration.direction.topic = topic;
        let turn = start(&mut store, &conversation, configuration).unwrap();
        let captured = wave2_context(&store, &turn);
        assert!(captured["practiceRecommendation"].is_null());
        assert!(
            !captured["messages"][0]["content"]
                .as_str()
                .unwrap()
                .contains("Practice selection (data)")
        );
    }
}

#[test]
fn depth_uses_saved_retry_effort_respects_exclusions_and_does_not_transfer_between_varieties() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "Reply.");
    fixture_evidence(&store, &first, "¿cómo estás?");
    let second = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "¿Cómo está tu hermana?",
        ))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &second, "Reply.");
    fixture_evidence(&store, &second, "¿Cómo está tu hermana?");
    let snapshot = store.snapshot().unwrap();
    let mut owner = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap()
        .clone();
    owner.id = "new-conversation-fixture".into();
    let direction = config(
        &store,
        &conversation,
        RecommendationMode::ContinuePracticing,
    )
    .direction;
    let recommendation = recommendations::capture(
        &store.connection,
        &store.config,
        &store.session_id,
        &owner,
        &direction,
    )
    .unwrap()
    .unwrap();
    assert_eq!(
        recommendation["selection"]["skill"]["skillId"],
        "questions_answers"
    );
    assert_eq!(recommendation["selection"]["skill"]["effort"], 1);
    owner.settings.variety_id = "spanish-mexico".into();
    assert!(
        recommendations::capture(
            &store.connection,
            &store.config,
            &store.session_id,
            &owner,
            &direction
        )
        .is_err()
    );
    owner.settings.variety_id = "spanish-spain".into();
    store
        .connection
        .execute(
            "INSERT INTO skill_choices VALUES('spanish',1,NULL,?1)",
            [serde_json::json!([format!("evidence-{second}")]).to_string()],
        )
        .unwrap();
    assert!(
        recommendations::capture(
            &store.connection,
            &store.config,
            &store.session_id,
            &owner,
            &direction
        )
        .is_err()
    );
}
