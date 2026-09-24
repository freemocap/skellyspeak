//! Learner-owned recording retention. Synthesized audio uses the shared result repository.
use crate::{model::*, storage::store::Store};
use rusqlite::{Connection, params};
use serde::Serialize;
use ts_rs::TS;

/// The learner types the cap in megabytes. Zero keeps no recording audio at all.
pub const MAX_LIMIT_MB: i32 = 100_000;

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DrillStorageView {
    pub limit_mb: i32,
    #[ts(type = "number")]
    pub recording_bytes: i64,
    #[ts(type = "number")]
    pub pending_removal_bytes: i64,
}

pub(crate) fn limit(db: &Connection) -> Result<i64> {
    Ok(
        db.query_row("SELECT limit_mb FROM drill_storage WHERE id=1", [], |r| {
            r.get::<_, i64>(0)
        })? * 1_000_000,
    )
}

/// Mark unavailable before touching files. Interrupted deletion remains visible
/// and retryable; a missing file cannot be advertised as replayable after restart.
/// Caller owns the transaction (publication or a settings change).
pub(crate) fn mark(db: &Connection) -> Result<()> {
    mark_to(db, limit(db)?)
}

fn mark_to(db: &Connection, cap: i64) -> Result<()> {
    let mut total: i64 = db.query_row("SELECT COALESCE(SUM(COALESCE(audio_bytes,length(pending_audio),0)),0) FROM drill_attempts WHERE audio_pruned_at IS NULL", [], |r| r.get(0))?;
    if total <= cap {
        return Ok(());
    }
    let candidates = db.prepare("SELECT id,COALESCE(audio_bytes,length(pending_audio),0) FROM drill_attempts WHERE audio_pruned_at IS NULL AND (audio_bytes IS NOT NULL OR pending_audio IS NOT NULL) ORDER BY rowid")?
        .query_map([], |r| Ok((r.get::<_,String>(0)?,r.get::<_,i64>(1)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
    for (id, bytes) in candidates {
        if total <= cap {
            break;
        }
        db.execute("UPDATE drill_attempts SET audio_bytes=COALESCE(audio_bytes,length(pending_audio)),pending_audio=NULL,audio_pruned_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1", [&id])?;
        total -= bytes;
    }
    Ok(())
}

impl Store {
    pub fn drill_storage(&self) -> Result<DrillStorageView> {
        Ok(DrillStorageView {
            limit_mb: (limit(&self.connection)? / 1_000_000) as i32,
            recording_bytes: self.connection.query_row("SELECT COALESCE(SUM(COALESCE(audio_bytes,length(pending_audio),0)),0) FROM drill_attempts", [], |r| r.get(0))?,
            pending_removal_bytes: self.connection.query_row("SELECT COALESCE(SUM(audio_bytes),0) FROM drill_attempts WHERE audio_pruned_at IS NOT NULL", [], |r| r.get(0))?,
        })
    }
    pub fn set_drill_storage(&mut self, limit_mb: i32) -> Result<DrillStorageView> {
        if !(0..=MAX_LIMIT_MB).contains(&limit_mb) {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Enter a recording storage limit between 0 and 100000 MB.",
            ));
        }
        let tx = self.connection.transaction()?;
        tx.execute(
            "UPDATE drill_storage SET limit_mb=?1 WHERE id=1",
            params![limit_mb],
        )?;
        mark(&tx)?;
        tx.commit()?;
        self.prune_drill_audio()?;
        self.drill_storage()
    }
    /// Called after committed publication/settings changes and on startup. No
    /// provider work is repeated when cleanup fails; receipts/attempts stay saved.
    pub(crate) fn prune_drill_audio(&self) -> Result<()> {
        let tx = self.connection.unchecked_transaction()?;
        mark(&tx)?;
        tx.commit()?;
        let ids = self.connection.prepare("SELECT id FROM drill_attempts WHERE audio_pruned_at IS NOT NULL AND audio_bytes IS NOT NULL")?
            .query_map([], |r| r.get::<_,String>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
        for id in ids {
            self.remove_drill_audio(&id).map_err(|mut error| {
                error.message = "The attempt and storage setting are saved, but some recording audio could not be removed. Retry cleanup in Recording storage.".into();
                error
            })?;
            self.connection.execute(
                "UPDATE drill_attempts SET audio_bytes=NULL WHERE id=?1",
                [&id],
            )?;
        }
        self.reclaim_drill_audio_pages()
    }
    pub(crate) fn reclaim_drill_audio_pages(&self) -> Result<()> {
        // This pragma yields once per reclaimed page; stepping only once leaves
        // almost all freed audio pages allocated to the database file.
        let mut vacuum = self.connection.prepare("PRAGMA incremental_vacuum")?;
        let mut pages = vacuum.query([])?;
        while pages.next()?.is_some() {}
        Ok(())
    }
}

#[cfg(test)]
#[path = "retention_tests.rs"]
mod tests;
