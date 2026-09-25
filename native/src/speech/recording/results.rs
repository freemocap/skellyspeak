//! Recording-owned recognition results; cache eviction cannot remove this evidence.
use crate::{ai::audio::TranscriptionResult, model::*};
use rusqlite::{Connection, OptionalExtension, params};

pub(crate) fn initialize(db: &Connection) -> Result<()> {
    let schema = include_str!("../../storage/schemas/recording_results.sql");
    let reference = Connection::open_in_memory()?;
    reference.execute_batch(schema)?;
    let expected: String = reference.query_row(
        "SELECT sql FROM sqlite_master WHERE name='recording_results'",
        [],
        |r| r.get(0),
    )?;
    let actual: Option<String> = db
        .query_row(
            "SELECT sql FROM sqlite_master WHERE name='recording_results'",
            [],
            |r| r.get(0),
        )
        .optional()?;
    if actual.is_some_and(|sql| sql != expected) {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Unexpected recording-result schema. No recording data was changed.",
        ));
    }
    db.execute_batch(schema)?;
    Ok(())
}

pub(crate) fn result(db: &Connection, id: &str) -> Result<Option<TranscriptionResult>> {
    let result: Option<String> = db
        .query_row(
            "SELECT result FROM recording_results WHERE recording_id=?1",
            [id],
            |r| r.get(0),
        )
        .optional()?;
    result
        .map(|value| {
            serde_json::from_str(&value).map_err(|_| {
                AppError::new(ErrorCode::Storage, "Saved recording result is invalid.")
            })
        })
        .transpose()
}

pub(crate) fn save(
    db: &Connection,
    id: &str,
    wav: &[u8],
    result: &TranscriptionResult,
) -> Result<()> {
    db.execute(
        "INSERT INTO recording_results(recording_id,audio_digest,result) VALUES(?1,?2,?3)",
        params![
            id,
            crate::ai::results::digest(wav),
            serde_json::to_string(result)?
        ],
    )?;
    Ok(())
}

pub(crate) fn load(db: &Connection, id: &str, wav: &[u8]) -> Result<Option<TranscriptionResult>> {
    let row: Option<(String, String)> = db
        .query_row(
            "SELECT audio_digest,result FROM recording_results WHERE recording_id=?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    row.map(|(digest, result)| {
        if digest != crate::ai::results::digest(wav) {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Recording timing belongs to different audio.",
            ));
        }
        serde_json::from_str(&result)
            .map_err(|_| AppError::new(ErrorCode::Storage, "Saved recording result is invalid."))
    })
    .transpose()
}
