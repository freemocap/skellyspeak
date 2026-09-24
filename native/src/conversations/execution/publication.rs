use super::*;

pub(crate) fn refresh_turn(db: &Connection, turn: &str) -> Result<()> {
    db.execute("UPDATE turns SET state=CASE WHEN EXISTS(SELECT 1 FROM operations WHERE turn_id=?1 AND state IN ('ready','running')) THEN CASE WHEN EXISTS(SELECT 1 FROM operations WHERE turn_id=?1 AND kind IN ('persona_reply','persona_opening','coach_reply') AND state IN ('ready','waiting_dependencies','running')) THEN 'pending' ELSE 'assisting' END WHEN EXISTS(SELECT 1 FROM operations WHERE turn_id=?1 AND state='unknown') THEN 'unknown' WHEN EXISTS(SELECT 1 FROM operations WHERE turn_id=?1 AND state='failed') THEN 'failed' WHEN EXISTS(SELECT 1 FROM operations WHERE turn_id=?1 AND state='invalidated') THEN 'invalidated' ELSE 'succeeded' END WHERE id=?1", [turn])?;
    db.execute(
        "UPDATE turns SET refusal_hold=NULL WHERE id=?1 AND state='succeeded'",
        [turn],
    )?;
    Ok(())
}

pub(super) fn plan_for(
    db: &Connection,
    turn: &str,
) -> Result<&'static [crate::conversations::turn_plan::Declaration]> {
    let opening: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM operations WHERE turn_id=?1 AND kind='persona_opening')",
        [turn],
        |r| r.get(0),
    )?;
    let coach: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM operations WHERE turn_id=?1 AND kind='coach_context')",
        [turn],
        |r| r.get(0),
    )?;
    Ok(if coach {
        COACH_PLAN
    } else if opening {
        OPENING_PLAN
    } else {
        PLAN
    })
}

pub(super) fn ops_succeeded(db: &Connection, turn: &str, kind: &str) -> Result<bool> {
    Ok(db.query_row(
        "SELECT state='succeeded' FROM operations WHERE turn_id=?1 AND kind=?2",
        params![turn, kind],
        |r| r.get(0),
    )?)
}

