use super::*;

impl Store {
    pub fn conversation_snapshot_since(
        &self,
        conversation: &str,
        before: Option<i32>,
        after_revision: i32,
        force: bool,
    ) -> Result<Option<ConversationSnapshot>> {
        let revision: i32 =
            self.connection
                .query_row("SELECT revision FROM metadata", [], |r| r.get(0))?;
        if !force && revision == after_revision {
            return Ok(None);
        }
        self.conversation_snapshot(conversation, before).map(Some)
    }

    pub fn conversation_snapshot(
        &self,
        conversation: &str,
        before: Option<i32>,
    ) -> Result<ConversationSnapshot> {
        let db = &self.connection;
        if !db.query_row(
            "SELECT EXISTS(SELECT 1 FROM conversations WHERE id=?1)",
            [conversation],
            |r| r.get::<_, bool>(0),
        )? {
            return Err(AppError::new(
                ErrorCode::NotFound,
                "Conversation no longer exists.",
            ));
        }
        let mut messages=db.prepare("SELECT id,sequence,role,text,created_at,turn_id,(SELECT replaces_turn_id FROM turns WHERE id=m.turn_id),(SELECT id FROM turns WHERE replaces_turn_id=m.turn_id) FROM messages m WHERE conversation_id=?1 AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=m.turn_id AND o.kind IN ('persona_reply','persona_opening')) AND sequence<?2 ORDER BY sequence DESC LIMIT 100")?.query_map(params![conversation,before.unwrap_or(i32::MAX)],|r|Ok(ChatMessage{conversation_feedback:None,reply_assistance:None,reply_explanations:None,explanations_state:None,explanations_error:None,reaction:None,reaction_error:None,coach_decision:None,turn_id:r.get(5)?,replaces_turn_id:r.get(6)?,replaced_by:r.get(7)?,feedback_state:None,feedback_error:None,feedback:None,suggested_replies:None,suggestions_state:None,suggestions_error:None,gloss_error:None,word_gloss:None,gloss_state:None,gloss_operation_id:None,translation_state:None,translation:None,id:r.get(0)?,sequence:r.get(1)?,role:r.get(2)?,text:r.get(3)?,created_at:r.get(4)?}))?.collect::<rusqlite::Result<Vec<_>>>()?;
        messages.reverse();
        for message in &mut messages {
            let saved: Option<String> = db.query_row("SELECT json_extract(t.context,?2) FROM turns t JOIN messages m ON m.turn_id=t.id WHERE m.id=?1", params![message.id, if message.role=="user" { "$.coachFeedback" } else { "$.coachReplies" }], |r|r.get(0))?;
            if message.role == "user" {
                let captured: String = db.query_row(
                    "SELECT context FROM turns WHERE id=?1",
                    [&message.turn_id],
                    |r| r.get(0),
                )?;
                let captured: serde_json::Value = serde_json::from_str(&captured)?;
                message.conversation_feedback = captured
                    .get("conversation_feedback")
                    .cloned()
                    .map(serde_json::from_value)
                    .transpose()?;
                message.feedback = crate::learning::coaching::coach_policy::view(&captured)?;
                message.coach_decision = captured
                    .get("coachDecision")
                    .cloned()
                    .map(serde_json::from_value)
                    .transpose()?;
                (message.feedback_state,message.feedback_error) = db.query_row("SELECT o.state,coalesce(json_extract(t.context,'$.conversation_feedbackError'),json_extract(t.context,'$.coach_feedbackError'),json_extract(t.context,'$.coach_retry_checkError')) FROM messages m JOIN turns t ON t.id=m.turn_id LEFT JOIN operations o ON o.turn_id=t.id AND o.kind IN ('conversation_feedback','coach_feedback','coach_retry_check') WHERE m.id=?1", [&message.id], |r|Ok((r.get(0)?,r.get(1)?)))?;
            } else {
                let reaction: Option<String> = db.query_row(
                    "SELECT json_extract(context,'$.partnerReaction') FROM turns WHERE id=?1",
                    [&message.turn_id],
                    |r| r.get(0),
                )?;
                message.reaction = reaction.map(|s| serde_json::from_str(&s)).transpose()?;
                message.reaction_error = db.query_row(
                    "SELECT json_extract(context,'$.coach_reactionError') FROM turns WHERE id=?1",
                    [&message.turn_id],
                    |r| r.get(0),
                )?;
                let context: String = db.query_row(
                    "SELECT context FROM turns WHERE id=?1",
                    [&message.turn_id],
                    |r| r.get(0),
                )?;
                let context: serde_json::Value = serde_json::from_str(&context)?;
                message.reply_assistance = context
                    .get("reply_assistance")
                    .cloned()
                    .map(serde_json::from_value)
                    .transpose()?;
                message.reply_explanations = context
                    .get("reply_explanations")
                    .cloned()
                    .map(serde_json::from_value)
                    .transpose()?;
                (message.explanations_state,message.explanations_error)=db.query_row("SELECT o.state,json_extract(t.context,'$.reply_explanationsError') FROM turns t LEFT JOIN operations o ON o.turn_id=t.id AND o.kind='reply_explanations' WHERE t.id=?1",[&message.turn_id],|r|Ok((r.get(0)?,r.get(1)?)))?;
                message.suggested_replies = saved.map(|s| serde_json::from_str(&s)).transpose()?;
                (message.suggestions_state,message.suggestions_error) = db.query_row("SELECT o.state,coalesce(json_extract(t.context,'$.reply_assistanceError'),json_extract(t.context,'$.coach_suggestionsError')) FROM messages m JOIN turns t ON t.id=m.turn_id LEFT JOIN operations o ON o.turn_id=t.id AND o.kind IN ('reply_assistance','coach_suggestions') WHERE m.id=?1", [&message.id], |r|Ok((r.get(0)?,r.get(1)?)))?;
            }

            let gloss_kind = if message.role == "user" {
                "user_word_gloss"
            } else {
                "persona_word_gloss"
            };
            let translation_kind = if message.role == "user" {
                "user_translation"
            } else {
                "reply_translation"
            };
            let (saved, state, operation): (Option<String>, Option<String>, Option<String>) = db.query_row("SELECT json_extract(t.context,?2),o.state,o.id FROM turns t JOIN messages m ON m.turn_id=t.id LEFT JOIN operations o ON o.turn_id=t.id AND o.kind=?3 WHERE m.id=?1", params![message.id,gloss_path(gloss_kind),gloss_kind], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?)))?;
            message.gloss_error = db.query_row("SELECT json_extract(t.context,?2) FROM turns t JOIN messages m ON m.turn_id=t.id WHERE m.id=?1", params![message.id,gloss_error_path(gloss_kind)], |r|r.get(0))?;
            message.word_gloss = saved.map(|json| serde_json::from_str(&json)).transpose()?;
            message.gloss_state = state;
            message.gloss_operation_id = operation;
            (message.translation, message.translation_state) = db.query_row("SELECT json_extract(t.context,?2),o.state FROM turns t JOIN messages m ON m.turn_id=t.id LEFT JOIN operations o ON o.turn_id=t.id AND o.kind=?3 WHERE m.id=?1", params![message.id,translation_path(translation_kind),translation_kind], |r| Ok((r.get(0)?,r.get(1)?)))?;
        }
        let first = messages.first().map(|m| m.sequence).unwrap_or(0);
        let has_older = db.query_row(
            "SELECT EXISTS(SELECT 1 FROM messages m WHERE conversation_id=?1 AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=m.turn_id AND o.kind IN ('persona_reply','persona_opening')) AND sequence<?2)",
            params![conversation, first],
            |r| r.get(0),
        )?;
        // Older message pages require their owning execution state too. The union
        // stays bounded by this page's 100 messages plus the latest 50 turns.
        let page_turns = serde_json::to_string(
            &messages
                .iter()
                .map(|message| &message.turn_id)
                .collect::<Vec<_>>(),
        )?;
        let rows=db.prepare("SELECT id,state,paused,route,refusal_hold FROM turns WHERE conversation_id=?1 AND (id IN (SELECT id FROM turns WHERE conversation_id=?1 ORDER BY rowid DESC LIMIT 50) OR id IN (SELECT value FROM json_each(?2))) ORDER BY rowid DESC")?.query_map(params![conversation,page_turns],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,bool>(2)?,r.get::<_,String>(3)?,r.get::<_,Option<String>>(4)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
        let mut turns = Vec::new();
        for (id, state, paused, route, hold) in rows {
            let ops = db
                .prepare(
                    "SELECT id,kind,state,permit FROM operations WHERE turn_id=?1 ORDER BY rowid",
                )?
                .query_map([&id], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, bool>(3)?,
                    ))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            let mut operations = Vec::new();
            for (op, kind, status, permit) in &ops {
                let declaration = plan_for(db, &id)?
                    .iter()
                    .find(|n| n.kind == kind)
                    .or_else(|| {
                        crate::conversations::turn_plan::RETAINED
                            .iter()
                            .find(|n| n.kind == kind)
                    })
                    .ok_or_else(|| fail("Unknown operation declaration."))?;
                let dependencies = declaration
                    .dependencies
                    .iter()
                    .map(|dep| {
                        ops.iter()
                            .find(|(_, k, _, _)| k == dep)
                            .map(|(id, _, _, _)| id.clone())
                            .ok_or_else(|| fail("Missing graph dependency."))
                    })
                    .collect::<Result<Vec<_>>>()?;
                operations.push(OperationView {
                    source_message_id: if kind == "persona_speech" {
                        db.query_row(
                            "SELECT id FROM messages WHERE turn_id=?1 AND role='assistant'",
                            [&id],
                            |r| r.get(0),
                        )
                        .optional()?
                    } else {
                        None
                    },
                    id: op.clone(),
                    kind: kind.clone(),
                    contract_version: declaration.contract_version,
                    dependencies,
                    role: declaration.role.into(),
                    state: if status == "ready" && (config(db)?.paused || (paused && !permit)) {
                        "held".into()
                    } else {
                        status.clone()
                    },
                });
            }
            let attempts=db.prepare("SELECT a.id,a.operation_id,a.state,a.requested_model,a.actual_model,a.provider_id,a.started_at,a.finished_at,a.input_tokens,a.output_tokens,a.error FROM attempts a JOIN operations o ON a.operation_id=o.id WHERE o.turn_id=?1 ORDER BY a.rowid")?.query_map([&id],|r|Ok(AttemptView{id:r.get(0)?,operation_id:r.get(1)?,state:r.get(2)?,requested_model:r.get(3)?,actual_model:r.get(4)?,provider_id:r.get(5)?,started_at:r.get(6)?,finished_at:r.get(7)?,input_tokens:r.get(8)?,output_tokens:r.get(9)?,error:r.get(10)?}))?.collect::<rusqlite::Result<Vec<_>>>()?;
            let (replaces_turn_id, replaced_by) = db.query_row("SELECT replaces_turn_id,(SELECT id FROM turns child WHERE child.replaces_turn_id=turns.id) FROM turns WHERE id=?1", [&id], |r| Ok((r.get(0)?, r.get(1)?)))?;
            turns.push(TurnView {
                replaces_turn_id,
                replaced_by,
                route: ConnectionRoute::parse(&route)?,
                id: id.clone(),
                state,
                paused,
                hold: hold.map(|json| serde_json::from_str(&json)).transpose()?,
                operations,
                attempts,
            });
        }
        let mut coach_messages=db.prepare("SELECT id,sequence,role,text,created_at,turn_id,(SELECT replaces_turn_id FROM turns WHERE id=m.turn_id),(SELECT id FROM turns WHERE replaces_turn_id=m.turn_id) FROM messages m WHERE conversation_id=?1 AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=m.turn_id AND o.kind='coach_reply') ORDER BY sequence DESC LIMIT 100")?.query_map([conversation],|r|Ok(ChatMessage{conversation_feedback:None,reply_assistance:None,reply_explanations:None,explanations_state:None,explanations_error:None,reaction:None,reaction_error:None,coach_decision:None,turn_id:r.get(5)?,replaces_turn_id:r.get(6)?,replaced_by:r.get(7)?,feedback_state:None,feedback_error:None,feedback:None,suggested_replies:None,suggestions_state:None,suggestions_error:None,gloss_error:None,word_gloss:None,gloss_state:None,gloss_operation_id:None,translation_state:None,translation:None,id:r.get(0)?,sequence:r.get(1)?,role:r.get(2)?,text:r.get(3)?,created_at:r.get(4)?}))?.collect::<rusqlite::Result<Vec<_>>>()?;
        coach_messages.reverse();
        let snapshot = self.snapshot()?;
        Ok(ConversationSnapshot {
            mystery: crate::partners::mystery::view(db, &snapshot, conversation)?,
            lessons: crate::learning::lessons::views(db, conversation)?,
            lesson_choices: crate::learning::lessons::choices(
                db,
                &self.config,
                &snapshot,
                conversation,
            )?,
            starter_cards: crate::conversations::openers::choices(self, conversation)?
                .into_iter()
                .map(|(card, _)| card)
                .collect(),
            opening: crate::conversations::openers::selected(db, conversation)?,
            revision_suffix_counts: crate::conversations::revision::suffix_counts(
                db,
                conversation,
                &messages,
            )?,
            transcription_attempts: crate::speech::recording::transcription::views(
                db,
                conversation,
            )?,
            holds: crate::ai::policy::holds::views(db)?,
            coach_messages,
            conversation_id: conversation.into(),
            session_id: self.session_id.clone(),
            revision: db.query_row("SELECT revision FROM metadata", [], |r| r.get(0))?,
            messages,
            turns,
            connection: config(db)?,
            has_older,
        })
    }
}
