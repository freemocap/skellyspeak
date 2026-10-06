//! Restore the reviewed synthesis preference without rewriting speech or evidence.
use super::*;

pub(super) fn apply(db: &Connection) -> Result<()> {
    v52_speech_default::validate(db)?;
    // Approved one-time policy: v53 erased default/manual selection provenance,
    // so all saved v3 selections move to v4. Later learner choices are respected.
    db.execute(
        "UPDATE ai_config SET audio_settings=json_set(audio_settings,'$.speech.model','eleven_v4_turbo'), revision=revision+1 WHERE json_extract(audio_settings,'$.speech.model')='eleven_v3'",
        [],
    )?;
    Ok(())
}
