use super::*;
use crate::drill::{DrillItemInput, DrillItemView};
use base64::{Engine, engine::general_purpose::STANDARD};

#[tauri::command]
pub(in crate::application) fn create_drill_item(
    state: tauri::State<'_, Arc<Application>>,
    input: DrillItemInput,
) -> Result<DrillItemView> {
    state.lock()?.create_drill_item(input)
}

#[tauri::command]
pub(in crate::application) fn get_drill_items(
    state: tauri::State<'_, Arc<Application>>,
    language: String,
) -> Result<Vec<DrillItemView>> {
    state.lock()?.drill_items(&language)
}

#[tauri::command]
pub(in crate::application) fn delete_drill_item(
    state: tauri::State<'_, Arc<Application>>,
    item_id: String,
) -> Result<()> {
    state.lock()?.delete_drill_item(&item_id)
}

/// Delete one take and its audio.
#[tauri::command]
pub(in crate::application) fn delete_drill_attempt(
    state: tauri::State<'_, Arc<Application>>,
    attempt_id: String,
) -> Result<()> {
    state.lock()?.delete_drill_attempt(&attempt_id)
}

/// Delete a phrase's takes from `since` on, or all of them; returns how many.
#[tauri::command]
pub(in crate::application) fn clear_drill_attempts(
    state: tauri::State<'_, Arc<Application>>,
    item_id: String,
    since: Option<String>,
) -> Result<usize> {
    state
        .lock()?
        .clear_drill_attempts(&item_id, since.as_deref())
}

/// One attempt's retained audio, for replay.
#[tauri::command]
pub(in crate::application) fn get_drill_attempt_audio(
    state: tauri::State<'_, Arc<Application>>,
    attempt_id: String,
) -> Result<String> {
    Ok(STANDARD.encode(state.lock()?.drill_attempt_audio(&attempt_id)?))
}

/// Analyse audio for this item: the reference reading, or a replayed attempt.
/// Local analysis only — no network, and nothing is stored by this call.
#[tauri::command]
pub(in crate::application) async fn inspect_drill_audio(
    state: tauri::State<'_, Arc<Application>>,
    item_id: String,
    audio_base64: String,
    attempt_id: Option<String>,
    speech_alignment: Option<crate::speech::alignment::SpeechAlignment>,
) -> Result<crate::speech::analysis::audio_inspection::AudioInspection> {
    if attempt_id.is_some() && speech_alignment.is_some() {
        return Err(AppError::new(
            ErrorCode::Validation,
            "A recording cannot use reference alignment.",
        ));
    }
    // The item must exist: an inspection is always attributed to a real owner.
    let owner = crate::drill::owner(&item_id);
    if !owner.available(&state.lock()?.connection)? {
        return Err(AppError::new(
            ErrorCode::NotFound,
            "This drill item no longer exists.",
        ));
    }
    if let Some(alignment) = &speech_alignment {
        let text: String = state.lock()?.connection.query_row(
            "SELECT text FROM drill_items WHERE id=?1",
            [&item_id],
            |r| r.get(0),
        )?;
        if alignment.source_text != text {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Reference alignment belongs to different text.",
            ));
        }
    }
    let wav = STANDARD.decode(&audio_base64).map_err(|cause| {
        crate::diagnostics::failures::base64(
            &cause,
            "drill.rs_base64",
            AppError::new(ErrorCode::Validation, "Invalid recording encoding."),
        )
    })?;
    let timing =
        if let Some(attempt) = attempt_id {
            let store = state.lock()?;
            let recording: Option<String> = store.connection.query_row(
            "SELECT transcription_attempt_id FROM drill_attempts WHERE id=?1 AND drill_item_id=?2",
            rusqlite::params![attempt, item_id], |r| r.get(0))?;
            recording
                .map(|id| crate::speech::recording::results::load(&store.connection, &id, &wav))
                .transpose()?
                .flatten()
                .and_then(|result| result.timing)
        } else {
            None
        };
    tauri::async_runtime::spawn_blocking(move || {
        let (mut inspection, _) =
            crate::speech::analysis::audio_inspection::inspect_wav(&wav, &item_id, &owner)?;
        let timing = timing.or_else(|| {
            speech_alignment
                .as_ref()
                .and_then(|alignment| alignment.words(inspection.duration))
        });
        crate::speech::analysis::audio_inspection::attach_words(&mut inspection, timing.as_ref());
        Ok(inspection)
    })
    .await
    .map_err(|cause| {
        crate::diagnostics::failures::join(
            &cause,
            "drill.rs_worker",
            AppError::new(
                ErrorCode::Internal,
                "Audio inspection stopped unexpectedly.",
            ),
        )
    })?
}

#[cfg(test)]
#[path = "../tests/drill.rs"]
mod tests;

#[tauri::command]
pub(in crate::application) fn start_drill_session(
    state: tauri::State<'_, Arc<Application>>,
    language: String,
) -> Result<String> {
    state.lock()?.start_drill_session(&language)
}
#[tauri::command]
pub(in crate::application) fn end_drill_session(
    state: tauri::State<'_, Arc<Application>>,
    session_id: String,
) -> Result<()> {
    state.lock()?.end_drill_session(&session_id)
}
#[tauri::command]
pub(in crate::application) fn enter_drill_visit(
    state: tauri::State<'_, Arc<Application>>,
    session_id: String,
    item_id: String,
) -> Result<String> {
    state.lock()?.enter_drill_visit(&session_id, &item_id)
}
#[tauri::command]
pub(in crate::application) fn leave_drill_visit(
    state: tauri::State<'_, Arc<Application>>,
    visit_id: String,
) -> Result<()> {
    state.lock()?.leave_drill_visit(&visit_id)
}
#[tauri::command]
pub(in crate::application) fn get_drill_sessions(
    state: tauri::State<'_, Arc<Application>>,
    language: String,
) -> Result<Vec<crate::drill::sessions::DrillSessionView>> {
    state.lock()?.drill_sessions(&language)
}

#[tauri::command]
pub(in crate::application) fn get_drill_storage(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<crate::drill::retention::DrillStorageView> {
    state.lock()?.drill_storage()
}
#[tauri::command]
pub(in crate::application) fn set_drill_storage(
    state: tauri::State<'_, Arc<Application>>,
    limit_mb: i32,
) -> Result<crate::drill::retention::DrillStorageView> {
    state.lock()?.set_drill_storage(limit_mb)
}

#[tauri::command]
pub(in crate::application) fn drill_attempts(
    state: tauri::State<'_, Arc<Application>>,
    item_id: String,
    cursor: Option<String>,
    limit: u32,
) -> Result<crate::drill::history::DrillAttemptPage> {
    state
        .lock()?
        .drill_attempts(&item_id, cursor.as_deref(), limit)
}
