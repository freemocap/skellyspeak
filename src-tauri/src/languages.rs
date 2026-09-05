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
    /// Whether words are separated by spaces. False means the script needs
    /// word segmentation (Chinese/Japanese) and the tokenization prompts must
    /// say so.
    pub word_delimited: bool,
    /// Whether words inflect (conjugation/declension). False for isolating
    /// languages (Mandarin); the word-insight prompt describes particles and
    /// measure words instead of tense/person/number/gender.
    pub inflects: bool,
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
        word_delimited: true,
        inflects: true,
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
        word_delimited: true,
        inflects: true,
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
        word_delimited: true,
        inflects: true,
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
        word_delimited: true,
        inflects: true,
    },
    Language {
        code: "zh-CN",
        base: "zh",
        name: "Chinese (Mandarin)",
        endonym: "中文",
        direction: "ltr",
        dialects: &[
            ("zh-CN", "Simplified (Mainland)"),
            ("zh-TW", "Traditional (Taiwan)"),
            ("zh-SG", "Singapore (Simplified)"),
        ],
        romanization: Some("PINYIN"),
        word_delimited: false,
        inflects: false,
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

/// Target-language guidance injected into every prompt when this language is
/// the target.
///
/// The words are in `prompts::overlays`, with every other string this app
/// sends to a model; this function pairs them with the registry and fills the
/// `{dialect}` placeholder. `prompts::tests::every_language_has_an_overlay`
/// fails the build if a language here has no guidance there.
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
        .map(|d| crate::prompts::overlays::dialect_line(&dialect_display(code, d), lang.name))
        .unwrap_or_default();
    crate::prompts::overlays::for_code(code).replace("{dialect}", &dialect_line)
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

/// Whether this language separates words with spaces. False for scripts that
/// need segmentation (Mandarin); the tokenization prompts add a segmentation
/// instruction. Unknown codes default to true (space-delimited).
pub fn word_delimited(code: &str) -> bool {
    LANGUAGES
        .iter()
        .find(|l| l.code == code || l.base == code.split('-').next().unwrap_or(code))
        .map(|l| l.word_delimited)
        .unwrap_or(true)
}

/// Whether words change form (conjugation/declension). False for isolating
/// languages (Mandarin); the word-insight prompt describes particles instead.
/// Unknown codes default to true (inflecting).
pub fn inflects(code: &str) -> bool {
    LANGUAGES
        .iter()
        .find(|l| l.code == code || l.base == code.split('-').next().unwrap_or(code))
        .map(|l| l.inflects)
        .unwrap_or(true)
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
