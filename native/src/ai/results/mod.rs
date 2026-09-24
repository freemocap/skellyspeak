//! Workspace-wide request results and evictable blobs. No product owner or UI state.
use crate::model::{AppError, ErrorCode, Result};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use ts_rs::TS;

pub mod pending;
pub mod speech;

#[derive(Clone)]
pub struct Retained {
    pub cached: bool,
    pub execution: String,
    pub payload: Vec<u8>,
    pub metadata: serde_json::Value,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CacheSettings {
    #[ts(type = "number")]
    pub capacity_bytes: u64,
    #[ts(type = "number")]
    pub used_bytes: u64,
    #[ts(type = "number")]
    pub result_count: u64,
}

pub fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn initialize(db: &Connection) -> Result<()> {
    let schema = include_str!("../../storage/schemas/inference_results.sql");
    let expected = Connection::open_in_memory()?;
    expected.execute_batch(schema)?;
    let mut objects =
        expected.prepare("SELECT name,sql FROM sqlite_master WHERE sql IS NOT NULL")?;
    for object in objects.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))? {
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
                format!(
                    "Unexpected inference schema object: {name}. No inference data was changed."
                ),
            ));
        }
    }
    let transaction = db.unchecked_transaction()?;
    transaction.execute_batch(schema)?;
    // Targeted development cleanup: obsolete regenerable bytes only, never receipts or recordings.
    transaction.execute_batch("DROP TABLE IF EXISTS drill_references;")?;
    transaction.execute("UPDATE inference_executions SET state=CASE WHEN dispatched=1 THEN 'unknown' ELSE 'cancelled' END, finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE state='pending'", [])?;
    transaction.commit()?;
    Ok(())
}

fn tick(db: &Connection) -> Result<i64> {
    Ok(db.query_row(
        "UPDATE inference_cache_settings SET clock=clock+1 WHERE singleton=1 RETURNING clock",
        [],
        |r| r.get(0),
    )?)
}

pub fn settings(db: &Connection) -> Result<CacheSettings> {
    Ok(CacheSettings {
        capacity_bytes: db.query_row(
            "SELECT capacity_bytes FROM inference_cache_settings WHERE singleton=1",
            [],
            |r| r.get::<_, i64>(0),
        )? as u64,
        used_bytes: db.query_row(
            "SELECT COALESCE(SUM(length(payload)),0) FROM inference_blobs",
            [],
            |r| r.get::<_, i64>(0),
        )? as u64,
        result_count: db.query_row("SELECT count(*) FROM inference_results", [], |r| {
            r.get::<_, i64>(0)
        })? as u64,
    })
}

pub fn set_capacity(db: &Connection, bytes: u64) -> Result<CacheSettings> {
    if bytes > 100_000 * 1024 * 1024 {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Cache capacity is too large.",
        ));
    }
    let tx = db.unchecked_transaction()?;
    tx.execute(
        "UPDATE inference_cache_settings SET capacity_bytes=?1 WHERE singleton=1",
        [bytes as i64],
    )?;
    prune(&tx)?;
    tx.commit()?;
    settings(db)
}

fn prune(db: &Connection) -> Result<()> {
    loop {
        db.execute("DELETE FROM inference_blobs WHERE NOT EXISTS(SELECT 1 FROM inference_results WHERE blob_digest=inference_blobs.digest)", [])?;
        let current = settings(db)?;
        if current.used_bytes <= current.capacity_bytes {
            return Ok(());
        }
        db.execute("DELETE FROM inference_results WHERE id=(SELECT id FROM inference_results ORDER BY last_used,id LIMIT 1)", [])?;
    }
}

pub fn lookup(db: &Connection, key: &str) -> Result<Option<Retained>> {
    let id: Option<String> = db.query_row("SELECT id FROM inference_results WHERE request_key=?1 ORDER BY last_used DESC,id LIMIT 1", [key], |r| r.get(0)).optional()?;
    id.map(|id| read(db, &id)).transpose().map(Option::flatten)
}

