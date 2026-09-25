use super::*;
use crate::language::reading;
use crate::learning::coaching::conversation_support as support;
#[cfg(test)]
use base64::{Engine, engine::general_purpose::STANDARD};

/// Local preview only: a cache miss must never create or dispatch reading work.
#[tauri::command]
pub(in crate::application) fn get_cached_reading_audio(
    state: tauri::State<'_, Arc<Application>>,
    input: reading::ReadingInput,
) -> Result<Option<crate::speech::alignment::SpeechAudio>> {
    cached_reading_audio(&*state.lock()?, input)
}

fn cached_reading_audio(
    store: &Store,
    input: reading::ReadingInput,
) -> Result<Option<crate::speech::alignment::SpeechAudio>> {
    if input.aid != reading::ReadingAid::Speech {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Cached audio requires a speech request.",
        ));
    }
    let request = reading::Request::capture(store, input)?;
    request.validate_source(store)?;
    crate::ai::results::speech::lookup(
        &store.connection,
        &request.target,
        &request.speech_input()?,
        &request.install,
    )?
    .map(|saved| crate::speech::alignment::SpeechAudio::decode(&saved.payload))
    .transpose()
}

#[tauri::command]
pub(in crate::application) fn get_saved_gloss_sources(
    state: tauri::State<'_, Arc<Application>>,
    query: reading::saved::SavedGlossQuery,
) -> Result<Vec<reading::saved::SavedGlossSource>> {
    let store = state.lock()?;
    let accepted = crate::conversations::saved_reading::sources(&store, &query)?;
    let mut sources = reading::text_sources::sources(&store, &query)?;
    // Exact accepted passages take precedence in the display index.
    sources.extend(accepted);
    if serde_json::to_vec(&sources)?.len() > 8 * 1024 * 1024 {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Saved word lookup exceeds its response limit. Select a shorter passage.",
        ));
    }
    Ok(sources)
}

#[tauri::command]
pub(in crate::application) fn begin_reading(
    state: tauri::State<'_, Arc<Application>>,
    input: reading::ReadingInput,
    fresh: Option<bool>,
) -> Result<String> {
    state
        .reading
        .begin_fresh(&*state.lock()?, input, fresh.unwrap_or(false))
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
    Audio(crate::speech::alignment::SpeechAudio),
    Translation(String),
    Explanations(support::ReplyExplanations),
}

async fn run_owned_reading(state: &Arc<Application>, id: &str) -> Result<reading::ReadingResult> {
    let request = state.reading.claim(id)?;
    let validate = || request.validate_source(&*state.lock()?);
    let mut metadata = serde_json::json!({});
    let outcome: Result<Aid> = async {
        validate()?;
        if request.input.aid == reading::ReadingAid::Speech {
            let saved = state
                .shared_speech(
                    request.target.clone(),
                    request.speech_input()?,
                    request.install.clone(),
                    &request.id,
                    validate,
                )
                .await?;
            metadata = saved.metadata.clone();
            metadata["sourceExecutionId"] = serde_json::json!(saved.execution);
            metadata["cacheHit"] = serde_json::json!(saved.cached);
            metadata["audioAccepted"] = serde_json::json!(true);
            metadata["transcriptComparison"] = serde_json::Value::Null;
            validate()?;
            return Ok(Aid::Audio(crate::speech::alignment::SpeechAudio::decode(
                &saved.payload,
            )?));
        }
        let saved = state
            .shared_reading(request.clone())
            .await
            .inspect_err(|error| {
                if let Some(response) = error.diagnostics.as_ref().and_then(|d| d.get("response")) {
                    metadata = response.clone();
                }
            })?;
        metadata = saved.metadata;
        metadata["sourceExecutionId"] = serde_json::json!(saved.execution);
        metadata["cacheHit"] = serde_json::json!(saved.cached);
        let stored = reading::text::Stored::decode(&saved.payload)?;
        match request.input.aid {
            reading::ReadingAid::WordGloss => stored.gloss.map(Aid::Gloss),
            reading::ReadingAid::Translation => stored.translation.map(Aid::Translation),
            reading::ReadingAid::Explanations => stored.explanations.map(Aid::Explanations),
            reading::ReadingAid::Speech => unreachable!(),
        }
        .ok_or_else(|| {
            AppError::new(
                ErrorCode::Storage,
                "Saved reading result is missing its requested aid.",
            )
        })
    }
    .await;
    // Always release volatile ownership, even when persisting a receipt fails.
    let result = (|| {
        let mut store = state.lock()?;
        let outcome = outcome.and_then(|value| {
            request.validate_source(&store)?;
            Ok(value)
        });
        if let Err(error) = &outcome {
            store.note_refusal(&request.target, error)?;
        }
        // Keep generation metadata even if cache publication fails. A cache hit
        // has no dispatch timestamp and therefore never counts as paid usage.
        let transaction = store.connection.unchecked_transaction()?;
        let receipt = reading::finish(&store, &request, metadata, outcome.as_ref().err())?;
        transaction.commit()?;
        match outcome {
            Ok(aid) => {
                let mut result = reading::ReadingResult {
                    gloss: None,
                    audio_base64: None,
                    audio_alignment: None,
                    translation: None,
                    explanations: None,
                    receipt,
                };
                match aid {
                    Aid::Gloss(gloss) => result.gloss = Some(gloss),
                    Aid::Audio(audio) => {
                        result.audio_base64 = Some(audio.audio_base64);
                        result.audio_alignment = audio.alignment;
                    }
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

#[cfg(test)]
#[path = "../tests/shared_reading.rs"]
mod shared_tests;
