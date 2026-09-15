use super::*;

#[test]
fn deleting_revised_conversation_removes_chain_and_credit_but_keeps_generation_receipt() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "First.");
    fixture_evidence(&store, &first, "¿cómo estás?");
    let second = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "¿Qué hora es?",
        ))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &second, "Second.");
    fixture_evidence(&store, &second, "¿Qué hora es?");
    store.connection.execute("INSERT INTO persona_generation_attempts(id,attempt_id,operation_id,language_id,route,requested_model,profile_revision,state) VALUES('receipt','attempt','operation','es','custom','fixture',1,'succeeded')",[]).unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "es").unwrap()["profile"]["xp"],
        35
    );
    let revision = store
        .snapshot()
        .unwrap()
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap()
        .revision;
    apply(
        &mut store,
        Action::DeleteConversation {
            conversation_id: conversation,
            expected_revision: revision,
        },
    );
    assert_eq!(
        store
            .connection
            .query_row("SELECT count(*) FROM turns", [], |r| r.get::<_, i32>(0))
            .unwrap(),
        0
    );
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM persona_generation_attempts",
                [],
                |r| r.get::<_, i32>(0)
            )
            .unwrap(),
        1
    );
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "es").unwrap()["profile"]["xp"],
        0
    );
}

#[test]
fn revision_revokes_late_speech_gloss_translation_and_suggestions() {
    let (_dir, mut store, conversation) = setup();
    let (speech, other) = speech_children(&mut store, &conversation);
    let first = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages[0]
        .turn_id
        .clone();
    let revised = store
        .execute(revision_command(&store, &conversation, &first, "Repaired"))
        .unwrap()
        .entity_id;
    assert!(
        store
            .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
            .unwrap()
            .is_none()
    );
    for dispatch in other {
        store
            .finish(
                &dispatch,
                Ok(if dispatch.gloss_source.is_some() {
                    gloss_reply()
                } else {
                    reply("Late translation")
                }),
            )
            .unwrap();
    }
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(view.messages[1].word_gloss.is_none());
    assert!(view.messages[1].translation.is_none());
    assert_eq!(view.messages[2].turn_id, revised);

    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.dispatch().unwrap();
    let persona = store.dispatch().unwrap().unwrap();
    let feedback = store.dispatch().unwrap().unwrap();
    store
        .finish(
            &feedback,
            Ok(reply(r#"{"meaning_recovered":"full","items":[]}"#)),
        )
        .unwrap();
    store.finish(&persona, Ok(reply("Reply."))).unwrap();
    let message = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "assistant")
        .unwrap()
        .id
        .clone();
    request_suggestions(&store.connection, &message).unwrap();
    store.connection.execute("UPDATE operations SET state='cancelled' WHERE state='ready' AND kind NOT IN ('coach_suggestions','persona_reply','persona_context')", []).unwrap();
    let suggestions = store.dispatch().unwrap().unwrap();
    assert!(suggestions.coaching_schema.is_some());
    store
        .execute(revision_command(&store, &conversation, &first, "Repaired"))
        .unwrap();
    store.finish(&suggestions,Ok(reply(r#"{"replies":[{"text":"Sí."}],"tokens":[{"reply":0,"text":"Sí","gloss":"Yes","romanization":null,"pronunciation":null}]}"#))).unwrap();
    assert!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages[1]
            .suggested_replies
            .is_none()
    );
}

#[test]
fn revised_wording_awards_weighted_xp_without_a_direct_proficiency_mark() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "First.");
    let second = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "¿Qué hora es?",
        ))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &second, "Second.");
    fixture_evidence(&store, &second, "¿Qué hora es?");
    let profile = crate::learning::learner::progression::snapshot(&store, "es").unwrap();
    assert_eq!(profile["profile"]["xp"], 10);
    let skill = profile["profile"]["skills"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["skill_id"] == "question")
        .unwrap();
    assert_eq!(skill["successes"], 0);
    assert_eq!(skill["assisted"], 1);
    assert_eq!(skill["checked"], false);
    assert_eq!(skill["star"], false);
}
