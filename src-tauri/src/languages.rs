use crate::model::*;
use std::sync::OnceLock;

#[derive(Clone, Copy)]
enum Direction {
    Ltr,
    Rtl,
}
impl Direction {
    fn label(self) -> &'static str {
        match self {
            Self::Ltr => "ltr",
            Self::Rtl => "rtl",
        }
    }
}

#[derive(Clone, Copy)]
struct LanguageConfig {
    id: &'static str,
    name: &'static str,
    native_name: &'static str,
    font_scale: f64,
    direction: Direction,
    romanization: Option<&'static str>,
    varieties: &'static [(&'static str, &'static str)],
    default_variety: &'static str,
    writing_guidance: Option<&'static str>,
}

const CONFIGS: &[LanguageConfig] = &[
    LanguageConfig {
        id: "en",
        name: "English",
        native_name: "English",
        font_scale: 1.0,
        direction: Direction::Ltr,
        romanization: None,
        varieties: &[("en-US", "United States"), ("en-GB", "United Kingdom")],
        default_variety: "en-US",
        writing_guidance: None,
    },
    LanguageConfig {
        id: "es",
        name: "Spanish",
        native_name: "Español",
        font_scale: 1.0,
        direction: Direction::Ltr,
        romanization: None,
        varieties: &[("es-ES", "Spain"), ("es-MX", "Mexico")],
        default_variety: "es-ES",
        writing_guidance: None,
    },
    LanguageConfig {
        id: "fr",
        name: "French",
        native_name: "Français",
        font_scale: 1.0,
        direction: Direction::Ltr,
        romanization: None,
        varieties: &[("fr-FR", "France"), ("fr-CA", "Canada")],
        default_variety: "fr-FR",
        writing_guidance: None,
    },
    LanguageConfig {
        id: "ar",
        name: "Arabic",
        native_name: "العربية",
        font_scale: 1.5,
        direction: Direction::Rtl,
        romanization: Some("ALA-LC"),
        varieties: &[("ar-MSA", "Modern Standard Arabic")],
        default_variety: "ar-MSA",
        writing_guidance: None,
    },
    LanguageConfig {
        id: "zh",
        name: "Mandarin",
        native_name: "中文（简体）",
        font_scale: 1.3,
        direction: Direction::Ltr,
        romanization: Some("PINYIN"),
        varieties: &[("zh-CN", "Mainland China")],
        default_variety: "zh-CN",
        writing_guidance: Some(
            "Write newly generated Mandarin text in Simplified Chinese characters. When reproducing a source excerpt verbatim, preserve it exactly. This does not prevent translating text when translation is requested.",
        ),
    },
];

fn validate_configs(configs: &[LanguageConfig]) -> std::result::Result<(), &'static str> {
    if configs.is_empty() {
        return Err("Language configuration is empty.");
    }
    for (index, config) in configs.iter().enumerate() {
        if config.id.trim().is_empty()
            || config.name.trim().is_empty()
            || config.native_name.trim().is_empty()
        {
            return Err("Language identity or label is empty.");
        }
        if configs[..index].iter().any(|other| other.id == config.id) {
            return Err("Language identity is duplicated.");
        }
        if config
            .writing_guidance
            .is_some_and(|text| text.trim().is_empty())
        {
            return Err("Writing guidance is empty.");
        }
        if config
            .romanization
            .is_some_and(|scheme| scheme.trim().is_empty())
        {
            return Err("Romanization scheme is empty.");
        }
        if !config
            .varieties
            .iter()
            .any(|(id, _)| *id == config.default_variety)
        {
            return Err("Default variety is absent.");
        }
        for (index, (id, name)) in config.varieties.iter().enumerate() {
            if id.trim().is_empty() || name.trim().is_empty() {
                return Err("Variety identity or label is empty.");
            }
            if config.varieties[..index]
                .iter()
                .any(|(other, _)| other == id)
            {
                return Err("Variety identity is duplicated.");
            }
        }
    }
    Ok(())
}

fn configs() -> &'static [LanguageConfig] {
    static VALIDATED: OnceLock<()> = OnceLock::new();
    // Compiled programmer-owned data: fail immediately on an invalid table;
    // never expose an incomplete registry or silently substitute a language.
    VALIDATED.get_or_init(|| {
        validate_configs(CONFIGS).expect("invalid compiled language configuration")
    });
    CONFIGS
}

