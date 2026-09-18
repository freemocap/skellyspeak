//! Saved custom subjects belong to the local learner workspace, across languages.
use crate::{
    conversations::direction::{SavedTopic, validate_text},
    model::*,
};
use rusqlite::{Connection, params};
pub(crate) fn list(db: &Connection) -> Result<Vec<SavedTopic>> {
    Ok(db
        .prepare("SELECT id,text FROM saved_topics ORDER BY rowid")?
        .query_map([], |r| {
            Ok(SavedTopic {
                id: r.get(0)?,
                text: r.get(1)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?)
}
/// Borrows the command coordinator's transaction. No independent commit.
pub(crate) fn update(
    db: &Connection,
    snapshot: &Snapshot,
    additions: &[String],
    deletions: &[String],
    expected: i32,
) -> Result<String> {
    if snapshot.revision != expected {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Saved topics changed. Reopen the creator and try again.",
        ));
    }
    for id in deletions {
        if db.execute("DELETE FROM saved_topics WHERE id=?1", [id])? != 1 {
            return Err(AppError::new(
                ErrorCode::NotFound,
                "Saved topic no longer exists.",
            ));
        }
    }
    for text in additions {
        validate_text(text)?;
        let exists: bool = db.query_row(
            "SELECT EXISTS(SELECT 1 FROM saved_topics WHERE text=?1)",
            [text.trim()],
            |r| r.get(0),
        )?;
        if exists {
            return Err(AppError::new(
                ErrorCode::Validation,
                "This topic is already saved.",
            ));
        }
        db.execute(
            "INSERT INTO saved_topics(id,text) VALUES(?1,?2)",
            params![uuid::Uuid::new_v4().to_string(), text.trim()],
        )?;
    }
    Ok(snapshot.learner.id.clone())
}
