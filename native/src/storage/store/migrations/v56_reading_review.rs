//! Preserve imported records while distinguishing editorial and source review.
use super::*;

pub(super) fn apply(db: &Connection) -> Result<()> {
    v55_reading_preloads::validate(db)?;
    // Copy both sides before removing either table: the child has cascade ownership.
    // The migration coordinator owns the transaction, including these temporary copies.
    db.execute_batch(
        "CREATE TEMP TABLE saved_reading_packages AS SELECT * FROM reading_packages;
         CREATE TEMP TABLE saved_reading_dictionary AS SELECT * FROM reading_dictionary;
         DROP TABLE reading_dictionary;
         DROP TABLE reading_packages;",
    )?;
    db.execute_batch(include_str!("v56_reading_review.sql"))?;
    db.execute_batch(
        "INSERT INTO reading_packages SELECT * FROM saved_reading_packages;
         INSERT INTO reading_dictionary SELECT * FROM saved_reading_dictionary;
         DROP TABLE saved_reading_dictionary;
         DROP TABLE saved_reading_packages;",
    )?;
    Ok(())
}

pub(super) fn validate(db: &Connection) -> Result<()> {
    v52_speech_default::validate(db)?;
    let reference = Connection::open_in_memory()?;
    reference.execute_batch(include_str!("v56_reading_review.sql"))?;
    schema::validate_objects(db, &reference, false)
}
