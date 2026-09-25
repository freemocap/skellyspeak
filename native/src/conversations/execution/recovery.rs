use super::*;

impl Store {
    pub fn reconcile_execution(&self) -> Result<()> {
        let tx = self.connection.unchecked_transaction()?;
        let speech_turns=tx.prepare("SELECT DISTINCT turn_id FROM operations WHERE kind='persona_speech' AND state IN ('ready','waiting_dependencies','running')")?.query_map([],|r|r.get::<_,String>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
        tx.execute_batch("UPDATE transcription_attempts SET state='unknown',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),error='Application interrupted. Transcription outcome and usage are unknown; audio is not retained and cannot be replayed.' WHERE state='running'; UPDATE turns SET state='unknown' WHERE id IN (SELECT turn_id FROM operations WHERE state='running'); UPDATE operations SET state='unknown',permit=0 WHERE state='running'; UPDATE attempts SET state='unknown',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),error='Application interrupted. Provider outcome and cost are unknown; retry is explicit.' WHERE state='running'; UPDATE operations SET state='cancelled',permit=0 WHERE kind='persona_speech' AND state IN ('ready','waiting_dependencies'); UPDATE turns SET paused=1 WHERE state IN ('pending','assisting'); UPDATE operations SET permit=0;")?;
        for turn in speech_turns {
            refresh_turn(&tx, &turn)?;
            tx.execute(
                "UPDATE turns SET paused=1 WHERE id=?1 AND state IN ('pending','assisting')",
                [turn],
            )?;
        }
        bump(&tx)?;
        tx.commit()?;
        Ok(())
    }
}
