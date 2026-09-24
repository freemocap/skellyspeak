use super::*;

pub(super) fn speech_owner(
    db: &Connection,
    operation: &str,
) -> Result<(String, String, String, String, String)> {
    db.query_row("SELECT t.id,m.id,m.text,o.state,t.context FROM operations o JOIN turns t ON t.id=o.turn_id JOIN messages m ON m.turn_id=t.id AND m.role='assistant' JOIN conversations c ON c.id=t.conversation_id JOIN contacts r ON r.id=c.contact_id WHERE o.id=?1 AND o.kind='persona_speech' AND c.archived=0 AND r.archived=0 AND t.state NOT IN ('invalidated','cancelled')", [operation], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional()?.ok_or_else(|| AppError::new(ErrorCode::NotFound,"Speech source is unavailable."))
}

pub(super) fn speech_binding(
    _db: &Connection,
    message: &str,
    text: &str,
    captured: &serde_json::Value,
) -> Result<crate::ai::connections::access::ResolvedTarget> {
    if captured["speechSourceId"].as_str() != Some(message)
        || captured["speechSourceText"].as_str() != Some(text)
    {
        return Err(fail("Speech source changed."));
    }
    let target: crate::ai::connections::access::ResolvedTarget =
        serde_json::from_value(captured["speechTarget"].clone())?;
    Ok(target)
}

pub(super) fn prepare_speech(
    db: &Connection,
    operation: &str,
    turn: &str,
    context: &str,
) -> Result<Dispatch> {
    let (_, message_id, text, _, _) = speech_owner(db, operation)?;
    let captured: serde_json::Value = serde_json::from_str(context)?;
    let target = speech_binding(db, &message_id, &text, &captured)?;
    crate::ai::policy::holds::check(db, &target)?;
    let voice = captured["speechVoice"]
        .as_str()
        .ok_or_else(|| fail("Missing captured speech voice."))?
        .to_owned();
    let context: crate::configuration::LanguageContext =
        serde_json::from_value(captured["languageContext"].clone())?;
    let input = speech_input(&target, text, voice, &context)?;
    let attempt = new_attempt_id();
    db.execute(
        "UPDATE operations SET state='running',permit=0 WHERE id=?1",
        [operation],
    )?;
    db.execute(
        "INSERT INTO attempts(id,operation_id,state,requested_model) VALUES(?1,?2,'running',?3)",
        params![attempt, operation, target.model],
    )?;
    db.execute(
        "UPDATE turns SET context=json_remove(context,'$.speechError') WHERE id=?1",
        [turn],
    )?;
    Ok(Dispatch {
        temperature: super::TASK_TEMPERATURE,
        credential: target.credential.clone().unwrap_or_default(),
        model: target.model.clone(),
        route: target.route,
        target,
        attempt,
        operation: operation.into(),
        messages: vec![],
        gloss_schema: None,
        decisions: None,
        coaching_schema: None,
        gloss_source: None,
        speech_source: Some(crate::speech::delivery::Source {
            message_id,
            text: input.text,
            language: input.language,
            voice: input.voice,
        }),
        install_id: db.query_row("SELECT id FROM learner LIMIT 1", [], |r| r.get(0))?,
    })
}

pub fn request_speech(db: &Connection, message_id: &str, resident_audio: bool) -> Result<String> {
    let (turn,text,context):(String,String,String)=db.query_row("SELECT t.id,m.text,t.context FROM messages m JOIN turns t ON t.id=m.turn_id JOIN conversations c ON c.id=t.conversation_id JOIN contacts r ON r.id=c.contact_id WHERE m.id=?1 AND m.role='assistant' AND c.archived=0 AND r.archived=0 AND t.state NOT IN ('cancelled','invalidated') AND EXISTS(SELECT 1 FROM operations WHERE turn_id=t.id AND kind IN ('persona_reply','persona_opening') AND state='succeeded')",[message_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional()?.ok_or_else(||fail("Speech requires an accepted persona message."))?;
    let mut captured: serde_json::Value = serde_json::from_str(&context)?;
    let existing: Option<(String, String)> = db
        .query_row(
            "SELECT id,state FROM operations WHERE turn_id=?1 AND kind='persona_speech'",
            [&turn],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    if let Some((operation, state)) = &existing
        && (matches!(state.as_str(), "ready" | "running" | "waiting_dependencies")
            || (state == "succeeded" && resident_audio))
    {
        speech_binding(db, message_id, &text, &captured)?;
        return Ok(operation.clone());
    }
    // A click authorizes synthesis of this saved text using today's settings.
    // Completed audio and active requests above need no new connection at all.
    let target = crate::ai::connections::access::resolve(
        db,
        crate::ai::connections::access::Capability::Speech,
    )?;
    captured["speechTarget"] = serde_json::to_value(&target)?;
    speech_binding(db, message_id, &text, &captured)?;
    let language_context = serde_json::from_value(captured["languageContext"].clone())?;
    let input = speech_input(
        &target,
        text.clone(),
        captured["speechVoice"].as_str().unwrap_or_default().into(),
        &language_context,
    )?;
    let install: String = db.query_row("SELECT id FROM learner LIMIT 1", [], |r| r.get(0))?;
    if let Some(saved) = crate::ai::results::speech::lookup(db, &target, &input, &install)? {
        let operation = existing.map(|(id, _)| id).unwrap_or_else(id);
        let attempt = new_attempt_id();
        db.execute("INSERT INTO operations(id,turn_id,kind,state,permit) VALUES(?1,?2,'persona_speech','succeeded',0) ON CONFLICT(turn_id,kind) DO UPDATE SET state='succeeded',permit=0",params![operation,turn])?;
        db.execute("INSERT INTO attempts(id,operation_id,state,requested_model,diagnostics,finished_at) VALUES(?1,?2,'succeeded','local',?3,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",params![attempt,operation,serde_json::json!({"cacheHit":true,"sourceExecutionId":saved.execution}).to_string()])?;
        crate::ai::results::associate(db, &attempt, &saved.execution)?;
        db.execute(
            "UPDATE turns SET context=?2 WHERE id=?1",
            params![turn, serde_json::to_string(&captured)?],
        )?;
        refresh_turn(db, &turn)?;
        return Ok(operation);
    }
    if config(db)?.paused {
        return Err(AppError::new(
            ErrorCode::AdmissionHeld,
            "AI execution is paused. Speech was not queued.",
        ));
    }
    crate::ai::policy::holds::check(db, &target)?;
    let operation = existing.map(|(id, _)| id).unwrap_or_else(id);
    // Each explicit request authorizes another generation. Historical attempts
    // remain observable, but do not impose a lifetime replay/retry limit.
    admit_network_work(db, 1)?;
    // Releasing a corrected hold may not resume any sibling.
    let paused: bool = db.query_row("SELECT paused FROM turns WHERE id=?1", [&turn], |r| {
        r.get(0)
    })?;
    db.execute("INSERT INTO operations(id,turn_id,kind,state,permit) VALUES(?1,?2,'persona_speech','ready',?3) ON CONFLICT(turn_id,kind) DO UPDATE SET state='ready',permit=excluded.permit",params![operation,turn,paused])?;
    db.execute(
        "UPDATE turns SET context=?2 WHERE id=?1",
        params![turn, serde_json::to_string(&captured)?],
    )?;
    refresh_turn(db, &turn)?;
    Ok(operation)
}

pub fn cancel_speech(db: &Connection, operation: &str) -> Result<String> {
    let (turn, _, _, _, _) = speech_owner(db, operation)?;
    db.execute(
        "UPDATE operations SET state='cancelled',permit=0 WHERE id=?1",
        [operation],
    )?;
    db.execute("UPDATE attempts SET state='unknown',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),error='Speech cancelled locally; provider outcome may be unknown.' WHERE operation_id=?1 AND state='running'",[operation])?;
    refresh_turn(db, &turn)?;
    Ok(operation.into())
}

impl Store {
    pub fn finish_speech(
        &mut self,
        dispatch: &Dispatch,
        outcome: crate::ai::audio::SpeechOutcome,
    ) -> Result<Option<crate::speech::delivery::ReadyAudio>> {
        crate::diagnostics::speech::completed(dispatch, &outcome);
        let tx = self.connection.transaction()?;
        let source = dispatch
            .speech_source
            .as_ref()
            .ok_or_else(|| fail("Missing captured speech source."))?;
        let tokens_in = outcome.input_tokens.and_then(|n| i32::try_from(n).ok());
        let tokens_out = outcome.output_tokens.and_then(|n| i32::try_from(n).ok());
        let diagnostics = crate::diagnostics::response::retained(
            outcome.diagnostics.as_ref(),
            outcome.audio.as_ref().err(),
        );
        tx.execute(
            "UPDATE attempts SET diagnostics=?2 WHERE id=?1 AND operation_id=?3",
            params![dispatch.attempt, diagnostics, dispatch.operation],
        )?;
        // Retain accounting even when cancellation already revoked publication.
        tx.execute("UPDATE attempts SET actual_model=COALESCE(actual_model,?2),provider_id=COALESCE(provider_id,?3),input_tokens=COALESCE(input_tokens,?4),output_tokens=COALESCE(output_tokens,?5) WHERE id=?1 AND operation_id=?6 AND state IN ('running','unknown','invalidated')",params![dispatch.attempt,outcome.actual_model,outcome.provider_id,tokens_in,tokens_out,dispatch.operation])?;
        if let Some(metered_turn)=tx.query_row("SELECT o.turn_id FROM operations o JOIN attempts a ON a.operation_id=o.id WHERE o.id=?1 AND a.id=?2",params![dispatch.operation,dispatch.attempt],|r|r.get::<_,String>(0)).optional()? {
        let usage_path = format!("$.speechUsageByAttempt.\"{}\"", dispatch.attempt);
        tx.execute("UPDATE turns SET context=json_set(context,?2,json(?3)) WHERE id=?1",params![metered_turn,usage_path,serde_json::json!({"inputTokens":outcome.input_tokens,"outputTokens":outcome.output_tokens,"costMicros":outcome.cost_micros,"finishReason":outcome.finish_reason}).to_string()])?;
        }
        let owner = speech_owner(&tx, &dispatch.operation);
        let active:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE a.id=?1 AND o.id=?2 AND a.state='running' AND o.state='running')",params![dispatch.attempt,dispatch.operation],|r|r.get(0))?;
        let (turn, message, text, _, context) = match owner {
            Ok(owner) => owner,
            Err(error) if error.code == ErrorCode::NotFound => {
                // The source can disappear or be archived independently of the
                // request future. Revoke publication AND release durable capacity.
                tx.execute("UPDATE attempts SET state='invalidated',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),error='Speech source is unavailable.' WHERE id=?1 AND state='running'",[&dispatch.attempt])?;
                tx.execute("UPDATE operations SET state='invalidated',permit=0 WHERE id=?1 AND state='running'",[&dispatch.operation])?;
                if let Some(turn)=tx.query_row("SELECT t.id FROM turns t JOIN operations o ON o.turn_id=t.id WHERE o.id=?1 AND t.state IN ('pending','assisting')",[&dispatch.operation],|r|r.get::<_,String>(0)).optional()? { refresh_turn(&tx,&turn)?; }
                bump(&tx)?;
                tx.commit()?;
                return Ok(None);
            }
            Err(error) => return Err(error),
        };
        if !active {
            bump(&tx)?;
            tx.commit()?;
            return Ok(None);
        }
        let captured: serde_json::Value = serde_json::from_str(&context)?;
        let authority = speech_binding(&tx, &message, &text, &captured).and_then(|_| {
            if message != source.message_id || text != source.text {
                Err(fail("Speech source changed."))
            } else {
                Ok(())
            }
        });

        // Decoded audio is publishable independently of optional finish
        // labels and counters. Original metadata remains in the receipt.
        let validation = authority;
        let audio = match outcome.audio {
            Ok(wav) => validation.and_then(|_| {
                if wav.is_empty() || wav.len() > crate::speech::delivery::AUDIO_LIMIT {
                    Err(fail("Speech audio exceeds its output limit."))
                } else {
                    Ok(wav)
                }
            }),
            Err(error) => Err(error),
        };
        // Publication validation can fail after provider decoding succeeded.
        // Retain that failure alongside the already validated provider receipt.
        let diagnostics = crate::diagnostics::response::retained(
            outcome.diagnostics.as_ref(),
            audio.as_ref().err(),
        );
        tx.execute(
            "UPDATE attempts SET diagnostics=?2 WHERE id=?1",
            params![dispatch.attempt, diagnostics],
        )?;
        if let Err(error) = &audio {
            pause_related(&tx, &dispatch.target, error)?;
        }
        let (state, error) = match &audio {
            Ok(_) => ("succeeded", None),
            Err(e) => (
                if e.code == ErrorCode::UnknownOutcome {
                    "unknown"
                } else {
                    "failed"
                },
                Some(e.message.as_str()),
            ),
        };
        tx.execute("UPDATE attempts SET state=?2,error=?3,finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1",params![dispatch.attempt,state,error])?;
        tx.execute(
            "UPDATE operations SET state=?2,permit=0 WHERE id=?1",
            params![dispatch.operation, state],
        )?;
        refresh_turn(&tx, &turn)?;
        bump(&tx)?;
        tx.commit()?;
        Ok(audio.ok().map(|wav| crate::speech::delivery::ReadyAudio {
            operation_id: dispatch.operation.clone(),
            attempt_id: dispatch.attempt.clone(),
            message_id: source.message_id.clone(),
            wav,
        }))
    }

    pub fn speech_audio(
        &self,
        operation: &str,
        cache: &crate::speech::delivery::DeliveryBuffer,
    ) -> Result<SpeechAudioState> {
        use base64::Engine;
        let (_, message, text, state, context) = speech_owner(&self.connection, operation)?;
        let captured: serde_json::Value = serde_json::from_str(&context)?;
        speech_binding(&self.connection, &message, &text, &captured)?;
        let unavailable = |reason: SpeechUnavailableReason| -> Result<SpeechAudioState> {
            let attempt = self.connection.query_row(
                "SELECT id,error,diagnostics,requested_model,actual_model,provider_id FROM attempts WHERE operation_id=?1 ORDER BY rowid DESC LIMIT 1",
                [operation], |r| Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?, r.get::<_, Option<String>>(2)?, r.get::<_, String>(3)?, r.get::<_, Option<String>>(4)?, r.get::<_, Option<String>>(5)?)),
            ).optional()?;
            let fallback = match reason {
                SpeechUnavailableReason::Expired => {
                    "This reply's audio is no longer cached. Tap the speaker to generate it again."
                }
                SpeechUnavailableReason::Cancelled => {
                    "Speech was cancelled before playback. Tap the speaker to try again."
                }
                SpeechUnavailableReason::UnknownOutcome => {
                    "The speech request ended without a confirmed result. Retrying may repeat provider work and charges."
                }
                SpeechUnavailableReason::NotRequested => {
                    "Speech has not been requested for this reply. Tap the speaker to generate it."
                }
                SpeechUnavailableReason::Failed => {
                    "Speech generation failed without a recorded explanation. Open AI activity to inspect the operation."
                }
            };
            // Admission can fail before an attempt exists. Its full error belongs
            // to this request, ahead of any previous attempt's failure.
            let admission = captured.get("speechError");
            let failure_message = admission
                .and_then(|v| {
                    v.get("message")
                        .and_then(|v| v.as_str())
                        .or_else(|| v.as_str())
                })
                .or_else(|| attempt.as_ref().and_then(|a| a.1.as_deref()));
            let failed = matches!(
                reason,
                SpeechUnavailableReason::Failed | SpeechUnavailableReason::UnknownOutcome
            );
            let explanation = if failed {
                failure_message.unwrap_or(fallback)
            } else {
                fallback
            };
            let mut diagnostics = if let Some(error) = admission {
                Some(error.clone())
            } else if let Some(a) = &attempt {
                let response =
                    a.2.as_deref()
                        .map(serde_json::from_str::<serde_json::Value>)
                        .transpose()?;
                Some(
                    serde_json::json!({"requested_model": a.3, "actual_model": a.4, "request_id": a.5, "response": response}),
                )
            } else {
                None
            };
            if let Some(a) = &attempt
                && let Some(receipt) =
                    crate::ai::results::receipt_for_consumer(&self.connection, &a.0)?
            {
                diagnostics.get_or_insert_with(|| serde_json::json!({}))["sourceExecution"] =
                    receipt;
            }
            Ok(SpeechAudioState::Unavailable {
                operation_id: operation.into(),
                message_id: message.clone(),
                reason,
                message: explanation.into(),
                attempt_id: if admission.is_some() {
                    None
                } else {
                    attempt.as_ref().map(|a| a.0.clone())
                },
                diagnostics,
            })
        };
        match state.as_str() {
            "ready" | "waiting_dependencies" | "running" => Ok(SpeechAudioState::Pending {
                operation_id: operation.into(),
                message_id: message,
            }),
            "succeeded" => {
                let attempt:String=self.connection.query_row("SELECT id FROM attempts WHERE operation_id=?1 AND state='succeeded' ORDER BY rowid DESC LIMIT 1",[operation],|r|r.get(0))?;
                if let Some(saved) = crate::ai::results::for_consumer(&self.connection, &attempt)? {
                    cache.discard(&attempt);
                    return Ok(SpeechAudioState::Ready {
                        operation_id: operation.into(),
                        attempt_id: attempt,
                        message_id: message,
                        mime: "audio/wav".into(),
                        audio_base64: base64::engine::general_purpose::STANDARD
                            .encode(saved.payload),
                    });
                }
                if let Some(audio) = cache
                    .get(&attempt)
                    .filter(|a| a.message_id == message && a.operation_id == operation)
                {
                    Ok(SpeechAudioState::Ready {
                        operation_id: operation.into(),
                        attempt_id: attempt,
                        message_id: message,
                        mime: "audio/wav".into(),
                        audio_base64: base64::engine::general_purpose::STANDARD.encode(&audio.wav),
                    })
                } else {
                    unavailable(SpeechUnavailableReason::Expired)
                }
            }
            "cancelled" | "invalidated" => unavailable(SpeechUnavailableReason::Cancelled),
            "unknown" => unavailable(SpeechUnavailableReason::UnknownOutcome),
            _ => unavailable(SpeechUnavailableReason::Failed),
        }
    }
}