pub fn read(db: &Connection, id: &str) -> Result<Option<Retained>> {
    let value: Option<(Vec<u8>,String)> = db.query_row("SELECT b.payload,e.metadata FROM inference_results r JOIN inference_blobs b ON b.digest=r.blob_digest JOIN inference_executions e ON e.id=r.id WHERE r.id=?1 AND e.state='succeeded'", [id], |r| Ok((r.get(0)?,r.get(1)?))).optional()?;
    value
        .map(|(payload, metadata)| {
            let metadata = serde_json::from_str(&metadata)?;
            db.execute(
                "UPDATE inference_results SET last_used=?2 WHERE id=?1",
                params![id, tick(db)?],
            )?;
            Ok(Retained {
                cached: true,
                execution: id.into(),
                payload,
                metadata,
            })
        })
        .transpose()
}

pub fn begin(db: &Connection, id: &str, task: &str) -> Result<()> {
    db.execute(
        "INSERT INTO inference_executions(id,task,state) VALUES(?1,?2,'pending')",
        params![id, task],
    )?;
    Ok(())
}
pub fn dispatched(db: &Connection, id: &str) -> Result<()> {
    if db.execute("UPDATE inference_executions SET dispatched=1 WHERE id=?1 AND state='pending' AND dispatched=0", [id])? != 1 {
        return Err(AppError::new(ErrorCode::Conflict, "Execution is no longer pending."));
    }
    Ok(())
}

pub fn record_retry(db: &Connection, id: &str, error: &AppError) -> Result<()> {
    let metadata = crate::diagnostics::response::retained(None, Some(error));
    if db.execute("UPDATE inference_executions SET metadata=json_set(metadata,'$.retry',json(?2)) WHERE id=?1 AND state='pending'",params![id,metadata])? != 1 {
        return Err(AppError::new(ErrorCode::Conflict,"Execution ended before retry."));
    }
    Ok(())
}

/// One transaction retains the receipt and makes only validated complete payloads reusable.
/// Caller supplies redacted metadata; content belongs only in the payload.
pub fn finish(
    db: &Connection,
    id: &str,
    key: &str,
    metadata: &serde_json::Value,
    payload: Option<&[u8]>,
    error: Option<&AppError>,
) -> Result<()> {
    let tx = db.unchecked_transaction()?;
    let state = if error.is_some_and(|e| e.code == ErrorCode::UnknownOutcome) {
        "unknown"
    } else if error.is_some() {
        "failed"
    } else {
        "succeeded"
    };
    if tx.execute("UPDATE inference_executions SET state=?2,metadata=?3,finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1 AND state='pending'", params![id,state,serde_json::to_string(metadata)?])? != 1 {
        return Err(AppError::new(ErrorCode::Conflict, "Execution already settled."));
    }
    if error.is_none()
        && let Some(payload) = payload.filter(|v| !v.is_empty())
    {
        let capacity = settings(&tx)?.capacity_bytes;
        if payload.len() as u64 <= capacity {
            let hash = digest(payload);
            tx.execute(
                "INSERT OR IGNORE INTO inference_blobs(digest,payload) VALUES(?1,?2)",
                params![hash, payload],
            )?;
            tx.execute("INSERT INTO inference_results(id,request_key,blob_digest,last_used) VALUES(?1,?2,?3,?4)", params![id,key,hash,tick(&tx)?])?;
            prune(&tx)?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn profile(db: &Connection, scope: &str) -> Result<Option<String>> {
    Ok(db
        .query_row(
            "SELECT profile FROM inference_profiles WHERE scope=?1",
            [scope],
            |r| r.get(0),
        )
        .optional()?)
}
pub fn remember_profile(db: &Connection, scope: &str, profile: &str) -> Result<()> {
    db.execute("INSERT INTO inference_profiles(scope,profile) VALUES(?1,?2) ON CONFLICT(scope) DO UPDATE SET profile=excluded.profile", params![scope,profile])?;
    Ok(())
}

pub fn associate(db: &Connection, consumer: &str, execution: &str) -> Result<()> {
    db.execute("INSERT INTO inference_consumers(consumer_id,execution_id) VALUES(?1,?2) ON CONFLICT(consumer_id) DO UPDATE SET execution_id=excluded.execution_id",params![consumer,execution])?;
    Ok(())
}

pub fn for_consumer(db: &Connection, consumer: &str) -> Result<Option<Retained>> {
    let id: Option<String> = db
        .query_row(
            "SELECT execution_id FROM inference_consumers WHERE consumer_id=?1",
            [consumer],
            |r| r.get(0),
        )
        .optional()?;
    id.map(|id| read(db, &id)).transpose().map(Option::flatten)
}

#[cfg(test)]
mod tests;
