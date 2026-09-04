//! Reading practice: one short glossed story at the learner's level.
//!
//! The one place in the app where the model picks the subject, so the prompt
//! has to push for variety by hand — a story generator left to itself writes
//! about a market and a cat every single time.

use super::no_information_rule;

/// Length and grammar per level. The CEFR band in the middle is documentation
/// for whoever tunes these; the prompt uses the description.
const LEVEL_BANDS: [(&str, &str, &str); 3] = [
    (
        "beginner",
        "A1-A2",
        "40-70 words in one or two paragraphs. Very short, simple sentences \
         (5-10 words), present tense, high-frequency everyday vocabulary.",
    ),
    (
        "intermediate",
        "B1-B2",
        "80-130 words in two or three paragraphs. Simple and compound \
         sentences, common past and future tenses, everyday topics with some \
         descriptive detail.",
    ),
    (
        "advanced",
        "C1-C2",
        "140-200 words in two or four paragraphs. Varied sentence structures, \
         richer vocabulary, idiomatic phrasing, and nuance.",
    ),
];

pub fn story_prompt(
    target_language_name: &str,
    cefr_level: &str,
    native_language_name: &str,
    level: &str,
    overlay_text: &str,
) -> String {
    let band = LEVEL_BANDS
        .iter()
        .find(|(name, _, _)| *name == level)
        .unwrap_or(&LEVEL_BANDS[0]);
    let overlay_section = if overlay_text.is_empty() {
        String::new()
    } else {
        format!("{}\n", overlay_text)
    };
    format!(
        "Write one original short story in {tln} for an adult self-learner at {cefr} level\n\
         whose native language is {native}.\n\n\
         Story requirements:\n\
         - LENGTH: {length}\n\
         - CONTENT: a self-contained story with a simple arc (setup, small turn, close).\n  Everyday and relatable is a good default — routines, markets, pets, family,\n  travel, work, food — but it is a default, not a fence. Adults are reading these:\n  a story about a difficult day at work, a piece of local history, an argument, or\n  something that mattered to someone is more worth reading than another trip to\n  the greengrocer.\n\
         - LANGUAGE: entirely in {tln} with vocabulary and spelling consistent with the\n  language guidance below.\n\
         - TONE: warm, concrete, and human. No titles inside the text, no moralizing, no emoji.\n\
         - GLOSSES: tokenize the story word by word and give every content word a short\n  {native} gloss in context. Function words (articles, prepositions, pronouns) may\n  carry glosses too; punctuation-only tokens have a null gloss. Keep glosses to one\n  or two words where possible.\n\
         {overlay}\n\n\
         {nothing}\n\
         Respond with the structured story you have been configured to produce.",
        tln = target_language_name,
        cefr = cefr_level,
        native = native_language_name,
        length = band.2,
        overlay = overlay_section,
        nothing = no_information_rule(),
    )
}

/// The user turn. Says "vary the topic" out loud because otherwise every story
/// is about somebody buying fruit.
pub fn story_turn() -> &'static str {
    "Write a new story. Vary the topic — do not repeat common everyday \
     scenarios you have used recently."
}
