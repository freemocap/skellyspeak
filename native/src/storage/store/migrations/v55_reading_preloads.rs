//! Authored reading imports own no inference execution or learner evidence.
use super::*;

pub(super) fn apply(db: &Connection) -> Result<()> {
    v52_speech_default::validate(db)?;
    db.execute_batch(include_str!("v55_reading_preloads.sql"))?;
    Ok(())
}

pub(super) fn validate(db: &Connection) -> Result<()> {
    v52_speech_default::validate(db)?;
    let reference = Connection::open_in_memory()?;
    reference.execute_batch(include_str!("v55_reading_preloads.sql"))?;
    schema::validate_objects(db, &reference, false)
}
