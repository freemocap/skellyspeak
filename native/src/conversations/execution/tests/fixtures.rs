use super::*;

pub(super) fn apply(store: &mut Store, action: Action) -> Receipt {
    store
        .execute(Command {
            session_id: store.session_id.clone(),
            action_id: id(),
            action,
        })
        .unwrap()
}

pub(super) fn setup() -> (tempfile::TempDir, Store, String) {
    let dir = tempfile::tempdir().unwrap();
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    store
        .connection
        .execute(
            "UPDATE ai_config SET route='hosted',assessment_adapter='chat_model'",
            [],
        )
        .unwrap();
    store
        .set_hosted_connection(1, Some("test-credential"), "fixture@example.invalid")
        .unwrap();
    apply(
        &mut store,
        Action::CreateContact {
            language_id: "spanish".into(),
            details: crate::partners::persona::starter("spanish").unwrap(),
        },
    );
    let contact = store.snapshot().unwrap().contacts[0].id.clone();
    let conversation = apply(
        &mut store,
        Action::CreateConversation {
            contact_id: contact,
            title: "Test exchange".into(),
        },
    )
    .entity_id;
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.readAloud',json('false')) WHERE conversation_id=?1", [&conversation]).unwrap();
    (dir, store, conversation)
}

pub(super) fn send(store: &Store, conversation: &str) -> Command {
    let revision = store
        .snapshot()
        .unwrap()
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap()
        .revision;
    Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::SendMessage {
            input: crate::learning::coaching::InputEvidence::default(),
            conversation_id: conversation.into(),
            text: "Hola, ¿cómo estás?".into(),
            expected_revision: revision,
        },
    }
}

pub(super) fn isolate_user_reading(store: &mut Store) {
    store.connection.execute("DELETE FROM operations WHERE kind IN ('user_word_gloss','user_translation') AND state='waiting_dependencies'", []).unwrap();
}

pub(super) fn isolate_coaching(store: &mut Store) {
    isolate_user_reading(store);
    // Dedicated lifecycle suites isolate their subject; coaching graph overlap is
    // exercised separately below with both automatic operations retained.
    store.connection.execute("DELETE FROM operations WHERE kind IN ('coach_feedback','coach_suggestions','coach_reaction','skill_assessment','skill_evidence','conversation_feedback','reply_brief','reply_assistance','reply_explanations') AND state='waiting_dependencies'", []).unwrap();
}

pub(super) fn isolate_translation(store: &mut Store) {
    isolate_coaching(store);
    // These tests focus on the established reply/translation lifecycle.
    store.connection.execute("DELETE FROM operations WHERE kind='persona_word_gloss' AND state='waiting_dependencies'", []).unwrap();
}

pub(super) fn begin(store: &mut Store, conversation: &str) -> Dispatch {
    let command = send(store, conversation);
    store.execute(command).unwrap();
    isolate_coaching(store);
    isolate_translation(store);
    assert!(store.dispatch().unwrap().is_none());
    store.dispatch().unwrap().unwrap()
}

pub(super) fn reply(text: &str) -> Completion {
    Completion {
        diagnostics: None,
        text: text.into(),
        finish_reason: "stop".into(),
        actual_model: "google/gemini-2.5-flash".into(),
        provider_id: "test-response".into(),
        input_tokens: Some(21),
        output_tokens: Some(8),
    }
}

