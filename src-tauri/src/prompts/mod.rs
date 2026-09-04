//! **Every string this app sends to a model lives under here.**
//!
//! That is the whole rule, and it is worth stating plainly because the
//! alternative is what this replaces: prompt text inlined at its call site,
//! scattered across a dozen command modules, so that tuning the partner's
//! personality meant crawling the codebase to find the four places that
//! contradicted each other. A prompt is content, not logic. It is edited far
//! more often than the code around it, by someone reading for *voice* rather
//! than for control flow, and it belongs somewhere you can read it all at once.
//!
//! If you are adding a model call: the prompt goes in here, and the command
//! module passes data in. A literal sentence of instruction anywhere else is a
//! bug, and `no_stray_prompts` in `tests.rs` fails the build over it.
//!
//! ## The map
//!
//! | Module | What it says |
//! |---|---|
//! | [`partner`] | The conversation partner: who they are, how they talk, and the eight built-in characters |
//! | [`coach`] | The private coach — the per-message analysis and the side-thread |
//! | [`analysis`] | Tokenizing, translating, grammar cards, scaffolds, word insight |
//! | [`observer`] | The teaching coordinator that maintains the plan and profile |
//! | [`story`] | Reading practice |
//! | [`overlays`] | Per-language guidance (orthography, dialect, register) |
//! | [`repair`] | What we say to a model that returned unusable JSON |
//! | [`speech`] | Making a conversational audio model behave like a TTS engine |
//!
//! Shared blocks — the rules more than one surface needs — stay in this file.

pub mod analysis;
pub mod coach;
pub mod observer;
pub mod overlays;
pub mod partner;
pub mod repair;
pub mod speech;
pub mod story;

#[cfg(test)]
mod tests;

/// The sentinel a model writes into a REQUIRED text field it has nothing to
/// say for. The UI renders it as empty — see `lib/normalize.ts`.
pub const NOT_APPLICABLE: &str = "not applicable";

/// Always answer in the language being learned.
///
/// This is the one constraint the conversation genuinely cannot do without: a
/// partner that drifts into the learner's own language stops being practice.
pub fn always_respond_rule(target_language_name: &str) -> String {
    format!(
        "- ALWAYS respond in {tln}, regardless of the language the learner \
         uses. If they write in another language, reply in {tln} anyway.",
        tln = target_language_name,
    )
}

/// How to say "nothing here" honestly.
///
/// Every schema this app sends is **strict**: every field is required, because
/// a schema with optional fields gave the decoder enough freedom to run away
/// mid-object (see `ai.rs::inline_defs`). Required must not mean *invented*,
/// so every structured prompt carries this rule — one sanctioned answer per
/// shape, instead of the model padding, guessing, or stalling.
pub fn no_information_rule() -> String {
    format!(
        "- NOTHING TO SAY: every field is required, but NEVER invent content to \
         fill one. When you genuinely have no information for a field, say so \
         in the way its type allows:\n\
         \x20 - a field that accepts null -> null\n\
         \x20 - a list with nothing to put in it -> [] (an empty list is a valid, \
         useful answer; do not pad it)\n\
         \x20 - a required text field -> exactly \"{na}\"\n\
         \x20 - a required number -> 0\n\
         Guessing is worse than an empty answer: these fields steer later \
         teaching, so a padded list actively misleads.\n\
         NEVER use the sentinel for a field that copies or transforms text \
         you were given - a token's text, a translation of a message you can \
         see, a corrected phrase. Those always have a real answer, and a \
         placeholder there is rendered to the learner as if it were their \
         language.\n\
         Where THIS prompt states an explicit requirement for a field - \
         'exactly two', 'at least one' - that requirement WINS over the \
         empty-answer option above.",
        na = NOT_APPLICABLE,
    )
}

/// No pictographs, because replies get read aloud.
pub fn no_emoji_rule() -> &'static str {
    "- NEVER use emojis, emoticons, or any Unicode pictographic symbols in your \
     responses. They are strictly forbidden because responses may be read aloud \
     by a text-to-speech engine and emoticons produce unnatural noise (e.g. \
     \"face with tears of joy\"). Plain text only."
}

/// CEFR band for a level the learner picked in the steer row.
pub fn resolve_cefr(level: &str) -> &'static str {
    match level {
        "zero" => "PRE-A1",
        "beginner" => "A2",
        "intermediate" => "B1",
        "advanced" => "C1",
        _ => "A2",
    }
}

/// The language the mechanics card's contrast note compares against: the
/// learner's own (a Spanish speaker learning French gets Spanish contrasts).
pub fn contrast_language(native_language_name: &str) -> String {
    native_language_name.to_string()
}
