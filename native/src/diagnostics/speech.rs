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
    event["audioAccepted"] = json!(outcome.audio.is_ok());
    event["errorCode"] = json!(outcome.audio.as_ref().err().map(|error| &error.code));
    event["finishReason"] = json!(match outcome.finish_reason.as_deref() {
        Some(reason @ ("stop" | "length" | "content_filter" | "error")) => Some(reason),
        Some(_) => Some("other"),
        None => None,
    });
    event["inputTokens"] = json!(outcome.input_tokens);
    event["outputTokens"] = json!(outcome.output_tokens);
    event["transcriptComparison"] = json!(outcome.transcript_diagnostics);
    event
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
}
