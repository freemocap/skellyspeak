use super::*;
use crate::{
    ai::{connections::access::ResolvedTarget, graph::Contract},
    language::source_graph::SourceText,
    speech::{alignment::CharacterAlignment, synthesis_graph::Settings},
};

fn database() -> Connection {
    let db = Connection::open_in_memory().unwrap();
    db.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE conversations(id TEXT PRIMARY KEY); INSERT INTO conversations VALUES('conversation');").unwrap();
    db.execute_batch(include_str!("../../storage/schemas/graph_runtime.sql"))
        .unwrap();
    results::initialize(&db).unwrap();
    db.execute(
        "INSERT INTO graph_engines VALUES('engine','conversation',?1,'{}',X'00')",
        ["a".repeat(64)],
    )
    .unwrap();
    db
}
fn request() -> Request {
    Request {
        source: SourceText {
            id: "message".into(),
            text: "cafe\u{301} 日本語".into(),
        },
        settings: Settings {
            target: ResolvedTarget {
                audio_resolution: None,
                route: crate::model::ConnectionRoute::Custom,
                revision: 1,
                url: "http://127.0.0.1:8765/v1/audio/speech".into(),
                model: "captured".into(),
                credential: Some("reference".into()),
            },
            install_id: "install".into(),
            language_tag: "es".into(),
            language: "Spanish".into(),
            voice: "voice".into(),
        },
    }
}
fn identity(execution: u64) -> InvocationIdentity {
    InvocationIdentity {
        engine: Some("engine".into()),
        execution: serde_json::from_value(serde_json::json!(execution)).unwrap(),
        artifact: "artifact".into(),
        operation: Contract::new("speech.synthesize", 1),
    }
}
fn alignment() -> SpeechAlignment {
    let lane = CharacterAlignment {
        characters: vec![request().source.text],
        starts: vec![0.0],
        ends: vec![0.1],
    };
    SpeechAlignment {
        source_text: request().source.text,
        original: Some(lane.clone()),
        normalized: Some(lane),
    }
}
#[test]
fn native_audio_receipts_survive_eviction_without_legacy_executions_or_resynthesis() {
    let mut db = database();
    let receipt = {
        let tx = db.transaction().unwrap();
        let receipt = retain(&tx, &identity(1), &request(), &wav(), Some(&alignment())).unwrap();
        verify(&tx, &receipt).unwrap();
        let cached = lookup(&tx, &request()).unwrap().unwrap();
        assert_eq!(cached.wav, wav());
        assert_eq!(cached.alignment, Some(alignment()));
        assert_eq!(cached.receipt.id, receipt.id);
        tx.commit().unwrap();
        receipt
    };
    assert_eq!(results::settings(&db).unwrap().result_count, 1);
    assert_eq!(
        db.query_row("SELECT count(*) FROM inference_executions", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
    results::set_capacity(&db, 0).unwrap();
    results::recover(&db).unwrap();
    let tx = db.transaction().unwrap();
    verify(&tx, &receipt).unwrap();
    assert!(lookup(&tx, &request()).unwrap().is_none());
    assert_eq!(
        tx.query_row(
            "SELECT alignment FROM graph_audio_receipts WHERE id=?1",
            [&receipt.id],
            |r| r.get::<_, String>(0)
        )
        .unwrap(),
        serde_json::to_string(&alignment()).unwrap()
    );
    assert_eq!(results::settings(&tx).unwrap().used_bytes, 0);
}
#[test]
fn native_audio_rolls_back_and_rejects_mismatch_corruption_and_duplicate_producers() {
    let mut db = database();
    let expected = reference(&identity(1), &wav()).unwrap();
    {
        let tx = db.transaction().unwrap();
        retain(&tx, &identity(1), &request(), &wav(), None).unwrap();
        assert!(retain(&tx, &identity(1), &request(), &wav(), None).is_err());
    }
    let tx = db.transaction().unwrap();
    assert!(verify(&tx, &expected).is_err());
    let mut wrong = alignment();
    wrong.source_text.push('!');
    assert!(retain(&tx, &identity(1), &request(), &wav(), Some(&wrong)).is_err());
    let receipt = retain(&tx, &identity(1), &request(), &wav(), Some(&alignment())).unwrap();
    let mut forged = receipt.clone();
    forged.engine = "foreign".into();
    assert!(verify(&tx, &forged).is_err());
    assert!(
        tx.execute("UPDATE graph_audio_receipts SET audio_bytes=3", [])
            .is_err()
    );
    tx.execute("UPDATE inference_blobs SET payload=X'010203'", [])
        .unwrap();
    assert!(read(&tx, &receipt.id).is_err());
}
#[test]
fn both_execution_paths_share_one_capacity_and_keep_their_receipts() {
    let mut db = database();
    results::begin(&db, "old", "text").unwrap();
    results::finish(
        &db,
        "old",
        "key",
        &serde_json::json!({}),
        Some(&[7; 50]),
        None,
    )
    .unwrap();
    let receipt = {
        let tx = db.transaction().unwrap();
        let receipt = retain(&tx, &identity(1), &request(), &wav(), None).unwrap();
        tx.commit().unwrap();
        receipt
    };
    let capacity = results::settings(&db).unwrap().used_bytes - 50;
    results::set_capacity(&db, capacity).unwrap();
    assert!(results::read(&db, "old").unwrap().is_none());
    let tx = db.transaction().unwrap();
    assert!(read(&tx, &receipt.id).unwrap().is_some());
    assert_eq!(
        tx.query_row(
            "SELECT state FROM inference_executions WHERE id='old'",
            [],
            |r| r.get::<_, String>(0)
        )
        .unwrap(),
        "succeeded"
    );
}

fn wav() -> Vec<u8> {
    let mut bytes = std::io::Cursor::new(Vec::new());
    let mut writer = hound::WavWriter::new(
        &mut bytes,
        hound::WavSpec {
            channels: 1,
            sample_rate: 24000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        },
    )
    .unwrap();
    for _ in 0..2400 {
        writer.write_sample(1_i16).unwrap();
    }
    writer.finalize().unwrap();
    bytes.into_inner()
}
