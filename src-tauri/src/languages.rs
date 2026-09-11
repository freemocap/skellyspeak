use crate::model::*;

pub fn registry() -> Vec<Language> {
    [
        (
            "en",
            "English",
            "English",
            vec![("en-US", "United States"), ("en-GB", "United Kingdom")],
        ),
        (
            "es",
            "Spanish",
            "Español",
            vec![("es-ES", "Spain"), ("es-MX", "Mexico")],
        ),
        (
            "fr",
            "French",
            "Français",
            vec![("fr-FR", "France"), ("fr-CA", "Canada")],
        ),
        (
            "ar",
            "Arabic",
            "العربية",
            vec![("ar-MSA", "Modern Standard Arabic")],
        ),
        (
            "zh",
            "Mandarin",
            "普通话",
            vec![("zh-CN", "Mainland China")],
        ),
    ]
    .into_iter()
    .map(|(id, name, native_name, varieties)| Language {
        direction: if id == "ar" { "rtl" } else { "ltr" }.into(),
        romanization: match id {
            "ar" => Some("ALA-LC".into()),
            "zh" => Some("PINYIN".into()),
            _ => None,
        },
        id: id.into(),
        name: name.into(),
        native_name: native_name.into(),
        varieties: varieties
            .into_iter()
            .map(|(id, name)| Variety {
                id: id.into(),
                name: name.into(),
            })
            .collect(),
    })
    .collect()
}

pub fn language(id: &str) -> Result<Language> {
    registry()
        .into_iter()
        .find(|item| item.id == id)
        .ok_or_else(|| AppError::new(ErrorCode::Validation, "Choose a supported language."))
}

pub fn validate_settings(language_id: &str, settings: &PracticeSettings) -> Result<()> {
    let target = language(language_id)?;
    language(&settings.explanation_language)?;
    if !target
        .varieties
        .iter()
        .any(|variety| variety.id == settings.variety_id)
    {
        return Err(AppError::new(
            ErrorCode::Validation,
            "The variety must belong to the conversation language.",
        ));
    }
    Ok(())
}

pub fn defaults(language_id: &str, explanation_language: &str) -> Result<PracticeSettings> {
    let target = language(language_id)?;
    let variety = target
        .varieties
        .first()
        .ok_or_else(|| AppError::new(ErrorCode::Internal, "Language has no variety."))?;
    Ok(PracticeSettings {
        difficulty: Difficulty::Balanced,
        explanation_language: explanation_language.into(),
        variety_id: variety.id.clone(),
        composing_help: HelpAmount::Balanced,
        coach_proactivity: CoachProactivity::OnRequest,
        translation: true,
        pronunciation: false,
        romanization: false,
    })
}
