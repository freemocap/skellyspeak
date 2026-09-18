use super::*;

mod assistance;
mod conversations;
mod learning;
mod partners;

struct Handlers<'a> {
    tx: &'a Connection,
    config: &'a crate::configuration::Registry,
    snapshot: &'a Snapshot,
    speech_cache: &'a crate::speech::cache::Cache,
    persona_scope: Option<String>,
    conversation_scope: Option<String>,
}

impl Store {
    pub fn execute(&mut self, command: Command) -> Result<Receipt> {
        if command.session_id != self.session_id {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "The application session changed. Refresh before continuing.",
            ));
        }
        Uuid::parse_str(&command.action_id)
            .map_err(|_| AppError::new(ErrorCode::Validation, "Invalid action identity."))?;
        let request = serde_json::to_string(&command.action)?;
        let tx = self.connection.transaction()?;
        let previous: Option<(String, String)> = tx
            .query_row(
                "SELECT request,receipt FROM receipts WHERE action_id=?1",
                [&command.action_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        if let Some((stored_request, receipt)) = previous {
            if stored_request != request {
                return Err(AppError::new(
                    ErrorCode::Conflict,
                    "An action ID cannot be reused for another action.",
                ));
            }
            return Ok(serde_json::from_str(&receipt)?);
        }
        let snapshot = read_snapshot(&tx, &self.session_id, &self.config)?;
        let revision = snapshot
            .revision
            .checked_add(1)
            .ok_or_else(|| AppError::new(ErrorCode::Storage, "Revision capacity exceeded."))?;
        let mut handlers = Handlers {
            tx: &tx,
            config: &self.config,
            snapshot: &snapshot,
            speech_cache: &self.speech_cache,
            persona_scope: None,
            conversation_scope: None,
        };
        let entity_id = match command.action {
            Action::StartConversation {
                conversation_id,
                configuration,
                message,
                input,
                expected_revision,
            } => handlers.start_conversation(
                conversation_id,
                configuration,
                message,
                input,
                expected_revision,
            )?,
            Action::UpdateConversationPrompt {
                conversation_id,
                configuration,
                additions,
                deletions,
                expected_revision,
                expected_settings_revision,
            } => {
                crate::conversations::saved_topics::update(
                    handlers.tx,
                    handlers.snapshot,
                    &additions,
                    &deletions,
                    expected_revision,
                )?;
                let current = handlers
                    .snapshot
                    .conversations
                    .iter()
                    .find(|c| c.id == conversation_id)
                    .ok_or_else(missing)?;
                let settings = crate::conversations::direction::settings(
                    handlers.config,
                    &current.language_id,
                    &current.settings,
                    &configuration,
                )?;
                handlers.update_settings(conversation_id, expected_settings_revision, settings)?
            }
            Action::SaveTopics {
                additions,
                deletions,
                expected_revision,
            } => crate::conversations::saved_topics::update(
                handlers.tx,
                handlers.snapshot,
                &additions,
                &deletions,
                expected_revision,
            )?,
            Action::CoachControl {
                turn_id,
                control,
                expected_revision,
            } => handlers.coach_control(turn_id, control, expected_revision)?,
            Action::ReviseTurn {
                conversation_id,
                turn_id,
                text,
                input,
                expected_revision,
            } => handlers.revise_turn(conversation_id, turn_id, text, input, expected_revision)?,
            Action::AskCoach {
                conversation_id,
                text,
                expected_revision,
            } => handlers.ask_coach(conversation_id, text, expected_revision)?,
            Action::SendMessage {
                input,
                conversation_id,
                text,
                expected_revision,
            } => handlers.send_message(input, conversation_id, text, expected_revision)?,
            Action::RequestMessageSpeech { message_id } => {
                handlers.request_message_speech(message_id)?
            }
            Action::CancelMessageSpeech { operation_id } => {
                handlers.cancel_message_speech(operation_id)?
            }
            Action::RequestSuggestions { message_id } => {
                handlers.request_suggestions(message_id)?
            }
            Action::RetryGloss { operation_id } => handlers.retry_gloss(operation_id)?,
            Action::ControlTurn { turn_id, control } => handlers.control_turn(turn_id, control)?,
            Action::SetPaused { paused } => handlers.set_paused(paused)?,
            Action::RecoverAiAccess {
                hold_id,
                expected_generation,
            } => handlers.recover_ai_access(hold_id, expected_generation)?,
            Action::StartChat { language_id } => handlers.start_chat(language_id)?,
            Action::CreateContact {
                language_id,
                details,
            } => handlers.create_contact(language_id, details)?,
            Action::UpdatePersona {
                persona_id,
                expected_revision,
                details,
            } => handlers.update_persona(persona_id, expected_revision, details)?,
            Action::SetContactArchived {
                contact_id,
                expected_revision,
                archived,
            } => handlers.set_contact_archived(contact_id, expected_revision, archived)?,
            Action::DeleteContact {
                contact_id,
                expected_revision,
            } => handlers.delete_contact(contact_id, expected_revision)?,
            Action::CreateConversation { contact_id, title } => {
                handlers.create_conversation(contact_id, title)?
            }
            Action::OpenConversation { conversation_id } => {
                handlers.open_conversation(conversation_id)?
            }
            Action::UpdateConversation {
                conversation_id,
                expected_revision,
                title,
                archived,
            } => {
                handlers.update_conversation(conversation_id, expected_revision, title, archived)?
            }
            Action::UpdateSettings {
                conversation_id,
                expected_revision,
                settings,
            } => handlers.update_settings(conversation_id, expected_revision, settings)?,
            Action::DeleteConversation {
                conversation_id,
                expected_revision,
            } => handlers.delete_conversation(conversation_id, expected_revision)?,
            Action::UpdateLearner {
                expected_revision,
                name,
                preferences,
            } => handlers.update_learner(expected_revision, name, preferences)?,
        };
        tx.execute(
            "UPDATE metadata SET revision=?1 WHERE singleton=1",
            [revision],
        )?;
        let receipt = Receipt {
            action_id: command.action_id,
            entity_id,
            revision,
        };
        tx.execute(
            "INSERT INTO receipts VALUES(?1,?2,?3,?4,?5)",
            params![
                receipt.action_id,
                request,
                serde_json::to_string(&receipt)?,
                handlers.persona_scope,
                handlers.conversation_scope
            ],
        )?;
        tx.commit()?;
        Ok(receipt)
    }
}
