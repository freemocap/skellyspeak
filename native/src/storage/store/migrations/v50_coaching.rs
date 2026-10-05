//! Coaching is required work. Retire only its activation preference; preserve
//! captured turn policy, accepted operations, learner evidence and earned credit.
use super::*;

pub(super) fn apply(db: &Connection) -> Result<()> {
    v49_execution::validate(db)?;
    db.execute_batch(
        "UPDATE learner SET preferences=json_remove(preferences,'$.execution.coaching');",
    )?;
    Ok(())
}

pub(super) fn validate(db: &Connection) -> Result<()> {
    v48_assessment::validate(db)?;
    let raw: String = db.query_row("SELECT preferences FROM learner", [], |r| r.get(0))?;
    let value: serde_json::Value = serde_json::from_str(&raw)?;
    let _: crate::configuration::execution::ExecutionPreferences =
        serde_json::from_value(value["execution"].clone())?;
    Ok(())
}
