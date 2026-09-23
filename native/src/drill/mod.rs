//! Drill: say a target-language line, hear how close you were.
//!
//! Drill owns only what is new — the item, the attempt and the comparison.
//! Recording, transcription, reading aids, speech and inspection are the shared
//! implementations Chat uses, reached by naming a `RecordingOwner::DrillItem`.
pub mod comparison;
pub mod conversation_source;
pub mod generation;
pub mod history;
pub mod previews;
pub(crate) mod reference;
pub mod reliability;
pub mod retention;
pub mod sessions;

use crate::model::*;
use crate::speech::recording::owner::RecordingOwner;
use crate::storage::store::Store;
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// The longest phrase one drill item may hold, in UTF-16 units.
const TEXT_LIMIT: usize = 512;
/// The largest attempt recording kept on disk, in bytes.
const AUDIO_LIMIT: usize = 24 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DrillItemInput {
    pub text: String,
    pub language: String,
    pub variety: Option<String>,
    pub explanation: String,
    pub explanation_variety: Option<String>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DrillItemView {
    pub source: previews::DrillSource,
    pub id: String,
    pub text: String,
    pub language: String,
    pub variety: String,
    pub explanation: String,
    pub explanation_variety: String,
    pub created_at: String,
    #[ts(type = "number")]
    pub attempt_count: i64,
    pub best_match_ratio: Option<f64>,
    pub last_attempt_at: Option<String>,
    pub attempts: Vec<DrillAttemptView>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DrillAttemptView {
    pub id: String,
    pub sequence: i64,
    pub visit_id: Option<String>,
    pub transcript: String,
    #[ts(type = "DrillComparison")]
    pub comparison: serde_json::Value,
    // Bytes retained in a file or pending SQLite storage; null if none was kept.
    pub audio_bytes: Option<i64>,
    // When the audio was removed to reclaim space; the attempt itself stays.
    pub audio_pruned_at: Option<String>,
    // The provider receipt this attempt came from, for its route and usage.
    pub transcription_attempt_id: Option<String>,
    pub created_at: String,
}

fn invalid(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}

impl Store {
    /// A phrase the learner typed. The language pair is validated here, so an
    /// item can always resolve the recording scope it will be recorded under.
    pub fn create_drill_item(&mut self, input: DrillItemInput) -> Result<DrillItemView> {
        let text = input.text.trim().to_owned();
        if text.is_empty() || text.encode_utf16().count() > TEXT_LIMIT || text.contains('\0') {
            return Err(invalid(format!(
                "Enter between 1 and {TEXT_LIMIT} characters to practise."
            )));
        }
        let context = self.config.resolve_pair(
            &input.language,
            input.variety.as_deref(),
            &input.explanation,
            input.explanation_variety.as_deref(),
        )?;
        let id = uuid::Uuid::new_v4().to_string();
        self.connection.execute(
            "INSERT INTO drill_items(id,language_id,variety_id,explanation_language,explanation_variety_id,text) VALUES(?1,?2,?3,?4,?5,?6)",
            params![id, input.language, context.variety_id, input.explanation, context.explanation_variety_id, text],
        )?;
        self.connection
            .execute("UPDATE metadata SET revision=revision+1", [])?;
        item(&self.connection, &id)
    }

    /// Every item for one language, newest first, each with its attempts.
    pub fn drill_items(&self, language: &str) -> Result<Vec<DrillItemView>> {
        let ids: Vec<String> = self
            .connection
            .prepare("SELECT id FROM drill_items WHERE language_id=?1 AND archived=0 ORDER BY created_at DESC, rowid DESC LIMIT 100")?
            .query_map([language], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        ids.iter().map(|id| item(&self.connection, id)).collect()
    }

    /// Record what the learner said, with the comparison it is stored beside.
    ///
    /// Saving is idempotent per recording: a retry after a failed save, or a
    /// duplicate call, returns the attempt that already exists rather than
    /// recording the same utterance twice. The receipt must belong to this item
    /// and have succeeded — an attempt is never attributed to a recording that
    /// failed, or to another item's.
    #[cfg(test)]
    pub fn save_drill_attempt(
        &mut self,
        item_id: &str,
        transcription_attempt_id: Option<&str>,
        transcript: &str,
        wav: Option<Vec<u8>>,
    ) -> Result<DrillAttemptView> {
        let tx = self.connection.transaction()?;
        let id = stage_attempt(
            &tx,
            item_id,
            transcription_attempt_id,
            transcript,
            wav.as_deref(),
        )?;
        retention::mark(&tx)?;
        tx.commit()?;
        self.prune_drill_audio()?;
        self.flush_drill_audio(&id)?;
        attempt(&self.connection, &id)
    }

    /// Move staged audio to its file only after the durable attempt transaction.
    /// A failed write leaves the complete bytes available for an explicit retry.
    pub(crate) fn flush_drill_audio(&self, id: &str) -> Result<()> {
        let pending: Option<Vec<u8>> = self.connection.query_row(
            "SELECT pending_audio FROM drill_attempts WHERE id=?1",
            [id],
            |r| r.get(0),
        )?;
        if let Some(wav) = pending {
            let bytes = self.write_drill_audio(id, &wav)?;
            self.connection.execute(
                "UPDATE drill_attempts SET audio_bytes=?2,pending_audio=NULL WHERE id=?1",
                params![id, bytes as i64],
            )?;
            self.reclaim_drill_audio_pages()?;
        }
        Ok(())
    }

    /// The retained audio for one attempt, for replay.
    pub fn drill_attempt_audio(&self, attempt_id: &str) -> Result<Vec<u8>> {
        let pruned: Option<String> = self
            .connection
            .query_row(
                "SELECT audio_pruned_at FROM drill_attempts WHERE id=?1",
                [attempt_id],
                |r| r.get(0),
            )
            .optional()?
            .ok_or_else(|| AppError::new(ErrorCode::NotFound, "This attempt no longer exists."))?;
        if pruned.is_some() {
            return Err(AppError::new(
                ErrorCode::NotFound,
                "This attempt's audio was removed to reclaim space. Its transcript and scores remain.",
            ));
        }
        self.flush_drill_audio(attempt_id)?;
        let path = self.drill_audio.join(format!("{attempt_id}.wav"));
        std::fs::read(&path).map_err(|cause| {
            crate::diagnostics::response::io_context(
                &cause,
                "drill_audio_read",
                AppError::new(
                    ErrorCode::NotFound,
                    "This attempt's audio is no longer on disk. Its transcript and scores remain.",
                ),
            )
        })
    }

    /// Delete one item with its attempts, their audio and their receipts.
    ///
    /// The audio goes first: if a file cannot be removed, the rows that name it
    /// are still there, so nothing is left on disk that nothing identifies.
    pub fn delete_drill_item(&mut self, item_id: &str) -> Result<()> {
        let attempts: Vec<String> = self
            .connection
            .prepare("SELECT id FROM drill_attempts WHERE drill_item_id=?1")?
            .query_map([item_id], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        let exists: bool = self.connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM drill_items WHERE id=?1)",
            [item_id],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(AppError::new(
                ErrorCode::NotFound,
                "This drill item no longer exists.",
            ));
        }
        for attempt in &attempts {
            self.remove_drill_audio(attempt)?;
            self.connection.execute("UPDATE drill_attempts SET audio_bytes=NULL,pending_audio=NULL,audio_pruned_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1", [attempt])?;
        }
        self.connection
            .execute("DELETE FROM drill_items WHERE id=?1", [item_id])?;
        self.reclaim_drill_audio_pages()?;
        self.connection
            .execute("UPDATE metadata SET revision=revision+1", [])?;
        Ok(())
    }

    /// Delete one take, with its audio. The phrase and its other takes stay.
    pub fn delete_drill_attempt(&mut self, attempt_id: &str) -> Result<()> {
        let exists: bool = self.connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM drill_attempts WHERE id=?1)",
            [attempt_id],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(AppError::new(
                ErrorCode::NotFound,
                "This take no longer exists.",
            ));
        }
        self.remove_drill_attempts(&[attempt_id.to_string()])
    }

    /// Delete a phrase's takes recorded at or after `since`, or all of them.
    /// `since` is a UTC timestamp in the stored form, `2026-09-23T14:05:00.000Z`,
    /// so the comparison is exact. Returns how many takes were deleted.
    pub fn clear_drill_attempts(&mut self, item_id: &str, since: Option<&str>) -> Result<usize> {
        if let Some(since) = since
            && !stored_timestamp(since)
        {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Give the start of the takes to clear as a UTC timestamp like 2026-09-23T14:05:00.000Z.",
            ));
        }
        let exists: bool = self.connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM drill_items WHERE id=?1)",
            [item_id],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(AppError::new(
                ErrorCode::NotFound,
                "This drill item no longer exists.",
            ));
        }
        let attempts: Vec<String> = self
            .connection
            .prepare("SELECT id FROM drill_attempts WHERE drill_item_id=?1 AND (?2 IS NULL OR created_at>=?2)")?
            .query_map(params![item_id, since], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        self.remove_drill_attempts(&attempts)?;
        Ok(attempts.len())
    }

    /// Audio first, then rows: a file that cannot be removed leaves its row, so
    /// nothing stays on disk that nothing identifies.
    fn remove_drill_attempts(&mut self, attempts: &[String]) -> Result<()> {
        for attempt in attempts {
            self.remove_drill_audio(attempt)?;
            self.connection
                .execute("DELETE FROM drill_attempts WHERE id=?1", [attempt])?;
        }
        self.reclaim_drill_audio_pages()?;
        self.connection
            .execute("UPDATE metadata SET revision=revision+1", [])?;
        Ok(())
    }

    /// Remove one attempt's audio file, if it has one. A file that cannot be
    /// removed is an error: the caller keeps the rows that identify it.
    fn remove_drill_audio(&self, attempt_id: &str) -> Result<()> {
        for suffix in ["wav", "wav.part"] {
            let path = self.drill_audio.join(format!("{attempt_id}.{suffix}"));
            match std::fs::remove_file(&path) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(cause) => {
                    return Err(crate::diagnostics::response::io_context(
                        &cause,
                        "drill_audio_delete",
                        AppError::new(
                            ErrorCode::Storage,
                            "Some audio could not be removed. The item remains listed so deletion can be retried.",
                        ),
                    ));
                }
            }
        }
        Ok(())
    }

    /// Audio files no attempt claims: what an interrupted save or a deletion
    /// that failed half-way leaves behind. Called at startup.
    pub(crate) fn reconcile_drill_audio(&self) -> Result<usize> {
        if !self.drill_audio.exists() {
            return Ok(0);
        }
        let kept: std::collections::HashSet<String> = self
            .connection
            .prepare("SELECT id FROM drill_attempts")?
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<rusqlite::Result<_>>()?;
        let entries = std::fs::read_dir(&self.drill_audio).map_err(|cause| {
            crate::diagnostics::response::io_context(
                &cause,
                "drill_audio_scan",
                AppError::new(
                    ErrorCode::Storage,
                    "The drill audio folder could not be read.",
                ),
            )
        })?;
        let mut removed = 0;
        for entry in entries {
            let path = entry
                .map_err(|cause| {
                    crate::diagnostics::response::io_context(
                        &cause,
                        "drill_audio_scan",
                        AppError::new(
                            ErrorCode::Storage,
                            "The drill audio folder could not be read.",
                        ),
                    )
                })?
                .path();
            let claimed = path
                .file_stem()
                .and_then(|stem| stem.to_str())
                .is_some_and(|stem| kept.contains(stem));
            if !claimed && path.is_file() {
                std::fs::remove_file(&path).map_err(|cause| {
                    crate::diagnostics::response::io_context(
                        &cause,
                        "drill_audio_orphan",
                        AppError::new(
                            ErrorCode::Storage,
                            "An unclaimed drill recording could not be removed.",
                        ),
                    )
                })?;
                removed += 1;
            }
        }
        Ok(removed)
    }

    fn write_drill_audio(&self, attempt_id: &str, wav: &[u8]) -> Result<usize> {
        crate::storage::store::private_directory(&self.drill_audio).map_err(|cause| {
            crate::diagnostics::response::io_context(
                &cause,
                "drill_audio_directory",
                AppError::new(
                    ErrorCode::Storage,
                    "The drill audio folder could not be created.",
                ),
            )
        })?;
        let path = self.drill_audio.join(format!("{attempt_id}.wav"));
        let temporary = path.with_extension("wav.part");
        let write = || -> std::io::Result<()> {
            use std::io::Write;
            let mut file = std::fs::File::create(&temporary)?;
            file.write_all(wav)?;
            file.sync_all()?;
            drop(file);
            std::fs::rename(&temporary, &path)?;
            // Unix supports flushing directory entries after rename. Opening a
            // directory as a regular File fails with access denied on Windows.
            #[cfg(unix)]
            std::fs::File::open(&self.drill_audio)?.sync_all()?;
            Ok(())
        };
        write().map_err(|cause| {
            crate::diagnostics::response::io_context(
                &cause,
                "drill_audio_write",
                AppError::new(
                    ErrorCode::Storage,
                    "Audio could not be written. The attempt and audio remain saved for retry.",
                ),
            )
        })?;
        Ok(wav.len())
    }
}

