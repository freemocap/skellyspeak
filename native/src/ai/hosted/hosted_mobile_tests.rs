use super::*;

#[test]
fn rejection_diagnostics_distinguish_missing_state_from_mismatch_without_values() {
    for (value, expected) in [
        (
            "skellyspeak://auth?code=private-code",
            "hosted_callback_state_missing",
        ),
        (
            "skellyspeak://auth?state=private-state&code=private-code",
            "hosted_callback_state_mismatch",
        ),
        (
            "skellyspeak://auth?state=expected&state=other",
            "hosted_callback_state_duplicate",
        ),
        (
            "skellyspeak://auth/other?state=expected",
            "hosted_callback_wrong_path",
        ),
    ] {
        assert_eq!(
            super::super::mobile_callback_rejection(&url(value), "expected"),
            Some(expected)
        );
        assert!(super::super::mobile_callback(&url(value), "expected").is_none());
    }
}

// macOS exposes the same Opened event, so exercise the iOS plugin callback with
// Tauri's mock runtime without requiring an iOS device or a real webview.
#[cfg(target_os = "macos")]
#[test]
fn native_open_event_delivers_without_a_webview_or_deep_link_broadcast() {
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };
    use tauri::{Listener, plugin::Plugin};

    let app = tauri::test::mock_app();
    let broadcast = Arc::new(AtomicBool::new(false));
    let observed = broadcast.clone();
    app.listen("deep-link://new-url", move |_| {
        observed.store(true, Ordering::SeqCst);
    });
    let (sender, mut receiver) = tokio::sync::oneshot::channel();
    *pending().lock().unwrap() = Some(("expected".into(), sender));
    let mut plugin = ios_callback_plugin();
    let event = tauri::RunEvent::Opened {
        urls: vec![url("skellyspeak://auth?state=expected&code=synthetic-code")],
    };
    plugin.on_event(app.handle(), &event);
    assert_eq!(receiver.try_recv().unwrap().unwrap(), "synthetic-code");
    assert!(pending().lock().unwrap().is_none());
    assert!(!broadcast.load(Ordering::SeqCst));
    // iOS can deliver the same URL more than once. It must not replay a code.
    plugin.on_event(app.handle(), &event);
    assert!(pending().lock().unwrap().is_none());
}

fn url(value: &str) -> reqwest::Url {
    reqwest::Url::parse(value).unwrap()
}

#[test]
fn browser_fragments_do_not_block_valid_query_callbacks_or_supply_credentials() {
    for fragment in ["", "_=_", "state=wrong&code=fragment-code"] {
        let (sender, mut receiver) = tokio::sync::oneshot::channel();
        let mut slot = Some(("expected".to_owned(), sender));
        let callback = url(&format!(
            "skellyspeak://auth?state=expected&code=query-code#{fragment}"
        ));
        let (sender, result) = take_callback(&mut slot, &[callback]).unwrap();
        sender.send(result).unwrap();
        assert_eq!(receiver.try_recv().unwrap().unwrap(), "query-code");
        assert!(slot.is_none());
    }
    for value in [
        "skellyspeak://auth?code=query-code#state=expected",
        "skellyspeak://auth?state=wrong&code=query-code#state=expected",
        "skellyspeak://auth?state=expected&state=other#state=expected",
    ] {
        assert!(mobile_callback(&url(value), "expected").is_none());
    }
    assert!(
        mobile_callback(
            &url("skellyspeak://auth?state=expected#code=fragment-code"),
            "expected"
        )
        .unwrap()
        .is_err()
    );
}

#[test]
fn callback_completes_the_pending_attempt_once() {
    let (sender, mut receiver) = tokio::sync::oneshot::channel();
    let mut slot = Some(("expected".to_owned(), sender));
    let urls = [url("skellyspeak://auth?state=expected&code=synthetic-code")];
    let (sender, result) = take_callback(&mut slot, &urls).unwrap();
    sender.send(result).unwrap();
    assert_eq!(receiver.try_recv().unwrap().unwrap(), "synthetic-code");
    assert!(slot.is_none());
    assert!(take_callback(&mut slot, &urls).is_none());
}

#[test]
fn unrelated_and_stale_callbacks_cannot_consume_the_current_attempt() {
    let (sender, mut receiver) = tokio::sync::oneshot::channel();
    let mut slot = Some(("current".to_owned(), sender));
    for value in [
        "https://auth?state=current&code=synthetic-code",
        "skellyspeak://other?state=current&code=synthetic-code",
        "skellyspeak://auth?state=previous&code=synthetic-code",
        "skellyspeak://auth?state=current&state=current&code=synthetic-code",
    ] {
        assert!(take_callback(&mut slot, &[url(value)]).is_none());
        assert!(slot.is_some());
        assert_eq!(
            receiver.try_recv().unwrap_err(),
            tokio::sync::oneshot::error::TryRecvError::Empty
        );
    }
    let (sender, result) = take_callback(
        &mut slot,
        &[
            url("skellyspeak://unrelated"),
            url("skellyspeak://auth?state=current&code=synthetic-code"),
        ],
    )
    .unwrap();
    sender.send(result).unwrap();
    assert!(receiver.try_recv().unwrap().is_ok());
}

#[test]
fn matching_state_with_provider_failure_or_invalid_code_releases_the_attempt() {
    for value in [
        "skellyspeak://auth?state=expected&error=access_denied",
        "skellyspeak://auth?state=expected",
        "skellyspeak://auth?state=expected&code=a&code=b",
    ] {
        let (sender, mut receiver) = tokio::sync::oneshot::channel();
        let mut slot = Some(("expected".to_owned(), sender));
        let (sender, result) = take_callback(&mut slot, &[url(value)]).unwrap();
        sender.send(result).unwrap();
        assert!(receiver.try_recv().unwrap().is_err());
        assert!(slot.is_none());
    }
}
