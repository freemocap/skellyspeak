use super::*;

impl Handlers<'_> {
    pub(super) fn answer_lesson_quiz(
        &mut self,
        conversation_id: String,
        lesson_id: String,
        question_index: u32,
        option_index: u32,
    ) -> Result<String> {
        crate::learning::lessons::check(self.snapshot, &conversation_id, self.snapshot.revision)?;
        let id = crate::learning::lessons::answer_quiz(
            self.tx,
            &conversation_id,
            &lesson_id,
            question_index,
            option_index,
        )?;
        self.conversation_scope = Some(conversation_id);
        Ok(id)
    }

    pub(super) fn generate_lesson(
        &mut self,
        category: crate::learning::lessons::LessonCategory,
        choice_id: Option<String>,
        conversation_id: String,
        topic: String,
        expected_revision: i32,
    ) -> Result<String> {
        let id = crate::learning::lessons::generate(
            self.tx,
            self.config,
            self.snapshot,
            &conversation_id,
            crate::learning::lessons::LessonRequest {
                topic: &topic,
                choice_id: choice_id.as_deref(),
                category,
                expected: expected_revision,
            },
        )?;
        self.conversation_scope = Some(conversation_id);
        Ok(id)
    }

    pub(super) fn control_lesson(
        &mut self,
        conversation_id: String,
        lesson_id: String,
        control: crate::learning::lessons::LessonControl,
        expected_revision: i32,
    ) -> Result<String> {
        let id = crate::learning::lessons::control(
            self.tx,
            self.config,
            self.snapshot,
            &conversation_id,
            &lesson_id,
            control,
            expected_revision,
        )?;
        self.conversation_scope = Some(conversation_id);
        Ok(id)
    }

    pub(super) fn ask_lesson_coach(
        &mut self,
        conversation_id: String,
        lesson_id: String,
        text: String,
        expected_revision: i32,
    ) -> Result<String> {
        crate::learning::lessons::check(self.snapshot, &conversation_id, expected_revision)?;
        let lesson = crate::learning::lessons::owned(self.tx, &conversation_id, &lesson_id)?;
        if lesson.plan.is_none() {
            return Err(AppError::new(
                ErrorCode::Validation,
                "The lesson is not ready.",
            ));
        }
        let current = self
            .snapshot
            .conversations
            .iter()
            .find(|c| c.id == conversation_id)
            .unwrap();
        let turn = crate::conversations::execution::accept_coach(
            self.tx,
            self.config,
            self.snapshot,
            &conversation_id,
            &text,
            current.revision,
        )?;
        crate::learning::lessons::attach_question(self.tx, &turn, &lesson)?;
        self.conversation_scope = Some(conversation_id);
        Ok(turn)
    }

    pub(super) fn coach_control(
        &mut self,
        turn_id: String,
        control: crate::learning::coaching::CoachControl,
        expected_revision: i32,
    ) -> Result<String> {
        let id = crate::learning::coaching::coach_policy::control(
            self.tx,
            self.snapshot,
            &turn_id,
            control,
            expected_revision,
        )?;
        self.conversation_scope = Some(self.tx.query_row(
            "SELECT conversation_id FROM turns WHERE id=?1",
            [&turn_id],
            |r| r.get(0),
        )?);
        Ok(id)
    }

    pub(super) fn ask_coach(
        &mut self,
        conversation_id: String,
        text: String,
        expected_revision: i32,
    ) -> Result<String> {
        let turn_id = crate::conversations::execution::accept_coach(
            self.tx,
            self.config,
            self.snapshot,
            &conversation_id,
            &text,
            expected_revision,
        )?;
        self.conversation_scope = Some(conversation_id);
        Ok(turn_id)
    }

    pub(super) fn update_learner(
        &mut self,
        expected_revision: i32,
        name: String,
        preferences: Preferences,
    ) -> Result<String> {
        check_revision(self.snapshot.learner.revision, expected_revision)?;
        short_text(&name, "Learner name", 80)?;
        self.config.validate_preferences(&preferences)?;
        if !(crate::model::TEXT_SIZE_MIN..=crate::model::TEXT_SIZE_MAX)
            .contains(&preferences.text_size)
            || preferences.text_spacing > 12
        {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Reading size or spacing is outside the supported range.",
            ));
        }
        self.tx.execute(
            "UPDATE learner SET name=?1,preferences=?2,revision=revision+1 WHERE id=?3",
            params![
                name.trim(),
                serde_json::to_string(&preferences)?,
                self.snapshot.learner.id
            ],
        )?;
        Ok(self.snapshot.learner.id.clone())
    }
}
