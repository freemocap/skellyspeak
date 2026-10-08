//! Conversation consumers of the same reading execution used by hover and tap.
//! Only the conversation publisher may accept a result into durable message data.
use super::*;
use crate::language::reading::{ReadingAid, ReadingInput, Request, text::Stored};
use serde_json::json;

pub(super) fn owns(dispatch: &execution::Dispatch) -> bool {
    matches!(
        dispatch.kind.as_str(),
        "persona_word_gloss" | "user_word_gloss" | "reply_translation" | "user_translation"
    )
}

impl Application {
    pub(super) async fn scheduled_reading(
        self: &Arc<Self>,
        dispatch: &execution::Dispatch,
        permit: tokio::sync::OwnedSemaphorePermit,
    ) -> Result<provider::Completion> {
        self.check_dispatches(std::slice::from_ref(dispatch))?;
        let (request, prepared) = {
            let store = self.lock()?;
            let (conversation, turn, _, kind) = store
                .attempt_scope(&dispatch.attempt)?
                .ok_or_else(internal)?;
            let captured: String = store.connection.query_row(
                "SELECT context FROM turns WHERE id=?1",
                [&turn],
                |r| r.get(0),
            )?;
            let captured: serde_json::Value = serde_json::from_str(&captured)?;
            let context: crate::configuration::LanguageContext =
                serde_json::from_value(captured["languageContext"].clone())?;
            let role = if kind.starts_with("user_") {
                "user"
            } else {
                "assistant"
            };
            let text = store.connection.query_row(
                "SELECT text FROM messages WHERE turn_id=?1 AND role=?2",
                rusqlite::params![turn, role],
                |r| r.get(0),
            )?;
            let input = ReadingInput {
                conversation_id: Some(conversation),
                reference_item: None,
                text,
                language: context.language_id.clone(),
                variety: Some(context.variety_id.clone()),
                explanation: context.explanation_language_id.clone(),
                explanation_variety: Some(context.explanation_variety_id.clone()),
                aid: if dispatch.gloss_source.is_some() {
                    ReadingAid::WordGloss
                } else {
                    ReadingAid::Translation
                },
            };
            let mut request = Request::capture_context(&store, input, context)?;
            // The durable attempt is the subscriber; it does not create a second
            // reading receipt or a second exploration award.
            request.id = dispatch.attempt.clone();
            if dispatch.gloss_source.is_some()
                && captured
                    .get(if role == "user" {
                        "userWordGloss"
                    } else {
                        "wordGloss"
                    })
                    .is_some_and(|v| !v.is_null())
            {
                request.model_role = "fast";
                request.model = dispatch.model.clone();
            }
            if request.model != dispatch.model {
                return Err(AppError::new(
                    ErrorCode::Conflict,
                    "Reading model changed before dispatch.",
                ));
            }
            let mut prepared = request.prepare_text()?;
            // Preserve captured transport inputs, including an explicit repair's
            // gap prompt. Normal hover and scheduled requests have identical keys.
            prepared.dispatch = dispatch.text_request();
            prepared.key = request.text_key(&prepared)?;
            (Arc::new(request), prepared)
        };
        let result = self.shared_reading_prepared(request, prepared, Some(permit));
        tokio::pin!(result);
        let saved = loop {
            tokio::select! {
                saved = &mut result => break saved?,
                _ = tokio::time::sleep(Duration::from_millis(50)) => self.check_dispatches(std::slice::from_ref(dispatch))?,
            }
        };
        self.check_dispatches(std::slice::from_ref(dispatch))?;
        let stored = Stored::decode(&saved.payload)?;
        let mut completion = stored.completion.ok_or_else(|| {
            AppError::new(
                ErrorCode::Storage,
                "Shared reading result is missing its validated completion.",
            )
        })?;
        let details = completion.diagnostics.get_or_insert_with(|| json!({}));
        details["sourceExecutionId"] = json!(saved.execution);
        details["cacheHit"] = json!(saved.cached);
        details["sharedExecution"] = json!(true);
        details["wordGlossValidation"] = saved
            .metadata
            .get("wordGlossValidation")
            .cloned()
            .unwrap_or_default();
        Ok(completion)
    }
}
