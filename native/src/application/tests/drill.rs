use super::*;
use crate::drill::DrillItemInput;

fn phrase() -> DrillItemInput {
    DrillItemInput {
        text: "Quisiera un café.".into(),
        language: "spanish".into(),
        variety: None,
        explanation: "english".into(),
        explanation_variety: None,
    }
}

#[test]
fn a_drill_item_records_replays_and_deletes_through_its_commands() {
    let directory = tempfile::tempdir().unwrap();
    let state = Application::start(&directory.path().join("drill.sqlite3"), None);
    let item = state.lock().unwrap().create_drill_item(phrase()).unwrap();

    // The audio the learner just recorded, kept for replay.
    let wav = b"RIFF....WAVEfixture".to_vec();
    let attempt = state
        .lock()
        .unwrap()
        .save_drill_attempt(&item.id, None, "quisiera un cafe", Some(wav.clone()))
        .unwrap();
    assert_eq!(attempt.comparison["edits"], 0);
    assert_eq!(attempt.comparison["words"][2]["kind"], "same");
    assert_eq!(
        state
            .lock()
            .unwrap()
            .drill_attempt_audio(&attempt.id)
            .unwrap(),
        wav
    );

    // Listing is what the page reads when it is opened again.
    let items = state.lock().unwrap().drill_items("spanish").unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].attempts.len(), 1);
    assert_eq!(items[0].attempts[0].transcript, "quisiera un cafe");

    state.lock().unwrap().delete_drill_item(&item.id).unwrap();
    assert!(
        state
            .lock()
            .unwrap()
            .drill_items("spanish")
            .unwrap()
            .is_empty()
    );
    assert!(
        state
            .lock()
            .unwrap()
            .drill_attempt_audio(&attempt.id)
            .is_err()
    );
}
