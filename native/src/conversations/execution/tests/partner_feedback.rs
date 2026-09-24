use super::*;

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
