use super::*;

impl Handlers<'_> {
    pub(super) fn reassess_feedback(&mut self, turn_id: String, note: String) -> Result<String> {
        self.conversation_scope = Some(crate::conversations::execution::reassess_feedback(self.tx, &turn_id, &note)?);
        Ok(turn_id)
    }

    pub(super) fn request_message_speech(&mut self, message_id: String) -> Result<String> {
        let cached_attempt: Option<String> = self.tx.query_row(
            "SELECT a.id FROM attempts a JOIN operations o ON o.id=a.operation_id JOIN messages m ON m.turn_id=o.turn_id WHERE m.id=?1 AND o.kind='persona_speech' AND o.state='succeeded' AND a.state='succeeded' ORDER BY a.rowid DESC LIMIT 1",
            [&message_id], |r| r.get(0),
        ).optional()?;
        let resident = cached_attempt
            .as_ref()
            .is_some_and(|attempt| self.speech_cache.get(attempt).is_some());
        let operation =
            crate::conversations::execution::request_speech(self.tx, &message_id, resident)?;
        self.conversation_scope = Some(self.tx.query_row(
            "SELECT conversation_id FROM messages WHERE id=?1",
            [&message_id],
            |r| r.get(0),
        )?);
        Ok(operation)
    }

    pub(super) fn cancel_message_speech(&mut self, operation_id: String) -> Result<String> {
        let operation = crate::conversations::execution::cancel_speech(self.tx, &operation_id)?;
        self.conversation_scope = Some(self.tx.query_row("SELECT t.conversation_id FROM operations o JOIN turns t ON t.id=o.turn_id WHERE o.id=?1", [&operation], |r|r.get(0))?);
        Ok(operation)
    }

    pub(super) fn request_suggestions(&mut self, message_id: String) -> Result<String> {
        let (conversation, operation) =
            crate::conversations::execution::request_suggestions(self.tx, &message_id)?;
        self.conversation_scope = Some(conversation);
        Ok(operation)
    }

    pub(super) fn request_explanations(&mut self, message_id: String) -> Result<String> {
        let (conversation, operation) =
            crate::conversations::execution::request_explanations(self.tx, &message_id)?;
        self.conversation_scope = Some(conversation);
        Ok(operation)
    }
    pub(super) fn retry_reply_help(
        &mut self,
        message_id: String,
        kind: crate::learning::coaching::conversation_support::ReplyHelpKind,
    ) -> Result<String> {
        let (conversation, operation) =
            crate::conversations::execution::retry_reply_help(self.tx, &message_id, kind)?;
        self.conversation_scope = Some(conversation);
        Ok(operation)
    }
    pub(super) fn retry_gloss(&mut self, operation_id: String) -> Result<String> {
        self.conversation_scope = Some(crate::conversations::execution::retry_gloss(
            self.tx,
            &operation_id,
        )?);
        Ok(operation_id)
    }

    pub(super) fn control_turn(&mut self, turn_id: String, control: TurnControl) -> Result<String> {
        self.conversation_scope = Some(crate::conversations::execution::control_turn(
            self.tx, &turn_id, control,
        )?);
        Ok(turn_id)
    }

    pub(super) fn set_paused(&mut self, paused: bool) -> Result<String> {
        self.tx
            .execute("UPDATE ai_config SET paused=?1 WHERE singleton=1", [paused])?;
        self.tx
            .execute("UPDATE operations SET permit=0 WHERE state='ready'", [])?;
        Ok("execution".into())
    }

    pub(super) fn recover_ai_access(
        &mut self,
        hold_id: String,
        expected_generation: String,
    ) -> Result<String> {
        crate::ai::policy::holds::recover(self.tx, &hold_id, &expected_generation)?;
        Ok(hold_id)
    }
}
