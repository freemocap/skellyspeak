use super::*;

fn generation_app() -> (tempfile::TempDir, Arc<Application>) {
    let directory = tempfile::tempdir().unwrap();
    let app = Application::start(&directory.path().join("generation.sqlite3"), None);
    app.lock().unwrap().connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl','http://127.0.0.1:8765/v1','$.bearerAuth',json('false'))", []).unwrap();
    (directory, app)
}

#[test]
fn failed_durable_begin_releases_volatile_ownership_and_cancel_is_idempotent() {
    let (_directory, app) = generation_app();
    app.lock()
        .unwrap()
        .connection
        .execute_batch("PRAGMA query_only=ON")
        .unwrap();
    for _ in 0..5 {
        let error = reserve_persona_generation(&app, "es".into(), None).unwrap_err();
        assert_eq!(error.code, ErrorCode::Storage);
    }
    app.lock()
        .unwrap()
        .connection
        .execute_batch("PRAGMA query_only=OFF")
        .unwrap();
    let ids: Vec<_> = (0..4)
        .map(|_| reserve_persona_generation(&app, "es".into(), None).unwrap())
        .collect();
    for id in ids {
        cancel_owned_persona_generation(&app, &id).unwrap();
        cancel_owned_persona_generation(&app, &id).unwrap();
        assert!(app.generations.claim(&id).is_err());
    }
    assert!(reserve_persona_generation(&app, "es".into(), None).is_ok());
}

#[test]
fn cancellation_or_authority_change_cannot_adopt_a_completed_proposal() {
    for cancel in [true, false] {
        let (_directory, app) = generation_app();
        let id = reserve_persona_generation(&app, "es".into(), None).unwrap();
        let run = {
            let mut store = app.lock().unwrap();
            let run = app.generations.claim(&id).unwrap();
            generation_receipts::dispatch(&mut store, &run.request).unwrap();
            run.request.mark_submitted();
            run
        };
        if cancel {
            cancel_owned_persona_generation(&app, &id).unwrap();
        } else {
            app.lock()
                .unwrap()
                .connection
                .execute("UPDATE ai_config SET revision=revision+1", [])
                .unwrap();
        }
        let proposed = persona::starter("es").unwrap();
        let completion = provider::Completion {
            text: serde_json::to_string(&proposed).unwrap(),
            actual_model: "fixture".into(),
            provider_id: "synthetic".into(),
            finish_reason: "stop".into(),
            input_tokens: Some(4),
            output_tokens: Some(8),
        };
        let error = finish_persona_generation(&app, &run.request, Some(&completion), Ok(proposed))
            .unwrap_err();
        assert_eq!(error.code, ErrorCode::UnknownOutcome);
    }
}

#[test]
fn rejected_proposals_keep_usage_metadata_and_failed_terminal_writes_do_not_adopt() {
    for reject_write in [true, false] {
        let (_directory, app) = generation_app();
        let id =
            reserve_persona_generation(&app, "es".into(), Some("private brief".into())).unwrap();
        let run = {
            let mut store = app.lock().unwrap();
            let run = app.generations.claim(&id).unwrap();
            generation_receipts::dispatch(&mut store, &run.request).unwrap();
            run.request.mark_submitted();
            run
        };
        let completion = provider::Completion {
            text: "private malformed proposal".into(),
            actual_model: "fixture-actual".into(),
            provider_id: "synthetic".into(),
            finish_reason: "stop".into(),
            input_tokens: Some(4),
            output_tokens: Some(8),
        };
        let outcome = if reject_write {
            app.lock()
                .unwrap()
                .connection
                .execute_batch("PRAGMA query_only=ON")
                .unwrap();
            Ok(persona::starter("es").unwrap())
        } else {
            generated_persona(&completion.text, "es")
        };
        let error =
            finish_persona_generation(&app, &run.request, Some(&completion), outcome).unwrap_err();
        if reject_write {
            assert_eq!(error.code, ErrorCode::Storage);
        } else {
            let activity = generation_receipts::activity(&app.lock().unwrap().connection).unwrap();
            assert_eq!(activity.attempts[0].state, "failed");
            assert_eq!(activity.attempts[0].input_tokens, Some(4));
            assert_eq!(activity.attempts[0].output_tokens, Some(8));
            assert_eq!(
                activity.attempts[0].actual_model.as_deref(),
                Some("fixture-actual")
            );
            assert!(
                !serde_json::to_string(&activity)
                    .unwrap()
                    .contains("private")
            );
        }
    }
}

