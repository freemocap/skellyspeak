//! OpenAI-compatible AI client (OpenRouter / Groq) with streaming, JSON
//! schema-constrained structured output, and the failure-mode handling we
//! learned the hard way in FreeLingo: inline $defs for grammar-constrained
//! decoders, and validation retries with error feedback. There is NO
//! degraded fallback path: schema-constrained decoding is applied on every
//! attempt, and a provider that cannot serve the call fails loudly with its
//! own error so the model gets replaced rather than papered over.

use futures_util::StreamExt;
use schemars::JsonSchema;
use serde::de::DeserializeOwned;
use log::{error, info, warn};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};

use crate::trace::{AttemptKind, RunContext, RunRecorder, Usage};

/// Counts bounded corrective attempts for malformed model output.
pub fn retry_stats_snapshot() -> [(&'static str, u64); 3] {
    [
        ("parse_retry", PARSE_RETRY.load(Ordering::Relaxed)),
        ("validation_retry", VALIDATION_RETRY.load(Ordering::Relaxed)),
        ("retries_exhausted", RETRIES_EXHAUSTED.load(Ordering::Relaxed)),
    ]
}

/// Output ceilings bound both generation and hosted spending reservations.
const REPLY_MAX_TOKENS: u64 = 2_000;

fn structured_token_limit(name: &str) -> Result<u64, String> {
    match name {
        "WordInsight" | "TopicNote" => Ok(2_000),
        "TranslationOut" | "MechanicsOut" | "CoachFeedback" | "TeachingPlan" | "Profile" => Ok(4_000),
        "ScaffoldsOut" | "SkillAssessment" => Ok(8_000),
        "CoachDecision" => Ok(3_000),
        "PartnerReaction" => Ok(1_600),
        // Word-by-word annotations grow with the source text, including long learner messages.
        "TokensOut" | "LearnerTokensOut" => Ok(32_000),
        _ => Err(format!("No output token limit configured for {name}")),
    }
}

/// A caller may pass its own, tighter cap. The point is not to constrain the
/// output — it is to make a runaway CHEAP. The observer's documents are a few
/// hundred tokens; giving it 4k means a pathological generation dies in ~10s
/// instead of burning 32k tokens over two minutes before anyone notices.
#[derive(Debug, Clone, Copy)]
pub struct MaxTokens(pub u64);

pub static PARSE_RETRY: AtomicU64 = AtomicU64::new(0);
pub static VALIDATION_RETRY: AtomicU64 = AtomicU64::new(0);
pub static RETRIES_EXHAUSTED: AtomicU64 = AtomicU64::new(0);

#[derive(Clone)]
pub struct Provider {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

impl std::fmt::Debug for Provider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Provider").field("model", &self.model).finish_non_exhaustive()
    }
}

/// Keywords outside the structured-output subset. Present in schemars output,
/// unsupported by the decoders, and — in the numeric case — actively harmful.
const UNSUPPORTED_KEYWORDS: &[&str] = &[
    "default",
    "format",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    // Cardinality is not in the strict subset either. It moves to the
    // `validate` closures, which already check non-emptiness and trigger a
    // corrective retry — enforcement relocates, it does not disappear.
    "minItems",
    "maxItems",
    "minLength",
    "maxLength",
    "pattern",
];

