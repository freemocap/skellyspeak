use super::*;

pub fn accept_coach(
    db: &Connection,
    registry: &crate::configuration::Registry,
    snapshot: &Snapshot,
    conversation_id: &str,
    text: &str,
    expected_revision: i32,
) -> Result<String> {
    accept_turn(
        db,
        registry,
        snapshot,
        conversation_id,
        text,
        expected_revision,
        true,
        None,
        None,
    )
}

pub fn accept_send(
    db: &Connection,
    registry: &crate::configuration::Registry,
    snapshot: &Snapshot,
    conversation_id: &str,
    text: &str,
    expected_revision: i32,
) -> Result<String> {
    accept_turn(
        db,
        registry,
        snapshot,
        conversation_id,
        text,
        expected_revision,
        false,
        None,
        None,
    )
}

pub(crate) fn accept_revision_send(
    db: &Connection,
    registry: &crate::configuration::Registry,
    snapshot: &Snapshot,
    conversation_id: &str,
    text: &str,
    expected_revision: i32,
    replaced: &str,
) -> Result<String> {
    accept_turn(
        db,
        registry,
        snapshot,
        conversation_id,
        text,
        expected_revision,
        false,
        Some(replaced),
        None,
    )
}

pub(crate) fn accept_opening(
    db: &Connection,
    registry: &crate::configuration::Registry,
    snapshot: &Snapshot,
    conversation: &str,
    brief: &str,
    opening: &Opening,
) -> Result<String> {
    let revision = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .ok_or_else(|| fail("Conversation not found."))?
        .revision;
    accept_turn(
        db,
        registry,
        snapshot,
        conversation,
        brief,
        revision,
        false,
        None,
        Some(opening),
    )
}

