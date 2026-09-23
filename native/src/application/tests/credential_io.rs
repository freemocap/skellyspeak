use super::*;

/// A fixture workspace that must open; a refusal here is a broken fixture.
fn application(path: &std::path::Path) -> Arc<Application> {
    let app = Application::start(path, None);
    assert!(app.refusal().is_none(), "the fixture workspace must open");
    app
}

#[test]
fn audit_stale_credential_cleanup_is_recoverable_without_blocking_store() {
    let directory = tempfile::tempdir().unwrap();
    let app = application(&directory.path().join("skellyspeak.sqlite3"));
    app.lock()
        .unwrap()
        .connection
        .execute("INSERT INTO credential_cleanup(id) VALUES('stale')", [])
        .unwrap();
    let denied = || AppError::new(ErrorCode::Credential, "Fixture keychain denied");
    let status = app
        .recover_credential_cleanup_with(|_| Err(denied()))
        .unwrap();
    assert!(status.refusal.is_none());
    assert_eq!(
        status.credential_cleanup.unwrap().message,
        "Fixture keychain denied"
    );
    app.lock().unwrap().prepare_chat().unwrap();
    assert!(
        !app.lock()
            .unwrap()
            .snapshot()
            .unwrap()
            .conversations
            .is_empty()
    );
    assert_eq!(
        app.lock()
            .unwrap()
            .connection
            .query_row("SELECT count(*) FROM credential_cleanup", [], |r| r
                .get::<_, i32>(0))
            .unwrap(),
        1
    );
    let status = app
        .recover_credential_cleanup_with(|id| {
            assert_eq!(id, "stale");
            Ok(())
        })
        .unwrap();
    assert!(status.credential_cleanup.is_none());
    assert_eq!(
        app.lock()
            .unwrap()
            .connection
            .query_row("SELECT count(*) FROM credential_cleanup", [], |r| r
                .get::<_, i32>(0))
            .unwrap(),
        0
    );
    app.recover_credential_cleanup_with(|_| panic!("Successful cleanup must not repeat"))
        .unwrap();
}

/// An older workspace is refused by design; the application must survive it so
/// the reason can reach the screen and the reset stays reachable.
#[test]
fn a_refused_workspace_leaves_the_application_running_with_the_reason_recorded() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("skellyspeak.sqlite3");
    drop(Store::open(&path).unwrap());
    {
        let connection = rusqlite::Connection::open(&path).unwrap();
        connection.pragma_update(None, "user_version", 8).unwrap();
    }
    let app = Application::start(&path, None);
    let refusal = app.refusal().expect("the refusal is recorded");
    assert!(
        refusal.message.contains("Factory Reset"),
        "{}",
        refusal.message
    );
    let error = match app.lock() {
        Ok(_) => panic!("a refused workspace must not hand out a store"),
        Err(error) => error,
    };
    assert_eq!(error.message, refusal.message);
}

#[test]
fn blocked_credential_io_releases_workspace_and_rechecks_revision() {
    for change_revision in [false, true] {
        let directory = tempfile::tempdir().unwrap();
        let app = application(&directory.path().join("test.sqlite3"));
        let revision = app.lock().unwrap().connection_config().unwrap().revision;
        let worker = app.clone();
        let (started, wait_started) = std::sync::mpsc::channel();
        let (resume, wait_resume) = std::sync::mpsc::channel();
        let removed = Arc::new(Mutex::new(Vec::new()));
        let deletions = removed.clone();
        let task = std::thread::spawn(move || {
            worker.write_credential_with(
                |_| Ok(()),
                |_| {
                    started.send(()).unwrap();
                    wait_resume.recv().unwrap();
                    Ok(())
                },
                |store, id| {
                    store.set_hosted_connection(revision, Some(id), "fixture@example.invalid")
                },
                |id| {
                    assert!(
                        worker.store.try_lock().is_ok(),
                        "Credential deletion held the workspace lock"
                    );
                    deletions.lock().unwrap().push(id.to_owned());
                    Ok(())
                },
            )
        });
        wait_started.recv_timeout(Duration::from_secs(2)).unwrap();
        let mut store = app
            .store
            .try_lock()
            .expect("Blocked credential save held workspace lock");
        assert!(store.as_mut().unwrap().snapshot().is_ok());
        assert!(
            store
                .as_mut()
                .unwrap()
                .claim_credential_cleanup()
                .unwrap()
                .is_none(),
            "Cleanup claimed an in-flight write"
        );
        if change_revision {
            store
                .as_mut()
                .unwrap()
                .connection
                .execute("UPDATE ai_config SET revision=revision+1", [])
                .unwrap();
        }
        drop(store);
        resume.send(()).unwrap();
        let result = task.join().unwrap();
        let store = app.lock().unwrap();
        if change_revision {
            assert_eq!(result.unwrap_err().code, ErrorCode::Conflict);
            assert!(
                store
                    .connection
                    .query_row("SELECT hosted_credential_id FROM ai_config", [], |r| r
                        .get::<_, Option<
                        String,
                    >>(
                        0
                    ))
                    .unwrap()
                    .is_none()
            );
            assert_eq!(removed.lock().unwrap().len(), 1);
        } else {
            result.unwrap();
            assert!(
                store
                    .connection
                    .query_row("SELECT hosted_credential_id FROM ai_config", [], |r| r
                        .get::<_, Option<
                        String,
                    >>(
                        0
                    ))
                    .unwrap()
                    .is_some()
            );
            assert!(removed.lock().unwrap().is_empty());
        }
        assert!(store.credential_writes.is_empty());
        assert_eq!(
            store
                .connection
                .query_row("SELECT count(*) FROM credential_cleanup", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
}

#[test]
fn failed_keychain_io_releases_claims_and_keeps_failed_cleanup_retryable() {
    let directory = tempfile::tempdir().unwrap();
    let app = application(&directory.path().join("test.sqlite3"));
    let fail = || AppError::new(ErrorCode::Credential, "Synthetic credential failure.");
    let result: Result<()> = app.write_credential_with(
        |_| Ok(()),
        |_| Err(fail()),
        |_, _| panic!("Failed write must not commit"),
        |_| Err(fail()),
    );
    assert_eq!(result.unwrap_err().code, ErrorCode::Credential);
    {
        let store = app.lock().unwrap();
        assert!(store.credential_writes.is_empty());
        assert!(
            store
                .connection
                .query_row("SELECT hosted_credential_id FROM ai_config", [], |r| r
                    .get::<_, Option<
                    String,
                >>(
                    0
                ))
                .unwrap()
                .is_none()
        );
        assert_eq!(
            store
                .connection
                .query_row("SELECT count(*) FROM credential_cleanup", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            1
        );
    }
    app.clean_credentials_with(|_| {
        assert!(app.store.try_lock().is_ok());
        Ok(())
    })
    .unwrap();
    assert_eq!(
        app.lock()
            .unwrap()
            .connection
            .query_row("SELECT count(*) FROM credential_cleanup", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
}
