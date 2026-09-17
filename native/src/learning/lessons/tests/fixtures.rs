use super::*;

pub(super) fn command(store: &Store, action: Action) -> Command {
    Command {
        session_id: store.session_id.clone(),
        action_id: uuid::Uuid::new_v4().to_string(),
        action,
    }
}

pub(super) fn apply(store: &mut Store, action: Action) -> Receipt {
    let c = command(store, action);
    store.execute(c).unwrap()
}

pub(super) fn setup() -> (tempfile::TempDir, Store, String) {
    let dir = tempfile::tempdir().unwrap();
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    store
        .connection
        .execute("UPDATE ai_config SET route='openrouter',audio_settings=json_set(audio_settings,'$.transcription.route','openrouter','$.speech.route','openrouter')", [])
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
    let chat = apply(
        &mut store,
        Action::CreateConversation {
            contact_id: contact,
            title: "Lessons".into(),
        },
    )
    .entity_id;
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.readAloud',json('false')) WHERE conversation_id=?1",[&chat]).unwrap();
    (dir, store, chat)
}

pub(super) fn completion(text: String) -> Completion {
    Completion {
        text,
        finish_reason: "stop".into(),
        actual_model: "fixture".into(),
        provider_id: "fixture".into(),
        input_tokens: Some(10),
        output_tokens: Some(10),
    }
}

pub(super) fn plan() -> Value {
    json!({"quiz":[{"question":"Which suggests a time?","options":["¿A las dos?","Hola","Adiós"],"correctOption":0,"explanation":"A las dos suggests two o’clock."},{"question":"Which agrees?","options":["No","Sí, a las dos.","Adiós"],"correctOption":1,"explanation":"Sí expresses agreement."}],"title":"Arrange a meeting","objective":"Agree on a time to meet.","explanation":"Use a question to suggest a time.","examples":[{"text":"¿A las dos?","translation":"At two?","romanization":null,"pronunciation":"ah lahs dohs"},{"text":"Sí, a las dos.","translation":"Yes, at two.","romanization":null,"pronunciation":"see ah lahs dohs"}],"exercise":"Suggest a time.","feedbackGuidance":"Explain the wording without grading.","situation":"Arrange a meeting. You cannot meet at one.","completionCriteria":"The learner and contact agree on a time."})
}

pub(super) fn generate_ready(store: &mut Store, chat: &str) -> String {
    let rev = store.snapshot().unwrap().revision;
    let id = apply(
        store,
        Action::GenerateLesson {
            category: LessonCategory::Practical,
            choice_id: None,
            conversation_id: chat.into(),
            topic: "Meeting times".into(),
            expected_revision: rev,
        },
    )
    .entity_id;
    assert!(store.dispatch().unwrap().is_none());
    let dispatch = store.dispatch().unwrap().unwrap();
    assert!(dispatch.coaching_schema.is_some());
    store
        .finish(&dispatch, Ok(completion(plan().to_string())))
        .unwrap();
    id
}

pub(super) fn control_lesson(store: &mut Store, chat: &str, id: &str, c: LessonControl) {
    let rev = store.snapshot().unwrap().revision;
    apply(
        store,
        Action::ControlLesson {
            conversation_id: chat.into(),
            lesson_id: id.into(),
            control: c,
            expected_revision: rev,
        },
    );
}

pub(super) fn finish_handoff(store: &mut Store) {
    assert!(store.dispatch().unwrap().is_none());
    let d = store.dispatch().unwrap().unwrap();
    store
        .finish(&d, Ok(completion("¿A qué hora nos vemos?".into())))
        .unwrap();
    store.connection.execute("UPDATE operations SET state='cancelled' WHERE state IN ('waiting_dependencies','ready')",[]).unwrap();
    store
        .connection
        .execute(
            "UPDATE turns SET state='succeeded' WHERE state='assisting'",
            [],
        )
        .unwrap();
}
