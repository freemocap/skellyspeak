//! The closed conversation topic contract admits explicit skill/subskill targets.
//! Existing topics and all learning/history records remain byte-for-byte intact.
use super::*;

pub(super) fn apply(db: &Connection) -> Result<()> {
    v50_coaching::validate(db)?;
    // Format 50's topic contract did not admit a skill target. Validate the
    // declared source format before permitting the expanded contract.
    let invalid: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM conversation_settings WHERE json_extract(settings,'$.direction.topic.kind') NOT IN ('builtin','custom','coach'))",
        [], |r| r.get(0),
    )?;
    if invalid {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Conversation direction does not match workspace format 50.",
        ));
    }
    Ok(())
}

pub(super) fn validate(db: &Connection) -> Result<()> {
    v50_coaching::validate(db)?;
    let mut statement = db.prepare("SELECT settings FROM conversation_settings")?;
    for row in statement.query_map([], |r| r.get::<_, String>(0))? {
        let _: PracticeSettings = serde_json::from_str(&row?)?;
    }
    Ok(())
}