/// Normalize a schemars schema into something every grammar-constrained
/// decoder can actually compile.
///
/// Three transformations, all learned the hard way:
///
/// 1. **Dereference `$ref`** — unresolved refs 400 on several providers.
///    Accepts both `definitions` (schemars 0.8) and `$defs`.
/// 2. **Collapse single-element `allOf` / `anyOf` / `oneOf`.** schemars wraps
///    a `$ref` in `allOf` whenever the field also carries a doc comment, so a
///    nested struct arrives as `{"allOf": [{...}], "description": "..."}`.
///    Providers that cannot map `allOf` to their grammar silently degrade
///    from "constrained decoding" to "strong hint" — and the model then
///    returns the nested object as a JSON *string*. That is what broke the
///    observer: `invalid type: string "{...}", expected struct TeachingPlan`.
///    Collapsing the wrapper is what keeps the schema enforceable.
/// 3. **Strip keywords constrained decoders do not support.** schemars emits
///    `default`, `format`, and `minimum`/`maximum` — none of which are in
///    the OpenAI-compatible structured-output subset. Worse, a `u32` field
///    arrives as `{"type": "integer", "format": "uint32", "minimum": 0.0}`:
///    a FLOAT bound on an integer. A grammar compiler given that can admit
///    unbounded digit emission, which is the runaway signature the bench
///    caught — the observer blowing a 32k token cap after two minutes, on
///    roughly one run in three, non-deterministically. Stripping them leaves
///    the shape (types, properties, required, items, enums, descriptions):
///    everything that constrains, nothing that confuses.
/// 4. **Make every object strict.** `additionalProperties: false`, and every
///    property listed in `required`. This is the one that matters most.
///    schemars omits any `#[serde(default)]` field from `required`, so
///    `TeachingPlan` — where all eight fields are defaulted — shipped with
///    NO required array at all: a schema meaning "an object that may contain
///    any of these properties, or none". Nothing in that grammar obliges the
///    model to close the object or stop emitting, which is exactly why the
///    observer ran away on ~1 call in 4 while the fully-required worker
///    schemas never failed once.
///
///    `Option<T>` already arrives as `["string", "null"]`, so requiring it
///    costs nothing: the model answers `null`. Prompts carry a matching rule
///    (`prompts::no_information_rule`) telling it how to say "nothing here"
///    for each shape, so required never means invented.
pub fn inline_defs(mut schema: Value) -> Value {
    let defs = schema
        .get("$defs")
        .or_else(|| schema.get("definitions"))
        .cloned()
        .unwrap_or(Value::Null);

    fn resolve(defs: &Value, reference: &str) -> Option<Value> {
        let name = reference
            .strip_prefix("#/$defs/")
            .or_else(|| reference.strip_prefix("#/definitions/"))?;
        defs.get(name).cloned()
    }

    fn walk(node: &mut Value, defs: &Value) {
        match node {
            Value::Object(map) => {
                if let Some(Value::String(reference)) = map.get("$ref") {
                    if let Some(def) = resolve(defs, reference) {
                        let mut def = def;
                        walk(&mut def, defs);
                        *node = def;
                        return;
                    }
                }
                map.remove("$defs");
                map.remove("definitions");
                for noise in UNSUPPORTED_KEYWORDS {
                    map.remove(*noise);
                }
                // Strict subset: closed objects, every property required.
                if let Some(props) = map.get("properties").and_then(|p| p.as_object()) {
                    let all: Vec<Value> =
                        props.keys().map(|k| Value::String(k.clone())).collect();
                    map.insert("required".into(), Value::Array(all));
                    map.insert("additionalProperties".into(), Value::Bool(false));
                }
                for (_, value) in map.iter_mut() {
                    walk(value, defs);
                }
                // Collapse a single-branch combinator into its parent, keeping
                // any sibling keys (description, default) the wrapper carried.
                for key in ["allOf", "anyOf", "oneOf"] {
                    let single = map
                        .get(key)
                        .and_then(|v| v.as_array())
                        .filter(|a| a.len() == 1)
                        .and_then(|a| a[0].as_object())
                        .cloned();
                    if let Some(inner) = single {
                        map.remove(key);
                        for (k, v) in inner {
                            map.entry(k).or_insert(v);
                        }
                    }
                }
            }
            Value::Array(items) => {
                for item in items {
                    walk(item, defs);
                }
            }
            _ => {}
        }
    }

    walk(&mut schema, &defs);
    schema
}

/// Strip markdown fences and extract the outermost JSON object if the model
/// wrapped it in prose.
pub fn extract_json(raw: &str) -> String {
    // Fence-stripping is unreliable (models truncate mid-fence, wrap in
    // prose, add trailing junk) - grabbing the outermost {..} always works
    // for object-shaped payloads, which every structured call produces.
    let trimmed = raw.trim();
    if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
        if end > start {
            return trimmed[start..=end].to_string();
        }
    }
    trimmed.to_string()
}

/// Char-boundary-safe truncation for log lines. Slicing a &str at a raw byte
/// offset panics when the offset lands inside a multi-byte character (e.g.
/// '¡') — which degenerate model output WILL hit eventually.
pub fn truncate_for_log(s: &str, max_chars: usize) -> &str {
    match s.char_indices().nth(max_chars) {
        Some((idx, _)) => &s[..idx],
        None => s,
    }
}

