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
        .execute("UPDATE ai_config SET route='openrouter'", [])
        .unwrap();
    store
        .set_connection(
            1,
            Some("test-credential"),
            "google/gemini-2.5-flash",
            "google/gemini-2.5-flash-lite",
        )
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
    store.connection.execute("DELETE FROM operations WHERE kind IN ('coach_feedback','coach_suggestions','coach_reaction') AND state='waiting_dependencies'", []).unwrap();
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
    let translation = store.dispatch().unwrap().unwrap();
    assert!(translation.gloss_source.is_none());
    (gloss, translation)
}

pub(super) fn speech_outcome(
    audio: Result<Vec<u8>>,
) -> crate::ai::transport::speech_provider::SpeechOutcome {
    crate::ai::transport::speech_provider::SpeechOutcome {
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

pub(super) fn fixture_evidence(store: &Store, turn: &str, wording: &str) {
    let value = serde_json::json!({"meaning_recovered":"full","items":[{"construct":"question","quote":wording,"outcome":"demonstrated","error":null,"rationale":"Requests information."}]});
    let validated = crate::learning::coaching::validate(
        &store.connection,
        turn,
        crate::learning::coaching::FEEDBACK,
        &reply(&value.to_string()),
    )
    .unwrap();
    crate::learning::coaching::publish(
        &store.connection,
        turn,
        crate::learning::coaching::FEEDBACK,
        &validated,
        &format!("evidence-{turn}"),
    )
    .unwrap();
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
    serde_json::json!({"construct":"question","quote":quote,"outcome":"partial","rationale":"Hidden corrected wording must not leak.","error":{"op":"missing","category":"AUX","source":"unknown","blocks_meaning":true,"target_hypothesis":"¿Cómo está tu hermana?","hint":"A linking verb is missing.","elicitation":"","metalinguistic":""}})
}

pub(super) fn wave2_observe(
    store: &Store,
    turn: &str,
    kind: &str,
    value: serde_json::Value,
) -> serde_json::Value {
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
