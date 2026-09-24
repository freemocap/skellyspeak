use super::*;
use crate::conversations::saved_reading::sources;
use crate::language::reading::{ReadingScope, saved::SavedGlossQuery};

fn query(store: &Store, dispatch: &Dispatch) -> SavedGlossQuery {
    let context: String = store
        .connection
        .query_row(
            "SELECT t.context FROM turns t JOIN operations o ON o.turn_id=t.id WHERE o.id=?1",
            [&dispatch.operation],
            |r| r.get(0),
        )
        .unwrap();
    let value: serde_json::Value = serde_json::from_str(&context).unwrap();
    let context: crate::configuration::LanguageContext =
        serde_json::from_value(value["languageContext"].clone()).unwrap();
    SavedGlossQuery {
        scope: ReadingScope {
            language: context.language_id,
            variety: Some(context.variety_id),
            explanation: context.explanation_language_id,
            explanation_variety: Some(context.explanation_variety_id),
        },
        surfaces: vec!["Hola".into()],
    }
}

fn publish(store: &mut Store, conversation: &str) -> Dispatch {
    let (gloss, translation) = gloss_children(store, conversation, "Hola.");
    store.finish(&gloss, Ok(gloss_reply())).unwrap();
    store
        .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
        .unwrap();
    gloss
}

#[test]
fn accepted_gloss_lookup_survives_restart_and_needs_no_access_or_selected_conversation() {
    let (dir, mut store, conversation) = setup();
    let first = publish(&mut store, &conversation);
    let query = query(&store, &first);
    let second = publish(&mut store, &conversation);
    let before = store.profile().unwrap().global.attempts;
    store
        .connection
        .execute(
            "UPDATE ai_config SET paused=1,hosted_credential_id=NULL",
            [],
        )
        .unwrap();
    let changed = store
        .config
        .resolve_pair("spanish", None, "french", None)
        .unwrap();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.explanationLanguage','french','$.explanationVarietyId',?1)",[changed.explanation_variety_id]).unwrap();
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    let saved = sources(&store, &query).unwrap();
    assert_eq!(saved.len(), 2);
    assert_eq!(
        saved[0].operation_id.as_deref(),
        Some(first.operation.as_str())
    );
    assert_eq!(
        saved[1].attempt_id.as_deref(),
        Some(second.attempt.as_str())
    );
    assert_eq!(saved[0].text, "Hola.");
    assert_eq!(saved[0].segments[0].start, 0);
    assert_eq!(saved[0].segments[0].end, 4);
    assert_eq!(saved[0].segments[0].gloss.as_deref(), Some("hello"));
    assert_eq!(store.profile().unwrap().global.attempts, before);
    let mut different = query;
    different.scope.explanation = "french".into();
    different.scope.explanation_variety = None;
    assert!(sources(&store, &different).unwrap().is_empty());
}

#[test]
fn accepted_lookup_excludes_archived_invalidated_and_replaced_sources() {
    for change in [
        "UPDATE conversations SET archived=1",
        "UPDATE contacts SET archived=1",
        "UPDATE turns SET state='invalidated'",
        "INSERT INTO turns(id,replaces_turn_id,conversation_id,state,paused,profile_revision,credential_id,route,model,context) SELECT 'replacement',id,conversation_id,'cancelled',paused,profile_revision,credential_id,route,model,context FROM turns LIMIT 1",
    ] {
        let (_dir, mut store, conversation) = setup();
        let gloss = publish(&mut store, &conversation);
        let query = query(&store, &gloss);
        assert_eq!(sources(&store, &query).unwrap().len(), 1);
        store.connection.execute(change, []).unwrap();
        assert!(sources(&store, &query).unwrap().is_empty());
    }
}

#[test]
fn saved_suggestions_keep_their_anchors_and_receipt_without_source_word_match() {
    let (_dir, mut store, conversation) = setup();
    let gloss = publish(&mut store, &conversation);
    let mut query = query(&store, &gloss);
    query.surfaces = vec!["casa".into()];
    let reply = serde_json::json!([{"text":"Mi casa.","segments":[{"start":3,"end":7,"kind":"gloss","gloss":"house"}]}]);
    store.connection.execute("UPDATE turns SET context=json_set(context,'$.coachReplies',json(?1),'$.coachRepliesAttempt','suggestion-attempt')",[reply.to_string()]).unwrap();
    let saved = sources(&store, &query).unwrap();
    assert_eq!(saved.len(), 1);
    assert_eq!(saved[0].text, "Mi casa.");
    assert_eq!(saved[0].attempt_id.as_deref(), Some("suggestion-attempt"));
    assert_eq!(saved[0].segments[0].start, 3);
    assert!(saved[0].source_id.ends_with("/suggestion/0"));
}

#[test]
fn malformed_saved_identity_and_unbounded_queries_fail_explicitly() {
    let (_dir, mut store, conversation) = setup();
    let gloss = publish(&mut store, &conversation);
    let mut query = query(&store, &gloss);
    store.connection.execute("UPDATE turns SET context=json_set(context,'$.wordGloss.sourceMessageId','wrong-source')",[]).unwrap();
    assert!(matches!(sources(&store,&query),Err(e) if e.code==ErrorCode::Storage));
    query.surfaces = vec!["x".repeat(4097)];
    assert!(matches!(sources(&store,&query),Err(e) if e.code==ErrorCode::Validation));
}
