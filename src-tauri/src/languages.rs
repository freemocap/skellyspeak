/// Language registry — the SINGLE source of truth. Every language here is
/// fully symmetric: usable as the TARGET (AI conversation + analysis
/// language) or the NATIVE (learner's own language + app UI language, see
/// lib/i18n.ts). All pairwise combinations are supported by construction:
/// prompts take target/native names from this table, STT uses `base` for
/// Whisper language codes, and overlays carry per-target guidance.
///
/// `romanization` carries the romanization scheme for non-Latin scripts
/// (ALA-LC for Arabic); the AI returns a romanized form alongside the
/// native script and the UI displays both. Latin-script languages use None.
///
/// Ladder (docs/future-work.md): a language only enters the registry once
/// its interaction quirks are handled (space-delimited text, accented input,
/// RTL, segmentation). Current rungs: en-US, fr-FR, es-ES, ar-Levantine.
/// Next: Mandarin (segmentation + tones).
pub struct Language {
    /// BCP-47 code — used as `target_language` in settings.
    pub code: &'static str,
    /// ISO 639-1 base — used as `native_language` in settings and for STT.
    pub base: &'static str,
    /// Display name (English label, region-qualified).
    pub name: &'static str,
    /// The language's own name, as its speakers write it.
    pub endonym: &'static str,
    /// Text direction for UI rendering.
    pub direction: &'static str,
    /// Romanization scheme for non-Latin scripts (ALA-LC, PINYIN, ...), or
    /// None for Latin-script languages.
    pub romanization: Option<&'static str>,
    /// Target-language guidance injected into every prompt when this
    /// language is the target. `{dialect}` interpolates the selected
    /// dialect's guidance; the default dialect fills it when none chosen.
    pub overlay: &'static str,
    /// Regional variants of this language. The first entry is the default.
    pub dialects: &'static [(&'static str, &'static str)],
}

pub const LANGUAGES: &[Language] = &[
    Language {
        code: "en-US",
        base: "en",
        name: "English (US)",
        endonym: "English",
        direction: "ltr",
        dialects: &[
            ("en-US", "Standard American"),
        ],
        romanization: None,
        overlay: "Language-specific guidance:\n- Use American English spelling, vocabulary, and idiom consistently (color, organize, elevator).\n- Pay close attention to word order, verb tenses, and preposition usage.\n- Avoid British-only vocabulary unless explicitly comparing variants.\n- Keep register natural: contractions (I'm, don't) are fine and expected in casual conversation.{dialect}",
    },
    Language {
        code: "fr-FR",
        base: "fr",
        name: "French",
        endonym: "Français",
        direction: "ltr",
        dialects: &[
            ("fr-FR", "France (standard)"),
            ("fr-CA", "Québécois (Canada)"),
        ],
        romanization: None,
        overlay: "Language-specific guidance:\n- Use standard French as spoken in France consistently.\n- Pay close attention to accents (é, è, ê, ç), elision (j'ai, l'ami), gender, and number agreement.\n- Use tu or vous consistently according to the context and learner level.\n- Avoid Canadian/Belgian/Swiss regionalisms unless explicitly comparing them.\n- Natural French phrasing: contractions (au, du, aux) and liaison where appropriate.{dialect}",
    },
    Language {
        code: "es-ES",
        base: "es",
        name: "Spanish",
        endonym: "Español",
        direction: "ltr",
        dialects: &[
            ("es-ES", "Spain (Peninsular)"),
            ("es-MX", "Mexican"),
            ("es-AR", "Rioplatense (Argentina)"),
        ],
        romanization: None,
        overlay: "Language-specific guidance:\n- Use Peninsular Spanish from Spain consistently.\n- Prefer Spain usage, including vosotros for informal plural address when appropriate.\n- Avoid voseo and Latin American-only vocabulary unless explicitly comparing variants.\n- Pay close attention to accents, gender, number agreement, and natural Spain Spanish phrasing.{dialect}",
    },
    Language {
        code: "ar",
        base: "ar",
        name: "Arabic",
        endonym: "العربية",
        direction: "rtl",
        dialects: &[
            ("ar-LE", "Levantine"),
            ("ar-EG", "Egyptian"),
            ("ar-MSA", "Modern Standard Arabic"),
        ],
        romanization: Some("ALA-LC"),
        overlay: "Language-specific guidance:\n- Use Levantine Arabic (Lebanon/Syria/Jordan/Palestine) as understood across the region.\n- Write in Arabic script with natural spelling; do not write in Latin characters.\n- Modern Standard Arabic vocabulary is acceptable when no Levantine equivalent exists, but keep grammar and phrasing Levantine.\n- Pay attention to root-and-pattern morphology: forms I-X change meaning systematically.\n- gender and number agreement are mandatory; the dual form exists alongside singular and plural.\n- Do not vocalize with full diacritics (tashkeel); write as natives type, unvocalized.{dialect}",
    },
];