impl Store {
    pub fn attempt_active(&self, attempt: &str) -> Result<bool> {
        let running:Option<(String,String)>=self.connection.query_row("SELECT o.id,o.kind FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE a.id=?1 AND a.state='running'",[attempt],|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
        let Some((operation, kind)) = running else {
            return Ok(false);
        };
        if kind != "persona_speech" {
            return Ok(true);
        }
        let (_, message, text, _, context) = match speech_owner(&self.connection, &operation) {
            Ok(owner) => owner,
            Err(error) if error.code == ErrorCode::NotFound => return Ok(false),
            Err(error) => return Err(error),
        };
        let captured: serde_json::Value = serde_json::from_str(&context)?;
        match speech_binding(&self.connection, &message, &text, &captured) {
            Ok(_) => Ok(true),
            Err(error) if matches!(error.code, ErrorCode::Validation | ErrorCode::Conflict) => {
                Ok(false)
            }
            Err(error) => Err(error),
        }
    }

    /// Where an attempt belongs, for its stream: conversation, turn, operation, kind.
    pub fn attempt_scope(&self, attempt: &str) -> Result<Option<(String, String, String, String)>> {
        Ok(self.connection.query_row("SELECT t.conversation_id,t.id,o.id,o.kind FROM attempts a JOIN operations o ON o.id=a.operation_id JOIN turns t ON t.id=o.turn_id WHERE a.id=?1",[attempt],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).optional()?)
    }

    pub fn attempt_state(&self, attempt: &str) -> Result<Option<String>> {
        Ok(self
            .connection
            .query_row("SELECT state FROM attempts WHERE id=?1", [attempt], |r| {
                r.get(0)
            })
            .optional()?)
    }

    /// Save streamed text of attempts that are still running, so an abrupt end
    /// of the process keeps what arrived. Deliberately no revision bump: the
    /// snapshot does not show running text, the stream does.
    pub fn save_previews(&mut self, previews: &[(String, String)]) -> Result<()> {
        if previews.is_empty() {
            return Ok(());
        }
        let tx = self.connection.transaction()?;
        for (attempt, text) in previews {
            tx.execute(
                "UPDATE attempts SET preview_text=?2 WHERE id=?1 AND state='running'",
                params![attempt, bounded_text(text)],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn finish(&mut self, dispatch: &Dispatch, result: Result<Completion>) -> Result<()> {
        self.finish_retaining(dispatch, result, None)
    }

    /// Finish an attempt, keeping every piece of text it received. `streamed`
    /// is the text that arrived as deltas; the completion's own text, when
    /// there is one, is kept too. Both are written before the scope check, so
    /// a cancelled, invalidated or replaced attempt still keeps its text.
    pub fn finish_retaining(
        &mut self,
        dispatch: &Dispatch,
        result: Result<Completion>,
        streamed: Option<&str>,
    ) -> Result<()> {
        let tx = self.connection.transaction()?;
        let retained = crate::diagnostics::response::retained(
            result.as_ref().ok().and_then(|c| c.diagnostics.as_ref()),
            result.as_ref().err(),
        );
        tx.execute(
            "UPDATE attempts SET diagnostics=?2 WHERE id=?1 AND operation_id=?3",
            params![dispatch.attempt, retained, dispatch.operation],
        )?;
        let response = result
            .as_ref()
            .ok()
            .map(|completion| bounded_text(&completion.text));
        let preview = streamed.map(bounded_text);
        let retained_text = tx.execute(
            "UPDATE attempts SET response_text=COALESCE(?3,response_text),preview_text=COALESCE(?4,preview_text) WHERE id=?1 AND operation_id=?2 AND (?3 IS NOT NULL OR ?4 IS NOT NULL)",
            params![dispatch.attempt, dispatch.operation, response, preview],
        )? > 0;
        let scope:Option<(String,String)>=tx.query_row("SELECT t.id,t.conversation_id FROM attempts a JOIN operations o ON o.id=a.operation_id JOIN turns t ON t.id=o.turn_id WHERE a.id=?1 AND o.id=?2 AND a.state='running' AND o.state='running' AND t.state IN ('pending','assisting')",params![dispatch.attempt,dispatch.operation],|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
        let Some((turn, conversation)) = scope else {
            // The attempt already ended (cancelled, invalidated, replaced). Its
            // retained text changes what the snapshot shows, so readers that saw
            // the ending must be woken to see the text: one bump, not per token.
            if retained_text {
                bump(&tx)?;
            }
            tx.commit()?;
            return Ok(());
        };
        if let Err(error) = &result {
            pause_related(&tx, &dispatch.target, error)?;
        }
        let kind: String = tx.query_row(
            "SELECT kind FROM operations WHERE id=?1",
            [&dispatch.operation],
            |r| r.get(0),
        )?;
        // Keep the provider's original response above; publish and derive assistance
        // from cleaned conversation prose, never rewrite structured JSON outputs.
        let mut result = result;
        if matches!(
            kind.as_str(),
            "persona_opening" | "persona_reply" | "coach_reply"
        ) && let Ok(output) = &mut result
        {
            let (clean, removed) = crate::ai::transport::provider::strip_prose_emojis(&output.text);
            if removed > 0 && !clean.is_empty() {
                output.text = clean;
                let diagnostics = output
                    .diagnostics
                    .get_or_insert_with(|| serde_json::json!({}));
                diagnostics["prose_cleanup"] =
                    serde_json::json!({"emoji_graphemes_removed": removed});
                crate::diagnostics::inference::emojis_removed(dispatch, &kind, removed);
            }
        }
        let mut translation = None;
        let mut gloss = None;
        let mut gloss_report = None;
        let mut coaching = None;
        let valid = match &result {
            // A provider may return partial text alongside an embedded failure.
            // Retain that text above, but report the failure before feature validation.
            Ok(output) if output.finish_reason == "error" => {
                let safe = output.diagnostics.as_ref().map(|details| {
                    crate::diagnostics::response::metadata(&details["choices"][0]["error"], &[])
                });
                let reason = safe
                    .as_ref()
                    .and_then(crate::diagnostics::response::reason)
                    .unwrap_or("The provider ended the response with an error.");
                Err(AppError::new(ErrorCode::Provider, format!("AI provider error: {reason}"))
                    .with_diagnostics(serde_json::json!({
                        "stage": "completion_publication", "finish_reason": output.finish_reason,
                        "response_bytes": output.text.len(),
                    })))
            }
            Ok(output) if crate::conversations::translation::owns(&kind) => (|| -> Result<()> {
                let source: String = tx
                    .query_row(
                        "SELECT text FROM messages WHERE turn_id=?1 AND role=?2",
                        params![turn, analysis_role(&kind)],
                        |r| r.get(0),
                    )
                    .optional()?
                    .ok_or_else(|| fail("Translation source is unavailable."))?;
                translation = Some(crate::conversations::translation::validate(
                    &source, output,
                )?);
                Ok(())
            })(),
            Ok(output) if kind == "skill_evidence" => {
                crate::learning::coaching::skill_evidence::validate(&tx, &turn, output)
                    .map(|v| coaching = Some(v))
            }
            Ok(output) if kind == "skill_assessment" => {
                crate::learning::coaching::assessment_adapter::validate(
                    &tx,
                    &turn,
                    output,
                    if dispatch.decisions.is_some() {
                        AssessmentAdapter::JevChoice
                    } else {
                        AssessmentAdapter::ChatModel
                    },
                )
                .map(|mut value| {
                    value["providerMode"] = serde_json::json!(dispatch.route);
                    coaching = Some(value);
                })
            }
            Ok(output) if crate::learning::coaching::message_assessment::owns(&kind) => {
                crate::learning::coaching::message_assessment::validate(&kind, output)
                    .map(|v| coaching = Some(v))
            }
            Ok(output) if crate::learning::coaching::conversation_support::owns(&kind) => {
                crate::learning::coaching::conversation_support::validate(&tx, &turn, &kind, output)
                    .map(|v| {
                        coaching = Some(v);
                    })
            }
            Ok(output)
                if kind == "skill_assessment"
                    || kind == "skill_evidence"
                    || crate::learning::coaching::conversation_support::owns(&kind)
                    || crate::learning::coaching::message_assessment::owns(&kind)
                    || kind == "coach_feedback"
                    || kind == "coach_retry_check"
                    || kind == "coach_suggestions"
                    || kind == "coach_reaction" =>
            {
                (if kind == crate::learning::coaching::SUGGESTIONS {
                    crate::learning::coaching::validate(&tx, &turn, &kind, output)
                } else {
                    crate::learning::coaching::coach_observation::validate(
                        &tx, &turn, &kind, output,
                    )
                })
                .map(|value| {
                    coaching = Some(value);
                })
            }
            Ok(output) if matches!(kind.as_str(), "persona_word_gloss" | "user_word_gloss") => {
                (|| -> Result<()> {
                    let source = dispatch
                        .gloss_source
                        .as_ref()
                        .ok_or_else(|| fail("Missing word gloss source."))?;
                    let bound: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM messages WHERE id=?1 AND turn_id=?2 AND role=?4 AND text=?3)", params![source.identity.message_id,turn,source.text,analysis_role(&kind)], |r| r.get(0))?;
                    if !bound {
                        return Err(fail("Word gloss source is unavailable."));
                    }
                    let captured: String =
                        tx.query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
                            r.get(0)
                        })?;
                    let captured: serde_json::Value = serde_json::from_str(&captured)?;
                    if captured["targetLanguage"].as_str()
                        != Some(source.identity.target_language_id.as_str())
                        || captured["translationLanguage"].as_str()
                            != Some(source.identity.explanation_language_id.as_str())
                    {
                        return Err(fail("Word gloss source identity changed."));
                    }
                    let language_context: crate::configuration::LanguageContext =
                        serde_json::from_value(captured["languageContext"].clone())?;
                    let (mut value, mut report) =
                        crate::conversations::gloss::recover_with_context(
                            source,
                            output,
                            &dispatch.operation,
                            &dispatch.attempt,
                            &language_context,
                        )?;
                    let saved_key = if kind == "user_word_gloss" {
                        "userWordGloss"
                    } else {
                        "wordGloss"
                    };
                    if let Some(saved) = captured.get(saved_key).filter(|v| !v.is_null()) {
                        let previous: WordGlossView = serde_json::from_value(saved.clone())?;
                        report["preserved_from_attempt"] = serde_json::json!(previous.attempt_id);
                        value = crate::conversations::gloss::merge_repair(&previous, value)?;
                    }
                    gloss_report = Some(report);
                    gloss = Some(value);
                    Ok(())
                })()
            }
            Ok(_) if kind == "persona_speech" => {
                Err(fail("Speech requires its media publication validator."))
            }
            Ok(_) if dispatch.gloss_source.is_some() => Err(fail("Unexpected word gloss source.")),
            Ok(output) if output.finish_reason == "error" => Err(AppError::new(
                ErrorCode::Provider,
                "Provider did not finish the reply normally. The reply was not saved to the conversation; the text that arrived is shown above.",
            )),
            Ok(output) => crate::ai::transport::provider::validate_prose(&output.text),
            Err(error) => Err(error.clone()),
        };
        crate::diagnostics::inference::completed(dispatch, &kind, &result, &valid);
        let diagnostics = crate::diagnostics::response::retained(
            result.as_ref().ok().and_then(|c| c.diagnostics.as_ref()),
            valid.as_ref().err().or(result.as_ref().err()),
        );
        tx.execute(
            "UPDATE attempts SET diagnostics=?2 WHERE id=?1",
            params![dispatch.attempt, diagnostics],
        )?;
        if let Ok(output) = &result {
            tx.execute("UPDATE attempts SET actual_model=?2,provider_id=?3,input_tokens=?4,output_tokens=?5 WHERE id=?1",params![dispatch.attempt,output.actual_model,output.provider_id,output.input_tokens,output.output_tokens])?;
        }
        let (state, error) = match valid {
            Ok(()) => ("succeeded", None),
            Err(error) => (
                if error.code == ErrorCode::UnknownOutcome {
                    "unknown"
                } else {
                    "failed"
                },
                Some(error.message),
            ),
        };
        if matches!(kind.as_str(), "persona_word_gloss" | "user_word_gloss") {
            tx.execute(
                "UPDATE turns SET context=json_set(context,?3,?2) WHERE id=?1",
                params![turn, error, gloss_error_path(&kind)],
            )?;
        }
        if kind == "skill_assessment"
            || kind == "skill_evidence"
            || crate::learning::coaching::conversation_support::owns(&kind)
            || crate::learning::coaching::message_assessment::owns(&kind)
            || kind == "coach_feedback"
            || kind == "coach_retry_check"
            || kind == "coach_suggestions"
            || kind == "coach_reaction"
        {
            tx.execute(
                "UPDATE turns SET context=json_set(context,?2,?3) WHERE id=?1",
                params![turn, format!("$.{kind}Error"), error],
            )?;
        }
        tx.execute("UPDATE attempts SET state=?2,error=?3,finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1",params![dispatch.attempt,state,error])?;
        tx.execute(
            "UPDATE operations SET state=?2 WHERE id=?1",
            params![dispatch.operation, state],
        )?;
        if state == "succeeded" {
            super::graph::release_dependents(&tx, &turn)?;
            let output = result.map_err(|_| fail("Missing validated output."))?;
            if let Some(value) = coaching {
                if kind == "skill_evidence" {
                    crate::learning::coaching::skill_evidence::publish(&tx, &turn, &value)?;
                } else if kind == "skill_assessment" && value["adapter"] == "jev_choice" {
                    crate::learning::coaching::skill_evidence::retain_decisions(
                        &tx,
                        &turn,
                        &value,
                        &dispatch.attempt,
                    )?;
                } else if kind == "skill_assessment" {
                    crate::learning::coaching::skill_assessment::publish(
                        &tx,
                        &turn,
                        &value,
                        &dispatch.attempt,
                    )?;
                    // The chat assessor already supplied exact quotes: record the
                    // declared evidence node locally without another network call.
                    tx.execute("INSERT INTO attempts(id,operation_id,state,requested_model,finished_at) SELECT ?1,id,'succeeded','local',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM operations WHERE turn_id=?2 AND kind='skill_evidence' AND state='ready'", params![id(),turn])?;
                    tx.execute("UPDATE operations SET state='succeeded',permit=0 WHERE turn_id=?1 AND kind='skill_evidence' AND state='ready'", [&turn])?;
                } else if kind == "conversation_feedback"
                    || crate::learning::coaching::conversation_support::owns(&kind)
                {
                    crate::learning::coaching::conversation_support::publish(
                        &tx, &turn, &kind, &value,
                    )?;
                } else if kind == "coach_reaction" {
                    tx.execute("UPDATE turns SET context=json_set(context,'$.partnerReaction',json(?2)) WHERE id=?1",params![turn,value.to_string()])?;
                } else if kind == crate::learning::coaching::SUGGESTIONS {
                    crate::learning::coaching::publish(
                        &tx,
                        &turn,
                        &kind,
                        &value,
                        &dispatch.attempt,
                    )?;
                } else {
                    crate::learning::coaching::coach_observation::publish(
                        &tx,
                        &turn,
                        &value,
                        &dispatch.attempt,
                    )?;
                }
            } else if let Some(gloss) = gloss {
                let repair = if gloss.coverage == GlossCoverage::Partial {
                    reading::queue_gloss_repair(&tx, &turn, dispatch)?
                } else {
                    "complete"
                };
                if let Some(report) = gloss_report.as_mut() {
                    report["repair"] = serde_json::json!(repair);
                }

                tx.execute(
                    "UPDATE turns SET context=json_set(context,?3,json(?2)) WHERE id=?1",
                    params![turn, serde_json::to_string(&gloss)?, gloss_path(&kind)],
                )?;
            } else if matches!(kind.as_str(), "reply_translation" | "user_translation") {
                tx.execute("UPDATE turns SET context=json_set(context,?3,?2) WHERE id=?1 AND EXISTS(SELECT 1 FROM messages WHERE turn_id=?1 AND role=?4)", params![turn,translation.as_ref().ok_or_else(|| fail("Missing validated translation."))?,translation_path(&kind),analysis_role(&kind)])?;
            } else {
                tx.execute("INSERT INTO messages(id,conversation_id,turn_id,sequence,role,text) SELECT ?1,?2,?3,COALESCE(MAX(sequence),0)+1,'assistant',?4 FROM messages WHERE conversation_id=?2",params![id(),conversation,turn,output.text])?;
            }
            if kind == "persona_reply" || kind == "persona_opening" {
                tx.execute("UPDATE turns SET context=json_set(context,'$.speechSourceId',(SELECT id FROM messages WHERE turn_id=?1 AND role='assistant'),'$.speechSourceText',(SELECT text FROM messages WHERE turn_id=?1 AND role='assistant')) WHERE id=?1", [&turn])?;
            }
            tx.execute(
                "UPDATE conversations SET revision=revision+1 WHERE id=?1",
                [conversation],
            )?;
        }
        if let Some(report) = gloss_report {
            tx.execute("UPDATE attempts SET diagnostics=json_set(COALESCE(diagnostics,'{}'),'$.word_gloss_validation',json(?2)) WHERE id=?1", params![dispatch.attempt, report.to_string()])?;
        }
        refresh_turn(&tx, &turn)?;
        bump(&tx)?;
        tx.commit()?;
        Ok(())
    }
}

/// Recorded text is capped at the response ceiling, cut on a character boundary.
pub(crate) const RETAINED_TEXT_LIMIT: usize = 262144;
pub(crate) fn bounded_text(text: &str) -> &str {
    if text.len() <= RETAINED_TEXT_LIMIT {
        return text;
    }
    let mut end = RETAINED_TEXT_LIMIT;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}
