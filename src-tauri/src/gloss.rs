//! Source-owned projection for one persona-message gloss result.
use crate::{
    linguistics::{self, Annotation, Coverage, SourceIdentity, SourceMap, adapter},
    model::{
        AppError, ErrorCode, GlossCoverage, GlossSegment, GlossSegmentKind, Result, WordGlossView,
    },
    provider::{Completion, RequestOutput},
};

#[derive(Debug, Clone)]
pub struct Source {
    pub identity: SourceIdentity,
    pub text: String,
}

pub fn request_output<'a>(
    source: Option<&Source>,
    schema: &'a serde_json::Value,
) -> RequestOutput<'a> {
    if source.is_some() {
        RequestOutput::JsonSchema {
            name: adapter::FORMAT_ID,
            schema,
        }
    } else {
        RequestOutput::Prose
    }
}

pub fn validation_error() -> AppError {
    AppError::new(
        ErrorCode::Provider,
        "Word meanings failed the source-bound output contract. No new word meanings were saved.",
    )
}

pub fn validate(
    source: &Source,
    completion: &Completion,
    operation: &str,
    attempt: &str,
) -> Result<WordGlossView> {
    let analysis =
        adapter::validate_word_gloss_completion(&source.identity, &source.text, completion)
            .map_err(|error| {
                let location = error
                    .span_index()
                    .map(|index| format!("; span {index}"))
                    .unwrap_or_default();
                AppError::new(
                    ErrorCode::Provider,
                    format!(
                        "Word meanings rejected: {}{}. No new word meanings were saved.",
                        error.diagnostic_code(),
                        location
                    ),
                )
            })?;
    let map = SourceMap::new(&source.text).map_err(|_| validation_error())?;
    let segments = analysis
        .segments()
        .iter()
        .map(|segment| {
            let span = map
                .utf16_span(segment.span)
                .map_err(|_| validation_error())?;
            let (kind, gloss) = match &segment.annotation {
                Annotation::Gloss { gloss, .. } => (GlossSegmentKind::Gloss, Some(gloss.clone())),
                Annotation::Literal => (GlossSegmentKind::Literal, None),
                Annotation::Unresolved => (GlossSegmentKind::Unresolved, None),
            };
            Ok(GlossSegment {
                start: span.start as u32,
                end: span.end as u32,
                kind,
                gloss,
                romanization: match &segment.annotation {
                    Annotation::Gloss { romanization, .. } => romanization.clone(),
                    _ => None,
                },
                pronunciation: match &segment.annotation {
                    Annotation::Gloss { pronunciation, .. } => pronunciation.clone(),
                    _ => None,
                },
            })
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(WordGlossView {
        source_message_id: source.identity.message_id.clone(),
        target_language_id: source.identity.target_language_id.clone(),
        explanation_language_id: source.identity.explanation_language_id.clone(),
        format_version: adapter::FORMAT_ID.into(),
        template_version: adapter::TEMPLATE_ID.into(),
        boundary_policy: linguistics::BOUNDARY_POLICY.into(),
        operation_id: operation.into(),
        attempt_id: attempt.into(),
        coverage: match analysis.coverage() {
            Coverage::Complete => GlossCoverage::Complete,
            Coverage::Partial => GlossCoverage::Partial,
        },
        segments,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn source() -> Source {
        Source {
            identity: SourceIdentity {
                message_id: "message".into(),
                target_language_id: "es".into(),
                explanation_language_id: "en".into(),
                analysis_version: linguistics::ANALYSIS_VERSION.into(),
            },
            text: "𐐀 sí sí!".into(),
        }
    }
    fn completion() -> Completion {
        Completion { text: r#"{"spans":[{"first":"g0002","last":"g0003","kind":"gloss","gloss":"yes"},{"first":"g0005","last":"g0006","kind":"gloss","gloss":"indeed"}]}"#.into(), finish_reason: "stop".into(), actual_model: "fixture".into(), provider_id: "fixture".into(), input_tokens: Some(10), output_tokens: Some(4) }
    }
    #[test]
    fn projection_preserves_repeated_occurrences_and_utf16_source_binding() {
        let source = source();
        let view = validate(&source, &completion(), "operation", "attempt").unwrap();
        let words: Vec<_> = view
            .segments
            .iter()
            .filter(|s| s.kind == GlossSegmentKind::Gloss)
            .collect();
        assert_eq!((words[0].start, words[0].end), (3, 5));
        assert_eq!((words[1].start, words[1].end), (6, 8));
        assert_eq!(words[0].gloss.as_deref(), Some("yes"));
        assert_eq!(words[1].gloss.as_deref(), Some("indeed"));
        assert_eq!(view.coverage, GlossCoverage::Partial);
        assert_eq!(view.source_message_id, "message");
        assert_eq!(view.operation_id, "operation");
        assert_eq!(view.attempt_id, "attempt");
        assert_eq!(
            serde_json::from_str::<WordGlossView>(&serde_json::to_string(&view).unwrap()).unwrap(),
            view
        );
    }
    #[test]
    fn projection_preserves_readings_for_the_exact_source_span() {
        let mut source = source();
        source.text = "你好".into();
        source.identity.target_language_id = "zh".into();
        let mut output = completion();
        output.text = r#"{"spans":[{"first":"g0000","last":"g0001","kind":"gloss","gloss":"hello","romanization":"nǐ hǎo","pronunciation":null}]}"#.into();
        let view = validate(&source, &output, "operation", "attempt").unwrap();
        assert_eq!(view.segments[0].romanization.as_deref(), Some("nǐ hǎo"));
        assert_eq!(view.segments[0].pronunciation, None);
        assert_eq!((view.segments[0].start, view.segments[0].end), (0, 2));
    }
    #[test]
    fn projection_rejects_bad_output_without_echoing_content_or_consuming_usage() {
        let mut output = completion();
        output.text = "private malformed response".into();
        let error = validate(&source(), &output, "operation", "attempt").unwrap_err();
        assert!(!error.message.contains("private"));
        assert!(error.message.starts_with("Word meanings rejected: "));
        assert_eq!(output.input_tokens, Some(10));
        assert_eq!(output.output_tokens, Some(4));
    }
}
