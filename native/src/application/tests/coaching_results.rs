use super::*;
use crate::application::test_server::{structured_sequence, structured_server};
use crate::model::Action;

fn fixture(base: &str) -> (tempfile::TempDir, Arc<Application>, execution::Dispatch) {
    let dir = tempfile::tempdir().unwrap();
    let app = Application::start(&dir.path().join("coaching.sqlite3"), None);
    let dispatch = {
        let mut store = app.lock().unwrap();
        store.prepare_chat().unwrap();
        store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl',?1,'$.bearerAuth',json('false'))", [base]).unwrap();
        let conversation = store.snapshot().unwrap().conversations[0].clone();
        let session_id = store.session_id.clone();
        store
            .execute(Command {
                session_id,
                action_id: uuid::Uuid::new_v4().to_string(),
                action: Action::SendMessage {
                    conversation_id: conversation.id,
                    expected_revision: conversation.revision,
                    text: "Hola".into(),
                    input: Default::default(),
                },
            })
            .unwrap();
        let mut found = None;
        for _ in 0..30 {
            if let Some(dispatch) = store.dispatch().unwrap() {
                let kind = store.attempt_scope(&dispatch.attempt).unwrap().unwrap().3;
                if kind == "coach_feedback" {
                    found = Some(dispatch);
                    break;
                }
                if kind == "persona_reply" {
                    store
                        .finish(
                            &dispatch,
                            Ok(provider::Completion {
                                text: "Hola".into(),
                                finish_reason: "stop".into(),
                                actual_model: "fixture".into(),
                                provider_id: "fixture".into(),
                                input_tokens: Some(0),
                                output_tokens: Some(0),
                                diagnostics: None,
                            }),
                        )
                        .unwrap();
                }
            }
        }
        found.expect("coaching dispatch")
    };
    (dir, app, dispatch)
}

fn capture(app: &Application, dispatch: &execution::Dispatch) -> Request {
    Request::capture(&app.lock().unwrap(), dispatch)
        .unwrap()
        .unwrap()
}

async fn execute(app: &Arc<Application>, dispatch: &execution::Dispatch) -> provider::Completion {
    app.shared_coaching(
        capture(app, dispatch),
        dispatch,
        app.admission.try_chat().unwrap(),
    )
    .await
    .unwrap()
}

fn valid() -> String {
    json!({"meaning_recovered":"full","items":[]}).to_string()
}

#[tokio::test]
async fn successful_coaching_is_reused_and_counted_once_with_original_metadata() {
    let (base, server) = structured_server(|_| valid());
    let (_dir, app, dispatch) = fixture(&base);
    let before = app.lock().unwrap().profile().unwrap().global;
    let first = execute(&app, &dispatch).await;
    server.join().unwrap();
    assert_eq!(first.diagnostics.as_ref().unwrap()["cacheHit"], false);
    let second = execute(&app, &dispatch).await;
    assert_eq!(second.diagnostics.as_ref().unwrap()["cacheHit"], true);
    assert_eq!(second.provider_id, first.provider_id);
    assert_eq!(second.input_tokens, Some(21));
    assert_eq!(
        second.diagnostics.as_ref().unwrap()["sourceExecutionId"],
        first.diagnostics.as_ref().unwrap()["sourceExecutionId"]
    );
    let mut store = app.lock().unwrap();
    store.finish(&dispatch, Ok(first)).unwrap();
    store.finish(&dispatch, Ok(second)).unwrap();
    let after = store.profile().unwrap().global;
    assert_eq!(after.attempts, before.attempts); // Replaces this pending attempt with one shared execution.
    assert_eq!(after.input_tokens - before.input_tokens, 21);
    assert_eq!(after.output_tokens - before.output_tokens, 4);
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM inference_executions WHERE task='coach_feedback'",
                [],
                |r| r.get::<_, i32>(0)
            )
            .unwrap(),
        1
    );
}

