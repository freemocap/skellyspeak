use super::*;

impl Handlers<'_> {
    pub(super) fn start_chat(&mut self, language_id: String) -> Result<String> {
        let details = self.config.starter_persona(&language_id)?;
        let (persona_id, contact_id) = create_persona(
            self.tx,
            self.config,
            &self.snapshot.learner.id,
            &language_id,
            details,
        )?;
        let settings = self
            .config
            .preference_defaults(&language_id, &self.snapshot.learner.preferences)?;
        let conversation_id = create_conversation(
            self.tx,
            &contact_id,
            &language_id,
            "New conversation",
            &settings,
        )?;
        self.persona_scope = Some(persona_id);
        self.conversation_scope = Some(conversation_id.clone());
        Ok(conversation_id)
    }

    pub(super) fn create_contact(
        &mut self,
        language_id: String,
        details: PersonaDetails,
    ) -> Result<String> {
        let (persona_id, contact_id) = create_persona(
            self.tx,
            self.config,
            &self.snapshot.learner.id,
            &language_id,
            details,
        )?;
        let settings = self
            .config
            .preference_defaults(&language_id, &self.snapshot.learner.preferences)?;
        let conversation_id = create_conversation(
            self.tx,
            &contact_id,
            &language_id,
            "New conversation",
            &settings,
        )?;
        self.persona_scope = Some(persona_id);
        self.conversation_scope = Some(conversation_id.clone());
        Ok(conversation_id)
    }

    pub(super) fn update_persona(
        &mut self,
        persona_id: String,
        expected_revision: i32,
        details: PersonaDetails,
    ) -> Result<String> {
        let persona = self
            .snapshot
            .personas
            .iter()
            .find(|p| p.id == persona_id)
            .ok_or_else(missing)?;
        check_revision(persona.revision, expected_revision)?;
        crate::partners::persona::validate_for_language(
            &details,
            &self.config.language(&persona.language_id)?,
        )?;
        self.tx.execute(
            "UPDATE personas SET details=?1,revision=revision+1 WHERE id=?2",
            params![serde_json::to_string(&details)?, persona_id],
        )?;
        self.persona_scope = Some(persona_id.clone());
        Ok(persona_id)
    }

    pub(super) fn set_contact_archived(
        &mut self,
        contact_id: String,
        expected_revision: i32,
        archived: bool,
    ) -> Result<String> {
        let contact = self
            .snapshot
            .contacts
            .iter()
            .find(|r| r.id == contact_id)
            .ok_or_else(missing)?;
        check_revision(contact.revision, expected_revision)?;
        self.tx.execute(
            "UPDATE contacts SET archived=?1,revision=revision+1 WHERE id=?2",
            params![archived, contact_id],
        )?;
        self.persona_scope = Some(contact.persona_id.clone());
        Ok(contact_id)
    }

    pub(super) fn delete_contact(
        &mut self,
        contact_id: String,
        expected_revision: i32,
    ) -> Result<String> {
        let contact = self
            .snapshot
            .contacts
            .iter()
            .find(|c| c.id == contact_id)
            .ok_or_else(missing)?;
        check_revision(contact.revision, expected_revision)?;
        // One persona per contact: removing the contact removes its
        // persona, and the cascade takes the conversations with it.
        self.tx
            .execute("DELETE FROM personas WHERE id=?1", [&contact.persona_id])?;
        Ok(contact_id)
    }
}