/// "Do not think" — in each family's native dialect. Gemini/DeepSeek take
/// `enabled: false`; OpenAI reasoning models take `effort: minimal`
/// (`enabled` is not a field they accept and 400s under require_parameters).
fn reasoning_off(model: &str) -> Value {
    if model.starts_with("openai/") {
        json!({"effort": "minimal"})
    } else {
        json!({"enabled": false})
    }
}

/// OpenAI reasoning models (gpt-5 family) reject ANY explicit temperature —
/// the field must be absent for them. Other families accept it normally.
fn apply_dialect(model: &str, payload: &mut Value) {
    if model.starts_with("openai/") {
        if let Some(obj) = payload.as_object_mut() {
            obj.remove("temperature");
        }
    }
}

impl Provider {
    pub fn openrouter(api_key: &str, model: &str) -> Self {
        Self {
            base_url: crate::settings::OPENROUTER_BASE_URL.into(),
            api_key: api_key.trim().into(),
            model: model.into(),
        }
    }

    fn client(&self) -> Result<reqwest::Client, String> {
        crate::network::validate_endpoint(&self.base_url)?;
        crate::network::client(180)
    }

    /// Consume an SSE chat stream, forwarding each text delta to `on_delta`
    /// and returning the complete concatenated reply.
    pub async fn chat_streaming(
        &self,
        ctx: RunContext,
        messages: &[Value],
        temperature: f64,
        on_delta: &mut (dyn FnMut(&str) + Send),
    ) -> Result<String, String> {
        // Before the recorder starts: a held operation has not begun, and
        // timing it from the moment it arrived at the gate would report a
        // pause as a slow model.
        crate::gate::wait(ctx.operation, ctx.turn_id).await;
        let mut run = RunRecorder::start(ctx, &self.model);
        run.profile(Some(temperature), false, Some(REPLY_MAX_TOKENS), true, None);
        run.set_prompt(messages);
        // Reasoning models (GLM etc.) burn seconds "thinking" before the first
        // token — disable it for conversational replies. If a model rejects
        // the request, we FAIL LOUDLY: that model cannot serve this call and
        // must be changed, not papered over.
        let mut payload = json!({
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": true,
            // Length is governed by the PROMPT ("one to three short
            // sentences"); this is only a runaway guard.
            "max_tokens": REPLY_MAX_TOKENS,
            // NOTE: do NOT add `frequency_penalty` here. The architecture doc
            // long claimed it was set "on every request payload"; it was set
            // nowhere, and adding it back produces
            //   404: No endpoints found that can handle the requested parameters
            // because `require_parameters: true` then filters out every
            // provider serving this model. It was presumably removed for
            // exactly that reason and the doc was never corrected.
            //
            // Repetition is handled where it actually occurs — across turns,
            // not within one completion — by the NEVER REPEAT YOURSELF rule in
            // `prompts::partner::reply_prompt`.
            "reasoning": reasoning_off(&self.model),
            // Route ONLY to providers that actually honor request parameters
            // (json_schema, reasoning, ...). Without this, OpenRouter
            // silently ignores unsupported params and hands the request to a
            // provider that prompts instead of constraining, turning
            // "guaranteed" structured output into a suggestion.
            "provider": {"require_parameters": true},
        });
        apply_dialect(&self.model, &mut payload);
        run.capture_request(&payload, if self.base_url == crate::settings::OPENROUTER_BASE_URL { "OpenRouter direct" } else { "Configured endpoint" })?;
        let url = format!("{}/chat/completions", self.base_url);
        info!(
            "[ai] streaming request: model={} messages={} temp={:.2}",
            self.model,
            messages.len(),
            temperature
        );
        let _permit = crate::request_admission::shared().acquire(&self.base_url).await?;
        let response = self
            .client()?
            .post(&url)
            .bearer_auth(&self.api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| {
                warn!("[ai] streaming request failed");
                format!("request failed: {}", e.without_url())
            });
        let response = match response {
            Ok(r) => r,
            Err(e) => {
                run.attempt(AttemptKind::Failed, Some(e.clone()), None);
                run.finish_failed(&e)?;
                return Err(e);
            }
        };
        let status = response.status();
        crate::request_admission::shared().refuse(&self.base_url, status.as_u16());
        info!("[ai] streaming response: status={status}");
        if !status.is_success() {
            // FAIL LOUDLY. A rejected request means the model or the call is
            // wrong (e.g. model refuses reasoning:false). No fallback: fix
            // the cause — change the model or the request.
            error!("[ai] streaming request rejected: {status}");
            let msg = crate::network::response_error(response).await;
            run.attempt(AttemptKind::Failed, Some(msg.clone()), None);
            run.finish_failed(&msg)?;
            return Err(msg);
        }

        let result = Self::consume_stream(response, on_delta, &mut run).await;
        match result {
            Ok(full) => {
                run.set_output(&full);
                run.attempt(AttemptKind::Ok, None, None);
                run.finish_ok()?;
                Ok(full)
            }
            Err(e) => {
                run.attempt(AttemptKind::Failed, Some(e.clone()), None);
                run.finish_failed(&e)?;
                Err(e)
            }
        }
    }

