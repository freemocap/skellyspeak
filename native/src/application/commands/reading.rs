use super::*;
use crate::conversations::translation;
use crate::language::reading;
use crate::learning::coaching::conversation_support as support;
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

/// What one explicit reading request produced.
enum Aid {
    Gloss(model::WordGlossView),
    Audio(String),
    Translation(String),
    Explanations(support::ReplyExplanations),
}

fn completion_metadata(completed: &provider::Completion) -> serde_json::Value {
    serde_json::json!({"actualModel":completed.actual_model,"providerId":completed.provider_id,"finishReason":completed.finish_reason,
        "inputTokens":completed.input_tokens,"outputTokens":completed.output_tokens,"diagnostics":completed.diagnostics})
}

async fn run_owned_reading(state: &Application, id: &str) -> Result<reading::ReadingResult> {
    let request = state.reading.claim(id)?;
    let validate = || request.validate(&*state.lock()?);
    let mut metadata = serde_json::json!({});
    let outcome: Result<Aid> = async {
        validate()?;
        if let Some((audio, receipt)) = crate::drill::reference::get(&*state.lock()?, &request)? {
            metadata = serde_json::json!({"cacheHit":true,"sourceReceiptId":receipt});
            return Ok(Aid::Audio(STANDARD.encode(audio)));
        }
        let _permit = state.admission.try_chat().ok_or_else(|| AppError::new(ErrorCode::AdmissionHeld, "AI work is at capacity. Try reading help again when pending work finishes."))?;
        let client = provider::client()?;
        let key = reading::checked(&request, async {
            match request.target.credential.clone() { Some(id) => read_secret(id).await, None => Ok(Zeroizing::new(String::new())) }
        }, validate).await??;
        match request.input.aid {
            reading::ReadingAid::Speech => {
                let input = request.speech_input()?;
                request.submitted(&*state.lock()?)?;
                let completed = retry::run(|| audio::synthesize(&client, &request.target, &key, &input, &request.install), validate, |error| reading::record_retry(&*state.lock()?, &request.id, error)).await;
                metadata = serde_json::json!({"actualModel":completed.actual_model,"providerId":completed.provider_id,
                    "costMicros":completed.cost_micros,"diagnostics":completed.diagnostics});
                // The same content-free projection persona speech retains, kept
                // whether or not the audio itself was accepted.
                if let serde_json::Value::Object(fields) = crate::diagnostics::speech::outcome_metadata(&completed) {
                    for (field, value) in fields {
                        metadata[field] = value;
                    }
                }
                let bytes = completed.audio?;
                validate()?;
                Ok(Aid::Audio(STANDARD.encode(bytes)))
            }
            reading::ReadingAid::WordGloss => {
                // The word-gloss contract conversation turns use: the same
                // prompt, output schema, recovery validation and model role.
                let dispatch = request.word_gloss_dispatch()?;
                let (source, schema) = match (&dispatch.gloss_source, &dispatch.gloss_schema) {
                    (Some(source), Some(schema)) => (source, schema),
                    _ => return Err(gloss::validation_error()),
                };
                request.submitted(&*state.lock()?)?;
                let completed = retry::run(|| provider::complete_with_output(&client, &key, &dispatch, gloss::request_output(Some(source), schema)), validate, |error| reading::record_retry(&*state.lock()?, &request.id, error)).await?;
                metadata = completion_metadata(&completed);
                let (gloss, report) = gloss::recover_with_context(source, &completed, &request.operation, &request.attempt, &request.context)?;
                metadata["wordGlossValidation"] = report;
                validate()?;
                Ok(Aid::Gloss(gloss))
            }
            reading::ReadingAid::Translation => {
                // The translation contract conversation turns use: the same
                // prompt, output schema, validation and model role.
                let (dispatch, schema) = request.translation_dispatch()?;
                request.submitted(&*state.lock()?)?;
                let completed = retry::run(|| provider::complete_with_output(&client, &key, &dispatch, provider::structured_output(&schema)), validate, |error| reading::record_retry(&*state.lock()?, &request.id, error)).await?;
                metadata = completion_metadata(&completed);
                let translated = translation::validate(&request.input.text, &completed)?;
                validate()?;
                Ok(Aid::Translation(translated))
            }
            reading::ReadingAid::Explanations => {
                // The explanation contract conversation turns use: the same
                // instruction, output schema, validation and model role.
                let dispatch = request.explanations_dispatch()?;
                let schema = dispatch.coaching_schema.clone().ok_or_else(|| AppError::new(ErrorCode::Internal, "Explanation schema is missing."))?;
                request.submitted(&*state.lock()?)?;
                let completed = retry::run(|| provider::complete_with_output(&client, &key, &dispatch, provider::structured_output(&schema)), validate, |error| reading::record_retry(&*state.lock()?, &request.id, error)).await?;
                metadata = completion_metadata(&completed);
                let value = support::validate_source(&request.input.text, support::EXPLANATIONS, &completed)?;
                let explanations = serde_json::from_value(value)?;
                validate()?;
                Ok(Aid::Explanations(explanations))
            }
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
        // Keep generation metadata even if cache publication fails. A cache hit
        // has no dispatch timestamp and therefore never counts as paid usage.
        let transaction = store.connection.unchecked_transaction()?;
        let outcome = outcome.and_then(|aid| {
            if metadata["cacheHit"] != true
                && let Aid::Audio(encoded) = &aid
            {
                let audio = STANDARD.decode(encoded).map_err(|_| {
                    AppError::new(ErrorCode::Internal, "Invalid internal speech audio.")
                })?;
                crate::drill::reference::put(&store, &request, &audio)?;
            }
            Ok(aid)
        });
        let receipt = reading::finish(&store, &request, metadata, outcome.as_ref().err())?;
        transaction.commit()?;
        match outcome {
            Ok(aid) => {
                let mut result = reading::ReadingResult {
                    gloss: None,
                    audio_base64: None,
                    translation: None,
                    explanations: None,
                    receipt,
                };
                match aid {
                    Aid::Gloss(gloss) => result.gloss = Some(gloss),
                    Aid::Audio(audio) => result.audio_base64 = Some(audio),
                    Aid::Translation(text) => result.translation = Some(text),
                    Aid::Explanations(value) => result.explanations = Some(value),
                }
                Ok(result)
            }
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