#[test]
fn non_stop_completion_cannot_publish_a_valid_proposal_but_retains_usage() {
    for finish in ["length", "content_filter", "tool_calls", ""] {
        let (_directory, app) = generation_app();
        let id = reserve_persona_generation(&app, "es".into(), None).unwrap();
        let run = {
            let mut store = app.lock().unwrap();
            let run = app.generations.claim(&id).unwrap();
            generation_receipts::dispatch(&mut store, &run.request).unwrap();
            run.request.mark_submitted();
            run
        };
        let proposed = persona::starter("es").unwrap();
        let completed = Ok(provider::Completion {
            text: serde_json::to_string(&proposed).unwrap(),
            actual_model: "fixture".into(),
            provider_id: "synthetic".into(),
            finish_reason: finish.into(),
            input_tokens: Some(9),
            output_tokens: Some(14),
        });
        let outcome =
            generation::accept_completion(&mut app.lock().unwrap(), &run.request, &completed)
                .map(|_| proposed);
        let error = finish_persona_generation(&app, &run.request, completed.as_ref().ok(), outcome)
            .unwrap_err();
        assert_eq!(error.code, ErrorCode::Provider);
        let view = generation_receipts::activity(&app.lock().unwrap().connection).unwrap();
        assert_eq!(view.attempts[0].state, "failed");
        assert_eq!(view.usage.input_tokens, 9);
        assert_eq!(view.usage.output_tokens, 14);
        assert_eq!(view.usage.unknown_usage, 0);
    }
}

#[test]
fn generation_identities_have_the_shape_the_hosted_server_accepts() {
    let hex = |value: &str| {
        value.len() == 32
            && value
                .chars()
                .all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c))
    };
    let (attempt, operation) = generation_identity();
    // The server's rules: operation `[0-9a-f]{32}`, attempt `[0-9]{10}-[0-9a-f]{32}`.
    let (issued, random) = attempt.split_once('-').expect("attempt has an issue time");
    assert!(
        issued.len() == 10 && issued.chars().all(|c| c.is_ascii_digit()),
        "{attempt}"
    );
    assert!(hex(random), "{attempt}");
    assert!(hex(&operation), "{operation}");
}

#[test]
fn a_valid_response_becomes_a_reviewable_persona_and_writes_nothing() {
    let directory = tempfile::tempdir().unwrap();
    let store = Store::open(&directory.path().join("skellyspeak.sqlite3")).unwrap();
    let before = store.snapshot().unwrap();
    let proposed = persona::starter("fr").unwrap();
    let details = generated_persona(&serde_json::to_string(&proposed).unwrap(), "fr").unwrap();
    assert_eq!(details.name, proposed.name);
    assert_eq!(details.vibe, proposed.vibe);
    // A proposal is not a contact: nothing is written until the learner creates one.
    let after = store.snapshot().unwrap();
    assert_eq!(after.revision, before.revision);
    assert!(after.personas.is_empty());
    assert!(after.contacts.is_empty());
    assert!(after.conversations.is_empty());
}

#[test]
fn an_unusable_response_is_refused_and_writes_nothing() {
    let directory = tempfile::tempdir().unwrap();
    let store = Store::open(&directory.path().join("skellyspeak.sqlite3")).unwrap();
    let before = store.snapshot().unwrap().revision;
    assert_eq!(
        generated_persona("not json", "fr").unwrap_err().code,
        ErrorCode::Provider
    );
    // Well-shaped but outside a limit: refused by the same rules an edit obeys.
    let mut oversized = persona::starter("fr").unwrap();
    oversized.vibe = vec!["🌿".into()];
    assert_eq!(
        generated_persona(&serde_json::to_string(&oversized).unwrap(), "fr")
            .unwrap_err()
            .code,
        ErrorCode::Validation
    );
    let after = store.snapshot().unwrap();
    assert_eq!(after.revision, before);
    assert!(after.personas.is_empty());
    assert!(after.contacts.is_empty());
    assert!(after.conversations.is_empty());
}
