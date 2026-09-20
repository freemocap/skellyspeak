use super::*;
use crate::model::{Action, TurnControl};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

fn apply(store: &mut Store, action: Action) {
    store
        .execute(Command {
            session_id: store.session_id.clone(),
            action_id: uuid::Uuid::new_v4().to_string(),
            action,
        })
        .unwrap();
}

// Hold a real protocol response until the workspace changes. The same
// preparation used by the scheduler must refuse before an operations POST.
#[tokio::test]
async fn revoked_work_is_not_submitted_after_a_delayed_probe() {
    for change in [
        "cancel",
        "delete",
        "credentials",
        "revision",
        "hold",
        "none",
    ] {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}/v1", listener.local_addr().unwrap());
        let directory = tempfile::tempdir().unwrap();
        let app = Application::start(&directory.path().join("scheduler.sqlite3"), None);
        let (conversation, turn, dispatch) = {
            let mut store = app.lock().unwrap();
            store.prepare_chat().unwrap();
            store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl',?1,'$.bearerAuth',json('false'))", [&base]).unwrap();
            let conversation = store.snapshot().unwrap().conversations[0].clone();
            apply(
                &mut store,
                Action::SendMessage {
                    conversation_id: conversation.id.clone(),
                    expected_revision: conversation.revision,
                    text: "Hola".into(),
                    input: Default::default(),
                },
            );
            let dispatch = (0..20).find_map(|_| store.dispatch().unwrap()).unwrap();
            let turn = store.attempt_scope(&dispatch.attempt).unwrap().unwrap().1;
            (conversation.id, turn, dispatch)
        };
        let client = provider::client().unwrap();
        let dispatches = [dispatch];
        let preparation = app.prepare_grouped(&client, "", &dispatches);
        tokio::pin!(preparation);
        let (mut socket, _) = tokio::select! {
            accepted = listener.accept() => accepted.unwrap(),
            result = &mut preparation => panic!("probe completed before responding: {result:?}"),
        };
        let mut request = Vec::new();
        loop {
            let mut bytes = [0; 1024];
            let count = tokio::select! {
                read = socket.read(&mut bytes) => read.unwrap(),
                result = &mut preparation => panic!("probe completed before responding: {result:?}"),
            };
            assert!(count > 0);
            request.extend_from_slice(&bytes[..count]);
            if request.windows(4).any(|part| part == b"\r\n\r\n") {
                break;
            }
        }
        assert!(
            String::from_utf8(request)
                .unwrap()
                .starts_with("GET /v1/protocol ")
        );
        {
            let mut store = app.lock().unwrap();
            match change {
                "cancel" => apply(
                    &mut store,
                    Action::ControlTurn {
                        turn_id: turn,
                        control: TurnControl::Cancel,
                    },
                ),
                "delete" => {
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
                }
                "credentials" => {
                    execution::invalidate(&store.connection, Some(ConnectionRoute::Custom)).unwrap()
                }
                "revision" => {
                    store
                        .connection
                        .execute("UPDATE ai_config SET revision=revision+1", [])
                        .unwrap();
                }
                "hold" => holds::record(
                    &store.connection,
                    &dispatches[0].target,
                    &AppError::new(ErrorCode::Provider, "Rate limited")
                        .with_refusal(crate::ai::policy::refusal::classify(None, None, None)),
                )
                .unwrap(),
                _ => (),
            }
        }
        let body = r#"{"operations_versions":[1,2]}"#;
        socket
            .write_all(
                format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                )
                .as_bytes(),
            )
            .await
            .unwrap();
        drop(socket);
        let result = preparation.await;
        if change == "none" || change == "revision" {
            assert!(result.unwrap());
        } else {
            assert!(result.is_err(), "{change} must stop dispatch");
        }
    }
}
