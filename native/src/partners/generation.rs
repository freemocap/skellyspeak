//! Persona-specific request projection; execution ownership lives in ai::generation.
use crate::{ai::generation::Request, model::*, partners::persona, storage::store::Store};
impl Request {
    pub fn capture(store: &Store, language_id: String, brief: Option<String>) -> Result<Self> {
        if brief
            .as_deref()
            .is_some_and(|text| text.chars().count() > persona::BRIEF_MAX || text.contains('\0'))
        {
            return Err(AppError::new(
                ErrorCode::Validation,
                "The generation brief exceeds its limit.",
            ));
        }
        let preferences = store.snapshot()?.learner.preferences;
        let settings = store
            .config
            .preference_defaults(&language_id, &preferences)?;
        let context = store.config.resolve_pair(
            &language_id,
            Some(&settings.variety_id),
            &settings.explanation_language,
            Some(&settings.explanation_variety_id),
        )?;
        Self::capture_context(store, "persona", context, brief)
    }
}
