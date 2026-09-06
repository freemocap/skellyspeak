//! Run tracing — the observability substrate.
//!
//! One `Run` = one execution of one agent. Every AI call in the app produces
//! exactly one, built at the single chokepoint in `ai.rs` that every call
//! already passes through. Runs are retained in a bounded local archive, a
//! process-local ring for reconciliation, and the live trace bus.
//!
//! Design rules, from `skellyspeak-docs/docs/observability.md`:
//!
//! - **Recording is unconditional.** There is no "tracing enabled" flag —
//!   that would be exactly the dual-path, feature-flagged architecture the
//!   project forbids. Always record; choose only what to *show*.
//! - **`attempts` is a list, not a count.** The corrective-retry loop is one
//!   of the most interesting things the app does and it must be legible.
//!
//! # SECURITY
//!
//! **Record request PAYLOADS only — never headers.** `ai.rs` attaches the API
//! key with `.bearer_auth(...)`; anything that captured "the request" whole
//! would write key material to disk on every single call. Nothing in this
//! module may ever be handed a `RequestBuilder`, a header map, or a
//! `Provider` (which owns `api_key`).

use serde::Serialize;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

use crate::graph;
use crate::ontology::{self, Actor};

/// How many current-process runs remain available for reconciliation.
const RING_CAPACITY: usize = 300;

/// Event names on the trace bus. The webview listens for both.
///
/// A completed `Run` is the record; `RunStarted` exists because a run only
/// reaches the bus when it FINISHES, which is far too late to show "this is
/// working right now". Without the start event the UI can only flash a node
/// after its work is already over — motion while the system is idle, which
/// is exactly backwards.
pub const TRACE_EVENT: &str = "trace:run";
pub const TRACE_STARTED_EVENT: &str = "trace:run_started";

/// Announced when an operation begins, including its conversation ownership.
#[derive(Debug, Clone, Serialize)]
pub struct RunStarted {
    pub context: Option<crate::instruction::Context>,
    pub id: u64,
    pub turn_id: Option<u64>,
    pub operation: String,
    pub actor: Actor,
    pub label: String,
    pub model: String,
    pub started_at_ms: u64,
}

static NEXT_RUN_ID: AtomicU64 = AtomicU64::new(1);
static NEXT_TURN_ID: AtomicU64 = AtomicU64::new(1);
static RING: OnceLock<Mutex<VecDeque<Run>>> = OnceLock::new();
static EMITTER: OnceLock<tauri::AppHandle> = OnceLock::new();

fn ring() -> &'static Mutex<VecDeque<Run>> {
    RING.get_or_init(|| Mutex::new(VecDeque::with_capacity(RING_CAPACITY)))
}

/// Attach the trace bus to the running app. Called once from `lib.rs::setup`.
/// Runs are recorded whether or not this has happened — an unattached bus
/// means "no UI is listening" (unit tests, the bench harness), not a
/// degraded path.
static ARCHIVE: OnceLock<Mutex<crate::trace_archive::Archive>> = OnceLock::new();

pub fn attach(app: tauri::AppHandle, config: &std::path::Path) -> Result<(), String> {
    let archive = crate::trace_archive::Archive::open(config)?;
    let runs = archive.runs();
    NEXT_RUN_ID.store(runs.iter().filter_map(|r| r["id"].as_u64()).max().unwrap_or(0) + 1, Ordering::Relaxed);
    NEXT_TURN_ID.store(runs.iter().filter_map(|r| r["turn_id"].as_u64()).max().unwrap_or(0) + 1, Ordering::Relaxed);
    ARCHIVE.set(Mutex::new(archive)).map_err(|_| "AI trace archive already attached".to_string())?;
    EMITTER.set(app).map_err(|_| "AI trace bus already attached".to_string())?;
    Ok(())
}

pub fn retained() -> Vec<serde_json::Value> {
    match ARCHIVE.get() {
        Some(archive) => archive.lock().expect("trace archive lock poisoned").runs(),
        None => snapshot().iter().map(|r| serde_json::to_value(r).expect("trace serializes")).collect(),
    }
}
pub fn retention() -> serde_json::Value {
    serde_json::json!({"session_id": session_id(), "evicted": ARCHIVE.get().map(|a| a.lock().expect("trace archive lock poisoned").evicted()).unwrap_or(0), "max_runs": 300, "max_bytes": 8 * 1024 * 1024})
}

