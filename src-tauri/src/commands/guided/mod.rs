//! One turn of conversation.
//!
//! The command does one thing itself — stream the tutor's reply, which is what
//! the learner is waiting for — and then hands three background passes what
//! they need and returns. Analysis, coach and observer all land later through
//! the event channel, so the learner can keep typing.

mod analysis;
mod coach_pass;
mod observer_pass;
mod skill_pass;
mod types;

use log::info;
use serde_json::json;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};

use crate::languages::{self, language_display, native_display, overlay};
use crate::ontology;
use crate::prompts;
use crate::trace::{self, RunContext};
use crate::AppState;

pub use types::{
    emit, ChatTurn, GuidedEvent, GuidedToken, GuidedTurnResult, LearnerTokensOut, Mechanic,
    MechanicsOut, Scaffolds, ScaffoldsOut, TokensOut, TranslationOut,
};
pub(super) use types::sanitize_reply;
use types::Section;

/// How much history each pass is given. The reply needs the conversation; the
/// analysis calls need only the turn in front of them.
const REPLY_HISTORY_TURNS: usize = 30;

/// How much room the conversational reply gets.
///
/// This is the only call in the app where the *least likely* wording is
/// usually the better one. At 0.6 the partner reliably reached for the safest
/// sentence available, which across a whole conversation reads as a person
/// with nothing to say. Every other pass in this file stays low on purpose —
/// tokenization, translation and the coach's corrections all want the boring
/// answer, and they keep it.
const REPLY_TEMPERATURE: f64 = 0.95;

