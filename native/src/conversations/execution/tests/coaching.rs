use super::*;

#[test]
fn coach_is_durable_and_excluded_from_persona_context() {
    let (_dir, mut store, conversation) = setup();
    let revision = store.snapshot().unwrap().conversations[0].revision;
    apply(
        &mut store,
        Action::AskCoach {
            conversation_id: conversation.clone(),
            text: "Private coach question".into(),
            expected_revision: revision,
        },
    );
    assert!(store.dispatch().unwrap().is_none());
    let coach = store.dispatch().unwrap().unwrap();
    store
        .finish(&coach, Ok(reply("Private coach explanation")))
        .unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 0);
    assert_eq!(snapshot.coach_messages.len(), 2);
    let persona = begin(&mut store, &conversation);
    assert!(
        !persona
            .messages
            .iter()
            .any(|m| m.content.contains("Private coach"))
    );
    store.finish(&persona, Ok(reply("Hola."))).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 2);
    assert_eq!(snapshot.coach_messages.len(), 2);
    let profile = store.profile().unwrap();
    assert_eq!(profile.global.persona_messages, 1);
    assert_eq!(profile.global.attempts, 2);
}

fn support_turn(store: &mut Store, conversation: &str, text: &str) -> String {
    let mut command = send(store, conversation);
    if let Action::SendMessage {
        text: source,
        input,
        ..
    } = &mut command.action
    {
        *source = text.into();
        input.modality = "speech_transcript".into();
    }
    let turn = store.execute(command).unwrap().entity_id;
    isolate_user_reading(store);
    store.connection.execute("DELETE FROM operations WHERE kind IN ('skill_assessment','skill_evidence','persona_word_gloss','reply_translation','reply_brief') AND state='waiting_dependencies'",[]).unwrap();
    store.dispatch().unwrap();
    let persona = store.dispatch().unwrap().unwrap();
    assert!(
        store.dispatch().unwrap().is_none(),
        "Support must await the actual reply"
    );
    store
        .finish(&persona, Ok(reply("¿Con quién fuiste?")))
        .unwrap();
    let message = store
        .conversation_snapshot(conversation, None)
        .unwrap()
        .messages
        .iter()
        .find(|m| m.turn_id == turn && m.role == "assistant")
        .unwrap()
        .id
        .clone();
    request_suggestions(&store.connection, &message).unwrap();
    request_explanations(&store.connection, &message).unwrap();
    turn
}
fn feedback() -> serde_json::Value {
    serde_json::json!({"remark":"Your meaning is clear. Use fui for ‘I went’ yesterday.","usedTarget":["Ayer"],"usedNative":["go"],"corrections":[{"said":"go","corrected":"fui","explanation":"Use [[past tense]] for yesterday.","kind":"missing_expression"}],"grammar":3,"conversation":5})
}
fn assistance() -> serde_json::Value {
    serde_json::json!({"replies":[{"text":"Fui con mi hermana.","translation":"I went with my sister.","romanization":"","pronunciation":"fwee kon mee ehr-MAH-nah"},{"text":"Fui solo.","translation":"I went alone.","romanization":"","pronunciation":"fwee SOH-loh"}],"frames":["Fui con ___.","Fuimos a ___."],"starters":["Ayer…","Con mi…"]})
}
#[test]
fn conversation_support_is_source_bound_independent_and_persisted_without_skill_credit() {
    let (dir, mut store, conversation) = setup();
    let turn = support_turn(&mut store, &conversation, "Ayer yo go al parque.");
    let coach = store.dispatch().unwrap().unwrap();
    let data: serde_json::Value = serde_json::from_str(&coach.messages[1].content).unwrap();
    assert_eq!(data["latestLearnerInput"], "Ayer yo go al parque.");
    assert_eq!(data["actualPartnerReply"], "¿Con quién fuiste?");
    assert!(!coach.messages[1].content.contains("candidateConstructs"));
    assert_eq!(
        coach.messages[1]
            .content
            .matches("Ayer yo go al parque.")
            .count(),
        1
    );
    assert!(coach.messages[0].content.contains("never infer acoustic"));
    assert!(
        coach
            .messages
            .iter()
            .map(|m| m.content.len())
            .sum::<usize>()
            < 12000
    );
    let help = store.dispatch().unwrap().unwrap();
    let cards = store.dispatch().unwrap().unwrap();
    // Next speech turn can start while all three support tasks are in flight.
    store.execute(send(&store, &conversation)).unwrap();
    store
        .finish(&coach, Ok(reply(&feedback().to_string())))
        .unwrap();
    store
        .finish(&coach, Ok(reply(&feedback().to_string())))
        .unwrap();
    store
        .finish(&help, Ok(reply(&assistance().to_string())))
        .unwrap();
    store.finish(&cards,Ok(reply(r#"{"cards":[{"quote":"Con quién","title":"Who with","body":"[[Con]] asks about company.","example":"¿Con quién comes?","contrast":"English can put ‘with’ at the end."}]}"#))).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(view.messages[0].conversation_feedback.is_some());
    assert!(view.messages[0].feedback.is_none());
    assert!(view.messages[1].reply_assistance.is_some());
    assert!(view.messages[1].reply_explanations.is_some());
    assert!(view.messages[2].conversation_feedback.is_none());
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        0
    );
    let first = request_suggestions(&store.connection, &view.messages[1].id).unwrap();
    assert_eq!(
        first,
        request_suggestions(&store.connection, &view.messages[1].id).unwrap()
    );
    assert_eq!(store.connection.query_row("SELECT count(*) FROM operations WHERE turn_id=?1 AND kind IN ('coach_feedback','coach_reaction','coach_retry_check')",[turn],|r|r.get::<_,i64>(0)).unwrap(),0);
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    let restored = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(
        restored.messages[0]
            .conversation_feedback
            .as_ref()
            .unwrap()
            .corrections[0]
            .corrected,
        "fui"
    );
    assert_eq!(
        restored.messages[1]
            .reply_assistance
            .as_ref()
            .unwrap()
            .frames
            .len(),
        2
    );
}
#[test]
fn support_validation_rejects_wrong_sources_truncation_and_unbounded_output() {
    use crate::learning::coaching::conversation_support as support;
    let (_dir, mut store, conversation) = setup();
    let turn = support_turn(&mut store, &conversation, "Ayer yo go al parque.");
    let mut wrong = feedback();
    wrong["corrections"][0]["said"] = serde_json::json!("fuiste");
    assert!(
        support::validate(
            &store.connection,
            &turn,
            support::FEEDBACK,
            &reply(&wrong.to_string())
        )
        .is_err()
    );
    wrong = feedback();
    wrong["grammar"] = serde_json::json!(6);
    assert!(
        support::validate(
            &store.connection,
            &turn,
            support::FEEDBACK,
            &reply(&wrong.to_string())
        )
        .is_err()
    );
    wrong = feedback();
    wrong["remark"] = serde_json::json!("x".repeat(901));
    assert!(
        support::validate(
            &store.connection,
            &turn,
            support::FEEDBACK,
            &reply(&wrong.to_string())
        )
        .is_ok()
    );
    wrong = assistance();
    wrong["frames"][0] = serde_json::json!("No blank");
    assert!(
        support::validate(
            &store.connection,
            &turn,
            support::ASSISTANCE,
            &reply(&wrong.to_string())
        )
        .is_ok()
    );
    let mut output = reply(&feedback().to_string());
    output.finish_reason = "length".into();
    assert!(support::validate(&store.connection, &turn, support::FEEDBACK, &output).is_ok());
    assert!(
        support::validate(
            &store.connection,
            &turn,
            support::EXPLANATIONS,
            &reply(r#"{"cards":[]}"#)
        )
        .is_ok()
    );
    let coach = store.dispatch().unwrap().unwrap();
    store.finish(&coach, Ok(reply("not JSON"))).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(view.messages[0].conversation_feedback.is_none());
    assert!(view.messages[0].feedback_error.is_some());
    assert!(store.execute(send(&store, &conversation)).is_ok());
}
#[test]
fn assistance_preserves_model_text_despite_script_heuristics() {
    use crate::learning::coaching::conversation_support as support;
    let (_dir, mut store, conversation) = setup();
    let turn = support_turn(&mut store, &conversation, "Ayer yo go al parque.");
    store
        .connection
        .execute(
            "UPDATE turns SET context=json_set(context,'$.languageContext.script','arabic') WHERE id=?1",
            [&turn],
        )
        .unwrap();
    let check = |value: &serde_json::Value| {
        support::validate(
            &store.connection,
            &turn,
            support::ASSISTANCE,
            &reply(&value.to_string()),
        )
    };
    let valid = serde_json::json!({"replies":[{"text":"أنا بحب آكل المنسف.","translation":"I like to eat mansaf.","romanization":"ana baḥibb ākul il-mansaf.","pronunciation":"AH-na ba-HIBB AH-kul il-MAN-saf"},{"text":"بحب الفلافل.","translation":"I like falafel.","romanization":"baḥibb il-falāfil.","pronunciation":"ba-HIBB il-fa-LAH-fil"}],"frames":["بحب ___.","ما بحب ___."],"starters":["أنا…","بحب…"]});
    assert!(check(&valid).is_ok());
    // Latin diacritics, decomposed pinyin tones and Arabic transliteration
    // modifier letters are valid reading aids, not target-script content.
    for text in [
        "Nǐ xǐhuān kēhuàn xiǎoshuō ma?",
        "Ni\u{030c} xi\u{030c}hua\u{0304}n",
        "ʿana ʾaḥibb",
    ] {
        let mut romanized = valid.clone();
        romanized["replies"][0]["romanization"] = serde_json::json!(text);
        assert!(check(&romanized).is_ok(), "{text}");
    }
    // Observed failure: English in text, Arabic in translation and romanization.
    let mut swapped = valid.clone();
    swapped["replies"][0]["text"] = serde_json::json!("I like to eat mansaf.");
    swapped["replies"][0]["translation"] = serde_json::json!("أنا بحب آكل المنسف.");
    swapped["replies"][0]["romanization"] = serde_json::json!("أنا بحب آكل المنسف.");
    assert_eq!(check(&swapped).unwrap(), swapped);
    let mut romanized = valid.clone();
    romanized["replies"][1]["romanization"] = serde_json::json!("Nǐ 喜欢");
    assert_eq!(check(&romanized).unwrap(), romanized);
}
#[test]
fn correct_message_has_useful_remark_without_manufactured_correction() {
    let (_dir, mut store, conversation) = setup();
    support_turn(&mut store, &conversation, "Ayer fui al parque.");
    let coach = store.dispatch().unwrap().unwrap();
    store.finish(&coach,Ok(reply(r#"{"remark":"Fui correctly expresses a completed trip yesterday.","usedTarget":["fui"],"usedNative":[],"corrections":[],"grammar":5,"conversation":5}"#))).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(
        view.messages[0]
            .conversation_feedback
            .as_ref()
            .unwrap()
            .corrections
            .is_empty()
    );
    // Private coach sees saved context; persona does not receive it.
    let revision = store.snapshot().unwrap().conversations[0].revision;
    apply(
        &mut store,
        Action::AskCoach {
            conversation_id: conversation.clone(),
            text: "[[past tense]]".into(),
            expected_revision: revision,
        },
    );
    store.dispatch().unwrap();
    let coach = store.dispatch().unwrap().unwrap();
    assert!(
        coach.messages[0]
            .content
            .contains("Fui correctly expresses")
    );
    assert!(
        coach.messages[0]
            .content
            .contains("not translate the marker")
    );
}

#[test]
fn latin_assistance_requests_empty_romanization_without_rejecting_extra_help() {
    use crate::learning::coaching::conversation_support as support;
    let (_dir, mut store, conversation) = setup();
    let turn = support_turn(&mut store, &conversation, "Hola.");
    let captured: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
            r.get(0)
        })
        .unwrap();
    let captured: serde_json::Value = serde_json::from_str(&captured).unwrap();
    let schema = support::schema_for_context(support::ASSISTANCE, &captured);
    assert_eq!(
        schema["properties"]["replies"]["items"]["properties"]["romanization"]["enum"],
        serde_json::json!([""])
    );
    let mut value = assistance();
    value["replies"][0]["romanization"] = serde_json::json!("Fui con mi hermana.");
    assert!(
        support::validate(
            &store.connection,
            &turn,
            support::ASSISTANCE,
            &reply(&value.to_string())
        )
        .is_ok()
    );
}

#[test]
fn assistance_binds_writing_guidance_to_fields_and_keeps_exchange_as_data() {
    use crate::learning::coaching::conversation_support as support;
    for (language, script) in [
        ("arabic", "arabic"),
        ("mandarin", "simplified-chinese"),
        ("spanish", "latin"),
    ] {
        let captured = serde_json::json!({
            "targetLanguage":language,"translationLanguage":"english","messages":[],
            "languageContext":{"script":script,"guidance":{
                "target_writing":["TARGET_WRITING"],"romanization":["ROMANIZATION_RULES"],
                "explanation_writing":["EXPLANATION_WRITING"],"pragmatics":["PRAGMATICS"],
                "assessment":["ASSESSMENT_NOT_FOR_DRAFTS"],"segmentation":["SEGMENTATION_NOT_FOR_DRAFTS"]
            }},"practiceSettings":{"difficulty":"beginner"},"input":null
        });
        let prompt = support::prompt_for_exchange(
            "PARTNER_SOURCE".into(),
            Some("LEARNER_SOURCE".into()),
            support::ASSISTANCE,
            &captured,
        )
        .unwrap();
        assert_eq!(prompt.len(), 2);
        assert_eq!(prompt[0].role, "system");
        assert_eq!(prompt[1].role, "user");
        let instruction = &prompt[0].content;
        let fields = instruction
            .split_once("Field-specific language guidance: ")
            .unwrap()
            .1
            .split_once(". Target writing rules apply ONLY")
            .unwrap()
            .0;
        let fields: serde_json::Value = serde_json::from_str(fields).unwrap();
        assert_eq!(
            fields["replies[].text, frames[], starters[]"]["writing"],
            serde_json::json!(["TARGET_WRITING"])
        );
        assert_eq!(
            fields["replies[].romanization"]["transliteration"],
            serde_json::json!(["ROMANIZATION_RULES"])
        );
        assert_eq!(
            fields["replies[].translation"]["writing"],
            serde_json::json!(["EXPLANATION_WRITING"])
        );
        assert!(!instruction.contains("ASSESSMENT_NOT_FOR_DRAFTS"));
        assert!(!instruction.contains("SEGMENTATION_NOT_FOR_DRAFTS"));
        assert!(!instruction.contains("PARTNER_SOURCE"));
        assert!(!instruction.contains("LEARNER_SOURCE"));
        let exchange: serde_json::Value = serde_json::from_str(&prompt[1].content).unwrap();
        assert_eq!(exchange["actualPartnerReply"], "PARTNER_SOURCE");
        assert_eq!(exchange["latestLearnerInput"], "LEARNER_SOURCE");
    }
}

#[test]
fn support_reports_embedded_provider_error_and_retains_partial_response() {
    let (_dir, mut store, conversation) = setup();
    support_turn(&mut store, &conversation, "Ayer yo go al parque.");
    let dispatch = store.dispatch().unwrap().unwrap();
    let raw = serde_json::json!({
        "id": "support-rate-limit", "model": "actual-model",
        "choices": [{"finish_reason": "error",
            "error": {"code": 429, "message": "temporarily rate-limited upstream"},
            "message": {"content": "partial text", "reasoning": "private reasoning"}}],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "cost": 0}
    });
    let output =
        crate::ai::transport::provider::decode(&serde_json::to_vec(&raw).unwrap()).unwrap();
    store.finish(&dispatch, Ok(output)).unwrap();
    let (state, error, response, diagnostics): (String, String, String, String) = store
        .connection
        .query_row(
            "SELECT state,error,response_text,diagnostics FROM attempts WHERE id=?1",
            [&dispatch.attempt],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .unwrap();
    assert_eq!(state, "failed");
    assert!(error.contains("temporarily rate-limited upstream"));
    assert!(!error.contains("oversized"));
    assert_eq!(response, "partial text");
    let details: serde_json::Value = serde_json::from_str(&diagnostics).unwrap();
    assert_eq!(details["response"]["id"], "support-rate-limit");
    assert_eq!(details["response"]["choices"][0]["error"]["code"], 429);
    assert_eq!(details["response"]["usage"]["cost"], 0);
    assert!(!diagnostics.contains("private reasoning"));
    assert!(!diagnostics.contains("partial text"));
}

#[test]
fn cherokee_assistance_keeps_scheme_guidance_without_rejecting_model_output() {
    use crate::learning::coaching::conversation_support as support;
    let (_dir, mut store, conversation) = setup();
    let turn = support_turn(&mut store, &conversation, "ᎣᏏᏲ.");
    let context = crate::configuration::Registry::bundled()
        .unwrap()
        .resolve("cherokee", None, "english")
        .unwrap();
    store
        .connection
        .execute(
            "UPDATE turns SET context=json_set(context,'$.languageContext',json(?1)) WHERE id=?2",
            rusqlite::params![serde_json::to_string(&context).unwrap(), turn],
        )
        .unwrap();
    let captured: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
            r.get(0)
        })
        .unwrap();
    let captured: serde_json::Value = serde_json::from_str(&captured).unwrap();
    let schema = support::schema_for_context(support::ASSISTANCE, &captured);
    let description =
        schema["properties"]["replies"]["items"]["properties"]["romanization"]["description"]
            .as_str()
            .unwrap();
    assert!(description.contains("cherokee:traditional-syllabary"));
    assert!(description.contains("ᎣᏏᏲ → osiyo"));
    assert!(description.contains("RIGHT of the arrow"));

    let mut value = serde_json::json!({"replies":[
        {"text":"ᎣᏏᏲ. ᎦᏙ ᎤᏍᏗᎭ?","translation":"Hello. What is he/she/it doing?","romanization":"ᎣᏏᏲ. ᎦᏙ ᎤᏍᏗᎭ?","pronunciation":"Osiyo. Gado usdiha?"},
        {"text":"ᎣᏏᏲ. ᎦᏙ ᎤᏍᏗ?","translation":"Hello. What is it?","romanization":"ᎣᏏᏲ. ᎦᏙ ᎤᏍᏗ?","pronunciation":"Osiyo. Gado usdi?"}],
        "frames":["ᎦᏙ ___?","ᎣᏏᏲ. ___"],"starters":["ᎣᏏᏲ","ᏩᏙ"]});
    let check = |v: &serde_json::Value| {
        support::validate(
            &store.connection,
            &turn,
            support::ASSISTANCE,
            &reply(&v.to_string()),
        )
    };
    assert_eq!(check(&value).unwrap(), value);
    value["replies"][0]["romanization"] = serde_json::json!("osiyo. gado usdiha?");
    value["replies"][1]["romanization"] = serde_json::json!("osiyo. gado usdi?");
    assert!(check(&value).is_ok());
}

#[test]
fn useful_help_does_not_require_exactly_two_choices_or_short_display_fields() {
    use crate::learning::coaching::conversation_support as support;
    let (_dir, mut store, conversation) = setup();
    let turn = support_turn(&mut store, &conversation, "Hola.");
    let mut value = assistance();
    value["replies"].as_array_mut().unwrap().truncate(1);
    value["frames"] = serde_json::json!([]);
    value["starters"] = serde_json::json!(["One", "Two", "Three"]);
    value["replies"][0]["translation"] = serde_json::json!("x".repeat(900));
    let result = support::validate(
        &store.connection,
        &turn,
        support::ASSISTANCE,
        &reply(&value.to_string()),
    )
    .unwrap();
    assert_eq!(result, value);
}