fn resolve(id: &str) -> Result<&'static LanguageConfig> {
    configs()
        .iter()
        .find(|config| config.id == id)
        .ok_or_else(|| AppError::new(ErrorCode::Validation, "Choose a supported language."))
}

fn project(config: &LanguageConfig) -> Language {
    Language {
        id: config.id.into(),
        name: config.name.into(),
        native_name: config.native_name.into(),
        font_scale: config.font_scale,
        direction: config.direction.label().into(),
        romanization: config.romanization.map(str::to_owned),
        varieties: config
            .varieties
            .iter()
            .map(|(id, name)| Variety {
                id: (*id).into(),
                name: (*name).into(),
            })
            .collect(),
    }
}

pub fn registry() -> Vec<Language> {
    configs().iter().map(project).collect()
}

pub fn language(id: &str) -> Result<Language> {
    resolve(id).map(project)
}

/// Trusted writing guidance for the resolved language/variety, never source rewriting.
pub fn writing_guidance(
    language_id: &str,
    variety_id: Option<&str>,
) -> Result<Option<&'static str>> {
    let config = resolve(language_id)?;
    let variety = variety_id.unwrap_or(config.default_variety);
    if !config.varieties.iter().any(|(id, _)| *id == variety) {
        return Err(AppError::new(
            ErrorCode::Validation,
            "The variety must belong to the conversation language.",
        ));
    }
    Ok(config.writing_guidance)
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
    if settings.speech_voice != "alloy" {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Choose a supported speech voice.",
        ));
    }
    Ok(())
}

