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

impl Store {
    /// Product rollback after the quote-localization experiment. Called only after
    /// startup recovery; preserve completed evidence and every provider receipt.
    pub(crate) fn shelve_jev_assessment(&self) -> Result<()> {
        let tx = self.connection.unchecked_transaction()?;
        let changed = tx.execute("UPDATE ai_config SET assessment_adapter='chat_model',revision=revision+1 WHERE assessment_adapter='jev_choice'", [])?;
        let turns = tx.prepare("SELECT t.id FROM turns t JOIN operations o ON o.turn_id=t.id AND o.kind='skill_assessment' WHERE t.state IN ('pending','assisting','failed','unknown') AND json_extract(t.context,'$.skillAssessment') IS NULL AND json_extract(t.context,'$.assessmentRouteSuspended') IS NULL AND COALESCE(json_extract(t.context,'$.retryTargets.\"' || o.id || '\".assessmentAdapter'),json_extract(t.context,'$.assessmentAdapter'))='jev_choice'")?
            .query_map([], |r| r.get::<_, String>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
        for turn in &turns {
            let error = AppError::new(
                ErrorCode::Validation,
                "Jev assessment is disabled. Retry this turn to assess with the selected Fast chat model.",
            );
            tx.execute("UPDATE turns SET context=json_set(context,'$.assessmentRouteSuspended',json('true'),'$.skill_assessmentError',json(?2)) WHERE id=?1", params![turn,serde_json::to_string(&error)?])?;
            tx.execute("UPDATE operations SET state='failed',permit=0 WHERE turn_id=?1 AND kind='skill_assessment'", [turn])?;
            tx.execute("UPDATE operations SET state='waiting_dependencies',permit=0 WHERE turn_id=?1 AND kind='skill_evidence'", [turn])?;
            refresh_turn(&tx, turn)?;
        }
        if changed > 0 || !turns.is_empty() {
            bump(&tx)?;
        }
        tx.commit()?;
        Ok(())
    }
}
