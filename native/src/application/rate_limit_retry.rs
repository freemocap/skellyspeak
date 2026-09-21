//! Bounded retries for explicit direct-provider rate limits, never ambiguous outcomes.
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
    if retry >= MAX_RETRIES || error.code != ErrorCode::Provider {
        return None;
    }
    let d = error.diagnostics.as_ref()?;
    let http_limit = is_429(&d["status"]);
    let completion_limit = d["stage"] == "provider_completion"
        && d["chars"].as_u64() == Some(0)
        && is_429(&d["response"]["choices"][0]["error"]["code"]);
    let stream_limit =
        d["stage"] == "stream" && d["chars"].as_u64() == Some(0) && is_429(&d["error"]["code"]);
    if !(http_limit || completion_limit || stream_limit) {
        return None;
    }
    let mut wait = Duration::from_millis((1000 << retry) + jitter_ms.min(250));
    if let Some(header) = d
        .pointer("/response_headers/retry_after")
        .or_else(|| d.pointer("/http/response_headers/retry_after"))
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

fn attach(result: &mut Result<Completion>, history: &[Value]) {
    if history.is_empty() {
        return;
    }
    let diagnostics = match result {
        Ok(completion) => &mut completion.diagnostics,
        Err(error) => {
            error.message = format!(
                "{} Automatic rate-limit retries scheduled: {}.",
                error.message.replace(" No automatic retry was made.", ""),
                history.len()
            );
            &mut error.diagnostics
        }
    };
    diagnostics.get_or_insert_with(|| json!({}))["automatic_retries"] = json!(history);
}

/// Each refusal is persisted before sleeping. Check authority before every HTTP
/// submission and while waiting/in flight; dropping the future cancels local work.
/// HTTP rounds remain within the original durable operation attempt, with their
/// individual errors, response metadata and planned waits retained in diagnostics.
pub(super) async fn run<F, Fut, Check, Save>(
    mut request: F,
    mut check: Check,
    mut save: Save,
) -> Result<Completion>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<Completion>>,
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
            let Err(error) = outcome else { return outcome; };
            let jitter = u64::from(uuid::Uuid::new_v4().as_bytes()[0]).min(250);
            let Some(wait) = delay(&error, history.len(), waited, jitter) else { return Err(error); };
            history.push(json!({
                "number": history.len() + 1,
                "scheduled_at_unix_ms": SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                "delay_ms": wait.as_millis() as u64,
                "error": {"code": error.code, "message": error.message, "diagnostics": error.diagnostics},
            }));
            let mut recorded = Err(error);
            attach(&mut recorded, &history);
            save(recorded.as_ref().unwrap_err())?;
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
    let mut result = result;
    attach(&mut result, &history);
    result
}

#[cfg(test)]
#[path = "tests/rate_limit_retry.rs"]
mod tests;