    /// `run` gets time-to-first-token plus the token counts and cost from the
    /// final usage chunk.
    ///
    /// Nothing has to ask for that chunk. OpenRouter returns full usage —
    /// `total_tokens` and the authoritative `usage.cost` — on every response,
    /// in the last SSE message for a stream; `stream_options.include_usage`
    /// and `usage.include` are deprecated and have no effect. So a stream that
    /// finishes WITHOUT usage means the upstream contract changed, and the
    /// hosted service treats that as an error rather than a free request.
    async fn consume_stream(
        response: reqwest::Response,
        on_delta: &mut (dyn FnMut(&str) + Send),
        run: &mut RunRecorder,
    ) -> Result<String, String> {
        let endpoint = response.url().to_string();
        let mut stream = response.bytes_stream();
        let mut decoder = crate::sse::Decoder::default();
        let mut full = String::new();
        while let Some(chunk) = stream.next().await {
            let bytes = chunk.map_err(|e| format!("stream error: {e}"))?;
            for event in decoder.push_for_endpoint(&bytes, &endpoint)? {
                match event {
                    crate::sse::Event::Done => {
                        decoder.finish()?;
                        return Ok(full);
                    }
                    crate::sse::Event::Data(value) => {
                        run.set_usage(Usage::from_response(&value));
                        if let Some(delta) = value["choices"][0]["delta"]["content"].as_str() {
                            run.mark_first_token();
                            if full.len() + delta.len() > 4 * 1024 * 1024 { return Err("Reply exceeds 4 MiB.".into()); }
                        full.push_str(delta);
                            on_delta(delta);
                        }
                    }
                }
            }
        }
        decoder.finish()?;
        Ok(full)
    }
    /// Returns the message content plus whatever usage the provider
    /// reported. The raw body is deliberately not returned — nothing used
    /// it, and holding response bodies around invites logging them.
    async fn post_chat(
        &self,
        payload: &Value,
        _run: &mut RunRecorder,
    ) -> Result<(String, Option<Usage>, bool), String> {
        let started = std::time::Instant::now();
        let url = format!("{}/chat/completions", self.base_url);
        let _permit = crate::request_admission::shared().acquire(&self.base_url).await?;
        let response = self
            .client()?
            .post(&url)
            .bearer_auth(&self.api_key)
            .json(payload)
            .send()
            .await
            .map_err(|e| format!("Request failed; outcome may be unknown. No automatic retry: {}", e.without_url()))?;
        let status = response.status();
        crate::request_admission::shared().refuse(&self.base_url, status.as_u16());
        if !status.is_success() {
            warn!("[ai] API error: {status}");
            return Err(crate::network::response_error(response).await);
        }
        let body = crate::network::response_json(response, 4 * 1024 * 1024).await?;
        info!(
            "[ai] response: status={} latency={:.1}s body_len={}",
            status,
            started.elapsed().as_secs_f32(),
            body.to_string().len()
        );
        let usage = Usage::from_response(&body);
        // `length` means the model was cut off mid-output. That is NOT a
        // transient defect and a corrective retry cannot fix it — the retry
        // re-sends a LONGER conversation and truncates at the same place.
        let truncated = body["choices"][0]["finish_reason"].as_str() == Some("length");
        let content = body["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();
        if content.is_empty() {
            warn!("[ai] empty response content");
            return Err("API returned an empty response".into());
        }
        Ok((content, usage, truncated))
    }

    /// Structured output. Design: the request is ALWAYS schema-constrained;
    /// a provider that rejects the schema is a model/call problem and fails
    /// LOUDLY (change the model, don't paper over it). The only retry is the
    /// corrective one for transient model-output defects (malformed JSON,
    /// failed validation) — the raw output plus the error go back to the
    /// model. HTTP failures are never retried automatically.
    #[allow(clippy::too_many_arguments)]
    pub async fn structured_validated<T, F>(
        &self,
        ctx: RunContext,
        messages: &[Value],
        temperature: f64,
        name: &str,
        allow_reasoning: bool,
        max_tokens: Option<MaxTokens>,
        validate: F,
    ) -> Result<T, String>
    where
        T: DeserializeOwned + JsonSchema,
        F: Fn(&T) -> Option<String>,
    {
        crate::gate::wait(ctx.operation, ctx.turn_id).await;
        let cap = match max_tokens {
            Some(MaxTokens(cap)) => cap,
            None => structured_token_limit(name)?,
        };
        let mut run = RunRecorder::start(ctx, &self.model);
        run.profile(Some(temperature), allow_reasoning, Some(cap), false, Some(name));
        let root = match serde_json::to_value(schemars::schema_for!(T)) {
            Ok(v) => v,
            Err(e) => {
                let msg = format!("schema generation failed: {e}");
                run.finish_failed(&msg)?;
                return Err(msg);
            }
        };
        let schema = inline_defs(root);

        let mut attempts: Vec<Value> = messages.to_vec();
        let mut last_error = String::new();

        for attempt in 0..3 {
            // Worker calls run with reasoning DISABLED (a thinking model
            // burns 30-60s before a mechanical task). The observer runs with
            // reasoning ENABLED and gets a larger budget for thinking +
            // output.
            // Schema-constrained decoding on EVERY attempt. With
            // require_parameters, a provider that can't honor the schema
            // fails at request time — loudly — instead of prompting.
            let mut payload = if allow_reasoning {
                json!({
                    "model": self.model,
                    "messages": attempts,
                    "temperature": temperature,
                    "max_tokens": cap,
                                        "provider": {"require_parameters": true},
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {"name": name, "strict": true, "schema": schema}
                    },
                })
            } else {
                json!({
                    "model": self.model,
                    "messages": attempts,
                    "temperature": temperature,
                    "max_tokens": cap,
                    "reasoning": reasoning_off(&self.model),
                    "provider": {"require_parameters": true},
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {"name": name, "strict": true, "schema": schema}
                    },
                })
            };
            apply_dialect(&self.model, &mut payload);
            // Re-recorded per attempt: a corrective retry sends a LONGER
            // conversation, and the stored prompt should be the one that
            // actually produced the stored output.
            run.set_prompt(&attempts);
            run.capture_request(&payload, if self.base_url == crate::settings::OPENROUTER_BASE_URL { "OpenRouter direct" } else { "Configured endpoint" })?;
            info!(
                "[ai] structured attempt {attempt} ({name}): messages={}",
                attempts.len()
            );

            // Request-level failure (auth, schema rejection, bad model):
            // FAIL LOUDLY with the provider's actual error. No fallback.
            let (raw, usage, truncated) = match self.post_chat(&payload, &mut run).await {
                Ok(v) => v,
                Err(e) => {
                    run.attempt(AttemptKind::Failed, Some(e.clone()), None);
                    run.finish_failed(&e)?;
                    return Err(e);
                }
            };
            run.set_usage(usage.clone());
            run.set_output(&raw);

            // Fail fast on truncation. Retrying costs another full call and
            // truncates identically — the observed failure was 3 attempts,
            // 64s and ~18k tokens for an outcome that was never reachable.
            if truncated {
                let msg = format!(
                    "model output hit the token cap ({name}) - raise max_tokens or                      shorten the input; retrying cannot help"
                );
                error!("[ai] {msg}");
                run.attempt(AttemptKind::Failed, Some(msg.clone()), usage);
                run.finish_failed(&msg)?;
                return Err(msg);
            }

            let cleaned = extract_json(&raw);
            match serde_json::from_str::<T>(&cleaned) {
                Ok(value) => {
                    if let Some(problem) = validate(&value) {
                        VALIDATION_RETRY.fetch_add(1, Ordering::Relaxed);
                        warn!("[ai] validation failed - corrective retry");
                        run.attempt(
                            AttemptKind::Invalid,
                            Some(problem.clone()),
                            usage.clone(),
                        );
                        last_error = problem;
                        attempts.push(json!({"role": "assistant", "content": raw}));
                        attempts.push(json!({
                            "role": "user",
                            "content": crate::prompts::repair::invalid_content(&last_error)
                        }));
                        continue;
                    }
                    info!("[ai] structured attempt {attempt} OK");
                    run.attempt(AttemptKind::Ok, None, usage);
                    run.finish_ok()?;
                    return Ok(value);
                }
                Err(e) => {
                    PARSE_RETRY.fetch_add(1, Ordering::Relaxed);
                    warn!("[ai] parse failed - corrective retry");
                    run.attempt(
                        AttemptKind::Unparseable,
                        Some(format!("invalid JSON: {e}")),
                        usage.clone(),
                    );
                    last_error = format!("invalid JSON: {e}");
                    attempts.push(json!({"role": "assistant", "content": raw}));
                    attempts.push(json!({
                        "role": "user",
                        "content": crate::prompts::repair::unparseable(&e.to_string())
                    }));
                }
            }
        }
        RETRIES_EXHAUSTED.fetch_add(1, Ordering::Relaxed);
        error!(
            "[ai] structured output ({name}) failed after all attempts"
        );
        let msg = format!("structured output failed after retries: {last_error}");
        run.finish_failed(&msg)?;
        Err(msg)
    }
}

