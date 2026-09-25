use super::*;
pub(super) fn result(kind: &str, choice: &str) -> Completion {
    let qs = crate::learning::coaching::message_assessment::questions(kind).unwrap();
    let answers:serde_json::Map<String,serde_json::Value>=qs.as_object().unwrap().iter().map(|(key,q)|{
 let ps:serde_json::Map<String,serde_json::Value>=q["criteria"].as_object().unwrap().keys().map(|label|(label.clone(),serde_json::json!(if label==choice{1.0}else{0.0}))).collect();
 (key.clone(),serde_json::json!({"type":"choice","choice":choice,"probabilities":ps,"confidence":1.0}))
 }).collect();
    reply(&serde_json::Value::Object(answers).to_string())
}
#[test]
fn scores_publish_before_reply_and_understanding_waits_for_reply_without_credit() {
    let (dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.connection.execute("DELETE FROM operations WHERE kind NOT IN ('persona_context','persona_reply','conversation_feedback','coach_reaction')",[]).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let partner = store.dispatch().unwrap().unwrap();
    let rating = store.dispatch().unwrap().unwrap();
    assert!(rating.coaching_schema.is_none());
    let request = rating.decisions.as_ref().unwrap();
    assert!(request["state"].get("actualPartnerReply").is_none());
    assert_eq!(request["questions"].as_object().unwrap().len(), 2);
    assert!(store.dispatch().unwrap().is_none());
    store
        .finish(&rating, Ok(result("conversation_feedback", "score_0")))
        .unwrap();
    store
        .finish(&rating, Ok(result("conversation_feedback", "score_0")))
        .unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(
        view.messages[0]
            .conversation_feedback
            .as_ref()
            .unwrap()
            .grammar,
        Some(0)
    );
    assert_eq!(view.messages.len(), 1);
    store
        .finish(&partner, Ok(reply("Please clarify.")))
        .unwrap();
    let reaction = store.dispatch().unwrap().unwrap();
    assert_eq!(
        reaction.decisions.as_ref().unwrap()["state"]["actualPartnerReply"],
        "Please clarify."
    );
    store
        .finish(&reaction, Ok(result("coach_reaction", "confused")))
        .unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(view.messages[0].reaction.is_none());
    assert!(matches!(
        view.messages[1].reaction.as_ref().unwrap().kind,
        crate::partners::partner_reaction::ReactionKind::Confused
    ));
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        0
    );
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM operations WHERE turn_id=?1 AND state!='succeeded'",
                [turn],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages[0]
            .conversation_feedback
            .as_ref()
            .unwrap()
            .grammar,
        Some(0)
    );
}

#[test]
fn invalid_scores_do_not_block_partner_reply_or_understanding() {
    let (_dir, mut store, conversation) = setup();
    store.execute(send(&store, &conversation)).unwrap();
    store.connection.execute("DELETE FROM operations WHERE kind NOT IN ('persona_context','persona_reply','conversation_feedback','coach_reaction')", []).unwrap();
    store.dispatch().unwrap();
    let partner = store.dispatch().unwrap().unwrap();
    let rating = store.dispatch().unwrap().unwrap();
    store.finish(&rating, Ok(reply("{}"))).unwrap();
    store.finish(&partner, Ok(reply("A reply."))).unwrap();
    let understanding = store.dispatch().unwrap().unwrap();
    store
        .finish(&understanding, Ok(result("coach_reaction", "confused")))
        .unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(view.messages[0].conversation_feedback.is_none());
    assert!(view.messages[0].feedback_error.is_some());
    assert!(view.messages[1].reaction.is_some());
}
