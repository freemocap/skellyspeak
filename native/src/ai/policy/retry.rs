//! Shared bounded retries for explicit provider rate limits, never ambiguous outcomes.
use crate::ai::audio::{SpeechOutcome, TranscriptionResponse};
use crate::ai::transport::provider::Completion;
use crate::model::{AppError, ErrorCode, Result};
use serde_json::{Value, json};
use std::{
    future::Future,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const MAX_RETRIES: usize = 3;
const WAIT_BUDGET: Duration = Duration::from_secs(30);

fn is_429(value: &Value) -> bool {
    value.as_u64() == Some(429) || value.as_str() == Some("429")
}

fn delay(error: &AppError, retry: usize, waited: Duration, jitter_ms: u64) -> Option<Duration> {
    if retry >= MAX_RETRIES
        || !matches!(error.code, ErrorCode::Provider | ErrorCode::UnknownOutcome)
    {
        return None;
    }
    let d = error.diagnostics.as_ref()?;
    // Grouped attempts are server-owned and deduplicated. Never replay a group.
    if d["stage"] == "grouped_operation" || d.get("automatic_retries").is_some() {
        return None;
    }
    if d["chars"].as_u64().is_some_and(|n| n > 0) {
        return None;
    }
    let upstream = d.pointer("/response/diagnostics/http");
    let wrapped_limit = d["status"] == 502 && upstream.is_some_and(|http| is_429(&http["status"]));
    let http_limit = is_429(&d["status"]);
    let code = d
        .pointer("/response/provider_error/code")
        .and_then(Value::as_str)
        .or_else(|| d.pointer("/response/detail/status").and_then(Value::as_str))
        .or_else(|| d.pointer("/response/error/code").and_then(Value::as_str));
    if code.is_some_and(|code| {
        matches!(
            code,
            "quota_exceeded"
                | "insufficient_quota"
                | "billing_hard_limit_reached"
                | "credit_balance_too_low"
        )
    }) {
        return None;
    }
    let completion_limit = d["stage"] == "provider_completion"
        && d["chars"].as_u64() == Some(0)
        && is_429(&d["response"]["choices"][0]["error"]["code"]);
    let stream_limit =
        d["stage"] == "stream" && d["chars"].as_u64() == Some(0) && is_429(&d["error"]["code"]);
    if !(http_limit || wrapped_limit || completion_limit || stream_limit) {
        return None;
    }
    let mut wait = Duration::from_millis((1000 << retry) + jitter_ms.min(250));
    if let Some(header) = d
        .pointer("/response_headers/retry_after")
        .or_else(|| d.pointer("/http/response_headers/retry_after"))
        .or_else(|| d.pointer("/response/diagnostics/http/response_headers/retry_after"))
    {
        let header = header.as_str()?;
        let seconds = match header.parse::<u64>() {
            Ok(seconds) => seconds,
            Err(_) => {
                let date = httpdate::parse_http_date(header).ok()?;
                date.duration_since(SystemTime::now())
                    .unwrap_or_default()
                    .as_secs()
                    + 1
            }
        };
        wait = wait.max(Duration::from_secs(seconds));
    }
    (waited.checked_add(wait)? <= WAIT_BUDGET).then_some(wait)
}

pub(crate) trait Metadata {
    fn diagnostics(&mut self) -> &mut Option<Value>;
}
impl Metadata for Completion {
    fn diagnostics(&mut self) -> &mut Option<Value> {
        &mut self.diagnostics
    }
}
impl Metadata for TranscriptionResponse {
    fn diagnostics(&mut self) -> &mut Option<Value> {
        &mut self.diagnostics
    }
}

pub(crate) trait Outcome: Sized {
    fn error(&self) -> Option<&AppError>;
    fn failed(error: AppError) -> Self;
    fn attach(&mut self, history: &[Value]);
}
pub(crate) fn annotate(error: &mut AppError, history: &[Value]) {
    error.message = format!(
        "{} Automatic rate-limit retries scheduled: {}.",
        error
            .message
            .replace(" No automatic retry was made.", "")
            .replace(" no automatic retry was made.", ""),
        history.len()
    );
    error.diagnostics.get_or_insert_with(|| json!({}))["automatic_retries"] = json!(history);
}
impl<T: Metadata> Outcome for Result<T> {
    fn error(&self) -> Option<&AppError> {
        self.as_ref().err()
    }
    fn failed(error: AppError) -> Self {
        Err(error)
    }
    fn attach(&mut self, history: &[Value]) {
        if history.is_empty() {
            return;
        }
        match self {
            Ok(value) => {
                value.diagnostics().get_or_insert_with(|| json!({}))["automatic_retries"] =
                    json!(history)
            }
            Err(error) => annotate(error, history),
        }
    }
}
impl Outcome for SpeechOutcome {
    fn error(&self) -> Option<&AppError> {
        self.audio.as_ref().err()
    }
    fn failed(error: AppError) -> Self {
        let mut value = Self::empty();
        value.audio = Err(error);
        value
    }
    fn attach(&mut self, history: &[Value]) {
        if history.is_empty() {
            return;
        }
        self.diagnostics.get_or_insert_with(|| json!({}))["automatic_retries"] = json!(history);
        if let Err(error) = &mut self.audio {
            annotate(error, history);
        }
    }
}

/// Each refusal is persisted before sleeping. Check authority before every HTTP
/// submission and while waiting/in flight; dropping the future cancels local work.
/// HTTP rounds remain within the original durable operation attempt, with their
/// individual errors, response metadata and planned waits retained in diagnostics.
pub(crate) async fn run<F, Fut, Check, Save, O>(
    mut request: F,
    mut check: Check,
    mut save: Save,
) -> O
where
    O: Outcome,
    F: FnMut() -> Fut,
    Fut: Future<Output = O>,
    Check: FnMut() -> Result<()>,
    Save: FnMut(&AppError) -> Result<()>,
{
    let mut history = Vec::new();
    let mut waited = Duration::ZERO;
    let result = async {
        loop {
            check()?;
            let future = request();
            tokio::pin!(future);
            let outcome = loop {
                tokio::select! {
                    result = &mut future => break result,
                    _ = tokio::time::sleep(Duration::from_millis(100)) => check()?,
                }
            };
            let Some(error) = outcome.error().cloned() else { return Ok(outcome); };
            let jitter = u64::from(uuid::Uuid::new_v4().as_bytes()[0]).min(250);
            let Some(wait) = delay(&error, history.len(), waited, jitter) else { return Ok(outcome); };
            history.push(json!({
                "number": history.len() + 1,
                "scheduled_at_unix_ms": SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                "delay_ms": wait.as_millis() as u64,
                "error": {"code": error.code, "message": error.message, "diagnostics": error.diagnostics},
            }));
            let mut recorded = error;
            annotate(&mut recorded, &history);
            save(&recorded)?;
            let sleep = tokio::time::sleep(wait);
            tokio::pin!(sleep);
            loop {
                tokio::select! {
                    _ = &mut sleep => break,
                    _ = tokio::time::sleep(Duration::from_millis(100)) => check()?,
                }
            }
            waited += wait;
        }
    }.await;
    let mut result = result.unwrap_or_else(O::failed);
    result.attach(&history);
    result
}

#[cfg(test)]
#[path = "retry_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "retry_audio_tests.rs"]
mod audio_tests;