/// The registry as the webview sees it. Mirrors `Language` with dialects
/// flattened into objects — `src/lib/tauri.ts` renders straight from this,
/// so there is exactly ONE language table in the codebase.
#[derive(Debug, Clone, serde::Serialize)]
pub struct LanguageInfo {
    pub code: &'static str,
    pub base: &'static str,
    pub name: &'static str,
    pub endonym: &'static str,
    pub direction: &'static str,
    pub romanization: Option<&'static str>,
    pub dialects: Vec<DialectInfo>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DialectInfo {
    pub id: &'static str,
    pub label: &'static str,
}

pub fn registry() -> Vec<LanguageInfo> {
    LANGUAGES
        .iter()
        .map(|l| LanguageInfo {
            code: l.code,
            base: l.base,
            name: l.name,
            endonym: l.endonym,
            direction: l.direction,
            romanization: l.romanization,
            dialects: l
                .dialects
                .iter()
                .map(|(id, label)| DialectInfo { id, label })
                .collect(),
        })
        .collect()
}

/// Display name for a language code — exact BCP-47 match first, then base
/// match, else the code itself.
pub fn language_display(code: &str) -> String {
    let base = code.split('-').next().unwrap_or(code);
    LANGUAGES
        .iter()
        .find(|l| l.code == code || l.base == base)
        .map(|l| l.name.to_string())
        .unwrap_or_else(|| code.to_string())
}

/// Endonym for a base language code ("en" -> "English").
pub fn native_display(base: &str) -> String {
    let base = base.split('-').next().unwrap_or(base);
    LANGUAGES
        .iter()
        .find(|l| l.base == base)
        .map(|l| l.endonym.to_string())
        .unwrap_or_else(|| base.to_string())
}

/// Convert a BCP-47 target language to the ISO 639-1 code used by STT APIs.
pub fn iso639(code: &str) -> String {
    code.split('-').next().unwrap_or(code).to_lowercase()
}

/// Target-language guidance injected into every prompt when this language
/// is the target. The `{dialect}` placeholder in the overlay interpolates
/// the selected dialect's guidance line.
pub fn overlay(code: &str, dialect: Option<&str>) -> String {
    let Some(lang) = LANGUAGES.iter().find(|l| l.code == code) else {
        return String::new()
    };
    // A dialect the preset list does not know is NOT an error: the picker
    // accepts free text ("Andaluz", "Chilean"), and the learner's own words
    // are a perfectly good instruction to the model. `dialect_display`
    // resolves a known id to its label and passes anything else through
    // verbatim — so a custom variety steers the prompt exactly like a preset.
    let dialect_line = dialect
        .filter(|d| !d.trim().is_empty())
        .map(|d| {
            format!(
                "- DIALECT: use the {label} variety of {name} - vocabulary, \
                 pronunciation, and phrasing specific to that region.",
                label = dialect_display(code, d),
                name = lang.name
            )
        })
        .unwrap_or_default();
    lang.overlay.replace("{dialect}", &dialect_line)
}

/// Romanization scheme for a language code ("ALA-LC"), or None for
/// Latin-script languages. Drives the `romanization` instruction in the
/// tokenization prompts — the scheme lives here, never in prompt text.
pub fn romanization(code: &str) -> Option<&'static str> {
    LANGUAGES
        .iter()
        .find(|l| l.code == code || l.base == code.split('-').next().unwrap_or(code))
        .and_then(|l| l.romanization)
}

/// Dialects for a language code: (id, display label). Empty for unknown.
pub fn dialects(code: &str) -> &[(&'static str, &'static str)] {
    LANGUAGES
        .iter()
        .find(|l| l.code == code || l.base == code.split('-').next().unwrap_or(code))
        .map(|l| l.dialects)
        .unwrap_or(&[])
}

/// Display label for a dialect id, falling back to the id itself.
pub fn dialect_display(code: &str, dialect: &str) -> String {
    dialects(code)
        .iter()
        .find(|(id, _)| *id == dialect)
        .map(|(_, label)| label.to_string())
        .unwrap_or_else(|| dialect.to_string())
}
