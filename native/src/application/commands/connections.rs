use super::*;
use crate::model::AssessmentAdapter;
use crate::model::AudioSettings;

#[tauri::command]
pub(in crate::application) fn get_connection(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<ConnectionConfig> {
    state.lock()?.connection_config()
}

#[tauri::command]
pub(in crate::application) fn save_models(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
    standard_model: String,
    fast_model: String,
    audio: AudioSettings,
    assessment_adapter: AssessmentAdapter,
) -> Result<ConnectionConfig> {
    available_assessment(assessment_adapter)?;
    let mut store = state.lock()?;
    store.set_models(
        expected_revision,
        standard_model.trim(),
        fast_model.trim(),
        &audio,
        assessment_adapter,
    )?;
    store.connection_config()
}

#[tauri::command]
pub(in crate::application) fn select_route(
    state: tauri::State<'_, Arc<Application>>,
    expected_revision: i32,
    route: ConnectionRoute,
) -> Result<ConnectionConfig> {
    let mut store = state.lock()?;
    store.select_route(expected_revision, route)?;
    store.connection_config()
}

// Presence assessment has one supported strategy.
fn available_assessment(adapter: AssessmentAdapter) -> Result<()> {
    if adapter != AssessmentAdapter::JevChoice {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Skill presence uses Jev Choice.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod assessment_availability_tests {
    use super::*;
    #[test]
    fn settings_accept_jev_and_reject_chat() {
        assert!(available_assessment(AssessmentAdapter::JevChoice).is_ok());
        assert!(available_assessment(AssessmentAdapter::ChatModel).is_err());
    }
}
