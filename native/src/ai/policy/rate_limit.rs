//! Classify explicit response metadata without interpreting request content.
use serde_json::Value;

pub(crate) fn detected(value: &Value) -> bool {
    fn codes(value: &Value, limited: &mut bool, quota: &mut bool, depth: usize) {
        if depth > 12 { return; }
        if let Some(items) = value.as_array() {
            for item in items.iter().take(64) { codes(item, limited, quota, depth + 1); }
            return;
        }
        for key in ["status", "code", "reason"] {
            let code = &value[key];
            *limited |= code.as_u64() == Some(429) || matches!(code.as_str(), Some("429" | "rate_limit" | "rate_limit_exceeded" | "too_many_requests"));
            *quota |= matches!(code.as_str(), Some("quota_exceeded" | "insufficient_quota" | "billing_hard_limit_reached" | "credit_balance_too_low" | "daily_limit" | "spending_paused"));
        }
        for key in ["error", "response", "diagnostics", "http", "choices", "provider_error", "detail", "refusal"] {
            if let Some(child) = value.get(key) { codes(child, limited, quota, depth + 1); }
        }
    }
    let (mut limited, mut quota) = (false, false);
    codes(value, &mut limited, &mut quota, 0);
    limited && !quota
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn classifies_http_and_nested_completion_limits_but_not_quota_or_content() {
        assert!(detected(&json!({"status":429})));
        assert!(detected(&json!({"response":{"choices":[{"error":{"code":429}}]}})));
        assert!(!detected(&json!({"status":429,"response":{"error":{"code":"insufficient_quota"}}})));
        assert!(!detected(&json!({"message":"429", "content":{"code":429}})));
    }
}
