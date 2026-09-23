//! The application owns one capture slot; every owner goes through it.
use super::*;
use crate::speech::recording::owner::RecordingOwner;
use crate::speech::recording::voice::start_capture;

/// The one capture slot is shared by every owner, and an owner that cannot
/// be validated never reaches the microphone or leaves the slot claimed.
#[test]
fn an_unknown_owner_is_refused_before_the_microphone_opens() {
    let directory = tempfile::tempdir().unwrap();
    let state = Application::start(&directory.path().join("capture.sqlite3"), None);
    {
        let mut store = state.lock().unwrap();
        store.prepare_chat().unwrap();
        store
            .connection
            .execute(
                "UPDATE ai_config SET route='openrouter',groq_credential_id='audio-reference'",
                [],
            )
            .unwrap();
        store
            .set_connection(1, Some("chat-reference"), "standard", "fast")
            .unwrap();
    }
    for owner in [
        RecordingOwner::DrillItem("missing".into()),
        RecordingOwner::Conversation("missing".into()),
    ] {
        assert!(start_capture(&state, owner).is_err());
        assert!(state.capture.lock().unwrap().is_none());
    }
}
