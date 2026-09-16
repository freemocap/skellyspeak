use super::*;

#[test]
fn captured_varieties_survive_settings_changes_for_deferred_operations() {
    let (_dir, mut store, conversation) = setup();
    let snapshot = store.snapshot().unwrap();
    let current = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap();
    let mut settings = current.settings.clone();
    settings.variety_id = "spanish-mexico".into();
    settings.explanation_variety_id = "english-united-kingdom".into();
    apply(
        &mut store,
        Action::UpdateSettings {
            conversation_id: conversation.clone(),
            expected_revision: current.settings_revision,
            settings,
        },
    );
    let receipt = store.execute(send(&store, &conversation)).unwrap();
    let before: String = store
        .connection
        .query_row(
            "SELECT context FROM turns WHERE id=?1",
            [&receipt.entity_id],
            |r| r.get(0),
        )
        .unwrap();
    let before: serde_json::Value = serde_json::from_str(&before).unwrap();
    assert_eq!(before["languageContext"]["variety_id"], "spanish-mexico");
    assert_eq!(
        before["languageContext"]["explanation_variety_id"],
        "english-united-kingdom"
    );
    let snapshot = store.snapshot().unwrap();
    let current = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap();
    let mut settings = current.settings.clone();
    settings.variety_id = "spanish-spain".into();
    settings.explanation_variety_id = "english-united-states".into();
    apply(
        &mut store,
        Action::UpdateSettings {
            conversation_id: conversation.clone(),
            expected_revision: current.settings_revision,
            settings,
        },
    );
    let after: String = store
        .connection
        .query_row(
            "SELECT context FROM turns WHERE id=?1",
            [&receipt.entity_id],
            |r| r.get(0),
        )
        .unwrap();
    let after: serde_json::Value = serde_json::from_str(&after).unwrap();
    assert_eq!(before["languageContext"], after["languageContext"]);
    assert!(
        after["languageContext"]["guidance"]["explanation_writing"]
            .to_string()
            .contains("United Kingdom")
    );
}

#[test]
fn writing_guidance_keeps_target_and_explanation_languages_independent_and_captured() {
    for (target, explanation) in [
        ("mandarin", "english"),
        ("spanish", "mandarin"),
        ("mandarin", "mandarin"),
        ("spanish", "english"),
    ] {
        for coach in [false, true] {
            let (_dir, mut store, existing) = setup();
            let conversation = if target == "spanish" {
                existing
            } else {
                // Creating a contact also creates its first conversation, which is
                // the one this test needs.
                apply(
                    &mut store,
                    Action::CreateContact {
                        language_id: target.into(),
                        details: crate::partners::persona::starter(target).unwrap(),
                    },
                )
                .entity_id
            };
            store.connection.execute(
                "UPDATE conversation_settings SET settings=json_set(settings,'$.explanationLanguage',?2,'$.explanationVarietyId',?3,'$.readAloud',json('false'),'$.translation',json('true')) WHERE conversation_id=?1",
                params![conversation, explanation, store.config.language(explanation).unwrap().default_variety],
            ).unwrap();
            let mut command = send(&store, &conversation);
            if coach {
                let Action::SendMessage {
                    conversation_id,
                    expected_revision,
                    ..
                } = command.action
                else {
                    unreachable!()
                };
                command.action = Action::AskCoach {
                    conversation_id,
                    expected_revision,
                    text: "Explain this quotation: 漢字。".into(),
                };
            }
            store.execute(command).unwrap();
            isolate_coaching(&mut store);
            // Later settings must not substitute a new explanation language in
            // either the already captured coach prompt or deferred translation.
            let later = if explanation == "mandarin" {
                "english"
            } else {
                "mandarin"
            };
            store.connection.execute(
                "UPDATE conversation_settings SET settings=json_set(settings,'$.explanationLanguage',?2,'$.explanationVarietyId',?3) WHERE conversation_id=?1",
                params![conversation, later, store.config.language(later).unwrap().default_variety],
            ).unwrap();
            assert!(store.dispatch().unwrap().is_none());
            let primary = store.dispatch().unwrap().unwrap();
            let instruction = &primary.messages[0].content;
            assert_eq!(instruction.contains("Target-language writing: Write newly generated Mandarin text in Simplified Chinese characters."), target == "mandarin");
            assert_eq!(instruction.contains("Explanation-language writing: Write newly generated Mandarin text in Simplified Chinese characters."), coach && explanation == "mandarin");
            if coach {
                assert_eq!(
                    primary.messages.last().unwrap().content,
                    "Explain this quotation: 漢字。"
                );
                continue;
            }
            store.finish(&primary, Ok(reply("漢字。"))).unwrap();
            let mut translation = None;
            for _ in 0..2 {
                let child = store.dispatch().unwrap().unwrap();
                if child.gloss_source.is_none() {
                    translation = Some(child);
                }
            }
            let translation = translation.unwrap();
            let instruction = &translation.messages[0].content;
            assert!(instruction.contains(&format!("passage into {explanation}.")));
            assert_eq!(instruction.contains("Destination-language writing: Write newly generated Mandarin text in Simplified Chinese characters."), explanation == "mandarin");
            assert!(!instruction.contains("Target-language writing:"));
            assert_eq!(translation.messages[1].content, "漢字。");
        }
    }
}

