//! Durable visits bind a recording at capture time, not at response time.
use crate::{model::*, storage::store::Store};
use rusqlite::{Connection, params};
use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DrillVisitView {
    pub id: String,
    pub item_id: String,
    pub entered_at: String,
    pub left_at: Option<String>,
    pub attempts: i64,
    pub exact_matches: i64,
}
#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DrillSessionView {
    pub id: String,
    pub language: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub end_reason: Option<String>,
    pub visits: Vec<DrillVisitView>,
}
fn unavailable() -> AppError {
    AppError::new(
        ErrorCode::Conflict,
        "This drill session or phrase is no longer active.",
    )
}

fn close(db: &Connection, id: &str, reason: &str) -> Result<()> {
    db.execute("UPDATE drill_visits SET left_at=COALESCE(left_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE session_id=?1", [id])?;
    db.execute("UPDATE drill_sessions SET ended_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),end_reason=?2 WHERE id=?1 AND ended_at IS NULL", params![id,reason])?;
    Ok(())
}
pub(crate) fn recover(db: &Connection) -> Result<()> {
    // Startup owns the workspace; all prior open visits ended with the process.
    let tx = db.unchecked_transaction()?;
    tx.execute("UPDATE drill_visits SET left_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE left_at IS NULL", [])?;
    tx.execute("UPDATE drill_sessions SET ended_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),end_reason='interrupted' WHERE ended_at IS NULL", [])?;
    tx.commit()?;
    Ok(())
}
pub(crate) fn active_visit(db: &Connection, item: &str) -> Result<String> {
    use rusqlite::OptionalExtension;
    db.query_row("SELECT v.id FROM drill_visits v JOIN drill_sessions s ON s.id=v.session_id WHERE v.drill_item_id=?1 AND v.left_at IS NULL AND s.ended_at IS NULL", [item], |r| r.get(0)).optional()?.ok_or_else(unavailable)
}

impl Store {
    pub fn start_drill_session(&mut self, language: &str) -> Result<String> {
        // Resolve a real supported practice language without trusting a label.
        self.config.resolve_pair(language, None, "english", None)?;
        let tx = self.connection.transaction()?;
        let active: Vec<String> = tx
            .prepare("SELECT id FROM drill_sessions WHERE ended_at IS NULL")?
            .query_map([], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        for id in active {
            close(&tx, &id, "replaced")?;
        }
        let id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO drill_sessions(id,language_id) VALUES(?1,?2)",
            params![id, language],
        )?;
        tx.commit()?;
        Ok(id)
    }
    pub fn end_drill_session(&mut self, id: &str) -> Result<()> {
        let tx = self.connection.transaction()?;
        close(&tx, id, "left")?;
        tx.commit()?;
        Ok(())
    }
    pub fn enter_drill_visit(&mut self, session: &str, item: &str) -> Result<String> {
        let tx = self.connection.transaction()?;
        let valid: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM drill_sessions s JOIN drill_items i ON i.language_id=s.language_id WHERE s.id=?1 AND i.id=?2 AND s.ended_at IS NULL AND i.archived=0)", params![session,item], |r| r.get(0))?;
        if !valid {
            return Err(unavailable());
        }
        tx.execute("UPDATE drill_visits SET left_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE session_id=?1 AND left_at IS NULL", [session])?;
        let id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO drill_visits(id,session_id,drill_item_id) VALUES(?1,?2,?3)",
            params![id, session, item],
        )?;
        tx.commit()?;
        Ok(id)
    }
    pub fn leave_drill_visit(&mut self, id: &str) -> Result<()> {
        self.connection.execute("UPDATE drill_visits SET left_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1 AND left_at IS NULL", [id])?;
        Ok(())
    }
    pub fn drill_sessions(&self, language: &str) -> Result<Vec<DrillSessionView>> {
        let mut sessions = self.connection.prepare("SELECT id,language_id,started_at,ended_at,end_reason FROM drill_sessions WHERE language_id=?1 ORDER BY rowid DESC LIMIT 100")?
            .query_map([language], |r| Ok(DrillSessionView { id:r.get(0)?,language:r.get(1)?,started_at:r.get(2)?,ended_at:r.get(3)?,end_reason:r.get(4)?,visits:vec![] }))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        for session in &mut sessions {
            session.visits = self.connection.prepare("SELECT v.id,v.drill_item_id,v.entered_at,v.left_at,COUNT(a.id),COALESCE(SUM(json_extract(a.comparison,'$.matchRatio')=1),0) FROM drill_visits v LEFT JOIN drill_attempts a ON a.visit_id=v.id WHERE v.session_id=?1 GROUP BY v.id ORDER BY v.rowid")?
                .query_map([&session.id], |r| Ok(DrillVisitView {id:r.get(0)?,item_id:r.get(1)?,entered_at:r.get(2)?,left_at:r.get(3)?,attempts:r.get(4)?,exact_matches:r.get(5)?}))?
                .collect::<rusqlite::Result<_>>()?;
        }
        Ok(sessions)
    }
}

#[cfg(test)]
#[path = "session_tests.rs"]
mod tests;
