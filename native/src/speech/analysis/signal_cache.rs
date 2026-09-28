//! Shared derived data for exact audio bytes, independent of origin and text.
//! Durable references follow audio retention; unclaimed live analysis is bounded.
use super::audio_inspection::{AudioSignal, analyze_wav};
use crate::model::{AppError, ErrorCode, Result};
use rusqlite::{Connection, OptionalExtension, params};
use std::{collections::VecDeque, sync::Mutex};

// Increment whenever decoding, waveform, spectral or activity algorithms change.
const REVISION: i32 = 1;
const LIVE_BYTES: usize = 64 * 1024 * 1024;

/// Workspace-owned worker gate. Concurrent consumers never compute the same
/// signal twice; it is never held by the UI thread or across a provider request.
#[derive(Default)]
pub(crate) struct AnalysisGate(pub Mutex<LiveSignals>);

#[derive(Default)]
pub(crate) struct LiveSignals {
    entries: VecDeque<(String, AudioSignal, usize)>,
    #[cfg(test)]
    pub computations: usize,
}
impl LiveSignals {
    pub fn get(&mut self, digest: &str) -> Option<AudioSignal> {
        let index = self.entries.iter().position(|(key, _, _)| key == digest)?;
        let entry = self.entries.remove(index)?;
        let value = entry.1.clone();
        self.entries.push_back(entry);
        Some(value)
    }
    pub fn insert(&mut self, digest: String, signal: AudioSignal) -> Result<()> {
        let bytes = serde_json::to_vec(&signal)?.len();
        self.entries.retain(|(key, _, _)| key != &digest);
        if bytes <= LIVE_BYTES {
            while self.entries.iter().map(|(_, _, n)| n).sum::<usize>() + bytes > LIVE_BYTES {
                self.entries.pop_front();
            }
            self.entries.push_back((digest, signal, bytes));
        }
        Ok(())
    }
}

pub(crate) fn initialize(db: &Connection) -> Result<()> {
    let schema = include_str!("../../storage/schemas/audio_signals.sql");
    let expected = Connection::open_in_memory()?;
    expected.execute_batch(schema)?;
    for object in expected
        .prepare("SELECT name,sql FROM sqlite_master WHERE sql IS NOT NULL")?
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
    {
        let (name, sql) = object?;
        let actual: Option<String> = db
            .query_row(
                "SELECT sql FROM sqlite_master WHERE name=?1",
                [&name],
                |r| r.get(0),
            )
            .optional()?;
        if actual.is_some_and(|actual| actual != sql) {
            return Err(AppError::new(
                ErrorCode::Storage,
                "Unexpected audio analysis schema. No audio was changed.",
            ));
        }
    }
    db.execute_batch(schema)?;
    db.execute("DELETE FROM audio_signals WHERE revision<>?1", [REVISION])?;
    // Unowned transient audio has no lifetime across application sessions.
    remove_unclaimed(db)
}

pub(crate) fn retain(db: &Connection, kind: &str, id: &str, wav: &[u8]) -> Result<()> {
    db.execute("INSERT INTO audio_signal_sources(kind,id,digest) VALUES(?1,?2,?3) ON CONFLICT(kind,id) DO UPDATE SET digest=excluded.digest",
        params![kind, id, crate::ai::results::digest(wav)])?;
    Ok(())
}

pub(crate) fn release(db: &Connection, kind: &str, id: &str) -> Result<()> {
    // Delete only this source's now-unclaimed derived data. Other live work is
    // unrelated to this deletion and must not be discarded.
    let digest: Option<String> = db
        .query_row(
            "DELETE FROM audio_signal_sources WHERE kind=?1 AND id=?2 RETURNING digest",
            params![kind, id],
            |r| r.get(0),
        )
        .optional()?;
    if let Some(digest) = digest {
        db.execute("DELETE FROM audio_signals WHERE digest=?1 AND NOT EXISTS(SELECT 1 FROM audio_signal_sources WHERE digest=?1)", [digest])?;
    }
    Ok(())
}

