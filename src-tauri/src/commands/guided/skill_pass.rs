//! Evidence assessment runs after the reply without delaying the learner.
use tauri::{AppHandle, Emitter, Manager, ipc::Channel};
use crate::{ai::Provider, instruction, ontology::op, skills, trace, AppState};
use super::{emit, GuidedEvent};

pub(super) struct SkillPass {
    pub app: AppHandle,
    pub channel: Channel<GuidedEvent>,
    pub chat: std::path::PathBuf,
    pub context: instruction::Context,
    pub provider: Provider,
    pub turn_id: u64,
    pub message: String,
    pub input: skills::InputEvidence,
    pub transcript: Vec<String>,
    pub reply: String,
}

async fn evaluate(pass: &SkillPass) -> Result<(), String> {
    let state = pass.app.state::<AppState>();
    let record = skills::EvidenceRecord {
        attempt_id: uuid::Uuid::new_v4().to_string(), session_id: trace::session_id().into(),
        turn_id: pass.turn_id, message_id: pass.context.message_id.ok_or("Skill evaluation requires a learner message ID")?,
        replaces_message_id: pass.context.replaces_message_id, chat_id: pass.context.chat_id.clone(), learner_id: skills::LEARNER.into(),
        target: pass.context.target.clone(), native: pass.context.native.clone(), source: pass.message.clone(), input: pass.input.clone(),
        at_secs: crate::conversation::now_secs(), model: pass.provider.model.clone(), provider_mode: pass.context.provider_mode.clone(),
        catalog_version: skills::CATALOG_VERSION, prompt_version: skills::PROMPT_VERSION.into(), status: skills::Status::Pending, assessment: None, error: None,
    };
    let definitions = skills::catalog()?;
    let blocks = crate::prompts::skills::blocks(&definitions, &record.target, &record.native)?;
    let payload = serde_json::json!({
        "target_language": record.target, "native_language": record.native,
        "history_before_current_message": pass.transcript,
        "current_learner_message": record.source,
        "partner_reply_for_context_only": pass.reply,
        "input_provenance": record.input, "external_assistance": "unknown",
        "attempt_id": record.attempt_id,
    });
    {
        let _context = state.context_epoch.lock().expect("context lock poisoned");
        if !skills::begin(&pass.chat, &record)? { return Ok(()); }
    }
    pass.app.emit("skills:changed", &record.target).map_err(|e| e.to_string())?;
    let messages = vec![
        serde_json::json!({"role": "system", "content": instruction::render(&blocks)}),
        serde_json::json!({"role": "user", "content": payload.to_string()}),
    ];
    let mut context = pass.context.clone();
    context.history_messages = pass.transcript.len();
    let result = pass.provider.structured_validated::<skills::Assessment, _>(
        trace::RunContext::new(op::ASSESS_SKILLS, Some(pass.turn_id)).with_context(&context).with_blocks(blocks),
        &messages, 0.1, "SkillAssessment", false, Some(crate::ai::MaxTokens(8000)),
        |assessment| assessment.validate(&record.source, &definitions),
    ).await;
    let failure = result.as_ref().err().cloned();
    let applied = {
        let _context = state.context_epoch.lock().expect("context lock poisoned");
        skills::finish(&pass.chat, &record.attempt_id, result)?
    };
    trace::application(pass.turn_id, op::ASSESS_SKILLS, if !applied { "superseded_evidence_not_applied" } else if failure.is_some() { "assessment_failed_no_evidence" } else { "evidence_recorded_no_awards" })?;
    pass.app.emit("skills:changed", &record.target).map_err(|e| e.to_string())?;
    if let Some(error) = failure { return Err(error); }
    Ok(())
}

pub(super) fn spawn(pass: SkillPass) {
    tokio::spawn(async move {
        if let Err(message) = evaluate(&pass).await {
            emit(&pass.channel, GuidedEvent::Fault { context: "Skill evidence".into(), message });
        }
    });
}
