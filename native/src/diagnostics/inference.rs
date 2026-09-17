//! Correlated native publication diagnostics. Never log prompts, responses,
//! credentials, provider-controlled identifiers, or arbitrary exception strings.
use crate::{
    ai::transport::provider::Completion, conversations::execution::Dispatch, model::Result,
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn identity(value: &str) -> Option<String> {
    if let Ok(id) = uuid::Uuid::parse_str(value) {
        return Some(id.to_string());
    }
    // Native attempt IDs are timestamp-prefixed UUIDs; operations use plain UUIDs.
    let (timestamp, id) = value.split_once('-')?;
    (timestamp.len() == 10
        && timestamp.bytes().all(|b| b.is_ascii_digit())
        && id.len() == 32
        && id.bytes().all(|b| b.is_ascii_hexdigit())
        && uuid::Uuid::parse_str(id).is_ok())
    .then(|| value.to_owned())
}
fn kind(value: &str) -> &str {
    match value {
        "skill_assessment"
        | "conversation_feedback"
        | "reply_assistance"
        | "reply_explanations"
        | "coach_feedback"
        | "coach_reaction"
        | "coach_retry_check"
        | "coach_suggestions"
        | "coach_reply"
        | "persona_reply"
        | "persona_opening"
        | "persona_speech"
        | "user_translation"
        | "reply_translation"
        | "user_word_gloss"
        | "persona_word_gloss"
        | "lesson_generate"
        | "lesson_review" => value,
        _ => "other",
    }
}
pub(super) fn base(dispatch: &Dispatch, operation_kind: &str) -> Value {
    json!({"code":"inference_validation", "operationKind":kind(operation_kind),
        "attemptId":identity(&dispatch.attempt), "operationId":identity(&dispatch.operation),
        "route":dispatch.route, "modelHash":hash(dispatch.model.as_bytes()),
        "appVersion":env!("CARGO_PKG_VERSION"),
        "schemaHash":dispatch.coaching_schema.as_ref().map(|v| hash(v.to_string().as_bytes())),
        "promptBytes":dispatch.messages.iter().map(|m| m.content.len()).sum::<usize>(),
        "messageCount":dispatch.messages.len()})
}
pub(super) fn emit(event: &Value) {
    if super::append_native(event).is_err() {
        eprintln!("Native inference diagnostic could not be saved.");
    }
}
pub(crate) fn prepared(
    dispatch: &Dispatch,
    operation_kind: &str,
    captured: &Value,
    current_config_hash: &str,
) {
    let mut event = base(dispatch, operation_kind);
    event["code"] = json!("inference_prepared");
    // Hash assembled instructions so edits without a version bump remain visible.
    event["systemPromptHash"] = json!(hash(
        dispatch
            .messages
            .iter()
            .filter(|m| m.role == "system")
            .flat_map(|m| m.content.as_bytes().iter().copied().chain([0]))
            .collect::<Vec<_>>()
            .as_slice()
    ));
    for field in ["configHash", "constructRegistryHash"] {
        event[field] = captured[field]
            .as_str()
            .filter(|s| s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit()))
            .map_or(Value::Null, |s| json!(s));
    }
    event["currentConfigHash"] = json!(current_config_hash);
    event["capturedContentMatchesBuild"] = json!(
        captured["configHash"]
            .as_str()
            .map(|hash| hash == current_config_hash)
    );
    event["candidateCount"] = json!(captured["candidateConstructs"].as_array().map(Vec::len));
    event["maxOutputTokens"] = json!(crate::ai::transport::provider::MAX_OUTPUT_TOKENS);
    emit(&event);
}
pub(crate) fn completed(
    dispatch: &Dispatch,
    operation_kind: &str,
    result: &Result<Completion>,
    validation: &Result<()>,
) {
    emit(&completion_event(
        dispatch,
        operation_kind,
        result,
        validation,
    ));
}
fn completion_event(
    dispatch: &Dispatch,
    operation_kind: &str,
    result: &Result<Completion>,
    validation: &Result<()>,
) -> Value {
    let mut event = base(dispatch, operation_kind);
    event["validationAccepted"] = json!(validation.is_ok());
    event["stage"] = json!(if result.is_ok() {
        "native_validation"
    } else {
        "transport"
    });
    event["errorCode"] = json!(validation.as_ref().err().map(|e| &e.code));
    if let Ok(output) = result {
        event["finishReason"] = json!(match output.finish_reason.as_str() {
            "stop" | "length" | "content_filter" | "error" | "tool_calls" =>
                output.finish_reason.as_str(),
            _ => "other",
        });
        event["outputBytes"] = json!(output.text.len());
        event["inputTokens"] = json!(output.input_tokens);
        event["outputTokens"] = json!(output.output_tokens);
        event["outputAtTokenLimit"] = json!(
            output
                .output_tokens
                .map(|n| n >= crate::ai::transport::provider::MAX_OUTPUT_TOKENS)
        );
        event["actualModelHash"] = json!(hash(output.actual_model.as_bytes()));
        if let Some(schema) = &dispatch.coaching_schema {
            event["structure"] = super::structured::inspect(&output.text, schema);
        }
    }
    // Only fixed, authored reasons can cross the sink. JSON diagnostics above
    // provide field paths without copying serde's provider-controlled error text.
    if let Err(error) = validation {
        let reason = error
            .message
            .strip_prefix("Coach observation rejected: ")
            .or_else(|| error.message.strip_prefix("Partner reaction rejected: "))
            .and_then(|s| s.strip_suffix('.'));
        event["domainReason"] = json!(
            reason
                .filter(|reason| matches!(
                    *reason,
                    "more than one coaching suggestion"
                        | "unused coaching cue must be empty"
                        | "non-normal completion"
                        | "output exceeds 32768 bytes"
                        | "output exceeds 8192 bytes"
                        | "item count"
                        | "missing candidates"
                        | "unknown or duplicate construct"
                        | "quote not in exact learner source"
                        | "outcome conflicts with error"
                        | "invalid error category"
                        | "graduated cue reveals the answer"
                        | "missing retry provenance"
                        | "retry source replaced or missing"
                        | "missing retry construct"
                        | "repair flag contradicts target evidence"
                        | "self-repair construct missing from registry"
                        | "missing retry target"
                        | "missing repaired item"
                        | "interpretation is empty"
                        | "explanation is empty"
                        | "interpretation exceeds 400 characters"
                        | "explanation exceeds 400 characters"
                        | "interpretation violates prose contract"
                        | "explanation violates prose contract"
                        | "quote is empty"
                        | "rationale is empty"
                        | "target_hypothesis is empty"
                        | "hint is empty"
                        | "elicitation is empty"
                        | "metalinguistic is empty"
                        | "quote exceeds 160 characters"
                        | "rationale exceeds 160 characters"
                        | "target_hypothesis exceeds 160 characters"
                        | "hint exceeds 160 characters"
                        | "elicitation exceeds 160 characters"
                        | "metalinguistic exceeds 160 characters"
                ))
                .unwrap_or("see_structure_or_error_code")
        );
    }
    event
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        ai::connections::access::ResolvedTarget,
        model::{AppError, ConnectionRoute, ErrorCode},
    };
    #[test]
    fn completion_metadata_survives_rejection_without_content() {
        let dispatch = Dispatch {
            target: ResolvedTarget {
                route: ConnectionRoute::Custom,
                revision: 1,
                url: "SECRET".into(),
                model: "SECRET".into(),
                credential: Some("SECRET".into()),
            },
            attempt: format!("1789581540-{}", uuid::Uuid::new_v4().simple()),
            operation: uuid::Uuid::new_v4().to_string(),
            credential: "SECRET".into(),
            model: "SECRET".into(),
            route: ConnectionRoute::Custom,
            install_id: "SECRET".into(),
            messages: vec![],
            coaching_schema: Some(
                json!({"type":"object","required":["kind"],"properties":{"kind":{"enum":["understood"]}}}),
            ),
            gloss_source: None,
            speech_source: None,
        };
        let result = Ok(Completion {
            text: r#"{"kind":"SECRET"}"#.into(),
            finish_reason: "length".into(),
            actual_model: "SECRET".into(),
            provider_id: "SECRET".into(),
            input_tokens: Some(5770),
            output_tokens: Some(2048),
        });
        let error = Err(AppError::new(
            ErrorCode::Validation,
            "Coach observation rejected: non-normal completion.",
        ));
        let event = completion_event(&dispatch, "coach_feedback", &result, &error);
        assert_eq!(event["attemptId"], dispatch.attempt);
        assert_eq!(event["finishReason"], "length");
        assert_eq!(event["outputAtTokenLimit"], true);
        assert_eq!(event["validationAccepted"], false);
        assert_eq!(event["structure"]["path"], "$.kind");
        assert_eq!(event["domainReason"], "non-normal completion");
        assert!(!event.to_string().contains("SECRET"));
        let temp = tempfile::tempdir().unwrap();
        let dir = temp.path().canonicalize().unwrap().join("run");
        let mut sink = super::super::FileSink::open(&dir).unwrap();
        sink.append("native", &event).unwrap();
        let stored = std::fs::read_to_string(dir.join("native.jsonl")).unwrap();
        assert!(stored.contains(&dispatch.attempt));
        assert!(!stored.contains("SECRET"));
        let failure = Err(AppError::new(ErrorCode::Provider, "SECRET"));
        let event = completion_event(
            &dispatch,
            "coach_reaction",
            &failure,
            &Err(AppError::new(ErrorCode::Provider, "SECRET")),
        );
        assert_eq!(event["stage"], "transport");
        assert!(!event.to_string().contains("SECRET"));
    }
}