/// A fresh turn id, grouping every run fired by one conversational turn.
pub fn next_turn_id() -> u64 {
    NEXT_TURN_ID.fetch_add(1, Ordering::Relaxed)
}

/// What happened on ONE attempt. Every attempt is recorded, so the list
/// reads as the complete story of the run: `[Invalid, Ok]` is "it got it
/// wrong, we told it why, it fixed it".
///
/// These names are user-facing — they are what the disclosure modal will
/// call these events, so they describe the outcome of the attempt rather
/// than the mechanics of the retry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AttemptKind {
    /// This attempt succeeded.
    Ok,
    /// Provider rate limit — transient and expected under parallel bursts.
    RateLimited,
    /// The model emitted something that would not parse as JSON.
    Unparseable,
    /// It parsed, but failed our validation rules; the error went back to it.
    Invalid,
    /// A request-level failure that ended the run (auth, bad model, network).
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Ok,
    /// Succeeded, but only after at least one corrective retry.
    RetriedThenOk,
    Failed,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct Usage {
    pub prompt_tokens: Option<u64>,
    pub completion_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
    /// Provider-reported cost, when it volunteers one.
    pub cost: Option<f64>,
}

impl Usage {
    pub fn is_empty(&self) -> bool {
        self.prompt_tokens.is_none()
            && self.completion_tokens.is_none()
            && self.total_tokens.is_none()
            && self.cost.is_none()
    }