pub(super) fn gloss_children(
    store: &mut Store,
    conversation: &str,
    text: &str,
) -> (Dispatch, Dispatch) {
    let command = send(store, conversation);
    store.execute(command).unwrap();
    isolate_coaching(store);
    assert!(store.dispatch().unwrap().is_none());
    let parent = store.dispatch().unwrap().unwrap();
    store.finish(&parent, Ok(reply(text))).unwrap();
    let gloss = store.dispatch().unwrap().unwrap();
    assert!(gloss.gloss_source.is_some());
    assert_eq!(
        gloss.gloss_schema.as_ref().unwrap()["properties"]["spans"]["items"]["oneOf"][0]["properties"]
            ["romanization"]["type"],
        "null"
    );
    // Audit the outbound provider body, not just validation/display behavior.
    for route in [
        ConnectionRoute::Hosted,
        ConnectionRoute::Custom,
        ConnectionRoute::Hosted,
    ] {
        let payload = crate::ai::transport::provider::payload_with_output(
            &gloss.model,
            &gloss.messages,
            route,
            crate::conversations::gloss::request_output(
                gloss.gloss_source.as_ref(),
                gloss.gloss_schema.as_ref().unwrap(),
            ),
        )
        .unwrap();
        assert_eq!(
            payload["response_format"]["json_schema"]["schema"]["properties"]["spans"]["items"]["oneOf"]
                [0]["properties"]["romanization"],
            serde_json::json!({"type":"null"})
        );
        assert_eq!(
            payload["max_tokens"],
            crate::ai::transport::provider::GLOSS_OUTPUT_TOKENS
        );
        assert!(
            payload["messages"][0]["content"]
                .as_str()
                .unwrap()
                .contains("no transliteration work is needed")
        );
    }
    let translation = store.dispatch().unwrap().unwrap();
    assert!(translation.gloss_source.is_none());
    (gloss, translation)
}

pub(super) fn speech_outcome(audio: Result<Vec<u8>>) -> crate::ai::audio::SpeechOutcome {
    crate::ai::audio::SpeechOutcome {
        diagnostics: None,
        audio,
        actual_model: Some("speech-model".into()),
        provider_id: Some("speech-request".into()),
        input_tokens: Some(12),
        output_tokens: Some(30),
        cost_micros: Some(4),
        finish_reason: Some("stop".into()),
    }
}

pub(super) fn speech_children(store: &mut Store, conversation: &str) -> (Dispatch, Vec<Dispatch>) {
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.readAloud',json('true')) WHERE conversation_id=?1",[conversation]).unwrap();
    let command = send(store, conversation);
    store.execute(command).unwrap();
    isolate_coaching(store);
    assert!(store.dispatch().unwrap().is_none());
    let parent = store.dispatch().unwrap().unwrap();
    let reserved: i64 = store
        .connection
        .query_row(
            "SELECT count(*) FROM operations WHERE kind NOT IN ('persona_context','coach_context')",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(reserved, 4);
    store.finish(&parent, Ok(reply("Hola."))).unwrap();
    let mut speech = None;
    let mut others = Vec::new();
    for _ in 0..3 {
        let dispatch = store.dispatch().unwrap().unwrap();
        if dispatch.speech_source.is_some() {
            speech = Some(dispatch);
        } else {
            others.push(dispatch);
        }
    }
    (speech.unwrap(), others)
}

pub(super) fn gloss_reply() -> Completion {
    reply(r#"{"spans":[{"first":"g0000","last":"g0003","kind":"gloss","gloss":"hello"}]}"#)
}

pub(super) fn revision_command(
    store: &Store,
    conversation: &str,
    turn: &str,
    text: &str,
) -> Command {
    Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::ReviseTurn {
            conversation_id: conversation.into(),
            turn_id: turn.into(),
            text: text.into(),
            input: crate::learning::coaching::InputEvidence::default(),
            expected_revision: store
                .conversation_snapshot(conversation, None)
                .unwrap()
                .revision,
        },
    }
}

pub(super) fn finish_fixture_exchange(store: &mut Store, turn: &str, text: &str) {
    store.connection.execute("INSERT INTO messages(id,conversation_id,turn_id,sequence,role,text) SELECT ?1,conversation_id,id,(SELECT coalesce(max(sequence),0)+1 FROM messages WHERE conversation_id=t.conversation_id),'assistant',?3 FROM turns t WHERE id=?2",params![id(),turn,text]).unwrap();
    store
        .connection
        .execute(
            "UPDATE operations SET state='succeeded' WHERE turn_id=?1",
            [turn],
        )
        .unwrap();
    store
        .connection
        .execute("UPDATE turns SET state='succeeded' WHERE id=?1", [turn])
        .unwrap();
}

pub(super) fn fixture_evidence(store: &Store, turn: &str, _wording: &str) {
    let tx = store.connection.unchecked_transaction().unwrap();
    let operation: String = tx
        .query_row(
            "SELECT id FROM operations WHERE turn_id=?1 AND kind='skill_assessment'",
            [turn],
            |r| r.get(0),
        )
        .unwrap();
    let attempt = format!("evidence-{turn}");
    tx.execute("INSERT OR IGNORE INTO attempts(id,operation_id,state,requested_model) VALUES(?1,?2,'running','fixture')",params![attempt,operation]).unwrap();
    tx.execute(
        "UPDATE operations SET state='running' WHERE id=?1",
        [&operation],
    )
    .unwrap();
    tx.execute("UPDATE turns SET state='assisting' WHERE id=?1", [turn])
        .unwrap();
    let presence: std::collections::BTreeMap<_, _> = store
        .config
        .shared_skills()
        .skills
        .iter()
        .map(|s| {
            (
                s.id.clone(),
                if s.id == "questions_answers" {
                    crate::learning::practice::Presence::Direct
                } else {
                    crate::learning::practice::Presence::Absent
                },
            )
        })
        .collect();
    crate::learning::practice::publish(
        &tx,
        turn,
        &attempt,
        presence.clone(),
        &presence.keys().cloned().collect(),
    )
    .unwrap();
    let value = serde_json::json!({"adapter":"jev_choice","answers":{"questions_answers":{"choice":"direct","confidence":1.0,"probabilities":{"direct":1.0,"contextual":0.0,"absent":0.0,"unclear":0.0}}}});
    tx.execute("UPDATE turns SET context=json_set(context,'$.skillAssessment',json(?2),'$.skillAssessmentAttempt',?3),state='succeeded' WHERE id=?1",params![turn,value.to_string(),attempt]).unwrap();
    crate::learning::rewards::publish(&tx, turn, &attempt).unwrap();
    tx.execute(
        "UPDATE operations SET state='succeeded' WHERE id=?1",
        [&operation],
    )
    .unwrap();
    tx.execute(
        "UPDATE attempts SET state='succeeded' WHERE id=?1",
        [&attempt],
    )
    .unwrap();
    tx.commit().unwrap();
}

pub(super) fn wave2_context(store: &Store, turn: &str) -> serde_json::Value {
    let raw: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [turn], |r| {
            r.get(0)
        })
        .unwrap();
    serde_json::from_str(&raw).unwrap()
}

