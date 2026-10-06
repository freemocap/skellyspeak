//! Adopt the new bundled speech default without rewriting historical receipts.
use super::*;

pub(super) fn apply(db: &Connection) -> Result<()> {
    v51_skill_direction::validate(db)?;
    // Existing v3 selections were the bundled default. Explicit custom model
    // identities stay untouched; the supported v3 capability route remains available.
    db.execute(
        "UPDATE ai_config SET audio_settings=json_set(audio_settings,'$.speech.model','eleven_v4_turbo'), revision=revision+1 WHERE json_extract(audio_settings,'$.speech.model')='eleven_v3'",
        [],
    )?;
    Ok(())
}

pub(super) fn validate(db: &Connection) -> Result<()> {
    v51_skill_direction::validate(db)
}