pub(crate) fn remove_unclaimed(db: &Connection) -> Result<()> {
    db.execute("DELETE FROM audio_signals WHERE NOT EXISTS(SELECT 1 FROM audio_signal_sources s WHERE s.digest=audio_signals.digest)", [])?;
    Ok(())
}

pub(crate) fn bytes(db: &Connection, kind: &str) -> Result<i64> {
    Ok(db.query_row("SELECT COALESCE(SUM(length(data)),0) FROM audio_signals a WHERE EXISTS(SELECT 1 FROM audio_signal_sources s WHERE s.digest=a.digest AND s.kind=?1)", [kind], |r| r.get(0))?)
}

pub(crate) fn read(db: &Connection, digest: &str) -> Result<Option<AudioSignal>> {
    let data: Option<Vec<u8>> = db
        .query_row(
            "SELECT data FROM audio_signals WHERE digest=?1 AND revision=?2",
            params![digest, REVISION],
            |r| r.get(0),
        )
        .optional()?;
    data.map(|data| {
        serde_json::from_slice(&data).map_err(|_| AppError::new(ErrorCode::Storage, "Saved audio analysis is invalid."))
    }).transpose()
}

pub(crate) fn save(db: &Connection, digest: &str, signal: &AudioSignal) -> Result<()> {
    let retained: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM audio_signal_sources WHERE digest=?1)",
        [digest],
        |r| r.get(0),
    )?;
    if !retained {
        return Ok(());
    }
    let data = serde_json::to_vec(signal)?;
    db.execute("INSERT INTO audio_signals(digest,revision,data) VALUES(?1,?2,?3) ON CONFLICT(digest) DO UPDATE SET revision=excluded.revision,data=excluded.data", params![digest, REVISION, data])?;
    Ok(())
}

pub(crate) fn compute(wav: &[u8]) -> Result<AudioSignal> {
    Ok(analyze_wav(wav)?.0)
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn shared_signal_survives_one_owner_and_drops_with_last_audio_owner() {
        let db = Connection::open_in_memory().unwrap();
        initialize(&db).unwrap();
        let wav = wav();
        let digest = crate::ai::results::digest(&wav);
        retain(&db, "inference", "speech", &wav).unwrap();
        retain(&db, "recording", "take", &wav).unwrap();
        save(&db, &digest, &compute(&wav).unwrap()).unwrap();
        assert!(bytes(&db, "recording").unwrap() > 0);
        initialize(&db).unwrap(); // Retained analysis survives restart.
        release(&db, "inference", "speech").unwrap();
        let signal = read(&db, &digest).unwrap().unwrap();
        let owner = crate::speech::recording::owner::RecordingOwner::DrillItem("item".into());
        let mut annotated = signal.inspection("first", &owner);
        annotated.word_timing.reason = Some("different evidence".into());
        assert_ne!(
            signal.inspection("second", &owner).word_timing.reason,
            annotated.word_timing.reason
        );
        release(&db, "recording", "take").unwrap();
        assert!(read(&db, &digest).unwrap().is_none());
    }

    #[test]
    fn transient_data_and_obsolete_revisions_do_not_survive_restart() {
        let db = Connection::open_in_memory().unwrap();
        initialize(&db).unwrap();
        let wav = wav();
        let digest = crate::ai::results::digest(&wav);
        save(&db, &digest, &compute(&wav).unwrap()).unwrap();
        initialize(&db).unwrap();
        assert!(read(&db, &digest).unwrap().is_none());
        retain(&db, "recording", "take", &wav).unwrap();
        save(&db, &digest, &compute(&wav).unwrap()).unwrap();
        db.execute("UPDATE audio_signals SET revision=0", [])
            .unwrap();
        initialize(&db).unwrap();
        assert!(read(&db, &digest).unwrap().is_none());
        assert!(compute(b"invalid").is_err());
    }
}
