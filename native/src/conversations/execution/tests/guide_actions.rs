use super::*;

fn reference(
    store: &Store,
    conversation: &str,
) -> crate::configuration::guide_translation::GuideReference {
    let snapshot = store.snapshot().unwrap();
    let owner = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap();
    store
        .config
        .guide_source(&owner.language_id, "time_events")
        .unwrap()
        .context(&owner.settings.variety_id)
        .reference
}

#[test]
fn guide_example_uses_exact_authored_text_and_rejects_stale_references() {
    let (_dir, mut store, source) = setup();
    let guide = reference(&store, &source);
    let expected = store
        .config
        .referenced_guide(&guide)
        .unwrap()
        .context(&guide.variety)
        .examples[0]
        .clone();
    let snapshot = store.snapshot().unwrap();
    let command = Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::StartGuideConversation {
            source_conversation_id: source.clone(),
            guide: guide.clone(),
            example: 0,
            phrase: None,
            expected_revision: snapshot.revision,
        },
    };
    let conversation = store.execute(command.clone()).unwrap().entity_id;
    assert_eq!(store.execute(command).unwrap().entity_id, conversation);
    let opened = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(opened.phrase_seed.as_deref(), Some(expected.as_str()));
    assert!(opened.messages.is_empty());
    let context = wave2_context(&store, &opened.turns[0].id);
    assert_eq!(
        context["phraseSeed"]["guide"]["fingerprint"],
        guide.fingerprint
    );
    assert!(
        !opened.turns[0]
            .operations
            .iter()
            .any(|o| o.kind == "skill_assessment")
    );
    store.dispatch().unwrap();
    let opening = store.dispatch().unwrap().unwrap();
    store
        .finish(&opening, Ok(reply(&format!("{expected} ¿Y tú?"))))
        .unwrap();
    assert!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages[0]
            .text
            .contains(&expected)
    );

    let before = store.snapshot().unwrap().conversations.len();
    let mut stale = guide;
    stale.fingerprint = "stale".into();
    let failed = Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::StartGuideConversation {
            source_conversation_id: source,
            guide: stale,
            example: 0,
            phrase: None,
            expected_revision: store.snapshot().unwrap().revision,
        },
    };
    assert!(store.execute(failed).is_err());
    assert_eq!(store.snapshot().unwrap().conversations.len(), before);
}

#[test]
fn guide_coach_context_is_inspectable_and_stays_out_of_partner_history() {
    let (_dir, mut store, conversation) = setup();
    let guide = reference(&store, &conversation);
    let revision = store
        .snapshot()
        .unwrap()
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap()
        .revision;
    let turn = apply(
        &mut store,
        Action::AskGuideCoach {
            conversation_id: conversation.clone(),
            text: "Explain this skill.".into(),
            focus: None,
            guide,
            expected_revision: revision,
        },
    )
    .entity_id;
    let context = wave2_context(&store, &turn);
    assert!(
        context["guideContext"]["markdown"]
            .as_str()
            .unwrap()
            .contains("###")
    );
    assert!(
        context["messages"][0]["content"]
            .as_str()
            .unwrap()
            .contains("Guide attached to this question")
    );
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(view.messages.is_empty());
    assert!(view.coach_messages[0].guide_context.is_some());
    store.dispatch().unwrap();
    let task = store.dispatch().unwrap().unwrap();
    store
        .finish(&task, Ok(reply("Here is the explanation.")))
        .unwrap();
    let revision = store
        .snapshot()
        .unwrap()
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap()
        .revision;
    let followup = apply(
        &mut store,
        Action::AskCoach {
            conversation_id: conversation.clone(),
            text: "Why?".into(),
            expected_revision: revision,
        },
    )
    .entity_id;
    assert!(
        wave2_context(&store, &followup)["messages"]
            .as_array()
            .unwrap()
            .iter()
            .any(|m| m["content"]
                .as_str()
                .unwrap()
                .contains("Attached guide (reference data"))
    );
    store.dispatch().unwrap();
    let task = store.dispatch().unwrap().unwrap();
    store
        .finish(&task, Ok(reply("Because of its role here.")))
        .unwrap();
    let partner_turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let partner = wave2_context(&store, &partner_turn);
    assert!(partner["messages"].as_array().unwrap().iter().all(|m| {
        !m["content"]
            .as_str()
            .unwrap()
            .contains("Attached guide (reference data")
    }));
    assert!(partner.get("guideContext").is_none());
}

