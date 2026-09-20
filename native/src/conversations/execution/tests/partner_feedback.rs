use super::*;

#[test]
fn reaction_waits_for_reply_and_publishes_on_its_message() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    store.connection.execute("INSERT INTO operations(id,turn_id,kind,state) VALUES(?1,?2,'coach_reaction','waiting_dependencies')",params![id(),turn]).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let persona = store.dispatch().unwrap().unwrap();
    assert!(
        !store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .iter()
            .any(|m| m.reaction.is_some())
    );
    store
        .finish(&persona, Ok(reply("¿Qué quieres decir?")))
        .unwrap();
    store.connection.execute("UPDATE operations SET state='cancelled' WHERE turn_id=?1 AND kind NOT IN ('persona_context','persona_reply','coach_reaction')",[&turn]).unwrap();
    let reaction = store.dispatch().unwrap().unwrap();
    assert!(reaction.messages[1].content.contains("¿Qué quieres decir?"));
    assert!(reaction.coaching_schema.as_ref().unwrap()["properties"]["kind"].is_object());
    store.finish(&reaction,Ok(reply(r#"{"kind":"confused","interpretation":"Your partner asked you to clarify.","explanation":"Their question asks what you mean."}"#))).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(snapshot.messages[0].reaction.is_none());
    assert!(matches!(
        snapshot.messages[1].reaction.as_ref().unwrap().kind,
        crate::partners::partner_reaction::ReactionKind::Confused
    ));
    let invalid = reply(r#"{"kind":"happy","interpretation":"","explanation":"Fine."}"#);
    assert!(crate::partners::partner_reaction::validate(&invalid).is_err());
}

#[test]
fn assistance_is_requested_and_repeated_requests_share_work() {
    let (_dir, mut store, conversation) = setup();
    store.execute(send(&store, &conversation)).unwrap();
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM operations WHERE kind='reply_assistance'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
    store.dispatch().unwrap();
    let persona = store.dispatch().unwrap().unwrap();
    store.finish(&persona, Ok(reply("¿Qué cocinas?"))).unwrap();
    let message = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages[1]
        .id
        .clone();
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM operations WHERE kind='reply_assistance'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
    let first = request_suggestions(&store.connection, &message).unwrap();
    assert_eq!(
        first,
        request_suggestions(&store.connection, &message).unwrap()
    );
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM operations WHERE kind='reply_assistance'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        1
    );
    let user = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages[0]
        .id
        .clone();
    assert!(request_suggestions(&store.connection, &user).is_err());
}