#[allow(clippy::too_many_arguments)]
fn accept_turn(
    db: &Connection,
    registry: &crate::configuration::Registry,
    snapshot: &Snapshot,
    conversation_id: &str,
    text: &str,
    expected_revision: i32,
    coach: bool,
    replaced: Option<&str>,
    opening: Option<&Opening>,
) -> Result<String> {
    if text.trim().is_empty() || text.chars().count() > 20000 || text.contains('\0') {
        return Err(fail("A message must contain 1–20,000 characters."));
    }
    let conversation = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation_id)
        .ok_or_else(|| fail("Conversation no longer exists."))?;
    if conversation.revision != expected_revision {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Conversation changed. Refresh before sending.",
        ));
    }
    let contact = snapshot
        .contacts
        .iter()
        .find(|r| r.id == conversation.contact_id)
        .ok_or_else(|| fail("Contact not found."))?;
    if conversation.archived || contact.archived {
        return Err(fail("Restore the conversation and persona before sending."));
    }
    let persona = snapshot
        .personas
        .iter()
        .find(|p| p.id == contact.persona_id)
        .ok_or_else(|| fail("Persona not found."))?;
    if db.query_row(
        "SELECT EXISTS(SELECT 1 FROM turns WHERE conversation_id=?1 AND state='pending')",
        [conversation_id],
        |r| r.get::<_, bool>(0),
    )? {
        return Err(fail("This conversation already has an outstanding reply."));
    }
    let profile = config(db)?;
    if !profile.configured {
        return Err(fail(
            "Configure the selected AI route in Settings before sending.",
        ));
    }
    let credential = active_credential(db)?.ok_or_else(|| {
        fail("Sign in with Google or configure the selected connection in Settings before sending.")
    })?;
    let language = registry.language(&conversation.language_id)?;
    let language_context = registry.resolve_pair(
        &conversation.language_id,
        Some(&conversation.settings.variety_id),
        &conversation.settings.explanation_language,
        Some(&conversation.settings.explanation_variety_id),
    )?;
    let settings = serde_json::to_string(&conversation.settings)?;
    let mut system = crate::conversations::conversation_prompt::system(
        registry,
        &language_context,
        &conversation.settings,
        &persona.details,
        opening.is_some(),
        conversation_id,
    )?;
    let channel = if coach {
        "coach_reply"
    } else {
        "persona_reply"
    };
    if coach {
        let exchange = db.prepare("SELECT m.role,m.text FROM messages m WHERE m.conversation_id=?1 AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=m.turn_id) AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=m.turn_id AND o.kind IN ('persona_reply','persona_opening')) ORDER BY m.sequence DESC LIMIT 20")?.query_map([conversation_id],|r|Ok(PromptMessage{role:r.get(0)?,content:r.get(1)?}))?.collect::<rusqlite::Result<Vec<_>>>()?;
        let saved: Vec<String> = db.prepare("SELECT t.context FROM turns t WHERE t.conversation_id=?1 AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id) AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=t.id AND o.kind IN ('persona_reply','persona_opening')) ORDER BY t.rowid DESC LIMIT 4")?.query_map([conversation_id], |r|r.get(0))?.collect::<rusqlite::Result<_>>()?;
        let support = saved.iter().map(|s| -> Result<serde_json::Value> { let v: serde_json::Value=serde_json::from_str(s)?; Ok(serde_json::json!({"feedback":v["conversation_feedback"],"assistance":v["reply_assistance"],"explanations":v["reply_explanations"]})) }).collect::<Result<Vec<_>>>()?;
        system = crate::conversations::coach_prompt::system(
            &language.name,
            &conversation.settings.explanation_language,
            &settings,
            &serde_json::to_string(&exchange)?,
            &serde_json::to_string(&support)?,
            &language_context,
        );
    }
    let focus = crate::learning::learner::progression::capture_focus(
        db,
        registry,
        &snapshot.session_id,
        &conversation.language_id,
    )?;
    let retry = if let Some(replaced) = replaced {
        crate::learning::coaching::coach_policy::retry_context(db, replaced)?
    } else {
        None
    };
    let mut focus_ids: Vec<String> = focus["id"]
        .as_str()
        .map(str::to_owned)
        .into_iter()
        .collect();
    if let Some(retry) = &retry
        && let Some(id) = retry["item"]["construct"].as_str()
    {
        focus_ids.push(id.into());
    }
    let tokens: Vec<String> = text.split_whitespace().map(str::to_lowercase).collect();
    let candidates = registry.candidates(
        &language_context,
        crate::conversations::openers::band(&conversation.settings.difficulty),
        &focus_ids,
        &[],
        &tokens,
    )?;

    let mut history=db.prepare("SELECT role,text,id FROM messages m WHERE conversation_id=?1 AND (?3 IS NULL OR m.turn_id!=?3) AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=m.turn_id) AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=m.turn_id AND (o.kind=?2 OR (?2='persona_reply' AND o.kind='persona_opening'))) ORDER BY sequence DESC LIMIT 40")?.query_map(params![conversation_id,channel,replaced],|r|Ok((PromptMessage{role:r.get(0)?,content:r.get(1)?},r.get::<_,String>(2)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
    history.reverse();
    let mut context = vec![PromptMessage {
        role: "system".into(),
        content: system,
    }];
    let source_ids: Vec<String> = history.iter().map(|(_, id)| id.clone()).collect();
    context.extend(history.into_iter().map(|(message, _)| message));
    if opening.is_none() {
        context.push(PromptMessage {
            role: "user".into(),
            content: text.into(),
        });
    }
    if context.iter().map(|m| m.content.len()).sum::<usize>() > 96000 {
        return Err(fail(
            "The selected context exceeds the 96 KB input budget. Start a separate conversation or shorten this message.",
        ));
    }
    let turn = id();
    let target = crate::ai::connections::access::resolve(
        db,
        crate::ai::connections::access::Capability::Chat,
    )?;
    crate::ai::policy::holds::check(db, &target)?;
    let speech_enabled = !coach && conversation.settings.read_aloud;
    let speech_target = if speech_enabled {
        Some(crate::ai::connections::access::resolve(
            db,
            crate::ai::connections::access::Capability::Speech,
        )?)
    } else {
        None
    };
    if let Some(target) = &speech_target {
        crate::ai::policy::holds::check(db, target)?;
    }
    let plan = if coach {
        COACH_PLAN
    } else if opening.is_some() {
        OPENING_PLAN
    } else {
        PLAN
    };
    admit_network_work(
        db,
        plan.iter()
            .filter(|node| node.role != "local" && node.activation.enabled(speech_enabled))
            .count() as i64,
    )?;
    let coach_sources = db.prepare("SELECT id,role,text FROM messages m WHERE conversation_id=?1 AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=m.turn_id AND o.kind='coach_reply') ORDER BY sequence DESC LIMIT 8")?.query_map([conversation_id], |r| Ok(serde_json::json!({"id":r.get::<_,String>(0)?,"role":r.get::<_,String>(1)?,"text":r.get::<_,String>(2)?})))?.collect::<rusqlite::Result<Vec<_>>>()?;
    let captured = serde_json::json!({"skillCriteria":registry.constructs().iter().map(|c|serde_json::json!({"id":c.id,"criterion":c.criterion})).collect::<Vec<_>>(),"skillAssessmentPromptVersion":crate::learning::coaching::skill_assessment::VERSION,"gamePolicy":registry.game_policy(),"gamePolicyHash":registry.game_hash(),"languageContext":language_context,"configHash":registry.hash(),"constructRegistryHash":crate::learning::coaching::construct_hash(registry),"candidateConstructs":candidates,"candidatesSent":candidates.len(),"feedbackPolicy":registry.feedback_policy(),"coachRetry":retry,"opening":opening,"practiceFocus":focus,"catalogVersion":crate::learning::coaching::version_for(registry),"coachSources":coach_sources,"practiceSettings":conversation.settings,"speechEnabled":speech_enabled,"speechTarget":speech_target,"speechVoice":conversation.settings.speech_voice,"target":target,"messages":context,"sourceIds":source_ids,"targetLanguage":conversation.language_id,"translationLanguage":conversation.settings.explanation_language,"translationEnabled":conversation.settings.translation,"settingsRevision":conversation.settings_revision,"personaRevision":persona.revision,"templateVersion":crate::conversations::conversation_prompt::VERSION,"conversationSupportPromptVersion":"conversation-support-5","coachFeedbackPromptVersion":crate::learning::coaching::FEEDBACK_PROMPT_VERSION,"coachSuggestionsPromptVersion":crate::learning::coaching::SUGGESTIONS_PROMPT_VERSION,"selectionPolicy":"recent-40-bounded-96kb-v1","routingPolicy":"task-models-v1","fastModel":profile.fast_model});
    db.execute("INSERT INTO turns(id,conversation_id,state,paused,profile_revision,credential_id,model,context,route) VALUES(?1,?2,'pending',0,?3,?4,?5,?6,?7)",params![turn,conversation_id,profile.revision,credential,target.model,serde_json::to_string(&captured)?,profile.route.label()])?;
    if opening.is_none() {
        db.execute("INSERT INTO messages(id,conversation_id,turn_id,sequence,role,text) SELECT ?1,?2,?3,COALESCE(MAX(sequence),0)+1,'user',?4 FROM messages WHERE conversation_id=?2",params![id(),conversation_id,turn,text])?;
    }
    for node in plan {
        if !node.activation.enabled(speech_enabled) {
            continue;
        }
        db.execute(
            "INSERT INTO operations(id,turn_id,kind,state) VALUES(?1,?2,?3,?4)",
            params![
                id(),
                turn,
                node.kind,
                if node.dependencies.is_empty() {
                    "ready"
                } else {
                    "waiting_dependencies"
                }
            ],
        )?;
    }
    db.execute(
        "UPDATE conversations SET revision=revision+1,last_used=MAX(CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),COALESCE((SELECT MAX(last_used) FROM conversations),0)+1) WHERE id=?1",
        params![conversation_id],
    )?;
    Ok(turn)
}

pub fn control_turn(db: &Connection, turn: &str, control: TurnControl) -> Result<String> {
    let (conversation, state): (String, String) = db
        .query_row(
            "SELECT conversation_id,state FROM turns WHERE id=?1",
            [turn],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| fail("Turn no longer exists."))?;
    match control {
        TurnControl::Cancel => {
            if state != "pending" && state != "assisting" {
                return Err(fail("Only pending turns can be cancelled."));
            }
            db.execute("UPDATE turns SET state='cancelled' WHERE id=?1", [turn])?;
            db.execute("UPDATE operations SET state='cancelled',permit=0 WHERE turn_id=?1 AND state!='succeeded'",[turn])?;
            db.execute("UPDATE attempts SET state='cancelled',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),error='Cancelled locally; provider execution and billing may continue.' WHERE operation_id IN (SELECT id FROM operations WHERE turn_id=?1) AND state='running'",[turn])?;
        }
        TurnControl::Pause | TurnControl::Resume => {
            if state != "pending" && state != "assisting" {
                return Err(fail("This turn is not pending."));
            }
            if matches!(control, TurnControl::Resume) {
                release_hold(db, turn, false)?;
            }
            db.execute(
                "UPDATE turns SET paused=?2 WHERE id=?1",
                params![turn, matches!(control, TurnControl::Pause)],
            )?;
            db.execute("UPDATE operations SET permit=0 WHERE turn_id=?1", [turn])?;
        }
        TurnControl::Step => {
            release_hold(db, turn, true)?;
            if (state != "pending" && state != "assisting") || config(db)?.paused {
                return Err(fail(
                    "Resume the app-wide gate before stepping a pending turn.",
                ));
            }
            let operation: Option<String>=db.query_row("SELECT id FROM operations WHERE turn_id=?1 AND state='ready' AND permit=0 ORDER BY rowid LIMIT 1",[turn],|r|r.get(0)).optional()?;
            let operation = operation.ok_or_else(|| {
                fail("No operation is ready to step; it may be running or waiting on a dependency.")
            })?;
            let running: i32 = db.query_row(
                "SELECT count(*) FROM operations WHERE state='running'",
                [],
                |r| r.get(0),
            )?;
            if running >= crate::ai::policy::admission::NETWORK_CAPACITY as i32 {
                return Err(fail(
                    "Execution capacity is occupied. Step again after an attempt ends.",
                ));
            }
            db.execute("UPDATE turns SET paused=1 WHERE id=?1", [turn])?;
            db.execute("UPDATE operations SET permit=1 WHERE id=?1", [operation])?;
        }
        TurnControl::Retry => {
            if state != "failed" && state != "unknown" {
                return Err(fail("Only a failed or unknown turn can be retried."));
            }
            if db.query_row("SELECT EXISTS(SELECT 1 FROM turns WHERE conversation_id=?1 AND rowid>(SELECT rowid FROM turns WHERE id=?2)) AND NOT EXISTS(SELECT 1 FROM messages WHERE turn_id=?2 AND role='assistant')",params![conversation,turn],|r|r.get::<_,bool>(0))? { return Err(fail("A later turn exists. Start a new exchange instead of inserting a reply into an earlier exchange.")); }
            admit_turn_retry(db, turn)?;
            connections::bind_retry(db, turn, None)?;
            db.execute("UPDATE turns SET state=CASE WHEN EXISTS(SELECT 1 FROM operations WHERE turn_id=?1 AND kind IN ('persona_reply','persona_opening','coach_reply') AND state IN ('ready','waiting_dependencies','running')) THEN 'pending' ELSE 'assisting' END WHERE id=?1", [turn])?;
            db.execute("UPDATE operations SET state='ready',permit=0 WHERE turn_id=?1 AND state IN ('failed','unknown') AND kind!='persona_speech'",[turn])?;
        }
    }
    Ok(conversation)
}