pub fn defaults(language_id: &str, explanation_language: &str) -> Result<PracticeSettings> {
    let target = resolve(language_id)?;
    Ok(PracticeSettings {
        difficulty: Difficulty::Beginner,
        explanation_language: explanation_language.into(),
        variety_id: target.default_variety.into(),
        composing_help: HelpAmount::Balanced,
        coach_proactivity: CoachProactivity::OnRequest,
        translation: true,
        pronunciation: false,
        romanization: false,
        auto_send: true,
        read_aloud: true,
        speech_voice: "alloy".into(),
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn every_language_starts_at_beginner() {
        for language in super::CONFIGS {
            assert_eq!(
                super::defaults(language.id, "en").unwrap().difficulty,
                crate::model::Difficulty::Beginner
            );
        }
    }

    use super::*;

    #[test]
    fn writing_guidance_resolves_only_its_own_language_and_variety() {
        let guidance = writing_guidance("zh", None).unwrap().unwrap();
        assert!(guidance.contains("Simplified Chinese"));
        assert_eq!(
            writing_guidance("zh", Some("zh-CN")).unwrap(),
            Some(guidance)
        );
        for language in ["en", "es", "fr", "ar"] {
            assert_eq!(writing_guidance(language, None).unwrap(), None);
        }
        assert!(writing_guidance("zh", Some("es-ES")).is_err());
        assert!(writing_guidance("es", Some("zh-CN")).is_err());
        assert!(writing_guidance("unknown", None).is_err());
        assert!(
            validate_configs(&[LanguageConfig {
                writing_guidance: Some(" "),
                ..CONFIGS[0]
            }])
            .is_err()
        );
    }

    #[test]
    fn current_registry_and_defaults_preserve_consumer_values() {
        let expected = [
            (
                "en",
                "English",
                "English",
                "ltr",
                None,
                vec![("en-US", "United States"), ("en-GB", "United Kingdom")],
            ),
            (
                "es",
                "Spanish",
                "Español",
                "ltr",
                None,
                vec![("es-ES", "Spain"), ("es-MX", "Mexico")],
            ),
            (
                "fr",
                "French",
                "Français",
                "ltr",
                None,
                vec![("fr-FR", "France"), ("fr-CA", "Canada")],
            ),
            (
                "ar",
                "Arabic",
                "العربية",
                "rtl",
                Some("ALA-LC"),
                vec![("ar-MSA", "Modern Standard Arabic")],
            ),
            (
                "zh",
                "Mandarin",
                "中文（简体）",
                "ltr",
                Some("PINYIN"),
                vec![("zh-CN", "Mainland China")],
            ),
        ];
        let values = registry();
        assert_eq!(values.len(), expected.len());
        for (actual, (id, name, native, direction, scheme, varieties)) in
            values.iter().zip(expected)
        {
            assert_eq!(
                serde_json::to_value(actual).unwrap(),
                serde_json::json!({
                    "fontScale":if id=="ar" {1.5}else if id=="zh" {1.3}else{1.0},"id":id,"name":name,"nativeName":native,"direction":direction,"romanization":scheme,
                    "varieties":varieties.iter().map(|(id,name)| serde_json::json!({"id":id,"name":name})).collect::<Vec<_>>()
                })
            );
            assert_eq!(
                serde_json::to_value(language(id).unwrap()).unwrap(),
                serde_json::to_value(actual).unwrap()
            );
            for explanation in ["en", "es", "fr", "ar", "zh"] {
                let settings = defaults(id, explanation).unwrap();
                assert_eq!(
                    settings,
                    PracticeSettings {
                        difficulty: Difficulty::Beginner,
                        explanation_language: explanation.into(),
                        variety_id: varieties[0].0.into(),
                        composing_help: HelpAmount::Balanced,
                        coach_proactivity: CoachProactivity::OnRequest,
                        translation: true,
                        pronunciation: false,
                        romanization: false,
                        auto_send: true,
                        read_aloud: true,
                        speech_voice: "alloy".into(),
                    }
                );
                validate_settings(id, &settings).unwrap();
            }
        }
        for bad in ["", "ES", " es", "es-MX", "unknown"] {
            assert!(language(bad).is_err());
        }
        // Preserve the existing API boundary: defaults copies explanation input;
        // validate_settings is responsible for rejecting an unknown explanation.
        let mut settings = defaults("es", "unknown").unwrap();
        assert!(validate_settings("es", &settings).is_err());
        settings.explanation_language = "en".into();
        settings.variety_id = "fr-FR".into();
        assert!(validate_settings("es", &settings).is_err());
    }

    #[test]
    fn malformed_tables_fail_and_default_is_independent_of_order() {
        let base = CONFIGS[0];
        assert!(validate_configs(&[]).is_err());
        assert!(validate_configs(&[base, base]).is_err());
        for bad in [
            LanguageConfig { id: " ", ..base },
            LanguageConfig { name: "", ..base },
            LanguageConfig {
                native_name: "",
                ..base
            },
            LanguageConfig {
                romanization: Some(" "),
                ..base
            },
            LanguageConfig {
                varieties: &[],
                ..base
            },
            LanguageConfig {
                default_variety: "missing",
                ..base
            },
            LanguageConfig {
                varieties: &[("en-US", "United States"), ("en-US", "Duplicate")],
                ..base
            },
            LanguageConfig {
                varieties: &[("en-US", "")],
                ..base
            },
            LanguageConfig {
                varieties: &[("", "Empty")],
                default_variety: "",
                ..base
            },
        ] {
            assert!(validate_configs(&[bad]).is_err());
        }
        let reordered = LanguageConfig {
            varieties: &[("en-GB", "United Kingdom"), ("en-US", "United States")],
            ..base
        };
        validate_configs(&[reordered]).unwrap();
        assert_eq!(reordered.default_variety, "en-US");
        assert_ne!(reordered.varieties[0].0, reordered.default_variety);
    }

    #[test]
    fn voice_defaults_are_on_and_explicitly_disableable() {
        let mut settings = defaults("es", "en").unwrap();
        assert!(settings.auto_send && settings.read_aloud);
        assert_eq!(settings.speech_voice, "alloy");
        validate_settings("es", &settings).unwrap();
        settings.auto_send = false;
        settings.read_aloud = false;
        validate_settings("es", &settings).unwrap();
        let encoded = serde_json::to_value(&settings).unwrap();
        assert_eq!(encoded["autoSend"], false);
        assert_eq!(encoded["readAloud"], false);
        assert_eq!(
            serde_json::from_value::<PracticeSettings>(encoded).unwrap(),
            settings
        );
        settings.speech_voice = "unsupported".into();
        assert!(validate_settings("es", &settings).is_err());
    }
}
