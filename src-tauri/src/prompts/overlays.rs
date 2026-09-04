//! Per-language guidance: orthography, agreement, register, and the dialect
//! line.
//!
//! This text used to be a field on the `Language` struct in `languages.rs`,
//! which was tidy right up until the point of tuning it — the registry is a
//! table of codes, names and script directions, and the prose was hiding in
//! the middle of it. So the registry keeps the *facts* about a language and
//! this file keeps the *words*, keyed by the same code.
//!
//! The split is only safe because it is checked: `every_language_has_an_overlay`
//! in `tests.rs` fails the build if a language is added to the registry without
//! one, which is the one way this could go wrong quietly.
//!
//! `{dialect}` is filled by `languages::overlay` with the chosen variety, or
//! removed when none is chosen.

/// Guidance for a target language, by BCP-47 code. Unknown codes get nothing —
/// a language the app does not know is not one it can be steered in.
pub fn for_code(code: &str) -> &'static str {
    match code {
        "en-US" => EN_US,
        "fr-FR" => FR_FR,
        "es-ES" => ES_ES,
        "ar" => AR,
        _ => "",
    }
}

/// The dialect line, given a resolved label. Free text is passed through
/// verbatim by the caller, so "Andaluz" steers exactly like a preset.
pub fn dialect_line(label: &str, language_name: &str) -> String {
    format!(
        "- DIALECT: use the {label} variety of {language_name} - vocabulary, \
         pronunciation, and phrasing specific to that region."
    )
}

const EN_US: &str = "Language-specific guidance:\n\
    - Use American English spelling, vocabulary, and idiom consistently (color, organize, elevator).\n\
    - Pay close attention to word order, verb tenses, and preposition usage.\n\
    - Avoid British-only vocabulary unless explicitly comparing variants.\n\
    - Keep register natural: contractions (I'm, don't) are fine and expected in casual conversation.{dialect}";

const FR_FR: &str = "Language-specific guidance:\n\
    - Use standard French as spoken in France consistently.\n\
    - Pay close attention to accents (é, è, ê, ç), elision (j'ai, l'ami), gender, and number agreement.\n\
    - Use tu or vous consistently according to the context and learner level.\n\
    - Avoid Canadian/Belgian/Swiss regionalisms unless explicitly comparing them.\n\
    - Natural French phrasing: contractions (au, du, aux) and liaison where appropriate.{dialect}";

const ES_ES: &str = "Language-specific guidance:\n\
    - Use Peninsular Spanish from Spain consistently.\n\
    - Prefer Spain usage, including vosotros for informal plural address when appropriate.\n\
    - Avoid voseo and Latin American-only vocabulary unless explicitly comparing variants.\n\
    - Pay close attention to accents, gender, number agreement, and natural Spain Spanish phrasing.{dialect}";

const AR: &str = "Language-specific guidance:\n\
    - Use Levantine Arabic (Lebanon/Syria/Jordan/Palestine) as understood across the region.\n\
    - Write in Arabic script with natural spelling; do not write in Latin characters.\n\
    - Modern Standard Arabic vocabulary is acceptable when no Levantine equivalent exists, but keep grammar and phrasing Levantine.\n\
    - Pay attention to root-and-pattern morphology: forms I-X change meaning systematically.\n\
    - gender and number agreement are mandatory; the dual form exists alongside singular and plural.\n\
    - Do not vocalize with full diacritics (tashkeel); write as natives type, unvocalized.{dialect}";