/// Called only from native transcription publication (or native fixtures).
/// Receipt completion and this insert must share the caller's transaction.
#[cfg(test)]
pub(crate) fn stage_attempt(
    db: &Connection,
    item_id: &str,
    receipt: Option<&str>,
    transcript: &str,
    wav: Option<&[u8]>,
) -> Result<String> {
    stage_attempt_with_reliability(db, item_id, receipt, transcript, wav, None)
}

pub(crate) fn stage_attempt_with_reliability(
    db: &Connection,
    item_id: &str,
    receipt: Option<&str>,
    transcript: &str,
    wav: Option<&[u8]>,
    reliability: Option<reliability::DrillReliability>,
) -> Result<String> {
    let target: String = db.query_row(
        "SELECT text FROM drill_items WHERE id=?1 AND archived=0",
        [item_id],
        |r| r.get(0),
    )?;
    if transcript.contains('\0') || transcript.encode_utf16().count() > 4096 {
        return Err(invalid("The transcript exceeds its stored length."));
    }
    if wav.is_some_and(|bytes| bytes.len() > AUDIO_LIMIT) {
        return Err(invalid("The recording exceeds its retention limit."));
    }
    if let Some(recording) = receipt {
        let valid: bool = db.query_row("SELECT EXISTS(SELECT 1 FROM transcription_attempts WHERE id=?1 AND drill_item_id=?2 AND state='succeeded')", params![recording,item_id], |r| r.get(0))?;
        if !valid {
            return Err(invalid(
                "That successful recording does not belong to this drill item.",
            ));
        }
        let existing: Option<String> = db
            .query_row(
                "SELECT id FROM drill_attempts WHERE transcription_attempt_id=?1",
                [recording],
                |r| r.get(0),
            )
            .optional()?;
        if let Some(id) = existing {
            return Ok(id);
        }
    }
    let wav = if retention::limit(db)? == 0 {
        None
    } else {
        wav
    };
    let id = uuid::Uuid::new_v4().to_string();
    let mut comparison = comparison::compare(&target, transcript);
    if let Some(reliability) = reliability {
        self::reliability::qualify(&mut comparison, reliability);
    }
    let comparison = comparison::record(&comparison)?;
    db.execute("INSERT INTO drill_attempts(id,drill_item_id,transcription_attempt_id,visit_id,sequence,transcript,comparison,pending_audio) VALUES(?1,?2,?3,(SELECT drill_visit_id FROM transcription_attempts WHERE id=?3),(SELECT COALESCE(MAX(sequence),0)+1 FROM drill_attempts WHERE drill_item_id=?2),?4,?5,?6)", params![id,item_id,receipt,transcript,comparison,wav])?;
    db.execute("UPDATE metadata SET revision=revision+1", [])?;
    Ok(id)
}

