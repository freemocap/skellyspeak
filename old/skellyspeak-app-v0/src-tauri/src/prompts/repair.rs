//! What we say to a model that returned something unusable.
//!
//! These two lines are the corrective turns appended before a structured-output
//! retry (`ai.rs::structured_validated`). They are short, and they were inlined
//! in the retry loop for a long time — but they are prompt text, they are worth
//! tuning, and someone auditing what this app says to a model should not have
//! to read a retry loop to find them.

/// The response parsed, but failed our own validator.
pub fn invalid_content(problem: &str) -> String {
    format!(
        "Validation error: {problem}. Return the COMPLETE corrected JSON \
         object, with every list populated."
    )
}

/// The response was not JSON at all.
pub fn unparseable(error: &str) -> String {
    format!("That was not valid JSON ({error}). Respond with ONLY the JSON object matching the schema.")
}
