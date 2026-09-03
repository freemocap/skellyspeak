//! The analysis pass: four small one-shot calls about the tutor's reply, plus
//! the learner-message call that started earlier, merged into one result.
//!
//! Each sub-call is tiny (100–500 output tokens), so the wall time is the
//! slowest single call rather than one serialized dump — and each hydrates the
//! pane the moment it lands instead of waiting for its siblings.

use log::{info, warn};
use serde::de::DeserializeOwned;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};
use tokio::task::JoinHandle;

use crate::ai::Provider;
use crate::ontology;
use crate::trace::RunContext;
use crate::AppState;

use super::types::{
    emit, GuidedEvent, GuidedTurnResult, LearnerTokensOut, MechanicsOut, Scaffolds, ScaffoldsOut,
    Section, TokensOut, TranslationOut,
};

/// How many mechanic titles the anti-repetition ledger remembers.
const RECENT_MECHANICS_CAP: usize = 20;

/// Everything the analysis pass needs, gathered by the caller before the reply
/// even finishes so the pass can start the moment it does.
pub(super) struct AnalysisPass {
    pub app: AppHandle,
    pub channel: Channel<GuidedEvent>,
    pub provider: Provider,
    pub turn_id: u64,
    pub reply: String,
    pub tokens_msgs: Vec<serde_json::Value>,
    pub translation_msgs: Vec<serde_json::Value>,
    pub mechanics_msgs: Vec<serde_json::Value>,
    pub scaffolds_msgs: Vec<serde_json::Value>,
    /// Already in flight: it depends only on the learner's message, so it was
    /// started alongside the reply rather than after it.
    pub learner_tokens: Option<JoinHandle<Result<LearnerTokensOut, String>>>,
}

/// One analysis sub-call.
///
/// Runs it, and the moment it lands pushes just that section to the webview so
/// the pane fills in progressively. The handle is returned so the caller can
/// merge the authoritative result — the section emit is hydration, not the
/// record.
#[allow(clippy::too_many_arguments)]
fn spawn_section<T, V, S>(
    provider: Provider,
    channel: Channel<GuidedEvent>,
    ctx: RunContext,
    messages: Vec<serde_json::Value>,
    temperature: f64,
    schema: &'static str,
    validate: V,
    section: S,
) -> JoinHandle<Result<T, String>>
where
    T: DeserializeOwned + schemars::JsonSchema + Send + 'static,
    V: Fn(&T) -> Option<String> + Send + 'static,
    S: Fn(&T) -> Section + Send + 'static,
{
    tokio::spawn(async move {
        let result = provider
            .structured_validated::<T, _>(ctx, &messages, temperature, schema, false, None, validate)
            .await;
        if let Ok(out) = &result {
            emit(&channel, section(out).into());
        }
        result
    })
}

/// A sub-call that failed costs its own section and nothing else. The reason
/// is kept and shown in the analysis pane — degradation is never silent.
fn degrade<T>(result: Result<T, String>, label: &str, failures: &mut Vec<String>) -> Option<T> {
    match result {
        Ok(value) => Some(value),
        Err(e) => {
            failures.push(format!("{label}: {e}"));
            None
        }
    }
}

/// Wait for a sub-call, turning a panicked task into an ordinary failure so it
/// degrades like any other rather than taking the whole pass down.
async fn joined<T>(handle: JoinHandle<Result<T, String>>, what: &str) -> Result<T, String> {
    handle
        .await
        .unwrap_or_else(|e| Err(format!("{what} task panicked: {e}")))
}

