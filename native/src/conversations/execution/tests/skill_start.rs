use super::*;

fn start(store: &Store, source: &str, subskill: Option<&str>) -> Command {
    let snapshot = store.snapshot().unwrap();
    let owner = snapshot
        .conversations
        .iter()
        .find(|c| c.id == source)
        .unwrap();
    Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::StartSkillConversation {
            source_conversation_id: source.into(),
            language: owner.language_id.clone(),
            variety: owner.settings.variety_id.clone(),
            skill_id: "time_events".into(),
            subskill_id: subskill.map(Into::into),
            expected_revision: snapshot.revision,
        },
    }
}

#[test]
fn skill_start_keeps_partner_and_focus_without_manufacturing_learner_evidence() {
    let (dir, mut store, source) = setup();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.direction.timeReference','past') WHERE conversation_id=?1", [&source]).unwrap();
    let command = start(&store, &source, None);
    let conversation = store.execute(command.clone()).unwrap().entity_id;
    assert_eq!(store.execute(command).unwrap().entity_id, conversation);
    let snapshot = store.snapshot().unwrap();
    let owner = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap();
    let original = snapshot
        .conversations
        .iter()
        .find(|c| c.id == source)
        .unwrap();
    assert_eq!(owner.contact_id, original.contact_id);
    assert_eq!(
        owner.settings.direction.time_reference,
        crate::conversations::direction::TimeReference::Any
    );
    assert_eq!(owner.settings.difficulty, original.settings.difficulty);
    let turns = store.conversation_snapshot(&conversation, None).unwrap();
    let context = wave2_context(&store, &turns.turns[0].id);
    assert_eq!(context["practiceFocus"]["id"], "time_events");
    assert_eq!(context["practiceFocus"]["source"], "learner");
    let prompt = context["messages"][0]["content"].as_str().unwrap();
    assert!(prompt.contains("learner’s skill"));
    assert!(prompt.contains("spanish-time-events-explained-in-english.yaml"));
    assert!(turns.messages.is_empty());
    assert!(
        !turns.turns[0]
            .operations
            .iter()
            .any(|o| o.kind == "skill_assessment")
    );
    finish_fixture_exchange(&mut store, &turns.turns[0].id, "¿Qué hiciste ayer?");
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    assert_eq!(
        wave2_context(&store, &turn)["practiceFocus"]["id"],
        "time_events"
    );
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert!(matches!(
        store
            .snapshot()
            .unwrap()
            .conversations
            .iter()
            .find(|c| c.id == conversation)
            .unwrap()
            .settings
            .direction
            .topic,
        Some(crate::conversations::direction::TopicChoice::Skill { .. })
    ));
}

#[test]
fn invalid_skill_context_rolls_back_the_entire_start() {
    let (_dir, mut store, source) = setup();
    let before = store.snapshot().unwrap().conversations.len();
    assert!(
        store
            .execute(start(&store, &source, Some("nonexistent")))
            .is_err()
    );
    assert_eq!(store.snapshot().unwrap().conversations.len(), before);
    let mut command = start(&store, &source, None);
    if let Action::StartSkillConversation { language, .. } = &mut command.action {
        *language = "english".into();
    }
    assert!(store.execute(command).is_err());
    assert_eq!(store.snapshot().unwrap().conversations.len(), before);
}

#[test]
fn subskill_start_sends_only_the_selected_section() {
    let (_dir, mut store, source) = setup();
    let conversation = store
        .execute(start(&store, &source, Some("past_events")))
        .unwrap()
        .entity_id;
    let turns = store.conversation_snapshot(&conversation, None).unwrap();
    let context = wave2_context(&store, &turns.turns[0].id);
    assert_eq!(context["practiceFocus"]["subskillId"], "past_events");
    let edition = store.config.guide_source("spanish", "time_events").unwrap();
    let prompt = context["messages"][0]["content"].as_str().unwrap();
    for section in &edition.guide.sections {
        assert_eq!(
            prompt.contains(&section.explanation),
            section.subskill_id == "past_events"
        );
    }
}