/// The learner's message as the passes refer to it. Greeting and steering
/// turns have no real message, so they carry a placeholder that reads sensibly
/// inside a prompt.
fn learner_message(greeting: bool, steering: Option<&str>, message: &str) -> String {
    if greeting {
        "(session start)".to_string()
    } else if let Some(change) = steering.filter(|s| !s.trim().is_empty()) {
        format!("(changed practice settings: {change})")
    } else {
        message.trim().to_string()
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn guided_turn(
    app: AppHandle,
    state: State<'_, AppState>,
    message: String,
    history: Vec<ChatTurn>,
    greeting: bool,
    // Present when the learner changed practice settings — the partner
    // sends a re-opening message aligned to the new level/topic instead of
    // answering a learner message.
    steering: Option<String>,
    level: crate::prompts::difficulty::Difficulty,
    topic: Option<String>,
    // The chat owns its saved character; turns never select a template.
    chat_id: String,
    message_id: u64,
    history_available: usize,
    replaces_message_id: Option<u64>,
    mut input_evidence: crate::skills::InputEvidence,
    on_event: Channel<GuidedEvent>,
) -> Result<String, String> {
    let (epoch, settings, plan_snapshot, recent_snapshot, level_notes, lesson, chat, partner, skill_block) = {
        let epoch = state.context_epoch.lock().expect("context lock poisoned");
        let settings = state.settings.lock().expect("settings lock poisoned").clone();
        let pair = crate::conversation::pair_dir(&state.config_dir, &settings.target_language, &settings.native_language)?;
        if crate::conversation::current_chat(&pair)?.as_deref() != Some(chat_id.as_str()) {
            return Err("The conversation changed before this turn started.".into());
        }
        let chat = crate::conversation::chat_dir(&pair, &chat_id)?;
        let partner = crate::conversation_partner::load(&chat)?;
        let lesson = crate::lesson::load(&pair)?;
        let evidence = crate::skills::snapshot(&state.config_dir, &settings.target_language)?;
        let profile = crate::skills::progress::project(&evidence, crate::skills::progress::load(&state.config_dir, &settings.target_language)?)?;
        let skill_block = prompts::skills::practice(&evidence, &profile)?;
        (*epoch,
         settings,
         state.plan.lock().expect("plan lock poisoned").clone(),
         state.recent_mechanics.lock().expect("mechanics lock poisoned").clone(),
         state.profile.lock().expect("profile lock poisoned").level_notes.clone(), lesson, chat, partner, skill_block)
    };
    let started = std::time::Instant::now();
    // Every run fired by this turn shares a turn id, so the UI can group
    // them into "what happened when you sent that message".
    let turn_id = trace::next_turn_id();
    let target = settings.target_language.clone();
    info!(
        "[cmd] guided_turn start: greeting={greeting} message_len={} history={} target={target}",
        message.len(),
        history.len(),
    );
    let tln = language_display(&target);
    let native = native_display(&settings.native_language);
    let target_overlay = overlay(&target, Some(settings.target_dialect.as_str()));
    // Non-Latin targets get a romanization alongside every gloss; the scheme
    // is the language's, not the prompt's.
    let romanization_scheme = languages::romanization(&target);
    let word_delimited = languages::word_delimited(&target);
    // Learner-selected level (steer row) maps to CEFR for every prompt.
    let cefr = level.cefr().to_string();
    // The topic the learner picked. The REPLY takes it as its own prompt
    // section (`prompts::partner::topic_section`) rather than as one more line at
    // bottom of the staging notes — buried behind the whole teaching plan it
    // was routinely ignored, which is exactly the "I changed the topic and it
    // never came up" complaint. Mechanics and scaffolds still take it as a
    // directive, because for them it genuinely is a hint.
    let topic = topic.filter(|t| !t.trim().is_empty());
    let topic_directive = prompts::partner::topic_directive(topic.as_deref());

    let request_context = crate::instruction::Context {
        chat_id: chat_id.clone(), message_id: Some(message_id), replaces_message_id,
        trigger: if greeting { "greeting" } else if steering.is_some() { "steering" } else if replaces_message_id.is_some() { "edit_resend" } else { "learner_message" }.into(),
        target: target.clone(), native: settings.native_language.clone(), dialect: settings.target_dialect.clone(), provider_mode: settings.provider_mode.clone(),
        difficulty: level, inferred_level_notes: level_notes.clone(), topic: topic.clone(),
        lesson_revision: lesson.revision, partner: serde_json::to_value(&partner).map_err(|e| e.to_string())?,
        history_messages: history.len().min(REPLY_HISTORY_TURNS), history_available,
    };
    info!("[cmd] guided_turn saved partner: {} ({})", partner.persona.label, partner.persona.id);

    // ── Pass 1: conversational reply (streamed to the UI) ───────────────────
    // The reply gets the overlay and the plan; the topic line is appended for
    // the mechanics and scaffolds passes only, because the reply already
    // carries the topic as a section of its own and stating it twice is how a
    // prompt argues with itself.
    let learner_directives = lesson.choices.directives();
    let reply_directives = format!("{}{}{}", target_overlay, prompts::observer::directives_block(&plan_snapshot, &recent_snapshot), learner_directives);
    let directives = format!("{target_overlay}{topic_directive}{learner_directives}\n{}", skill_block.content);
    let mut reply_blocks = prompts::partner::reply_blocks(
        &partner.persona.sketch,
        partner.introduction.as_deref(),
        &tln,
        &cefr,
        &native,
        topic.as_deref(),
        &reply_directives,
    );
    reply_blocks.pop();
    reply_blocks.extend([
        crate::instruction::Block::new("dialect", "languages.rs + captured settings", target_overlay.clone()),
        crate::instruction::Block::new("observations", "captured teaching plan and recent mechanics", prompts::observer::directives_block(&plan_snapshot, &recent_snapshot)),
        crate::instruction::Block::new("lesson_choices", "lesson.json at captured revision", learner_directives.clone()),
    ]);
    reply_blocks.push(skill_block.clone());
    let reply_system = crate::instruction::render(&reply_blocks);
    let mut reply_messages = vec![json!({"role": "system", "content": reply_system})];
    for turn in history.iter().rev().take(REPLY_HISTORY_TURNS).rev() {
        reply_messages.push(json!({"role": turn.role, "content": turn.content}));
    }
    if greeting {
        // The FIRST message sets whether this conversation is worth having, and
        // "greet the learner warmly and ask one simple opening question" is
        // precisely what produced "hello, how are you?" at the top of every
        // single chat. So the opener has to arrive mid-life: this person was
        // doing something before the learner turned up, and they lead with it.
        reply_messages.push(json!({
            "role": "user",
            "content": prompts::partner::greeting_turn()
        }));
    } else if let Some(change) = steering.as_deref().filter(|s| !s.trim().is_empty()) {
        // Learner changed practice settings mid-conversation: the partner
        // re-opens the exchange aligned to the new level/topic.
        reply_messages.push(json!({
            "role": "user",
            "content": prompts::partner::steering_turn(change)
        }));
    } else {
        if message.trim().is_empty() {
            return Err("Message is empty".into());
        }
        reply_messages.push(json!({"role": "user", "content": message}));
    }

    let learner_message = learner_message(greeting, steering.as_deref(), &message);
    // Whether the learner actually said something this turn. A greeting has no
    // learner output, and a steering turn carries an empty message with a
    // placeholder — asking a model to gloss "(session start)" produced
    // `"translation": "not applicable"`, correct per the no-information rule
    // and then rejected by the validator, costing a retry on every such turn.
    // The coach pass draws the same line for the same reason.
    let has_learner_message =
        !greeting && steering.as_deref().is_none_or(|s| s.trim().is_empty());

    // `tokenize_learner` reads ONLY the learner's message — see
    // `turn_plan::TURN_STEPS`, where its `needs` is `[LearnerMessage]`. So
    // it starts HERE, in parallel with the reply, instead of waiting for a
    // dependency it never had: worth ~700ms on the learner's own bubble.
    //
    // The graph draws that edge from the input node off the same
    // declaration, and `trace::reconcile` contradicts the edge if this ever
    // regresses to waiting.
    let learner_tokens_task = if !has_learner_message {
        None
    } else {
        let provider = settings.chat_provider(&settings.openrouter_model)?;
        let channel = on_event.clone();
        let learner_msgs = vec![
            json!({"role": "system", "content": prompts::analysis::learner_tokens_prompt(&tln, &native, romanization_scheme, word_delimited)}),
            json!({"role": "user", "content": prompts::analysis::analyze_learner_turn(&learner_message)}),
        ];
        let token_context = request_context.clone();
        Some(tokio::spawn(async move {
            let result = provider
                .structured_validated::<LearnerTokensOut, _>(
                    RunContext::new(ontology::op::TOKENIZE_LEARNER, Some(turn_id)).with_context(&token_context),
                    &learner_msgs,
                    0.1,
                    "LearnerTokensOut",
                    false,
                    None,
                    |t: &LearnerTokensOut| {
                        (t.tokens.is_empty() || t.translation.trim().is_empty())
                            .then(|| "tokens and translation must not be empty".into())
                    },
                )
                .await;
            if let Ok(out) = &result {
                emit(
                    &channel,
                    Section {
                        user_tokens: Some(out.tokens.clone()),
                        user_translation: Some(out.translation.clone()),
                        ..Section::default()
                    }
                    .into(),
                );
            }
            result
        }))
    };

    let provider = settings.chat_provider(&settings.openrouter_model)?;
    let channel = on_event.clone();
    let full_reply = provider
        .chat_streaming(
            RunContext::new(ontology::op::REPLY, Some(turn_id)).with_context(&request_context).with_blocks(reply_blocks),
            &reply_messages,
            REPLY_TEMPERATURE,
            &mut |delta| {
                emit(
                    &channel,
                    GuidedEvent::ReplyDelta {
                        text: delta.to_string(),
                    },
                );
            },
        )
        .await
        .map_err(|e| {
            if let Some(task) = &learner_tokens_task { task.abort(); }
            let msg = format!("reply failed: {e}");
            if msg.contains("429") {
                "The tutor hit a rate limit — give it a few seconds and try again.".into()
            } else {
                msg
            }
        })?;
    let reply = sanitize_reply(&full_reply);
    if reply.is_empty() {
        if let Some(task) = &learner_tokens_task { task.abort(); }
        return Err("The tutor returned an empty reply. Please try again.".into());
    }
    let identity_result = {
        let current_epoch = state.context_epoch.lock().expect("context lock poisoned");
        if *current_epoch != epoch {
            Err("The conversation context changed while the reply was being generated.".to_string())
        } else if partner.introduction.is_none() {
            crate::conversation_partner::establish(&chat, &reply)
        } else { Ok(()) }
    };
    if let Err(error) = identity_result {
        trace::application(turn_id, ontology::op::REPLY, "rejected_context_or_identity")?;
        if let Some(task) = &learner_tokens_task { task.abort(); }
        return Err(error);
    }
    trace::application(turn_id, ontology::op::REPLY, "reply_ready")?;
    info!(
        "[cmd] guided_turn reply ready in {:.1}s: reply_len={}",
        started.elapsed().as_secs_f32(),
        reply.len()
    );
    emit(
        &on_event,
        GuidedEvent::ReplyDone {
            reply: reply.clone(),
        },
    );
    // The command resolves HERE — the learner can keep talking immediately.
    // Everything below runs in the background and lands via the channel.

    // ── Observer pass: rewrites the plan and profile on its own cadence ─────
    let observer_due = {
        let context = state.context_epoch.lock().expect("context lock poisoned");
        if *context != epoch {
            if let Some(task) = learner_tokens_task { task.abort(); }
            return Err("Conversation changed while the reply was being generated.".into());
        }
        let mut turns = state.observer_turns.lock().expect("observer cadence lock poisoned");
        if has_learner_message { *turns += 1; }
        has_learner_message && (*turns - 1).is_multiple_of(4)
    };
    let observer_model = settings.observer_model.clone().unwrap_or_else(crate::settings::default_observer_model);
    let observer_provider = settings.chat_provider(&observer_model)?;
    if observer_due && observer_pass::try_claim_slot(&state) {
        let transcript: Vec<String> = history
            .iter()
            .map(|t| format!("{}: {}", if t.role == "user" { "L" } else { "T" }, t.content))
            .chain(std::iter::once(format!("L: {learner_message}")))
            .chain(std::iter::once(format!("T: {reply}")))
            .collect();
        observer_pass::spawn(observer_pass::ObserverPass {
            skill_block: skill_block.clone(),
            context: request_context.clone(),
            epoch,
            app: app.clone(),
            channel: on_event.clone(),
            turn_id,
            tln: tln.clone(),
            transcript,
            provider: observer_provider,
            pairing: (
                settings.target_language.clone(),
                settings.native_language.clone(),
            ),
        });
    }

    // ── Analysis pass: four small calls about the reply ─────────────────────
    // Resolved once here, not rebuilt per task: the provider is a single
    // decision and every analysis call shares it.
    let worker_provider = settings.chat_provider(&settings.openrouter_model)?;
    analysis::spawn(analysis::AnalysisPass {
        context: request_context.clone(),
        epoch,
        app: app.clone(),
        channel: on_event.clone(),
        provider: worker_provider.clone(),
        turn_id,
        reply: reply.clone(),
        tokens_msgs: vec![
            json!({"role": "system", "content": prompts::analysis::tokens_prompt(&tln, &native, romanization_scheme, word_delimited)}),
            json!({"role": "user", "content": prompts::analysis::tokenize_reply_turn(&reply)}),
        ],
        translation_msgs: vec![
            json!({"role": "system", "content": prompts::analysis::translation_prompt(&tln, &native)}),
            json!({"role": "user", "content": prompts::analysis::translate_reply_turn(&reply)}),
        ],
        mechanics_msgs: vec![
            json!({"role": "system", "content": prompts::analysis::mechanics_prompt(&tln, &cefr, &native, &directives)}),
            json!({"role": "user", "content": prompts::analysis::mechanics_turn(&cefr, &learner_message, &reply)}),
        ],
        scaffolds_blocks: prompts::analysis::scaffolds_blocks(&tln, &cefr, &native, &directives),
        scaffolds_msgs: vec![
            json!({"role": "system", "content": prompts::analysis::scaffolds_prompt(&tln, &cefr, &native, &directives)}),
            json!({"role": "user", "content": prompts::analysis::scaffolds_turn(&learner_message, &reply)}),
        ],
        learner_tokens: learner_tokens_task,
    });

    // ── Coach pass: private feedback on what the learner said ───────────────
    if has_learner_message {
        let trimmed = message.trim().to_string();
        input_evidence.revision |= replaces_message_id.is_some();
        skill_pass::spawn(skill_pass::SkillPass {
            app: app.clone(), channel: on_event.clone(), chat,
            context: request_context.clone(), provider: worker_provider.clone(), turn_id,
            message: trimmed.clone(), input: input_evidence,
            transcript: coach_pass::transcript(&history),
            reply: reply.clone(),
        });
        coach_pass::spawn(coach_pass::CoachPass {
            skill_block,
            context: request_context.clone(),
            app,
            channel: on_event.clone(),
            provider: worker_provider,
            turn_id,
            tln,
            native,
            transcript: coach_pass::transcript(&history),
            message: trimmed,
            level_notes,
            topic,
        });
    }

    Ok(reply)
}
