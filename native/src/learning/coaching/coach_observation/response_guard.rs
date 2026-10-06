//! Guard newly returned coach output without rewriting it or retrying inference.
use crate::ai::transport::provider::Completion;
use crate::model::{AppError, ErrorCode, Result};
use serde_json::json;

pub(super) fn complete(output: &Completion) -> Result<()> {
    if output.finish_reason == "length" {
        return Err(AppError::new(
            ErrorCode::Provider,
            "Coach feedback stopped at the provider's output limit before completing. No feedback from this response was applied.",
        ).with_diagnostics(json!({
            "stage":"coach_observation_validation", "reason":"output_token_limit",
            "finish_reason":"length", "output_tokens":output.output_tokens,
        })));
    }
    Ok(())
}

/// Detect a sustained exact cycle, not ordinary emphasis or repeated evidence.
/// Eight or more copies spanning at least 512 Unicode scalars are pathological
/// for one generated explanation/correction. Quotes are never checked. No case,
/// whitespace, punctuation or canonical-encoding normalization is performed.
/// Work is bounded by 256 * field length; no quadratic substring allocation.
pub(super) fn repetitive(text: &str) -> bool {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() < 512 {
        return false;
    }
    for period in 1..=256.min(chars.len() / 8) {
        let mut matched = 0;
        for index in period..chars.len() {
            if chars[index] == chars[index - period] {
                matched += 1;
                if matched >= period * 7 && matched + period >= 512 {
                    return true;
                }
            } else {
                matched = 0;
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sustained_cycles_are_detected_across_scripts_without_normalization() {
        for phrase in [
            "One replacement / Another replacement / ",
            "你好。再见。",
            "مرحبا بالعالم. ",
            "cafe\u{301} déjà. ",
        ] {
            assert!(repetitive(&format!("Before: {} End.", phrase.repeat(100))));
            assert!(!repetitive(&phrase.repeat(3)));
        }
        assert!(!repetitive(&"x".repeat(161)));
        let distinct = (0..200)
            .map(|n| format!("Explanation number {n}. "))
            .collect::<String>();
        assert!(!repetitive(&distinct));
    }
}