fn item(db: &Connection, id: &str) -> Result<DrillItemView> {
    let (text, language, variety, explanation, explanation_variety, created_at) = db
        .query_row(
            "SELECT text,language_id,variety_id,explanation_language,explanation_variety_id,created_at FROM drill_items WHERE id=?1 AND archived=0",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
        )
        .optional()?
        .ok_or_else(|| AppError::new(ErrorCode::NotFound, "This drill item no longer exists."))?;
    let ids: Vec<String> = db
        .prepare(
            "SELECT id FROM drill_attempts WHERE drill_item_id=?1 ORDER BY sequence DESC LIMIT 50",
        )?
        .query_map([id], |r| r.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    let (attempt_count, best_match_ratio, last_attempt_at) = db.query_row(
        "SELECT COUNT(*),MAX(json_extract(comparison,'$.matchRatio')),MAX(created_at) FROM drill_attempts WHERE drill_item_id=?1",
        [id], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?)))?;
    Ok(DrillItemView {
        source: serde_json::from_str(&db.query_row::<String, _, _>(
            "SELECT source FROM drill_items WHERE id=?1",
            [id],
            |r| r.get(0),
        )?)?,
        attempt_count,
        best_match_ratio,
        last_attempt_at,
        id: id.into(),
        text,
        language,
        variety,
        explanation,
        explanation_variety,
        created_at,
        attempts: ids
            .iter()
            .map(|attempt_id| attempt(db, attempt_id))
            .collect::<Result<_>>()?,
    })
}

