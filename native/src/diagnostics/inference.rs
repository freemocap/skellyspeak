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
fn output_limit(dispatch: &Dispatch) -> i32 {
    if dispatch.gloss_source.is_some() {
        crate::ai::transport::provider::GLOSS_OUTPUT_TOKENS
    } else {
        crate::ai::transport::provider::MAX_OUTPUT_TOKENS
    }
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
        | "skill_evidence"
        | "conversation_feedback"
        | "reply_brief"
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
        | "persona_word_gloss" => value,
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
    if let Err(error) = super::append_native(event) {
        super::fallback("inference_persistence", event, &error);
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
    event["temperature"] = json!(dispatch.temperature);
    event["maxOutputTokens"] = json!(output_limit(dispatch));
    if let Some(body) = &dispatch.decisions {
        event["requestProtocol"] = json!("decisions");
        event["questionsHash"] = json!(hash(body["questions"].to_string().as_bytes()));
        event["questionCount"] = json!(body["questions"].as_object().map(|q| q.len()));
        event["systemPromptHash"] = Value::Null;
        event["temperature"] = Value::Null;
        event["maxOutputTokens"] = Value::Null;
    }
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
    let private = private_values(dispatch, result.as_ref().ok().map(|c| c.text.as_str()));
    let mut event = base(dispatch, operation_kind);
    event["validationAccepted"] = json!(validation.is_ok());
    event["stage"] = json!(if result.is_ok() {
        "native_validation"
    } else {
        "transport"
    });
    event["errorCode"] = json!(validation.as_ref().err().map(|e| &e.code));
    event["diagnostics"] = json!(
        result
            .as_ref()
            .ok()
            .and_then(|c| c.diagnostics.as_ref())
            .or_else(|| result.as_ref().err().and_then(|e| e.diagnostics.as_ref()))
            .map(|v| super::response::metadata(v, &private))
    );
    if let Ok(output) = result {
        event["finishReason"] = json!(match output.finish_reason.as_str() {
            "stop" | "length" | "content_filter" | "error" | "tool_calls" =>
                output.finish_reason.as_str(),
            _ => "other",
        });
        event["outputBytes"] = json!(output.text.len());
        event["inputTokens"] = json!(output.input_tokens);
        event["outputTokens"] = json!(output.output_tokens);
        event["outputAtTokenLimit"] =
            json!(output.output_tokens.map(|n| n >= output_limit(dispatch)));
        event["actualModelHash"] = json!(hash(output.actual_model.as_bytes()));
        if let Some(schema) = &dispatch.coaching_schema {
            event["structure"] = super::structured::inspect(&output.text, schema);
        }
    }
    // The receipt and validation failure are independent evidence. Never select
    // one in preference to the other, or narrow authored errors to an allowlist.

    if let Some(error) = validation.as_ref().err() {
        event["error"] = super::response::error_metadata(error, &private);
        event["domainReason"] = json!(super::response::scrub(&error.message, &private));
    }
    if let Some(error) = result.as_ref().err() {
        event["transportError"] = super::response::error_metadata(error, &private);
    }
    event
}

/// Supply known request/response values before errors reach any durable sink.
pub(super) fn private_values<'a>(dispatch: &'a Dispatch, output: Option<&'a str>) -> Vec<&'a str> {
    let mut private = vec![
        dispatch.credential.as_str(),
        dispatch.target.url.as_str(),
        dispatch.install_id.as_str(),
    ];
    private.extend(dispatch.target.credential.as_deref());
    private.extend(dispatch.messages.iter().map(|m| m.content.as_str()));
    private.extend(dispatch.speech_source.as_ref().map(|s| s.text.as_str()));
    private.extend(output);
    private
}

/// Content-free warning; original response and provider metadata remain in the attempt.
pub(crate) fn emojis_removed(dispatch: &Dispatch, operation_kind: &str, count: usize) {
    emit(&json!({
        "code": "prose_emojis_removed", "level": "WARN",
        "attemptId": identity(&dispatch.attempt),
        "operationId": identity(&dispatch.operation),
        "operationKind": kind(operation_kind), "removedGraphemes": count,
    }));
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
            decisions: None,
            temperature: 0.7,
            target: ResolvedTarget {
                audio_resolution: None,
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
            gloss_schema: None,
            coaching_schema: Some(
                json!({"type":"object","required":["kind"],"properties":{"kind":{"enum":["understood"]}}}),
            ),
            gloss_source: None,
            speech_source: None,
        };
        let result = Ok(Completion {
            diagnostics: None,
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
        assert_eq!(
            event["domainReason"],
            "Coach observation rejected: non-normal completion."
        );
        assert_eq!(
            event["error"]["message"],
            "Coach observation rejected: non-normal completion."
        );
        assert!(!event.to_string().contains("SECRET"));
        let temp = tempfile::tempdir().unwrap();
        let dir = temp.path().canonicalize().unwrap().join("run");
        let mut sink = super::super::FileSink::open(&dir).unwrap();
        sink.append("native", &event).unwrap();
        let stored = std::fs::read_to_string(dir.join("native.jsonl")).unwrap();
        assert!(stored.contains(&dispatch.attempt));
        assert!(!stored.contains("SECRET"));
        let output = Completion {
            diagnostics: Some(
                json!({"request_id":"req-preserved", "usage":{"tokens":352}, "api_key":"SECRET", "content":"private-answer"}),
            ),
            text: r#"{"kind":"understood"}"#.into(),
            finish_reason: "stop".into(),
            actual_model: "fixture".into(),
            provider_id: "request".into(),
            input_tokens: Some(705),
            output_tokens: Some(352),
        };
        let rejection = Err(AppError::new(ErrorCode::Validation,"Conversation support: quote is not in its source message")
            .with_diagnostics(json!({"stage":"reply_explanations_validation","path":"cards[0].quote","expected":"exact source quote"})));
        let event = completion_event(&dispatch, "reply_explanations", &Ok(output), &rejection);
        assert_eq!(
            event["structure"]["reason"],
            "no_structural_mismatch_detected"
        );
        assert_eq!(event["diagnostics"]["request_id"], "req-preserved");
        assert_eq!(event["error"]["diagnostics"]["path"], "cards[0].quote");
        let run = temp.path().canonicalize().unwrap().join("native-1-2");
        let mut sink = super::super::FileSink::open(&run).unwrap();
        sink.append("native", &event).unwrap();
        let path = super::super::archive::save(temp.path(), temp.path()).unwrap();
        let mut zip = zip::ZipArchive::new(std::fs::File::open(path).unwrap()).unwrap();
        let mut stored = String::new();
        std::io::Read::read_to_string(
            &mut zip.by_name("logs/native-1-2/native.jsonl").unwrap(),
            &mut stored,
        )
        .unwrap();
        for retained in [
            "quote is not in its source message",
            "cards[0].quote",
            "req-preserved",
            "352",
        ] {
            assert!(stored.contains(retained));
        }
        for private in ["SECRET", "private-answer"] {
            assert!(!stored.contains(private));
        }
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