    /// Parse the `usage` object an OpenAI-compatible response carries.
    pub fn from_response(body: &serde_json::Value) -> Option<Self> {
        let u = body.get("usage")?;
        let usage = Usage {
            prompt_tokens: u.get("prompt_tokens").and_then(|v| v.as_u64()),
            completion_tokens: u.get("completion_tokens").and_then(|v| v.as_u64()),
            total_tokens: u.get("total_tokens").and_then(|v| v.as_u64()),
            cost: u.get("cost").and_then(|v| v.as_f64()),
        };
        if usage.is_empty() {
            None
        } else {
            Some(usage)
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Attempt {
    pub request: Option<crate::instruction::Request>,
    pub response: Option<String>,
    pub response_truncated: bool,
    pub index: u32,
    pub kind: AttemptKind,
    pub duration_ms: u64,
    /// What went wrong, verbatim — the actual provider or parser message.
    pub error: Option<String>,
    pub usage: Option<Usage>,
}

/// One execution of one agent.
#[derive(Debug, Clone, Serialize)]
pub struct Run {
    pub session_id: String,
    pub app_version: String,
    pub context: Option<crate::instruction::Context>,
    pub length_checks: Vec<crate::prompts::difficulty::LengthCheck>,
    pub application_status: String,
    pub id: u64,
    /// Groups every run fired by one conversational turn. `None` for
    /// out-of-turn work (a story, a word insight, a coach question).
    pub turn_id: Option<u64>,
    /// Which `ontology::Operation` ran.
    pub operation: String,
    /// Who it belongs to: one of the two agents, or the Runner.
    pub actor: Actor,
    /// Denormalized from the registry so the UI can label a run without a
    /// second lookup.
    pub label: String,
    pub model: String,
    pub temperature: Option<f64>,
    /// Whether the model was allowed to reason before answering.
    pub reasoning: bool,
    pub max_tokens: Option<u64>,
    pub streamed: bool,
    /// Schema name for structured calls; `None` for streamed prose.
    pub schema: Option<String>,
    /// Wall-clock start, epoch milliseconds.
    pub started_at_ms: u64,
    /// Time to first streamed token, for streamed runs.
    pub first_token_ms: Option<u64>,
    pub duration_ms: u64,
    pub usage: Option<Usage>,
    pub attempts: Vec<Attempt>,
    pub outcome: Outcome,
    pub error: Option<String>,
    /// The messages actually sent, rendered as `role: content`. This is the
    /// *content* of the node — without it the graph can only say that
    /// something ran, never what it was asked.
    ///
    /// SECURITY: the request PAYLOAD only. Headers carry the bearer token
    /// and must never reach here (see the module note).
    pub prompt: Option<String>,
    /// The model's raw response, before parsing.
    pub output: Option<String>,
}

/// Content caps. Big enough to read the whole story of a call, small enough
/// that 300 of them in a ring stay cheap.
const PROMPT_CAP: usize = 12_000;
const OUTPUT_CAP: usize = 8_000;

fn clip(s: &str, cap: usize) -> String {
    match s.char_indices().nth(cap) {
        Some((i, _)) => format!("{}
… [{} more chars]", &s[..i], s.chars().count() - cap),
        None => s.to_string(),
    }
}

/// Render chat messages as readable `role: content` blocks.
pub fn render_messages(messages: &[serde_json::Value]) -> String {
    messages
        .iter()
        .map(|m| {
            let role = m.get("role").and_then(|r| r.as_str()).unwrap_or("?");
            let content = m.get("content").and_then(|c| c.as_str()).unwrap_or("");
            format!("── {role} ──
{content}")
        })
        .collect::<Vec<_>>()
        .join("

")
}

fn session_id() -> &'static str {
    static SESSION: OnceLock<String> = OnceLock::new();
    SESSION.get_or_init(|| uuid::Uuid::new_v4().to_string())
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Identity for a run, handed to `ai.rs` by the call site.
#[derive(Debug, Clone)]
pub struct RunContext {
    pub context: Option<crate::instruction::Context>,
    pub blocks: Vec<crate::instruction::Block>,
    /// An id from `ontology::op::*` — never a hand-spelled string.
    pub operation: &'static str,
    pub turn_id: Option<u64>,
}

impl RunContext {
    pub fn new(operation: &'static str, turn_id: Option<u64>) -> Self {
        Self { operation, turn_id, context: None, blocks: Vec::new() }
    }
    pub fn with_context(mut self, context: &crate::instruction::Context) -> Self { self.context = Some(context.clone()); self }
    pub fn with_blocks(mut self, blocks: Vec<crate::instruction::Block>) -> Self { self.blocks = blocks; self }

}

/// Accumulates one run as it happens. `finish_*` records it.
pub struct RunRecorder {
    request: Option<crate::instruction::Request>,
    blocks: Vec<crate::instruction::Block>,
    response_truncated: bool,
    run: Run,
    current_usage: Option<Usage>,
    started: std::time::Instant,
    attempt_started: std::time::Instant,
}

impl RunRecorder {
    pub fn start(ctx: RunContext, model: &str) -> Self {
        // An unknown id means a call site bypassed `ontology::op::*`.
        let entry = ontology::operation(ctx.operation);
        debug_assert!(
            entry.is_some(),
            "unknown operation id {:?} - use ontology::op::*",
            ctx.operation
        );
        // The declaration is allowed to be wrong; it is not allowed to lie
        // quietly. A run with no node means the map is missing something.
        if !graph::declares(ctx.operation) {
            log::error!(
                "[trace] operation {:?} has no node in graph.rs - it runs                  invisibly and the graph view is incomplete",
                ctx.operation
            );
        }
        let (actor, label) = entry
            .map(|o| (o.actor, o.label.to_string()))
            .unwrap_or((Actor::Runner, format!("unknown:{}", ctx.operation)));
        let now = std::time::Instant::now();
        let id = NEXT_RUN_ID.fetch_add(1, Ordering::Relaxed);
        let started_at_ms = now_ms();
        // Announce the start so the graph can show live work. Completion
        // arrives later on TRACE_EVENT.
        if let Some(app) = EMITTER.get() {
            use tauri::Emitter;
            let _ = app.emit(
                TRACE_STARTED_EVENT,
                &RunStarted {
                    context: ctx.context.clone(),
                    id,
                    turn_id: ctx.turn_id,
                    operation: ctx.operation.to_string(),
                    actor,
                    label: label.clone(),
                    model: model.to_string(),
                    started_at_ms,
                },
            );
        }
        Self {
            request: None,
            blocks: ctx.blocks,
            response_truncated: false,
            current_usage: None,
            run: Run {
                session_id: session_id().into(),
                app_version: env!("CARGO_PKG_VERSION").into(),
                context: ctx.context,
                length_checks: Vec::new(),
                application_status: "not_reported".into(),
                id,
                turn_id: ctx.turn_id,
                operation: ctx.operation.to_string(),
                actor,
                label,
                model: model.to_string(),
                temperature: None,
                reasoning: false,
                max_tokens: None,
                streamed: false,
                schema: None,
                started_at_ms,
                first_token_ms: None,
                duration_ms: 0,
                usage: None,
                attempts: Vec::new(),
                outcome: Outcome::Ok,
                error: None,
                prompt: None,
                output: None,
            },
            started: now,
            attempt_started: now,
        }
    }

    /// Record the request profile. Takes only scalars lifted from the
    /// payload — never the payload's auth context (there is none) and never
    /// a header map. See the SECURITY note on this module.
    pub fn profile(
        &mut self,
        temperature: Option<f64>,
        reasoning: bool,
        max_tokens: Option<u64>,
        streamed: bool,
        schema: Option<&str>,
    ) {
        self.run.temperature = temperature;
        self.run.reasoning = reasoning;
        self.run.max_tokens = max_tokens;
        self.run.streamed = streamed;
        self.run.schema = schema.map(str::to_string);
    }

    pub fn capture_request(&mut self, payload: &serde_json::Value, route: &str) -> Result<(), String> {
        if !self.blocks.is_empty() && payload["messages"][0]["content"].as_str() != Some(crate::instruction::render(&self.blocks).as_str()) {
            return Err("Recorded prompt blocks do not match the outbound system message.".into());
        }
        let capture = crate::instruction::Request::capture(payload, route, &self.blocks);
        self.run.temperature = payload.get("temperature").and_then(|v| v.as_f64());
        self.run.max_tokens = payload.get("max_tokens").and_then(|v| v.as_u64());
        self.request = Some(capture);
        self.run.output = None;
        self.response_truncated = false;
        Ok(())
    }

    pub fn mark_first_token(&mut self) {
        if self.run.first_token_ms.is_none() {
            self.run.first_token_ms = Some(self.started.elapsed().as_millis() as u64);
        }
    }

    /// Record the latest attempt message preview, without credentials.
    pub fn set_prompt(&mut self, messages: &[serde_json::Value]) {
        self.run.prompt = Some(clip(&render_messages(messages), PROMPT_CAP));
    }

    /// Record what came back, raw. Overwritten per attempt so the stored
    /// output is the one that actually counted.
    pub fn set_output(&mut self, raw: &str) {
        self.response_truncated = raw.chars().count() > OUTPUT_CAP;
        self.run.output = Some(clip(raw, OUTPUT_CAP));
        if let Some(context) = &self.run.context {
            if self.run.operation == crate::ontology::op::REPLY {
                self.run.length_checks = vec![crate::prompts::difficulty::check(raw, context.difficulty, &context.target)];
            } else if self.run.operation == crate::ontology::op::SUGGEST {
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) {
                    self.run.length_checks = ["replies", "frames", "starters"].iter().flat_map(|key| value[*key].as_array().into_iter().flatten()).filter_map(|v| v.as_str()).map(|text| crate::prompts::difficulty::check(text, context.difficulty, &context.target)).collect();
                }
            }
        }
    }

    pub fn set_usage(&mut self, usage: Option<Usage>) {
        if let Some(u) = usage {
            self.current_usage = Some(u);
        }
    }

    /// Close out one attempt. `error` is `None` when the attempt succeeded.
    pub fn attempt(&mut self, kind: AttemptKind, error: Option<String>, usage: Option<Usage>) {
        let usage = usage.or(self.current_usage.take());
        self.current_usage = None;
        if let Some(u) = &usage {
            let total = self.run.usage.get_or_insert_with(Usage::default);
            fn add(a: Option<u64>, b: Option<u64>) -> Option<u64> {
                match (a, b) { (None, None) => None, _ => Some(a.unwrap_or(0) + b.unwrap_or(0)) }
            }
            total.prompt_tokens = add(total.prompt_tokens, u.prompt_tokens);
            total.completion_tokens = add(total.completion_tokens, u.completion_tokens);
            total.total_tokens = add(total.total_tokens, u.total_tokens);
            if let Some(cost) = u.cost { total.cost = Some(total.cost.unwrap_or(0.0) + cost); }
        }
        let index = self.run.attempts.len() as u32;
        self.run.attempts.push(Attempt {
            request: self.request.clone(),
            response: self.run.output.clone(),
            response_truncated: self.response_truncated,
            index,
            kind,
            duration_ms: self.attempt_started.elapsed().as_millis() as u64,
            error,
            usage,
        });
        self.attempt_started = std::time::Instant::now();
    }

    pub fn finish_ok(mut self) -> Result<(), String> {
        let corrected = self
            .run
            .attempts
            .iter()
            .any(|a| a.kind != AttemptKind::Ok);
        self.run.outcome = if corrected {
            Outcome::RetriedThenOk
        } else {
            Outcome::Ok
        };
        self.commit()
    }

    pub fn finish_failed(mut self, error: &str) -> Result<(), String> {
        self.run.outcome = Outcome::Failed;
        self.run.error = Some(error.to_string());
        self.commit()
    }

    fn commit(mut self) -> Result<(), String> {
        self.run.duration_ms = self.started.elapsed().as_millis() as u64;
        record(self.run)
    }
}

fn record(run: Run) -> Result<(), String> {
    if let Some(archive) = ARCHIVE.get() {
        archive.lock().expect("trace archive lock poisoned").put(serde_json::to_value(&run).map_err(|e| e.to_string())?)?;
    }
    log::debug!(
        "[trace] run {} {} ({:?}) {}ms attempts={} outcome={:?}",
        run.id,
        run.operation,
        run.actor,
        run.duration_ms,
        run.attempts.len(),
        run.outcome
    );
    if let Some(app) = EMITTER.get() {
        use tauri::Emitter;
        if let Err(e) = app.emit(TRACE_EVENT, &run) {
            log::warn!("[trace] emit failed: {e}");
        }
    }
    let mut ring = ring().lock().unwrap_or_else(|p| p.into_inner());
    if let Some(index) = ring.iter().position(|r| r.id == run.id) { ring[index] = run; }
    else {
        if ring.len() == RING_CAPACITY { ring.pop_front(); }
        ring.push_back(run);
    }
    Ok(())
}

/// Every run still in memory, oldest first.
pub fn snapshot() -> Vec<Run> {
    ring()
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .iter()
        .cloned()
        .collect()
}

/// Clear retained and current-process traces. Explicit exports are separate files.
pub fn clear() -> Result<(), String> {
    if let Some(archive) = ARCHIVE.get() { archive.lock().expect("trace archive lock poisoned").clear()?; }
    ring().lock().unwrap_or_else(|p| p.into_inner()).clear();
    Ok(())
}

pub fn application(turn: u64, operation: &str, status: &str) -> Result<(), String> {
    let updates: Vec<Run> = snapshot().into_iter().filter(|r| r.turn_id == Some(turn) && r.operation == operation).collect();
    for mut run in updates { run.application_status = status.into(); record(run)?; }
    Ok(())
}
pub fn chat_saved(chat: &str, turns: &serde_json::Value) -> Result<(), String> {
    for mut run in snapshot() {
        if run.operation != crate::ontology::op::REPLY || run.application_status == "conversation_saved" { continue; }
        if let Some(context) = &run.context {
            if context.chat_id == chat && turns.as_array().expect("stored turns").iter().any(|t| t["id"].as_u64() == context.message_id) {
                run.application_status = "conversation_saved".into(); record(run)?;
            }
        }
    }
    Ok(())
}

/// How a declared edge held up against what actually ran.
#[derive(Debug, Clone, Serialize)]
pub struct EdgeVerdict {
    pub from: String,
    pub to: String,
    /// `observed` — seen to hold. `contradicted` — the dependent started
    /// before its dependency finished, so the edge cannot be real.
    /// `unobserved` — never had the data to judge.
    pub verdict: &'static str,
    pub detail: Option<String>,
}

/// The graph's own fidelity, computed from runs rather than asserted.
///
/// This is the **reconciled** tier: the declaration can still be wrong, but
/// it says so instead of lying quietly — a hand-drawn edge that never runs
/// shows up on the very first turn.
#[derive(Debug, Clone, Serialize)]
pub struct Reconciliation {
    pub turns_observed: usize,
    /// Ran, but no node declares it — the map is missing something.
    pub undeclared_operations: Vec<String>,
    /// Declared, but never seen to run in this session. Not necessarily
    /// wrong (a story you never generated), just unproven.
    pub unobserved_operations: Vec<String>,
    pub edges: Vec<EdgeVerdict>,
    /// True when nothing observed contradicts the declaration.
    pub consistent: bool,
}

/// Diff the declared graph against the runs actually recorded.
pub fn reconcile() -> Reconciliation {
    let runs = snapshot();
    let graphs = graph::all();

    let declared_ops: Vec<String> = graphs
        .iter()
        .flat_map(|g| g.nodes.iter().filter_map(|n| n.operation.map(String::from)))
        .collect();
    let mut ran: Vec<String> = runs.iter().map(|r| r.operation.clone()).collect();
    ran.sort_unstable();
    ran.dedup();

    let undeclared_operations: Vec<String> = ran
        .iter()
        .filter(|o| !declared_ops.contains(o))
        .cloned()
        .collect();
    let mut unobserved_operations: Vec<String> = declared_ops
        .iter()
        .filter(|o| !ran.contains(o))
        .cloned()
        .collect();
    unobserved_operations.sort_unstable();
    unobserved_operations.dedup();

    // Group by turn: a dependency claim is only judgeable within one turn.
    let mut turns: std::collections::BTreeMap<u64, Vec<&Run>> = Default::default();
    for r in &runs {
        if let Some(t) = r.turn_id {
            turns.entry(t).or_default().push(r);
        }
    }

    let turn = graph::turn_graph();
    let mut edges = Vec::new();
    for edge in &turn.edges {
        // Only dependency edges make a falsifiable claim. Hydrate and FanIn
        // describe delivery, not ordering.
        if !matches!(
            edge.kind,
            graph::EdgeKind::Sequential | graph::EdgeKind::FanOut
        ) || edge.from == graph::INPUT
        {
            continue;
        }
        let mut verdict = "unobserved";
        let mut detail = None;
        for (turn_id, rs) in &turns {
            let from = rs.iter().find(|r| r.operation == edge.from);
            let to = rs.iter().find(|r| r.operation == edge.to);
            if let (Some(f), Some(t)) = (from, to) {
                let from_finished = f.started_at_ms + f.duration_ms;
                if t.started_at_ms + 50 < from_finished {
                    // `to` was already running before `from` produced
                    // anything — it cannot depend on it.
                    verdict = "contradicted";
                    detail = Some(format!(
                        "turn {turn_id}: {} started {}ms before {} finished",
                        edge.to,
                        from_finished.saturating_sub(t.started_at_ms),
                        edge.from
                    ));
                    break;
                }
                verdict = "observed";
            }
        }
        edges.push(EdgeVerdict {
            from: edge.from.to_string(),
            to: edge.to.to_string(),
            verdict,
            detail,
        });
    }

    let consistent = undeclared_operations.is_empty()
        && !edges.iter().any(|e| e.verdict == "contradicted");
    Reconciliation {
        turns_observed: turns.len(),
        undeclared_operations,
        unobserved_operations,
        edges,
        consistent,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ontology::op;

    /// The ring is process-global and cargo runs tests in parallel, so these
    /// must not interleave — each one asserts on "the last run recorded".
    static TEST_LOCK: Mutex<()> = Mutex::new(());

    fn guard() -> std::sync::MutexGuard<'static, ()> {
        let g = TEST_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        clear().unwrap();
        g
    }

    #[test]
    fn attempts_preserve_requests_responses_and_effective_parameters() {
        let _g = guard();
        let mut recorder = RunRecorder::start(RunContext::new(op::EXPLAIN, None), "test/model");
        let prompt = "fixture system";
        let repair = "fixture repair";
        let first = serde_json::json!({"messages":[{"role":"system","content":prompt}],"temperature":0.9,"authorization":"never record headers"});
        recorder.capture_request(&first, "test").unwrap();
        recorder.set_output("invalid response");
        recorder.attempt(AttemptKind::Invalid, Some("Bad structure".into()), None);
        let second = serde_json::json!({"messages":[{"role":"system","content":prompt},{"role":"user","content":repair}]});
        recorder.capture_request(&second, "test").unwrap();
        recorder.set_output("valid response");
        recorder.attempt(AttemptKind::Ok, None, None);
        recorder.finish_ok().unwrap();
        let run = snapshot().pop().unwrap();
        assert!(run.temperature.is_none());
        assert_eq!(run.attempts[0].response.as_deref(), Some("invalid response"));
        assert_eq!(run.attempts[1].response.as_deref(), Some("valid response"));
        assert_eq!(run.attempts[0].request.as_ref().unwrap().messages.len(), 1);
        assert_eq!(run.attempts[1].request.as_ref().unwrap().messages.len(), 2);
        assert!(run.attempts[0].request.as_ref().unwrap().parameters.get("authorization").is_none());
        assert_eq!(run.application_status, "not_reported");
    }
    #[test]
    fn provenance_cannot_disagree_with_actual_messages() {
        let _g = guard();
        let blocks = vec![crate::instruction::Block::new("difficulty", "test", "correct".into())];
        let mut recorder = RunRecorder::start(RunContext::new(op::REPLY, None).with_blocks(blocks), "test/model");
        let unexpected = "mismatched fixture";
        assert!(recorder.capture_request(&serde_json::json!({"messages":[{"role":"system","content":unexpected}]}), "test").is_err());
    }

    #[test]
    fn a_clean_run_is_ok_with_one_attempt() {
        let _g = guard();
        let mut r =
            RunRecorder::start(RunContext::new(op::TOKENIZE, Some(7)), "test/model");
        r.profile(Some(0.1), false, Some(6000), false, Some("TokensOut"));
        r.attempt(AttemptKind::Ok, None, None);
        r.finish_ok().unwrap();

        let run = snapshot().into_iter().last().expect("run recorded");
        assert_eq!(run.operation, op::TOKENIZE);
        assert_eq!(run.actor, Actor::Runner);
        assert_eq!(run.label, "Reply word meanings");
        assert_eq!(run.outcome, Outcome::Ok);
        assert_eq!(run.attempts.len(), 1);
        assert_eq!(run.schema.as_deref(), Some("TokensOut"));
    }

    #[test]
    fn a_corrected_run_reports_retried_then_ok_and_keeps_the_error() {
        let _g = guard();
        let mut r = RunRecorder::start(RunContext::new(op::EXPLAIN, None), "test/model");
        r.attempt(
            AttemptKind::Invalid,
            Some("mechanics list empty".into()),
            None,
        );
        r.attempt(AttemptKind::Ok, None, None);
        r.finish_ok().unwrap();

        let run = snapshot().into_iter().last().expect("run recorded");
        // The retry is legible, not just counted — that is the whole point.
        assert_eq!(run.outcome, Outcome::RetriedThenOk);
        assert_eq!(run.attempts.len(), 2);
        assert_eq!(
            run.attempts[0].error.as_deref(),
            Some("mechanics list empty")
        );
    }

    #[test]
    fn a_failed_run_carries_the_providers_own_error() {
        let _g = guard();
        let r = RunRecorder::start(RunContext::new(op::REFLECT, None), "test/model");
        r.finish_failed("API error 402: insufficient credits").unwrap();
        let run = snapshot().into_iter().last().expect("run recorded");
        assert_eq!(run.outcome, Outcome::Failed);
        assert_eq!(
            run.error.as_deref(),
            Some("API error 402: insufficient credits")
        );
    }

    #[test]
    fn usage_parses_from_a_response_body_and_ignores_an_empty_one() {
        let body = serde_json::json!({
            "usage": {"prompt_tokens": 120, "completion_tokens": 40, "total_tokens": 160}
        });
        let u = Usage::from_response(&body).expect("usage parsed");
        assert_eq!(u.prompt_tokens, Some(120));
        assert_eq!(u.total_tokens, Some(160));
        assert!(Usage::from_response(&serde_json::json!({})).is_none());
        assert!(Usage::from_response(&serde_json::json!({"usage": {}})).is_none());
    }

    #[test]
    fn retry_usage_includes_failed_and_successful_attempts_once() {
        let _g = guard();
        let mut recorder = RunRecorder::start(RunContext::new(op::EXPLAIN, None), "test/model");
        recorder.set_usage(Some(Usage { total_tokens: Some(70), cost: Some(0.02), ..Usage::default() }));
        recorder.attempt(AttemptKind::Invalid, Some("invalid output".into()), None);
        recorder.set_usage(Some(Usage { total_tokens: Some(90), cost: Some(0.03), ..Usage::default() }));
        recorder.attempt(AttemptKind::Ok, None, None);
        recorder.finish_ok().unwrap();
        let run = snapshot().pop().unwrap();
        let usage = run.usage.unwrap();
        assert_eq!(usage.total_tokens, Some(160));
        assert!((usage.cost.unwrap() - 0.05).abs() < 1e-12);
        assert_eq!(run.attempts[0].usage.as_ref().unwrap().total_tokens, Some(70));
    }
}
