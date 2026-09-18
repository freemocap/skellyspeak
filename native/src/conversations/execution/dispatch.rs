use super::*;

impl Store {
    pub fn has_ready_work(&self) -> Result<bool> {
        if config(&self.connection)?.paused {
            return Ok(false);
        }
        Ok(self.connection.query_row("SELECT EXISTS(SELECT 1 FROM operations o JOIN turns t ON t.id=o.turn_id WHERE o.state='ready' AND t.state IN ('pending','assisting') AND (t.paused=0 OR o.permit=1))", [], |r| r.get(0))?)
    }

    pub fn dispatch(&mut self) -> Result<Option<Dispatch>> {
        let tx = self.connection.transaction()?;
        crate::learning::lessons::suspend_pending(&tx)?;
        if config(&tx)?.paused {
            tx.commit()?;
            return Ok(None);
        }
        let running: i32 = tx.query_row(
            "SELECT count(*) FROM operations WHERE state='running'",
            [],
            |r| r.get(0),
        )?;
        if running >= crate::ai::policy::admission::NETWORK_CAPACITY as i32 {
            tx.commit()?;
            return Ok(None);
        }
        let candidate:Option<(String,String,String,String,String,String)>=tx.query_row("SELECT o.id,o.kind,t.id,t.credential_id,t.model,t.context FROM operations o JOIN turns t ON t.id=o.turn_id WHERE o.state='ready' AND t.state IN ('pending','assisting') AND (t.paused=0 OR o.permit=1) ORDER BY CASE WHEN o.kind IN ('persona_context','coach_context','persona_reply','persona_opening','coach_reply','persona_speech') THEN 0 ELSE 1 END,t.rowid,o.rowid LIMIT 1",[],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?))).optional()?;
        let Some((operation, kind, turn, credential, model, context)) = candidate else {
            tx.commit()?;
            return Ok(None);
        };
        let attempt = id();
        if kind == "persona_context" || kind == "coach_context" {
            let captured: serde_json::Value = serde_json::from_str(&context)?;
            let messages: Vec<PromptMessage> =
                serde_json::from_value(captured["messages"].clone())?;
            let sources: Vec<String> = serde_json::from_value(captured["sourceIds"].clone())?;
            if messages.first().map(|m| m.role.as_str()) != Some("system")
                || messages.last().map(|m| m.role.as_str()) != Some("user")
                || messages.len() > 42
                || messages
                    .iter()
                    .skip(1)
                    .any(|m| m.role != "user" && m.role != "assistant")
                || messages.iter().map(|m| m.content.len()).sum::<usize>() > 96000
            {
                return Err(fail(
                    "Captured context violates the persona-reply input contract.",
                ));
            }
            for source in sources {
                let permitted: bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM messages m JOIN turns t ON t.conversation_id=m.conversation_id WHERE m.id=?1 AND t.id=?2)",params![source,turn],|r|r.get(0))?;
                if !permitted {
                    return Err(fail(
                        "A captured conversation source is unavailable or outside this turn's scope.",
                    ));
                }
            }
            tx.execute("INSERT INTO attempts(id,operation_id,state,requested_model,finished_at) VALUES(?1,?2,'succeeded','local',strftime('%Y-%m-%dT%H:%M:%fZ','now'))",params![attempt,operation])?;
            tx.execute(
                "UPDATE operations SET state='succeeded',permit=0 WHERE id=?1",
                [&operation],
            )?;
            for declaration in plan_for(&tx, &turn)? {
                let ready = declaration
                    .dependencies
                    .iter()
                    .map(|dep| ops_succeeded(&tx, &turn, dep))
                    .collect::<Result<Vec<_>>>()?
                    .into_iter()
                    .all(|done| done);
                if ready {
                    tx.execute("UPDATE operations SET state='ready' WHERE turn_id=?1 AND kind=?2 AND state='waiting_dependencies'",params![turn,declaration.kind])?;
                }
            }
            bump(&tx)?;
            tx.commit()?;
            return Ok(None);
        }
        if kind == "persona_speech" {
            let result = prepare_speech(&tx, &operation, &turn, &context);
            match result {
                Ok(dispatch) => {
                    bump(&tx)?;
                    tx.commit()?;
                    return Ok(Some(dispatch));
                }
                Err(error) => {
                    if matches!(error.code, ErrorCode::Storage | ErrorCode::Internal) {
                        return Err(error);
                    }
                    tx.execute(
                        "UPDATE operations SET state='failed',permit=0 WHERE id=?1",
                        [&operation],
                    )?;
                    tx.execute(
                        "UPDATE turns SET context=json_set(context,'$.speechError',?2) WHERE id=?1",
                        params![turn, error.message],
                    )?;
                    refresh_turn(&tx, &turn)?;
                    bump(&tx)?;
                    tx.commit()?;
                    return Ok(None);
                }
            }
        }
        if !crate::learning::coaching::conversation_support::owns(&kind)
            && kind != "skill_assessment"
            && kind != "lesson_generate"
            && kind != "lesson_review"
            && kind != "persona_reply"
            && kind != "persona_opening"
            && kind != "coach_retry_check"
            && kind != "coach_reply"
            && kind != "reply_translation"
            && kind != "persona_word_gloss"
            && kind != "user_word_gloss"
            && kind != "user_translation"
            && kind != "coach_feedback"
            && kind != "coach_suggestions"
            && kind != "coach_reaction"
        {
            return Err(fail("No executor for declared operation."));
        }
        let captured: serde_json::Value = serde_json::from_str(&context)?;
        let prepared = (|| -> Result<_> {
            let mut gloss_source = None;
            let mut gloss_schema = None;
            let coaching_schema = if kind == "skill_assessment" {
                Some(crate::learning::coaching::skill_assessment::schema(
                    &captured,
                )?)
            } else if crate::learning::coaching::conversation_support::owns(&kind) {
                Some(
                    crate::learning::coaching::conversation_support::schema_for_context(
                        &kind, &captured,
                    ),
                )
            } else if kind.starts_with("lesson_") {
                Some(crate::learning::lessons::schema_for_context(
                    &kind, &captured,
                ))
            } else if kind.starts_with("coach_") && kind != "coach_reply" {
                Some(if kind == "coach_reaction" {
                    crate::partners::partner_reaction::schema()
                } else if kind == crate::learning::coaching::SUGGESTIONS {
                    crate::learning::coaching::schema(&kind)
                } else {
                    crate::learning::coaching::coach_observation::schema(
                        &captured,
                        kind == "coach_retry_check",
                    )?
                })
            } else {
                None
            };
            let messages = if kind == "skill_assessment" {
                crate::learning::coaching::skill_assessment::prompt(&tx, &turn, &captured)?
            } else if crate::learning::coaching::conversation_support::owns(&kind) {
                crate::learning::coaching::conversation_support::prompt(
                    &tx, &turn, &kind, &captured,
                )?
            } else if kind.starts_with("lesson_") {
                crate::learning::lessons::prompt(&tx, &turn, &kind, &captured)?
            } else if kind == "coach_reaction" {
                crate::partners::partner_reaction::prompt(&tx, &turn, &captured)?
            } else if coaching_schema.is_some() {
                crate::learning::coaching::prompt(&tx, &turn, &kind, &captured)?
            } else if matches!(kind.as_str(), "persona_word_gloss" | "user_word_gloss") {
                let prepared = (|| -> Result<_> {
                    let (message_id, text): (String, String) = tx.query_row(
                        "SELECT id,text FROM messages WHERE turn_id=?1 AND role=?2",
                        params![turn, analysis_role(&kind)],
                        |r| Ok((r.get(0)?, r.get(1)?)),
                    )?;
                    let source = crate::conversations::gloss::Source {
                        identity: crate::language::linguistics::SourceIdentity {
                            message_id,
                            target_language_id: captured["targetLanguage"]
                                .as_str()
                                .ok_or_else(|| fail("Missing gloss language."))?
                                .into(),
                            explanation_language_id: captured["translationLanguage"]
                                .as_str()
                                .ok_or_else(|| fail("Missing gloss language."))?
                                .into(),
                            analysis_version: crate::language::linguistics::ANALYSIS_VERSION.into(),
                        },
                        text,
                    };
                    let language_context: crate::configuration::LanguageContext =
                        serde_json::from_value(captured["languageContext"].clone())?;
                    let prompt = crate::language::linguistics::adapter::build_word_gloss_prompt_with_context(
                        &source.identity,
                        &source.text,
                        &language_context,
                    )
                    .map_err(|_| fail("Word gloss source cannot be analyzed."))?;
                    let target: crate::ai::connections::access::ResolvedTarget =
                        serde_json::from_value(captured["target"].clone())?;
                    crate::ai::transport::provider::payload_with_output(
                        &model,
                        &prompt.messages,
                        target.route,
                        crate::ai::transport::provider::RequestOutput::JsonSchema {
                            name: crate::language::linguistics::adapter::FORMAT_ID,
                            schema: &prompt.output_schema,
                        },
                    )?;
                    Ok((source, prompt.messages, prompt.output_schema))
                })();
                let (source, messages, schema) = prepared?;
                gloss_schema = Some(schema);
                gloss_source = Some(source);
                messages
            } else if matches!(kind.as_str(), "reply_translation" | "user_translation") {
                let source: String = tx.query_row(
                    "SELECT text FROM messages WHERE turn_id=?1 AND role=?2",
                    params![turn, analysis_role(&kind)],
                    |r| r.get(0),
                )?;
                crate::conversations::translation::prompt(source, &captured)?
            } else {
                serde_json::from_value(captured["messages"].clone())?
            };
            let base: crate::ai::connections::access::ResolvedTarget =
                serde_json::from_value(captured["target"].clone())?;
            let target = if captured["routingPolicy"] == "task-models-v1" {
                crate::ai::connections::model_routing::target(
                    &base,
                    &kind,
                    captured["fastModel"]
                        .as_str()
                        .ok_or_else(|| fail("Captured fast model is missing."))?,
                )
            } else {
                base
            };
            let coaching_schema = if crate::conversations::translation::owns(&kind) {
                Some(crate::conversations::translation::schema())
            } else {
                coaching_schema
            };
            Ok((
                gloss_source,
                gloss_schema,
                coaching_schema,
                messages,
                target,
            ))
        })();
        let (gloss_source, gloss_schema, coaching_schema, messages, target) = match prepared {
            Ok(prepared) => prepared,
            Err(error) => {
                if matches!(
                    error.code,
                    ErrorCode::Storage | ErrorCode::Internal | ErrorCode::ConfigLoad
                ) {
                    return Err(error);
                }
                // No provider request was made. Retain a local preparation receipt
                // so every operation's failure is inspectable and explicitly retryable.
                tx.execute("INSERT INTO attempts(id,operation_id,state,requested_model,error,finished_at) VALUES(?1,?2,'failed','local',?3,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",params![id(),operation,error.message])?;
                tx.execute(
                    "UPDATE operations SET state='failed',permit=0 WHERE id=?1",
                    [&operation],
                )?;
                let error_path =
                    if matches!(kind.as_str(), "persona_word_gloss" | "user_word_gloss") {
                        gloss_error_path(&kind).to_owned()
                    } else {
                        format!("$.{kind}Error")
                    };
                tx.execute(
                    "UPDATE turns SET context=json_set(context,?2,?3) WHERE id=?1",
                    params![turn, error_path, error.message],
                )?;
                refresh_turn(&tx, &turn)?;
                bump(&tx)?;
                tx.commit()?;
                return Ok(None);
            }
        };
        let model = target.model.clone();
        let attempt = new_attempt_id();
        if matches!(kind.as_str(), "persona_word_gloss" | "user_word_gloss") {
            tx.execute(
                "UPDATE turns SET context=json_remove(context,?2) WHERE id=?1",
                params![turn, gloss_error_path(&kind)],
            )?;
        }
        tx.execute(
            "UPDATE operations SET state='running',permit=0 WHERE id=?1",
            [&operation],
        )?;
        tx.execute("INSERT INTO attempts(id,operation_id,state,requested_model) VALUES(?1,?2,'running',?3)",params![attempt,operation,model])?;
        bump(&tx)?;
        tx.commit()?;
        let dispatch = Dispatch {
            target,
            attempt,
            operation,
            credential,
            model,
            messages,
            gloss_schema,
            coaching_schema,
            gloss_source,
            speech_source: None,
            route: ConnectionRoute::parse(&self.connection.query_row(
                "SELECT route FROM turns WHERE id=?1",
                [&turn],
                |r| r.get::<_, String>(0),
            )?)?,
            install_id: self.snapshot()?.learner.id,
        };
        crate::diagnostics::inference::prepared(&dispatch, &kind, &captured, self.config.hash());
        Ok(Some(dispatch))
    }
}