fn attempt(db: &Connection, id: &str) -> Result<DrillAttemptView> {
    let (sequence, transcript, comparison, audio_bytes, audio_pruned_at, receipt, created_at): (
        i64,
        String,
        String,
        Option<i64>,
        Option<String>,
        Option<String>,
        String,
    ) = db
        .query_row(
            "SELECT sequence,transcript,comparison,COALESCE(audio_bytes,length(pending_audio)),audio_pruned_at,transcription_attempt_id,created_at FROM drill_attempts WHERE id=?1",
            [id],
            |r| {
                Ok((
                    r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?,
                ))
            },
        )
        .optional()?
        .ok_or_else(|| AppError::new(ErrorCode::NotFound, "This attempt no longer exists."))?;
    Ok(DrillAttemptView {
        id: id.into(),
        sequence,
        visit_id: db.query_row(
            "SELECT visit_id FROM drill_attempts WHERE id=?1",
            [id],
            |r| r.get(0),
        )?,
        transcript,
        comparison: serde_json::from_str(&comparison)?,
        audio_bytes,
        audio_pruned_at,
        transcription_attempt_id: receipt,
        created_at,
    })
}

/// The recording owner for one item, so a caller never builds it by hand.
pub fn owner(item_id: &str) -> RecordingOwner {
    RecordingOwner::DrillItem(item_id.into())
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;

/// `YYYY-MM-DDTHH:MM:SS.sssZ`, the form `created_at` is stored in.
fn stored_timestamp(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 24
        && bytes.iter().enumerate().all(|(index, byte)| match index {
            4 | 7 => *byte == b'-',
            10 => *byte == b'T',
            13 | 16 => *byte == b':',
            19 => *byte == b'.',
            23 => *byte == b'Z',
            _ => byte.is_ascii_digit(),
        })
}