#[test]
fn selected_guide_material_is_validated_and_bounded_to_its_section() {
    use crate::configuration::guide_translation::GuideCoachFocus;
    for focus in [
        GuideCoachFocus::Subskill {
            subskill_id: "past_events".into(),
        },
        GuideCoachFocus::Example { index: 1 },
    ] {
        let (_dir, mut store, conversation) = setup();
        let guide = reference(&store, &conversation);
        let edition = store.config.referenced_guide(&guide).unwrap();
        let revision = store
            .snapshot()
            .unwrap()
            .conversations
            .iter()
            .find(|c| c.id == conversation)
            .unwrap()
            .revision;
        let command = Command {
            session_id: store.session_id.clone(),
            action_id: id(),
            action: Action::AskGuideCoach {
                conversation_id: conversation.clone(),
                text: "Explain this selection.".into(),
                guide,
                focus: Some(focus),
                expected_revision: revision,
            },
        };
        let turn = store.execute(command.clone()).unwrap().entity_id;
        assert_eq!(store.execute(command).unwrap().entity_id, turn);
        let context = wave2_context(&store, &turn);
        let attachment = &context["guideContext"];
        assert_eq!(attachment["selection"]["subskillId"], "past_events");
        let markdown = attachment["markdown"].as_str().unwrap();
        assert!(markdown.contains(&edition.guide.sections[1].examples[0].text));
        assert!(!markdown.contains(&edition.guide.sections[0].explanation));
        assert!(
            store
                .conversation_snapshot(&conversation, None)
                .unwrap()
                .messages
                .is_empty()
        );
    }
}

#[test]
fn unknown_guide_selections_do_not_create_coach_turns() {
    use crate::configuration::guide_translation::GuideCoachFocus;
    let (_dir, mut store, conversation) = setup();
    let guide = reference(&store, &conversation);
    let before = store.conversation_snapshot(&conversation, None).unwrap();
    for focus in [
        GuideCoachFocus::Subskill {
            subskill_id: "unknown".into(),
        },
        GuideCoachFocus::Example { index: usize::MAX },
    ] {
        let revision = store
            .snapshot()
            .unwrap()
            .conversations
            .iter()
            .find(|c| c.id == conversation)
            .unwrap()
            .revision;
        let command = Command {
            session_id: store.session_id.clone(),
            action_id: id(),
            action: Action::AskGuideCoach {
                conversation_id: conversation.clone(),
                text: "Explain this selection.".into(),
                guide: guide.clone(),
                focus: Some(focus),
                expected_revision: revision,
            },
        };
        assert!(store.execute(command).is_err());
    }
    let after = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(after.turns.len(), before.turns.len());
    assert_eq!(after.coach_messages.len(), before.coach_messages.len());
}

#[test]
fn guide_popup_phrase_must_be_an_exact_part_of_its_authored_example() {
    let (_dir, mut store, source) = setup();
    let guide = reference(&store, &source);
    let phrase = store
        .config
        .referenced_guide(&guide)
        .unwrap()
        .context(&guide.variety)
        .examples[0]
        .split_whitespace()
        .next()
        .unwrap()
        .to_string();
    let before = store.snapshot().unwrap().conversations.len();
    for text in [
        "not in this example".to_string(),
        String::new(),
        phrase.clone(),
    ] {
        let command = Command {
            session_id: store.session_id.clone(),
            action_id: id(),
            action: Action::StartGuideConversation {
                source_conversation_id: source.clone(),
                guide: guide.clone(),
                example: 0,
                phrase: Some(text.clone()),
                expected_revision: store.snapshot().unwrap().revision,
            },
        };
        let result = store.execute(command);
        if text == phrase {
            let conversation = result.unwrap().entity_id;
            assert_eq!(
                store
                    .conversation_snapshot(&conversation, None)
                    .unwrap()
                    .phrase_seed
                    .as_deref(),
                Some(phrase.as_str())
            );
        } else {
            assert!(result.is_err());
            assert_eq!(store.snapshot().unwrap().conversations.len(), before);
        }
    }
}