#[test]
fn focus_is_frozen_and_reaches_partner_and_both_coach_prompts() {
    let (_dir, mut store, conversation) = setup();
    store
        .connection
        .execute(
            "INSERT INTO skill_choices VALUES('spanish',1,'question','[]')",
            [],
        )
        .unwrap();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let captured: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
            r.get(0)
        })
        .unwrap();
    let captured: serde_json::Value = serde_json::from_str(&captured).unwrap();
    assert_eq!(captured["practiceFocus"]["source"], "learner");
    let block =
        crate::conversations::conversation_prompt::focus_block(&captured["practiceFocus"]).unwrap();
    assert!(
        captured["messages"][0]["content"]
            .as_str()
            .unwrap()
            .contains(&block)
    );
    finish_fixture_exchange(&mut store, &turn, "Reply.");
    store
        .connection
        .execute("UPDATE skill_choices SET focus='greeting',revision=2", [])
        .unwrap();
    for kind in [
        crate::learning::coaching::FEEDBACK,
        crate::learning::coaching::SUGGESTIONS,
    ] {
        let prompt =
            crate::learning::coaching::prompt(&store.connection, &turn, kind, &captured).unwrap();
        if kind == crate::learning::coaching::FEEDBACK {
            assert!(!prompt[0].content.contains(&block));
            let data: serde_json::Value = serde_json::from_str(&prompt[1].content).unwrap();
            assert_eq!(data["focus"], "question");
        } else {
            assert!(prompt[0].content.contains(&block));
        }
        let mut no_focus = captured.clone();
        no_focus["practiceFocus"] = serde_json::Value::Null;
        let prompt =
            crate::learning::coaching::prompt(&store.connection, &turn, kind, &no_focus).unwrap();
        assert!(!prompt[0].content.contains("Practice focus ("));
    }
    let next = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let next: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [next], |r| {
            r.get(0)
        })
        .unwrap();
    let next: serde_json::Value = serde_json::from_str(&next).unwrap();
    assert_eq!(next["practiceFocus"]["id"], "greeting");
    assert_eq!(captured["practiceFocus"]["id"], "question");
}

#[test]
fn every_language_guidance_reaches_coach_prompts_and_all_outcomes_validate() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &turn, "Reply.");
    let captured: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
            r.get(0)
        })
        .unwrap();
    let mut captured: serde_json::Value = serde_json::from_str(&captured).unwrap();
    for language in crate::language::languages::registry() {
        captured["targetLanguage"] = serde_json::json!(language.id);
        captured["languageContext"] =
            serde_json::to_value(store.config.resolve(&language.id, None, "english").unwrap())
                .unwrap();
        let suggestions = crate::learning::coaching::prompt(
            &store.connection,
            &turn,
            crate::learning::coaching::SUGGESTIONS,
            &captured,
        )
        .unwrap();
        if let Some(guidance) =
            crate::language::languages::romanization_guidance(&language.id).unwrap()
        {
            assert!(suggestions[0].content.contains(&guidance));
        } else {
            assert!(!suggestions[0].content.contains("romanization"));
        }
        let feedback = crate::learning::coaching::prompt(
            &store.connection,
            &turn,
            crate::learning::coaching::FEEDBACK,
            &captured,
        )
        .unwrap();
        if let Some(guidance) =
            crate::language::languages::assessment_guidance(&language.id).unwrap()
        {
            assert!(feedback[0].content.contains(guidance));
        }
        if language.id != "arabic" {
            assert!(!feedback[0].content.contains("normalize Arabic"));
        }
    }
    for outcome in [
        "demonstrated",
        "partial",
        "not_demonstrated",
        "not_observed",
        "uncertain",
    ] {
        let body=serde_json::json!({"meaning_recovered":"full","items":[{"construct":"question","quote":"¿cómo estás?","outcome":outcome,"error":null,"rationale":"Fixture context."}]}).to_string();
        let value = crate::learning::coaching::validate(
            &store.connection,
            &turn,
            crate::learning::coaching::FEEDBACK,
            &reply(&body),
        )
        .unwrap();
        assert_eq!(value["observation"]["items"][0]["outcome"], outcome);
        // Each variant is an isolated publication fixture, not a rewrite of earned XP.
        store
            .connection
            .execute(
                "UPDATE turns SET context=json_remove(context,'$.rewardEvents') WHERE id=?1",
                [&turn],
            )
            .unwrap();
        crate::learning::coaching::publish(
            &store.connection,
            &turn,
            crate::learning::coaching::FEEDBACK,
            &value,
            "five-outcomes",
        )
        .unwrap();
        assert_eq!(
            crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]
                ["xp"],
            match outcome {
                "demonstrated" => 30,
                "partial" => 12,
                _ => 0,
            }
        );
    }
}
