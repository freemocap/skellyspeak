//! Speech decoder outcome, emitted before publication so failures and cancelled
//! attempts remain diagnosable. No transcript, source text, audio or provider IDs.
use crate::{ai::audio::SpeechOutcome, conversations::execution::Dispatch};
use serde_json::{Value, json};

pub(crate) fn completed(dispatch: &Dispatch, outcome: &SpeechOutcome) {
    super::inference::emit(&event(dispatch, outcome));
}
fn event(dispatch: &Dispatch, outcome: &SpeechOutcome) -> Value {
    let mut event = super::inference::base(dispatch, "persona_speech");
    let private = super::inference::private_values(dispatch, None);
    event["diagnostics"] = json!(
        outcome
            .diagnostics
            .as_ref()
            .map(|v| super::response::metadata(v, &private))
    );
    if let Err(error) = &outcome.audio {
        event["error"] = super::response::error_metadata(
            error,
            &super::inference::private_values(dispatch, None),
        );
    }
    event["code"] = json!("speech_validation");
    event["stage"] = json!("decoder_outcome");
    event["contentRedacted"] = json!(true);
    event["errorCode"] = json!(outcome.audio.as_ref().err().map(|error| &error.code));
    if let Value::Object(fields) = outcome_metadata(outcome) {
        for (field, value) in fields {
            event[field] = value;
        }
    }
    event
}

/// What one speech outcome says about itself without its content: whether audio
/// was accepted, how it finished, its usage, and the provider's own comparison
/// of the spoken transcript with the source. Persona speech events and explicit
/// reading receipts retain the same projection, on success and on failure.
pub(crate) fn outcome_metadata(outcome: &SpeechOutcome) -> Value {
    json!({
        "audioAccepted": outcome.audio.is_ok(),
        "finishReason": match outcome.finish_reason.as_deref() {
            Some(reason @ ("stop" | "length" | "content_filter" | "error")) => Some(reason),
            Some(_) => Some("other"),
            None => None,
        },
        "inputTokens": outcome.input_tokens,
        "outputTokens": outcome.output_tokens,
        "transcriptComparison": outcome.transcript_diagnostics,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        ai::connections::access::ResolvedTarget,
        language::text_diagnostics::TranscriptDiagnostics,
        model::{AppError, ConnectionRoute, ErrorCode},
    };

    #[test]
    fn speech_event_is_correlated_durable_and_content_free_on_success_and_failure() {
        let dispatch = Dispatch {
            temperature: 0.7,
            target: ResolvedTarget {
                route: ConnectionRoute::Custom,
                revision: 1,
                url: "PRIVATE".into(),
                model: "PRIVATE".into(),
                credential: Some("PRIVATE".into()),
            },
            attempt: format!("1789652631-{}", uuid::Uuid::new_v4().simple()),
            operation: uuid::Uuid::new_v4().to_string(),
            credential: "PRIVATE".into(),
            model: "PRIVATE".into(),
            route: ConnectionRoute::Custom,
            install_id: "PRIVATE".into(),
            messages: vec![],
            gloss_schema: None,
            decisions: None,
            coaching_schema: None,
            gloss_source: None,
            speech_source: None,
        };
        let mut outcome = SpeechOutcome {
            diagnostics: None,
            audio: Err(AppError::new(ErrorCode::Provider, "PRIVATE")),
            actual_model: Some("PRIVATE".into()),
            provider_id: Some("PRIVATE".into()),
            input_tokens: Some(12),
            output_tokens: Some(30),
            cost_micros: None,
            finish_reason: Some("PRIVATE".into()),
            transcript_diagnostics: Some(TranscriptDiagnostics::new(
                "PRIVATE-क़",
                "PRIVATE-क\u{93c}",
                true,
            )),
        };
        let value = event(&dispatch, &outcome);
        assert_eq!(value["code"], "speech_validation");
        assert_eq!(value["operationKind"], "persona_speech");
        assert_eq!(value["attemptId"], dispatch.attempt);
        assert_eq!(value["operationId"], dispatch.operation);
        assert_eq!(value["audioAccepted"], false);
        assert_eq!(value["finishReason"], "other");
        assert_eq!(value["transcriptComparison"]["canonicalEquivalent"], true);
        assert!(!value.to_string().contains("PRIVATE"));
        let temp = tempfile::tempdir().unwrap();
        let dir = temp.path().canonicalize().unwrap().join("run");
        let mut sink = super::super::FileSink::open(&dir).unwrap();
        sink.append("native", &value).unwrap();
        let stored = std::fs::read_to_string(dir.join("native.jsonl")).unwrap();
        assert!(stored.contains(&dispatch.attempt));
        assert!(stored.contains("canonicalEquivalent"));
        assert!(!stored.contains("PRIVATE"));
        outcome.audio = Ok(vec![1, 2]);
        outcome.finish_reason = Some("stop".into());
        assert_eq!(event(&dispatch, &outcome)["audioAccepted"], true);
        outcome.transcript_diagnostics = None;
        assert!(event(&dispatch, &outcome)["transcriptComparison"].is_null());
    }

    #[test]
    fn shared_outcome_metadata_keeps_the_comparison_without_its_content() {
        let mut outcome = SpeechOutcome {
            diagnostics: None,
            audio: Err(AppError::new(ErrorCode::Provider, "PRIVATE")),
            actual_model: Some("PRIVATE".into()),
            provider_id: Some("PRIVATE".into()),
            input_tokens: Some(12),
            output_tokens: Some(30),
            cost_micros: None,
            finish_reason: Some("stop".into()),
            transcript_diagnostics: Some(TranscriptDiagnostics::new(
                "PRIVATE-क़",
                "PRIVATE-क\u{93c}",
                false,
            )),
        };
        // A failed attempt still explains how the spoken audio compared.
        let failed = outcome_metadata(&outcome);
        assert_eq!(failed["audioAccepted"], false);
        assert_eq!(failed["finishReason"], "stop");
        assert_eq!(failed["inputTokens"], 12);
        assert_eq!(failed["outputTokens"], 30);
        assert_eq!(failed["transcriptComparison"]["canonicalEquivalent"], true);
        assert_eq!(failed["transcriptComparison"]["complete"], false);
        assert_eq!(failed["transcriptComparison"]["source"]["devanagari"], 2);
        assert!(!failed.to_string().contains("PRIVATE"));
        outcome.audio = Ok(vec![1, 2]);
        let accepted = outcome_metadata(&outcome);
        assert_eq!(accepted["audioAccepted"], true);
        assert_eq!(
            accepted["transcriptComparison"],
            failed["transcriptComparison"]
        );
        // Absent comparison metadata is explicitly absent, never omitted.
        outcome.transcript_diagnostics = None;
        assert!(
            outcome_metadata(&outcome)
                .get("transcriptComparison")
                .is_some_and(Value::is_null)
        );
    }
}
