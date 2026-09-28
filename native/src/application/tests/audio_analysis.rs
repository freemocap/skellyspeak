use super::*;
use crate::speech::recording::owner::RecordingOwner;

fn phrase(text: &str) -> crate::drill::DrillItemInput {
    crate::drill::DrillItemInput {
        text: text.into(),
        language: "spanish".into(),
        variety: None,
        explanation: "english".into(),
        explanation_variety: None,
    }
}
fn wav() -> Vec<u8> {
    let mut bytes = std::io::Cursor::new(Vec::new());
    let mut writer = hound::WavWriter::new(
        &mut bytes,
        hound::WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        },
    )
    .unwrap();
    for i in 0..1600 {
        writer.write_sample((i % 100) as i16).unwrap();
    }
    writer.finalize().unwrap();
    bytes.into_inner()
}
fn computations(state: &Application) -> usize {
    state
        .lock()
        .unwrap()
        .audio_analysis
        .0
        .lock()
        .unwrap()
        .computations
}
fn count(state: &Application) -> i64 {
    state
        .lock()
        .unwrap()
        .connection
        .query_row("SELECT count(*) FROM audio_signals", [], |r| r.get(0))
        .unwrap()
}

#[tokio::test]
async fn concurrent_consumers_share_signal_and_retained_analysis_survives_restart() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("audio.sqlite3");
    let state = Application::start(&path, None);
    let (first, second) = {
        let mut store = state.lock().unwrap();
        let first = store.create_drill_item(phrase("Hola")).unwrap();
        let second = store.create_drill_item(phrase("Adiós")).unwrap();
        for item in [&first, &second] {
            store
                .save_drill_attempt(&item.id, None, "Hola", Some(wav()))
                .unwrap();
        }
        (first.id, second.id)
    };
    let (a, b) = tokio::join!(
        state.inspect_audio(
            wav(),
            "one".into(),
            RecordingOwner::DrillItem(first.clone())
        ),
        state.inspect_audio(
            wav(),
            "two".into(),
            RecordingOwner::DrillItem(second.clone())
        )
    );
    let (a, b) = (a.unwrap(), b.unwrap());
    assert_eq!(computations(&state), 1);
    assert_eq!(count(&state), 1);
    assert_ne!(a.owner, b.owner);
    assert_eq!(a.spectrogram.bins, b.spectrogram.bins);
    drop(state);
    let state = Application::start(&path, None);
    state
        .inspect_audio(
            wav(),
            "again".into(),
            RecordingOwner::DrillItem(second.clone()),
        )
        .await
        .unwrap();
    assert_eq!(computations(&state), 0);
    state.lock().unwrap().delete_drill_item(&first).unwrap();
    assert_eq!(count(&state), 1);
    state.lock().unwrap().delete_drill_item(&second).unwrap();
    assert_eq!(count(&state), 0);
}

#[tokio::test]
async fn keep_none_reuses_live_analysis_without_persisting_it_and_errors_are_retryable() {
    let dir = tempfile::tempdir().unwrap();
    let state = Application::start(&dir.path().join("audio.sqlite3"), None);
    let item = state
        .lock()
        .unwrap()
        .create_drill_item(phrase("Hola"))
        .unwrap();
    let owner = RecordingOwner::DrillItem(item.id);
    assert!(
        state
            .inspect_audio(b"invalid".to_vec(), "bad".into(), owner.clone())
            .await
            .is_err()
    );
    for id in ["capture", "replay"] {
        state
            .inspect_audio(wav(), id.into(), owner.clone())
            .await
            .unwrap();
    }
    assert_eq!(computations(&state), 1);
    assert_eq!(count(&state), 0);
}

#[tokio::test]
async fn recording_budget_includes_analysis_and_prunes_it_with_audio() {
    let dir = tempfile::tempdir().unwrap();
    let state = Application::start(&dir.path().join("audio.sqlite3"), None);
    let (item, attempt) = {
        let mut store = state.lock().unwrap();
        let item = store.create_drill_item(phrase("Hola")).unwrap();
        let attempt = store
            .save_drill_attempt(&item.id, None, "Hola", Some(wav()))
            .unwrap();
        (item, attempt)
    };
    state
        .inspect_audio(wav(), "view".into(), RecordingOwner::DrillItem(item.id))
        .await
        .unwrap();
    assert!(
        state
            .lock()
            .unwrap()
            .drill_storage()
            .unwrap()
            .recording_bytes
            > wav().len() as i64
    );
    state.lock().unwrap().set_drill_storage(0).unwrap();
    assert_eq!(count(&state), 0);
    assert!(
        state
            .lock()
            .unwrap()
            .drill_attempt_audio(&attempt.id)
            .is_err()
    );
}