pub(super) fn spawn(pass: AnalysisPass) {
    tokio::spawn(async move {
        let started = std::time::Instant::now();
        let AnalysisPass {
            app,
            channel,
            provider,
            turn_id,
            reply,
            tokens_msgs,
            translation_msgs,
            mechanics_msgs,
            scaffolds_msgs,
            learner_tokens,
        } = pass;

        let tokens_task = spawn_section::<TokensOut, _, _>(
            provider.clone(),
            channel.clone(),
            RunContext::new(ontology::op::TOKENIZE, Some(turn_id)),
            tokens_msgs,
            0.1,
            "TokensOut",
            |t: &TokensOut| {
                if t.tokens.is_empty() {
                    return Some("tokens must not be empty".into());
                }
                // A "token" longer than a long word means the model returned
                // prose instead of a tokenization.
                t.tokens
                    .iter()
                    .find(|tok| tok.text.chars().count() > 48)
                    .map(|bad| {
                        format!(
                            "each token must be ONE word with its punctuation attached \
                             ('{}...' is far too long). Split the reply word by word and \
                             return only the structured tokenization, no explanations.",
                            bad.text.chars().take(24).collect::<String>()
                        )
                    })
            },
            |t: &TokensOut| Section {
                tokens: Some(t.tokens.clone()),
                ..Section::default()
            },
        );

        let translation_task = spawn_section::<TranslationOut, _, _>(
            provider.clone(),
            channel.clone(),
            RunContext::new(ontology::op::TRANSLATE, Some(turn_id)),
            translation_msgs,
            0.2,
            "TranslationOut",
            |t: &TranslationOut| {
                (t.translation.trim().is_empty()).then(|| "translation must not be empty".into())
            },
            |t: &TranslationOut| Section {
                translation: Some(t.translation.clone()),
                ..Section::default()
            },
        );

        let mechanics_task = spawn_section::<MechanicsOut, _, _>(
            provider.clone(),
            channel.clone(),
            RunContext::new(ontology::op::EXPLAIN, Some(turn_id)),
            mechanics_msgs,
            0.4,
            "MechanicsOut",
            |m: &MechanicsOut| {
                (m.mechanics.is_empty())
                    .then(|| "mechanics must not be empty - every reply teaches something".into())
            },
            |m: &MechanicsOut| Section {
                mechanics: Some(m.mechanics.clone()),
                ..Section::default()
            },
        );

        let scaffolds_task = spawn_section::<ScaffoldsOut, _, _>(
            provider,
            channel.clone(),
            RunContext::new(ontology::op::SUGGEST, Some(turn_id)),
            scaffolds_msgs,
            0.6,
            "ScaffoldsOut",
            |sc: &ScaffoldsOut| {
                (sc.replies.is_empty() || sc.frames.is_empty() || sc.starters.is_empty())
                    .then(|| "all three scaffold lists must be populated".into())
            },
            |sc: &ScaffoldsOut| Section {
                scaffolds: Some(Scaffolds {
                    replies: sc.replies.clone(),
                    frames: sc.frames.clone(),
                    starters: sc.starters.clone(),
                }),
                ..Section::default()
            },
        );

        // Awaiting in sequence does NOT serialize the work: every task above is
        // already running on the runtime, so this collects results in a fixed
        // order and the wall time is the slowest call, not their sum.
        let tokens_out = joined(tokens_task, "tokens").await;
        let translation_out = joined(translation_task, "translation").await;
        let mechanics_out = joined(mechanics_task, "mechanics").await;
        let scaffolds_out = joined(scaffolds_task, "scaffolds").await;
        let learner_out = match learner_tokens {
            Some(handle) => joined(handle, "user tokens").await,
            // Not a failure: this turn carried no learner message to analyse.
            None => Ok(LearnerTokensOut {
                tokens: Vec::new(),
                translation: String::new(),
            }),
        };

        let mut failures: Vec<String> = Vec::new();
        let tokens = degrade(tokens_out, "tokens", &mut failures)
            .map(|t| t.tokens)
            .unwrap_or_default();
        let translation = degrade(translation_out, "translation", &mut failures).map(|t| t.translation);
        let mechanics = degrade(mechanics_out, "mechanics", &mut failures)
            .map(|m| m.mechanics)
            .unwrap_or_default();
        let scaffolds = degrade(scaffolds_out, "scaffolds", &mut failures)
            .map(|sc| Scaffolds {
                replies: sc.replies,
                frames: sc.frames,
                starters: sc.starters,
            })
            .unwrap_or_default();
        let (user_tokens, user_translation) = match degrade(learner_out, "your words", &mut failures)
        {
            Some(t) => (t.tokens, Some(t.translation)),
            None => (Vec::new(), None),
        };

        if failures.is_empty() {
            info!(
                "[cmd] guided analysis done in {:.1}s: tokens={} mechanics={}",
                started.elapsed().as_secs_f32(),
                tokens.len(),
                mechanics.len(),
            );
        } else {
            warn!(
                "[cmd] guided analysis partially degraded in {:.1}s: {}",
                started.elapsed().as_secs_f32(),
                failures.join("; "),
            );
        }

        // Record taught mechanics so future analyses never repeat them.
        {
            let state = app.state::<AppState>();
            let mut recent = state
                .recent_mechanics
                .lock()
                .unwrap_or_else(|p| p.into_inner());
            for mech in &mechanics {
                recent.push(mech.title.clone());
            }
            let overflow = recent.len().saturating_sub(RECENT_MECHANICS_CAP);
            recent.drain(0..overflow);
        }

        emit(
            &channel,
            GuidedEvent::AnalysisDone {
                turn: GuidedTurnResult {
                    reply,
                    translation,
                    tokens,
                    user_tokens,
                    user_translation,
                    mechanics,
                    scaffolds,
                    errors: failures,
                },
            },
        );
    });
}