#[cfg(test)]
mod tests {
use super::*;
use serde_json::json;

// Pins the definitions/$defs handling: nested refs must inline cleanly.
#[test]
fn inline_defs_resolves_definitions() {
    let schema = json!({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "definitions": {
            "GuidedToken": { "type": "object", "properties": { "text": { "type": "string" } } }
        },
        "type": "object",
        "properties": {
            "tokens": { "type": "array", "items": { "$ref": "#/definitions/GuidedToken" } }
        }
    });
    let out = inline_defs(schema);
    let items = &out["properties"]["tokens"]["items"];
    assert!(items.get("$ref").is_none(), "ref must be inlined");
    assert_eq!(items["properties"]["text"]["type"], "string");
    assert!(out.get("definitions").is_none(), "definitions map stripped");
}

#[test]
fn inline_defs_handles_dollar_defs() {
    let schema = json!({
        "$defs": { "Item": { "type": "object" } },
        "properties": { "x": { "$ref": "#/$defs/Item" } }
    });
    let out = inline_defs(schema);
    assert!(out["properties"]["x"].get("$ref").is_none());
    assert_eq!(out["properties"]["x"]["type"], "object");
}

#[test]
fn inline_defs_resolves_transitive_refs() {
    let schema = json!({
        "definitions": {
            "A": { "$ref": "#/definitions/B" },
            "B": { "type": "string" }
        },
        "properties": { "x": { "$ref": "#/definitions/A" } }
    });
    let out = inline_defs(schema);
    assert_eq!(out["properties"]["x"]["type"], "string");
}

#[test]
fn inline_defs_collapses_the_allof_wrapper_schemars_adds_to_documented_fields() {
    // The observer's `plan` field arrived as {"allOf": [{...}]} because it
    // carries a doc comment. Providers that cannot compile `allOf` degrade
    // to a hint and return the nested object as a STRING.
    let schema = json!({
        "type": "object",
        "properties": {
            "plan": {
                "description": "The rewritten plan.",
                "allOf": [{"$ref": "#/definitions/Plan"}]
            }
        },
        "definitions": {
            "Plan": {"type": "object", "properties": {"focus": {"type": "string"}}}
        }
    });
    let out = inline_defs(schema);
    let plan = &out["properties"]["plan"];
    assert!(plan.get("allOf").is_none(), "allOf wrapper survived: {plan}");
    assert_eq!(plan["type"], "object");
    assert_eq!(plan["properties"]["focus"]["type"], "string");
    // Sibling keys on the wrapper are preserved.
    assert_eq!(plan["description"], "The rewritten plan.");
}

#[test]
fn inline_defs_strips_keywords_that_make_decoders_run_away() {
    // A u32 arrives as an integer with a FLOAT minimum. Left in, a grammar
    // compiler can admit unbounded digits — the observer's 32k-token runaway.
    let schema = json!({
        "type": "object",
        "properties": {
            "budget": {
                "type": "integer",
                "format": "uint32",
                "minimum": 0.0,
                "default": 1,
                "description": "kept"
            }
        },
        "required": ["budget"]
    });
    let out = inline_defs(schema);
    let b = &out["properties"]["budget"];
    for gone in ["format", "minimum", "default"] {
        assert!(b.get(gone).is_none(), "{gone} survived: {b}");
    }
    // The shape that actually constrains must survive untouched.
    assert_eq!(b["type"], "integer");
    assert_eq!(b["description"], "kept");
    assert_eq!(out["required"][0], "budget");
}

#[test]
fn inline_defs_makes_every_object_strict() {
    // The bug this exists to prevent: schemars omits `#[serde(default)]`
    // fields from `required`, so TeachingPlan shipped with NO required array
    // — "an object that may contain any of these, or none". Nothing obliged
    // the model to stop emitting, and it ran away on ~1 call in 4.
    let schema = json!({
        "type": "object",
        "properties": {
            "focus": {"type": "array", "items": {"type": "string"}},
            "note": {"type": ["string", "null"]},
            "budget": {"type": "integer"}
        }
    });
    let out = inline_defs(schema);
    let mut required: Vec<&str> =
        out["required"].as_array().unwrap().iter().map(|v| v.as_str().unwrap()).collect();
    required.sort_unstable();
    assert_eq!(required, ["budget", "focus", "note"]);
    assert_eq!(out["additionalProperties"], false);
    // Nullable stays nullable — requiring it just means the model must answer,
    // and `null` is a legal answer.
    assert_eq!(out["properties"]["note"]["type"][1], "null");
}

#[test]
fn inline_defs_makes_nested_objects_strict_too() {
    let schema = json!({
        "type": "object",
        "properties": {
            "errors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"said": {"type": "string"}, "seen": {"type": "integer"}}
                }
            }
        }
    });
    let out = inline_defs(schema);
    let item = &out["properties"]["errors"]["items"];
    assert_eq!(item["additionalProperties"], false);
    assert_eq!(item["required"].as_array().unwrap().len(), 2);
}

