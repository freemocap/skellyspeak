//! Safe structured refusal metadata. Provider prose never drives scheduling.
use crate::model::{Refusal, RefusalReason};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn now() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before epoch")
        .as_secs_f64()
}

pub fn classify(code: Option<&str>, retry_after: Option<u32>, request_id: Option<&str>) -> Refusal {
    let daily = matches!(
        code,
        Some(
            "PERSONAL_ACCOUNT_DAILY_LIMIT"
                | "SHARED_ACCOUNT_DAILY_LIMIT"
                | "PERSONAL_ALLOWANCE_EXHAUSTED"
                | "SHARED_ALLOWANCE_EXHAUSTED"
        )
    );
    let service_wide = daily || matches!(code, Some("SPENDING_PAUSED" | "INGRESS_RATE_LIMIT"));
    let time = now();
    let delay = retry_after.filter(|s| *s > 0 && *s <= 604800);
    let retry_at = if daily {
        Some(
            ((time / 86400.0).floor() * 86400.0 + 86400.0)
                .max(delay.map(|s| time + f64::from(s)).unwrap_or(time)),
        )
    } else if code == Some("SPENDING_PAUSED") {
        None // No invented expiry: recovery is an explicit user action.
    } else {
        delay
            .or(match code {
                Some("INGRESS_RATE_LIMIT") => Some(60),
                Some("TRANSCRIPTION_BUSY" | "ACCOUNT_INFLIGHT_LIMIT") => Some(5),
                _ => None,
            })
            .map(|s| time + f64::from(s))
    };
    Refusal {
        reason: if daily {
            RefusalReason::DailyLimit
        } else if code == Some("SPENDING_PAUSED") {
            RefusalReason::SpendingPaused
        } else if matches!(
            code,
            Some("INGRESS_RATE_LIMIT" | "TRANSCRIPTION_BUSY" | "ACCOUNT_INFLIGHT_LIMIT")
        ) {
            RefusalReason::RateLimit
        } else {
            RefusalReason::Unknown
        },
        service_wide,
        retry_at,
        request_id: request_id
            .filter(|id| id.len() == 32 && id.bytes().all(|b| b.is_ascii_hexdigit()))
            .map(str::to_owned),
    }
}

pub fn from_response(response: &reqwest::Response) -> Refusal {
    let delay = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.parse::<u32>().ok());
    classify(None, delay, None)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_known_codes_expand_scope_and_ids_are_allowlisted() {
        let rate = classify(None, Some(60), Some("secret\nvalue"));
        assert!(!rate.service_wide);
        assert!(rate.request_id.is_none());
        assert!(rate.retry_at.unwrap() > now());
        let daily = classify(
            Some("SHARED_ALLOWANCE_EXHAUSTED"),
            None,
            Some("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        );
        assert!(daily.service_wide);
        assert_eq!(daily.retry_at.unwrap() % 86400.0, 0.0);
        assert!(daily.request_id.is_some());
        assert!(
            classify(Some("SPENDING_PAUSED"), Some(60), None)
                .retry_at
                .is_none()
        );
        assert!(classify(None, Some(u32::MAX), None).retry_at.is_none());
        assert!(!classify(Some("UNTRUSTED_SECRET"), None, None).service_wide);
    }
}
