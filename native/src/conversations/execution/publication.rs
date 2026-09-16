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
    if db.query_row(
        "SELECT EXISTS(SELECT 1 FROM operations WHERE turn_id=?1 AND kind='lesson_generate')",
        [turn],
        |r| r.get::<_, bool>(0),
    )? {
        return Ok(crate::conversations::turn_plan::LESSON_PLAN);
    }
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

    pub fn finish(&mut self, dispatch: &Dispatch, result: Result<Completion>) -> Result<()> {
        let tx = self.connection.transaction()?;
        let scope:Option<(String,String)>=tx.query_row("SELECT t.id,t.conversation_id FROM attempts a JOIN operations o ON o.id=a.operation_id JOIN turns t ON t.id=o.turn_id WHERE a.id=?1 AND o.id=?2 AND a.state='running' AND o.state='running' AND t.state IN ('pending','assisting')",params![dispatch.attempt,dispatch.operation],|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
        let Some((turn, conversation)) = scope else {
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
        let mut gloss = None;
        let mut coaching = None;
        let valid = match &result {
            Ok(output) if kind.starts_with("lesson_") => {
                crate::learning::lessons::validate(&tx, &turn, &kind, output).map(|value| {
                    coaching = Some(value);
                })
            }
            Ok(output)
                if kind == "coach_feedback"
                    || kind == "coach_retry_check"
                    || kind == "coach_suggestions"
                    || kind == "coach_reaction" =>
            {
                (if kind == "coach_reaction" {
                    crate::partners::partner_reaction::validate(output)
                } else if kind == crate::learning::coaching::SUGGESTIONS {
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
                    gloss = Some(crate::conversations::gloss::validate_with_context(
                        source,
                        output,
                        &dispatch.operation,
                        &dispatch.attempt,
                        &language_context,
                    )?);
                    Ok(())
                })()
            }
            Ok(_) if kind == "persona_speech" => {
                Err(fail("Speech requires its media publication validator."))
            }
            Ok(_) if dispatch.gloss_source.is_some() => Err(fail("Unexpected word gloss source.")),
            Ok(output) if output.finish_reason != "stop" => Err(AppError::new(
                ErrorCode::Provider,
                "Provider did not finish the reply normally. No partial prose was published.",
            )),
            Ok(output) => crate::ai::transport::provider::validate_prose(&output.text),
            Err(error) => Err(error.clone()),
        };
        crate::diagnostics::inference::completed(dispatch, &kind, &result, &valid);
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
        if kind == "coach_feedback"
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
            if kind == "persona_reply" || kind == "persona_opening" {
                tx.execute("UPDATE operations SET state='ready' WHERE turn_id=?1 AND kind IN ('reply_translation','persona_word_gloss','persona_speech','coach_suggestions','coach_reaction','lesson_review') AND state='waiting_dependencies'", [&turn])?;
            }
            let output = result.map_err(|_| fail("Missing validated output."))?;
            if let Some(value) = coaching {
                if kind.starts_with("lesson_") {
                    crate::learning::lessons::publish(&tx, &turn, &kind, &value)?;
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
                tx.execute(
                    "UPDATE turns SET context=json_set(context,?3,json(?2)) WHERE id=?1",
                    params![turn, serde_json::to_string(&gloss)?, gloss_path(&kind)],
                )?;
            } else if matches!(kind.as_str(), "reply_translation" | "user_translation") {
                tx.execute("UPDATE turns SET context=json_set(context,?3,?2) WHERE id=?1 AND EXISTS(SELECT 1 FROM messages WHERE turn_id=?1 AND role=?4)", params![turn,output.text,translation_path(&kind),analysis_role(&kind)])?;
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
        refresh_turn(&tx, &turn)?;
        bump(&tx)?;
        tx.commit()?;
        Ok(())
    }
}
