use super::*;
use crate::language::{linguistics::adapter, reading};
use base64::{Engine, engine::general_purpose::STANDARD};

#[tauri::command]
pub(in crate::application) fn begin_reading(
    state: tauri::State<'_, Arc<Application>>,
    input: reading::ReadingInput,
) -> Result<String> {
    state.reading.begin(&*state.lock()?, input)
}
#[tauri::command]
pub(in crate::application) fn cancel_reading(
    state: tauri::State<'_, Arc<Application>>,
    id: String,
) -> Result<()> {
    state.reading.cancel(&*state.lock()?, &id)
}
#[tauri::command]
pub(in crate::application) fn get_reading_activity(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<Vec<serde_json::Value>> {
    reading::activity(&*state.lock()?)
}
#[tauri::command]
pub(in crate::application) async fn run_reading(
    state: tauri::State<'_, Arc<Application>>,
    id: String,
) -> Result<reading::ReadingResult> {
    run_owned_reading(&state, &id).await
}

async fn run_owned_reading(state: &Application, id: &str) -> Result<reading::ReadingResult> {
    let request = state.reading.claim(id)?;
    let validate = || request.validate(&*state.lock()?);
    let mut metadata = serde_json::json!({});
    let outcome: Result<(Option<model::WordGlossView>, Option<String>)> = async {
        validate()?;
        let _permit = state.admission.try_chat().ok_or_else(|| AppError::new(ErrorCode::AdmissionHeld, "AI work is at capacity. Try reading help again when pending work finishes."))?;
        let client = provider::client()?;
        let key = reading::checked(&request, async {
            match request.target.credential.clone() { Some(id) => read_secret(id).await, None => Ok(Zeroizing::new(String::new())) }
        }, validate).await??;
        let source = request.source();
        if request.input.speech {
            let input = audio::SpeechInput { text: request.input.text.clone(), voice: "alloy".into(), language: format!("{} — {}", request.context.target_name, request.context.variety_name) };
            audio::validate_speech(&request.target, &input)?;
            request.submitted(&*state.lock()?)?;
            let completed = reading::checked(&request, audio::synthesize(&client, &request.target, &key, &input, &request.install), validate).await?;
            metadata = serde_json::json!({"actualModel":completed.actual_model,"providerId":completed.provider_id,"finishReason":completed.finish_reason,
                "inputTokens":completed.input_tokens,"outputTokens":completed.output_tokens,"costMicros":completed.cost_micros,"diagnostics":completed.diagnostics});
            let bytes = completed.audio?;
            validate()?;
            Ok((None, Some(STANDARD.encode(bytes))))
        } else {
            let prompt = adapter::build_word_gloss_prompt_with_context(&source.identity, &source.text, &request.context)
                .map_err(|_| AppError::new(ErrorCode::Validation, "This selection cannot be analyzed. Select a shorter passage."))?;
            let dispatch = execution::Dispatch { temperature: 0.0, target: request.target.clone(), attempt: request.attempt.clone(), operation: request.operation.clone(),
                credential: request.target.credential.clone().unwrap_or_default(), model: request.target.model.clone(), route: request.target.route,
                install_id: request.install.clone(), messages: prompt.messages, gloss_schema: Some(prompt.output_schema.clone()), coaching_schema: None,
                gloss_source: Some(source.clone()), speech_source: None };
            request.submitted(&*state.lock()?)?;
            let completed = reading::checked(&request, provider::complete_with_output(&client, &key, &dispatch, gloss::request_output(Some(&source), &prompt.output_schema)), validate).await??;
            metadata = serde_json::json!({"actualModel":completed.actual_model,"providerId":completed.provider_id,"finishReason":completed.finish_reason,
                "inputTokens":completed.input_tokens,"outputTokens":completed.output_tokens,"diagnostics":completed.diagnostics});
            let gloss = gloss::validate_with_context(&source, &completed, &request.operation, &request.attempt, &request.context)?;
            validate()?;
            Ok((Some(gloss), None))
        }
    }.await;
    // Always release volatile ownership, even when persisting a receipt fails.
    let result = (|| {
        let mut store = state.lock()?;
        let outcome = outcome.and_then(|value| {
            request.validate(&store)?;
            Ok(value)
        });
        if let Err(error) = &outcome {
            store.note_refusal(&request.target, error)?;
        }
        let receipt = reading::finish(&store, &request, metadata, outcome.as_ref().err())?;
        match outcome {
            Ok((gloss, audio_base64)) => Ok(reading::ReadingResult {
                gloss,
                audio_base64,
                receipt,
            }),
            Err(mut error) => {
                error.diagnostics = Some(receipt);
                Err(error)
            }
        }
    })();
    state.reading.remove(id)?;
    result
}

#[cfg(test)]
#[path = "../tests/reading.rs"]
mod tests;
