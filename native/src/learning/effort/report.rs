//! Read-only summaries and cursor-paged lifetime history, independent of claims.
use super::EffortDimension;
use crate::model::{AppError, ErrorCode, Result};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct EffortActivity {
    pub dimension: EffortDimension,
    pub total: u32,
    pub last_seven_days: u32,
    pub active_days: u32,
    pub first_at: String,
    pub last_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct EffortHistoryEntry {
    pub id: String,
    pub dimension: EffortDimension,
    pub created_at: String,
    /// Current retained source text, never another persisted copy.
    pub source_text: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct EffortReport {
    pub target: String,
    pub activity: Vec<EffortActivity>,
    pub entries: Vec<EffortHistoryEntry>,
    pub next: Option<String>,
}
fn dimension(key: String) -> Result<EffortDimension> {
    Ok(serde_json::from_value(serde_json::Value::String(key))?)
}
pub(super) fn read(
    db: &Connection,
    target: &str,
    filter: Option<EffortDimension>,
    before: Option<&str>,
) -> Result<EffortReport> {
    let mut report = EffortReport {
        target: target.into(),
        activity: vec![],
        entries: vec![],
        next: None,
    };
    let rows = db.prepare("SELECT dimension,count(*),sum(julianday(created_at)>=julianday('now','-7 days')),count(DISTINCT substr(created_at,1,10)),min(created_at),max(created_at) FROM effort_awards WHERE language_id=?1 GROUP BY dimension")?.query_map([target],|r| Ok((r.get::<_,String>(0)?,r.get::<_,u32>(1)?,r.get::<_,u32>(2)?,r.get::<_,u32>(3)?,r.get::<_,String>(4)?,r.get::<_,String>(5)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
    for (key, total, last_seven_days, active_days, first_at, last_at) in rows {
        report.activity.push(EffortActivity {
            dimension: dimension(key)?,
            total,
            last_seven_days,
            active_days,
            first_at,
            last_at,
        });
    }
    let cursor: Option<i64> = before.map(|id| -> Result<i64> {
        db.query_row("SELECT rowid FROM effort_awards WHERE id=?1 AND language_id=?2 AND (?3 IS NULL OR dimension=?3)",params![id,target,filter.map(|d|d.key())], |r|r.get(0)).optional()?.ok_or_else(|| AppError::new(ErrorCode::NotFound,"Effort history changed. Reopen the report."))
    }).transpose()?;
    // Cursor uses immutable insertion order, so new publications cannot shift pages.
    // Exploration identities are operations or content digests, never user turn IDs.
    let rows = db.prepare("SELECT a.id,a.dimension,a.created_at,CASE WHEN a.dimension IN ('explorations','bot') THEN NULL WHEN a.dimension='practice_attempts' THEN (SELECT transcript FROM drill_attempts WHERE transcription_attempt_id=a.source_id LIMIT 1) ELSE (SELECT text FROM messages WHERE turn_id=a.source_id AND role='user') END FROM effort_awards a WHERE language_id=?1 AND (?2 IS NULL OR a.dimension=?2) AND (?3 IS NULL OR a.rowid<?3) ORDER BY a.rowid DESC LIMIT 51")?.query_map(params![target,filter.map(|d|d.key()),cursor],|r| Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,Option<String>>(3)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
    let more = rows.len() > 50;
    for (id, key, created_at, source_text) in rows.into_iter().take(50) {
        report.entries.push(EffortHistoryEntry {
            id,
            dimension: dimension(key)?,
            created_at,
            source_text,
        });
    }
    if more {
        report.next = report.entries.last().map(|entry| entry.id.clone());
    }
    Ok(report)
}
#[tauri::command]
pub(crate) fn get_effort_report(
    state: tauri::State<'_, Arc<crate::application::Application>>,
    target: String,
    dimension: Option<EffortDimension>,
    before: Option<String>,
) -> Result<EffortReport> {
    let store = state.lock()?;
    store.config.language(&target)?;
    read(&store.connection, &target, dimension, before.as_deref())
}
