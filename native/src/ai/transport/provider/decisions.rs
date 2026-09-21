//! OpenRouter Decisions uses its own endpoint and typed response, never chat generation.
use super::{Completion, decode};
use crate::model::{AppError, ConnectionRoute, ErrorCode, Result};
use serde_json::{Value, json};

pub const URL: &str = "https://openrouter.ai/api/alpha/decisions";

pub async fn complete(
    client: &reqwest::Client,
    key: &str,
    dispatch: &crate::conversations::execution::Dispatch,
) -> Result<Completion> {
    if dispatch.route != ConnectionRoute::Openrouter {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Direct decisions require the OpenRouter route",
        ));
    }
    let body = dispatch
        .decisions
        .clone()
        .ok_or_else(|| AppError::new(ErrorCode::Validation, "Missing decisions request"))?;
    super::request::request_payload_decoded(
        client,
        &dispatch.target.url,
        key,
        dispatch.route,
        &dispatch.install_id,
        body,
        decode_decisions,
    )
    .await
}
fn decode_decisions(bytes: &[u8]) -> Result<Completion> {
    let mut value: Value = serde_json::from_slice(bytes).map_err(|_| {
        crate::diagnostics::response::invalid("decisions_json", "$", "JSON object", &Value::Null)
    })?;
    let answers = value
        .get("answers")
        .filter(|a| a.is_object())
        .ok_or_else(|| {
            crate::diagnostics::response::invalid(
                "decisions",
                "answers",
                "typed answers object",
                &value,
            )
        })?;
    let text = serde_json::to_string(answers)?;
    if let Some(usage) = value.get_mut("usage").and_then(Value::as_object_mut) {
        for (from, to) in [
            ("input_tokens", "prompt_tokens"),
            ("output_tokens", "completion_tokens"),
        ] {
            if let Some(v) = usage.get(from).cloned() {
                usage.insert(to.into(), v);
            }
        }
    }
    // The internal transport envelope uses Completion; domain validation still
    // receives and validates all typed decisions rather than generated prose.
    value["choices"] = json!([{"finish_reason":"stop","message":{"content":text}}]);
    let mut result = decode(&serde_json::to_vec(&value)?)?;
    result.diagnostics.get_or_insert_with(|| json!({}))["adapter"] = json!({"protocol":"openrouter_decisions","finishReasonOrigin":"complete_decisions_response"});
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn captured_endpoint_receives_only_the_decisions_contract() {
        let (url, worker) = super::super::fixtures::server(
            "200 OK",
            r#"{"id":"decision-http","model":"typesafe/jev-1.13","usage":{"input_tokens":3,"output_tokens":1},"answers":{}}"#,
            "",
        );
        let mut dispatch =
            super::super::fixtures::structured_dispatch(url, ConnectionRoute::Openrouter);
        let body = json!({"model":"typesafe/jev-1.13","state":{"currentLearnerMessage":"Hola"},"questions":{}});
        dispatch.decisions = Some(body.clone());
        let result = complete(
            &super::super::client().unwrap(),
            "test-credential",
            &dispatch,
        )
        .await
        .unwrap();
        assert_eq!(worker.join().unwrap(), body);
        assert_eq!(result.provider_id, "decision-http");
        assert_eq!(result.input_tokens, Some(3));
    }
    #[test]
    fn provider_usage_names_and_model_revision_survive_adapter() {
        let bytes=br#"{"id":"decision-request","model":"typesafe/jev-1.13-20260917","provider":"TypeSafe","usage":{"input_tokens":123,"output_tokens":45,"cost":0.0005},"answers":{"question":{"type":"choice","choice":"partial","probabilities":{"partial":1},"confidence":1}}}"#;
        let out = decode_decisions(bytes).unwrap();
        assert_eq!(out.input_tokens, Some(123));
        assert_eq!(out.output_tokens, Some(45));
        assert_eq!(out.actual_model, "typesafe/jev-1.13-20260917");
        assert_eq!(out.diagnostics.as_ref().unwrap()["usage"]["cost"], 0.0005);
        assert!(out.text.contains("probabilities"));
        assert!(
            !out.diagnostics
                .unwrap()
                .to_string()
                .contains("probabilities")
        );
    }
    #[test]
    fn malformed_answers_retain_billing_and_request_identity() {
        let e=decode_decisions(br#"{"id":"billed-invalid","model":"typesafe/jev-1.13","usage":{"cost":0.01},"answers":null}"#).unwrap_err();
        let d = e.diagnostics.unwrap().to_string();
        assert!(d.contains("billed-invalid"));
        assert!(d.contains("0.01"));
    }
}