#[test]
fn inline_defs_strips_cardinality_which_moves_to_the_validators() {
    let schema = json!({
        "type": "object",
        "properties": {
            "xs": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 4}
        }
    });
    let out = inline_defs(schema);
    let xs = &out["properties"]["xs"];
    assert!(xs.get("minItems").is_none());
    assert!(xs.get("maxItems").is_none());
}

#[test]
fn inline_defs_keeps_multi_branch_combinators_alone() {
    // Only SINGLE-branch wrappers are noise; a real union must survive.
    let schema = json!({
        "type": "object",
        "properties": {
            "v": {"anyOf": [{"type": "string"}, {"type": "null"}]}
        }
    });
    let out = inline_defs(schema);
    assert_eq!(out["properties"]["v"]["anyOf"].as_array().unwrap().len(), 2);
}

#[test]
fn inline_defs_keeps_unrelated_content() {
    let schema = json!({
        "definitions": { "B": { "type": "string" } },
        "type": "object",
        "properties": { "y": { "type": "number" } }
    });
    let out = inline_defs(schema);
    assert_eq!(out["properties"]["y"]["type"], "number");
}
}

#[cfg(test)]
mod transport_regressions {
    use super::*;
    #[test]
    fn output_limits_preserve_long_annotations_and_reject_unconfigured_work() {
        assert_eq!(structured_token_limit("TokensOut").unwrap(), 32_000);
        assert_eq!(structured_token_limit("LearnerTokensOut").unwrap(), 32_000);
        for name in ["WordInsight", "TopicNote", "TranslationOut", "MechanicsOut", "CoachFeedback"] {
            assert!(structured_token_limit(name).unwrap() <= 4_000);
        }
        assert!(structured_token_limit("ScaffoldsOut").unwrap() <= 8_000);
        assert!(structured_token_limit("UnconfiguredTask").is_err());
    }
    #[tokio::test]
    async fn refusal_is_not_resent_and_blocks_following_work() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}/v1", listener.local_addr().unwrap());
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
            let mut bytes = [0; 8192];
            let _ = stream.read(&mut bytes).unwrap();
            stream.write_all(b"HTTP/1.1 429 Too Many Requests\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
        });
        let provider = Provider { base_url: base, api_key: "synthetic-test-key".into(), model: "test".into() };
        let mut run = RunRecorder::start(RunContext::new(crate::ontology::op::REPLY, None), "test");
        let error = provider.post_chat(&json!({}), &mut run).await.unwrap_err();
        assert!(error.contains("429"));
        server.join().unwrap();
        // Listener is gone, but refusal must be checked before another HTTP attempt.
        let error = provider.post_chat(&json!({}), &mut run).await.unwrap_err();
        assert!(error.contains("paused after a refusal"));
        crate::request_admission::shared().resume();
        crate::gate::resume();
    }
}