#[tokio::test]
async fn invalid_response_is_retained_for_inspection_but_explicit_retry_dispatches_again() {
    let mut count = 0;
    let (base, server) = structured_sequence(2, move |_| {
        count += 1;
        if count == 1 {
            "{\"meaning_recovered\":\"invalid\",\"items\":[]}".into()
        } else {
            valid()
        }
    });
    let (_dir, app, dispatch) = fixture(&base);
    let first = execute(&app, &dispatch).await;
    assert!(first.text.contains("invalid"));
    assert_eq!(
        results::settings(&app.lock().unwrap().connection)
            .unwrap()
            .result_count,
        0
    );
    assert_eq!(
        results::receipt_for_consumer(&app.lock().unwrap().connection, &dispatch.attempt)
            .unwrap()
            .unwrap()["state"],
        "failed"
    );
    let retry = {
        let mut store = app.lock().unwrap();
        // Isolate coaching so the turn can finish before the user's retry command.
        store.connection.execute("UPDATE operations SET state='cancelled' WHERE id!=?1 AND state IN ('ready','running','waiting_dependencies')", [&dispatch.operation]).unwrap();
        store
            .connection
            .execute(
                "UPDATE attempts SET state='cancelled' WHERE id!=?1 AND state='running'",
                [&dispatch.attempt],
            )
            .unwrap();
        store.finish(&dispatch, Ok(first)).unwrap();
        assert_eq!(
            store.attempt_state(&dispatch.attempt).unwrap().as_deref(),
            Some("failed")
        );
        let retained: String = store
            .connection
            .query_row(
                "SELECT response_text FROM attempts WHERE id=?1",
                [&dispatch.attempt],
                |r| r.get(0),
            )
            .unwrap();
        assert!(retained.contains("invalid"));
        let turn = store.attempt_scope(&dispatch.attempt).unwrap().unwrap().1;
        let session_id = store.session_id.clone();
        store
            .execute(Command {
                session_id,
                action_id: uuid::Uuid::new_v4().to_string(),
                action: Action::ControlTurn {
                    turn_id: turn,
                    control: crate::model::TurnControl::Retry,
                },
            })
            .unwrap();
        store.dispatch().unwrap().unwrap()
    };
    assert_eq!(capture(&app, &dispatch).key, capture(&app, &retry).key);
    let second = execute(&app, &retry).await;
    assert_eq!(second.text, valid());
    assert_eq!(server.join().unwrap().len(), 2);
    assert_eq!(
        results::settings(&app.lock().unwrap().connection)
            .unwrap()
            .result_count,
        1
    );
}

#[tokio::test]
async fn simultaneous_consumers_share_http_and_one_cancelled_waiter_does_not_cancel_settlement() {
    let (entered_tx, entered_rx) = tokio::sync::oneshot::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let (base, server) = structured_server(move |_| {
        entered_tx.send(()).unwrap();
        release_rx.recv_timeout(Duration::from_secs(10)).unwrap();
        valid()
    });
    let (_dir, app, dispatch) = fixture(&base);
    let mut other = dispatch.clone();
    other.attempt = uuid::Uuid::new_v4().to_string();
    app.lock().unwrap().connection.execute("INSERT INTO attempts(id,operation_id,state,requested_model) VALUES(?1,?2,'running',?3)", rusqlite::params![other.attempt,other.operation,other.model]).unwrap();
    let mut first = Box::pin(app.shared_coaching(
        capture(&app, &dispatch),
        &dispatch,
        app.admission.try_chat().unwrap(),
    ));
    tokio::select! { _ = entered_rx => (), result = &mut first => panic!("finished early: {result:?}") }
    let second = app.shared_coaching(
        capture(&app, &other),
        &other,
        app.admission.try_chat().unwrap(),
    );
    tokio::pin!(second);
    // Poll the second consumer into its subscription before releasing the provider.
    tokio::select! { _ = tokio::time::sleep(Duration::from_millis(20)) => (), result = &mut second => panic!("finished early: {result:?}") }
    app.lock()
        .unwrap()
        .connection
        .execute(
            "UPDATE attempts SET state='cancelled' WHERE id=?1",
            [&dispatch.attempt],
        )
        .unwrap();
    assert!(first.await.is_err());
    release_tx.send(()).unwrap();
    let result = second.await.unwrap();
    server.join().unwrap();
    assert_eq!(result.text, valid());
    {
        let mut store = app.lock().unwrap();
        store.finish(&dispatch, Ok(result.clone())).unwrap();
        assert_eq!(
            store.attempt_state(&dispatch.attempt).unwrap().as_deref(),
            Some("cancelled")
        );
        store.finish(&other, Ok(result)).unwrap();
        assert_eq!(
            store.attempt_state(&other.attempt).unwrap().as_deref(),
            Some("succeeded")
        );
    }
    assert_eq!(
        app.lock()
            .unwrap()
            .connection
            .query_row(
                "SELECT count(*) FROM inference_executions WHERE task='coach_feedback'",
                [],
                |r| r.get::<_, i32>(0)
            )
            .unwrap(),
        1
    );
}

#[test]
fn cache_identity_covers_inputs_model_schema_and_validation_context_not_attempt_ids() {
    let (_dir, app, mut dispatch) = fixture("http://127.0.0.1:1/v1");
    let original = capture(&app, &dispatch);
    let key = |request: &Request| {
        results::text::request_key(
            &request.dispatch,
            request.output(),
            "coaching-result-v1",
            &json!([request.kind, request.captured, request.source]),
        )
        .unwrap()
    };
    let mut request = capture(&app, &dispatch);
    request.dispatch.attempt = "different-attempt".into();
    request.dispatch.operation = "different-operation".into();
    assert_eq!(key(&request), original.key);
    request.dispatch.messages[0]
        .content
        .push_str(" Changed input.");
    assert_ne!(key(&request), original.key);
    dispatch.model.push_str("-other");
    assert_ne!(capture(&app, &dispatch).key, original.key);
    let mut request = original;
    let before = key(&request);
    request.schema["description"] = json!("Different response contract");
    assert_ne!(key(&request), before);
    let before = key(&request);
    request.captured["practiceFocus"] = json!({"id":"different"});
    assert_ne!(key(&request), before);
}
