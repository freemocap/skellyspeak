//! Change only the former bundled speech preference; historical results stay intact.
use super::*;

pub(super) fn apply(db: &Connection) -> Result<()> {
    v52_speech_default::validate(db)?;
    // There is no provenance distinguishing a manually selected v4 from the
    // former bundled default. Both adopt v3 once; later learner edits persist.
    db.execute(
        "UPDATE ai_config SET audio_settings=json_set(audio_settings,'$.speech.model','eleven_v3'), revision=revision+1 WHERE json_extract(audio_settings,'$.speech.model')='eleven_v4_turbo'",
        [],
    )?;
    Ok(())
}