pub(super) fn wave2_error(quote: &str) -> serde_json::Value {
    serde_json::json!({"construct":"questions_answers","quote":quote,"outcome":"partial","rationale":"Use está to ask how someone is.","error":{"op":"missing","category":"AUX","source":"unknown","blocks_meaning":true,"target_hypothesis":"¿Cómo está tu hermana?","hint":"","elicitation":"","metalinguistic":""}})
}

pub(super) fn wave2_observe(
    store: &Store,
    turn: &str,
    kind: &str,
    value: serde_json::Value,
) -> serde_json::Value {
    retained_observation(store, turn, kind);
    let validated = crate::learning::coaching::coach_observation::validate(
        &store.connection,
        turn,
        kind,
        &reply(&value.to_string()),
    )
    .unwrap();
    crate::learning::coaching::coach_observation::publish(
        &store.connection,
        turn,
        &validated,
        &format!("observation-{turn}"),
    )
    .unwrap();
    validated
}

// Fixtures for retained evidence math explicitly create its former producer.
// Current conversational judgments must never create these records.
pub(super) fn retained_observation(store: &Store, turn: &str, kind: &str) {
    store.connection.execute("INSERT INTO operations(id,turn_id,kind,state) SELECT ?1,?2,?3,'succeeded' WHERE NOT EXISTS(SELECT 1 FROM operations WHERE turn_id=?2 AND kind=?3)",params![id(),turn,kind]).unwrap();
}

pub(super) fn translation_reply(dispatch: &Dispatch, text: &str) -> Completion {
    reply(
        &serde_json::json!({"source":dispatch.messages[1].content,"translation":text}).to_string(),
    )
}
