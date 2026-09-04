//! One turn of conversation.
//!
//! The command does one thing itself — stream the tutor's reply, which is what
//! the learner is waiting for — and then hands three background passes what
//! they need and returns. Analysis, coach and observer all land later through
//! the event channel, so the learner can keep typing.

mod analysis;
mod coach_pass;
mod observer_pass;
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
    level: Option<String>,
    topic: Option<String>,
    // Which character the learner is talking to, and the conversation this
    // turn belongs to. `chat_id` is what makes "surprise me" resolve to one
    // person per conversation instead of a new one every turn.
    persona: Option<String>,
    chat_id: String,
    on_event: Channel<GuidedEvent>,
) -> Result<String, String> {
    let settings = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
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
    // Learner-selected level (steer row) maps to CEFR for every prompt.
    let cefr = match level.as_deref() {
        Some("zero") => "PRE-A1",
        Some("intermediate") => "B1",
        Some("advanced") => "C1",
        _ => "A2",
    }
    .to_string();
    // The topic the learner picked. The REPLY takes it as its own prompt
    // section (`prompts::partner::topic_section`) rather than as one more line at
    // bottom of the staging notes — buried behind the whole teaching plan it
    // was routinely ignored, which is exactly the "I changed the topic and it
    // never came up" complaint. Mechanics and scaffolds still take it as a
    // directive, because for them it genuinely is a hint.
    let topic = topic.filter(|t| !t.trim().is_empty());
    let topic_directive = prompts::partner::topic_directive(topic.as_deref());

    // Who the learner is talking to. `chat_id` is the seed for "surprise me",
    // so the partner is one consistent person for a whole conversation and
    // somebody else in the next one.
    let mut persona_faults = Vec::new();
    let available = crate::personas::all(&state.config_dir, &mut persona_faults);
    // A personas file that could not be read reaches the screen rather than a
    // log: the learner's own characters are missing from this conversation and
    // they have to be told why.
    for fault in persona_faults {
        emit(&on_event, GuidedEvent::Fault { context: "Personas".into(), message: fault });
    }
    let persona = crate::personas::resolve(persona.as_deref(), &chat_id, &available);
    info!("[cmd] guided_turn partner: {} ({})", persona.label, persona.id);

    // ── Pass 1: conversational reply (streamed to the UI) ───────────────────
    // The reply gets the overlay and the plan; the topic line is appended for
    // the mechanics and scaffolds passes only, because the reply already
    // carries the topic as a section of its own and stating it twice is how a
    // prompt argues with itself.
    let reply_directives = {
        let plan = state.plan.lock().unwrap_or_else(|p| p.into_inner());
        let recent = state
            .recent_mechanics
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        format!(
            "{}{}",
            target_overlay,
            prompts::observer::directives_block(&plan, &recent)
        )
    };
    let directives = format!("{reply_directives}{topic_directive}");
    let reply_system = prompts::partner::reply_prompt(
        &persona.sketch,
        &tln,
        &cefr,
        &native,
        topic.as_deref(),
        &reply_directives,
    );
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
            "content": prompts::partner::greeting_turn(topic.as_deref())
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
            json!({"role": "system", "content": prompts::analysis::learner_tokens_prompt(&tln, &native, romanization_scheme)}),
            json!({"role": "user", "content": prompts::analysis::analyze_learner_turn(&learner_message)}),
        ];
        Some(tokio::spawn(async move {
            let result = provider
                .structured_validated::<LearnerTokensOut, _>(
                    RunContext::new(ontology::op::TOKENIZE_LEARNER, Some(turn_id)),
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
            RunContext::new(ontology::op::REPLY, Some(turn_id)),
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
            let msg = format!("reply failed: {e}");
            if msg.contains("429") {
                "The tutor hit a rate limit — give it a few seconds and try again.".into()
            } else {
                msg
            }
        })?;
    let reply = sanitize_reply(&full_reply);
    if reply.is_empty() {
        return Err("The tutor returned an empty reply. Please try again.".into());
    }
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
    if observer_pass::try_claim_slot(&state) {
        let transcript: Vec<String> = history
            .iter()
            .map(|t| format!("{}: {}", if t.role == "user" { "L" } else { "T" }, t.content))
            .chain(std::iter::once(format!("L: {learner_message}")))
            .chain(std::iter::once(format!("T: {reply}")))
            .collect();
        observer_pass::spawn(observer_pass::ObserverPass {
            app: app.clone(),
            channel: on_event.clone(),
            turn_id,
            tln: tln.clone(),
            transcript,
            model: settings
                .observer_model
                .clone()
                .unwrap_or_else(crate::settings::default_observer_model),
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
        app: app.clone(),
        channel: on_event.clone(),
        provider: worker_provider.clone(),
        turn_id,
        reply: reply.clone(),
        tokens_msgs: vec![
            json!({"role": "system", "content": prompts::analysis::tokens_prompt(&tln, &native, romanization_scheme)}),
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
        scaffolds_msgs: vec![
            json!({"role": "system", "content": prompts::analysis::scaffolds_prompt(&tln, &native, &directives)}),
            json!({"role": "user", "content": prompts::analysis::scaffolds_turn(&learner_message, &reply)}),
        ],
        learner_tokens: learner_tokens_task,
    });

    // ── Coach pass: private feedback on what the learner said ───────────────
    if has_learner_message {
        let trimmed = message.trim().to_string();
        coach_pass::spawn(coach_pass::CoachPass {
            app,
            channel: on_event.clone(),
            provider: worker_provider,
            turn_id,
            tln,
            native,
            transcript: coach_pass::transcript(&history),
            message: trimmed,
            topic,
        });
    }

    Ok(reply)
}
