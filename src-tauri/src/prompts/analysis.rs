//! The background passes that turn one exchange into study material:
//! tokenizing, translating, grammar cards, scaffolds, and word insight.
//!
//! The learner never sees these prompts and never waits on them — they land
//! after the reply has already streamed. They all want the *boring* answer, so
//! unlike the partner they run at a low temperature and are told to say
//! nothing rather than pad (`super::no_information_rule`).
//!
//! Both halves of each call live here: the system prompt AND the user turn
//! that frames the data. The framings are one line each and were previously
//! inlined at their call sites, which is exactly how "Tutor reply to tokenize"
//! and "Learner message to analyze" ended up phrased differently in the app
//! and in the benchmark.

use super::{contrast_language, no_information_rule};

pub fn tokens_prompt(
    target_language_name: &str,
    native_language_name: &str,
    romanization_scheme: Option<&str>,
    word_delimited: bool,
) -> String {
    format!(
        "You tokenize {tln} text for a learner glossary.\n\
         Given a tutor reply, split it into word tokens in order (punctuation\n\
         attached to the preceding word) and give each token a short {native}\n\
         gloss in context. Punctuation-only tokens get a null gloss. Tag each\n\
         token with a Universal part of speech (NOUN, VERB, ADJ, ADV, PRON, DET,\n\
         ADP, CCONJ, SCONJ, AUX, PART, INTJ, NUM, PROPN, PUNCT). Mark at most 3\n\
         tokens as notable — forms a learner should notice (inflections,\n\
         constructions, word order). Copy each token's text EXACTLY from the\n\
         reply and never skip words.{segment}{roman}\n\
         {nothing}\n\
         Respond with the structured tokenization you have been configured to produce.",
        tln = target_language_name,
        native = native_language_name,
        segment = segmentation_line(word_delimited),
        roman = romanization_line(romanization_scheme),
        nothing = no_information_rule(),
    )
}

/// The romanization instruction, or nothing for Latin-script targets. The
/// scheme comes from the language registry (`languages::romanization`), so a
/// new non-Latin rung ships its scheme with the language, not with the prompt.
fn romanization_line(scheme: Option<&str>) -> String {
    match scheme {
        Some(s) => format!(
            "\nALSO give every token a romanization in {s} in its \
             `romanization` field."
        ),
        None => String::new(),
    }
}

/// The word-segmentation instruction for scripts without spaces, or nothing
/// for space-delimited targets. The fact lives in the language registry
/// (`languages::word_delimited`), the words live here.
fn segmentation_line(word_delimited: bool) -> String {
    if word_delimited {
        String::new()
    } else {
        "\nThe text has no spaces between words — segment it into words, never\n\
         single characters. Each token is one meaningful word (词), with\n\
         punctuation attached to the preceding word."
            .to_string()
    }
}

pub fn translation_prompt(target_language_name: &str, native_language_name: &str) -> String {
    format!(
        "Translate the given {tln} tutor reply into natural {native}.\n\
         {nothing}\n\
         Respond with the structured translation you have been configured to produce.",
        tln = target_language_name,
        native = native_language_name,
        nothing = no_information_rule(),
    )
}

pub fn mechanics_prompt(
    target_language_name: &str,
    cefr_level: &str,
    native_language_name: &str,
    directives: &str,
) -> String {
    format!(
        "You are a meticulous {tln} linguistics coach. Given a tutor reply for an\n\
         adult learner at {cefr} level, pick the 1-2 most valuable grammar\n\
         mechanics it demonstrates and write one explainer card each:\n\
         - title: the mechanic's name\n\
         - cefr: its CEFR level\n\
         - body: 1-2 short sentences (max ~25 words each) explaining how it\n\
           works, in {native}\n\
         - example: one worked example close to the reply, with a {native} gloss\n\
           after an em dash\n\
         - contrast: one sentence on how this differs from {contrast_with}, in {native}\n\
         FOCUS BIAS: if a structure from the session focus list appears in the\n\
         reply, that mechanic is your first card. Every reply teaches something\n\
         — never return zero cards. Never repeat a mechanic from the ALREADY\n\
         TAUGHT list.\n\
         {directives}\n\
         {nothing}\n\
         Respond with the structured cards you have been configured to produce.",
        tln = target_language_name,
        cefr = cefr_level,
        native = native_language_name,
        contrast_with = contrast_language(native_language_name),
        directives = directives,
        nothing = no_information_rule(),
    )
}

pub fn scaffolds_prompt(
    target_language_name: &str,
    native_language_name: &str,
    directives: &str,
) -> String {
    format!(
        "You prepare scaffolds for a {tln} learner's NEXT message. Given the \
         conversation so far, write:\n\
         - replies: exactly 2 complete sentences in {tln} the learner could\n\
           plausibly send next\n\
         - frames: exactly 2 fill-in-the-blank sentences in {tln} using ___\n\
         - starters: exactly 2 short openers of 2-4 words in {tln}\n\
         EVERY list must contain EXACTLY 2 real, specific items — never empty,\n\
         never placeholders, never a list with a single item.\n\
         The learner's native language is {native}, but every scaffold stays in {tln}.\n\
         Follow whatever the conversation is actually about, including a \
         difficult or serious subject — scaffolds for a subject the learner has \
         left behind are useless to them.\n\
         Use the session focus structures where natural.\n\
         {directives}\n\
         {nothing}\n\
         Respond with the structured scaffolds you have been configured to produce.",
        tln = target_language_name,
        native = native_language_name,
        directives = directives,
        nothing = no_information_rule(),
    )
}

pub fn learner_tokens_prompt(
    target_language_name: &str,
    native_language_name: &str,
    romanization_scheme: Option<&str>,
    word_delimited: bool,
) -> String {
    format!(
        "Analyze the LEARNER'S latest message in {tln}. The learner is a student:\n\
         their words may contain mistakes, mixed languages, or questions about\n\
         how to say something.\n\n\
         1. tokenize: split the message word by word (punctuation attached to\n\
            the preceding word), in order, never skipping words. Give each token\n\
            a short {native} gloss IN CONTEXT - what the learner MEANT, including\n\
            for their mistakes. Mark at most 3 tokens as notable.{segment}{roman}\n\
         2. translation: a natural {native} translation of what the learner\n\
            actually communicated (not a word-for-word rendering).\n\n\
         {nothing}\n\
         Respond with the structured analysis you have been configured to produce.",
        tln = target_language_name,
        native = native_language_name,
        segment = segmentation_line(word_delimited),
        roman = romanization_line(romanization_scheme),
        nothing = no_information_rule(),
    )
}

pub fn word_insight_prompt(
    target_language_name: &str,
    native_language_name: &str,
    inflects: bool,
) -> String {
    let (lemma, form) = if inflects {
        (
            "the dictionary form of the word",
            "conjugation/declension details for this usage - tense, mood,\n\
             person, number, gender as applicable",
        )
    } else {
        (
            "the word itself — this language has no inflected forms",
            "how the word is built for this usage - aspect particles\n\
             (了, 着, 过), measure words (量词), or structural particles\n\
             (的, 地, 得), as applicable",
        )
    };
    format!(
        "You are a {tln} morphology and grammar analyzer for language learners.\n\
         Given a WORD and the SENTENCE it appears in, analyze the word AS USED\n\
         in that sentence and return:\n\
         - lemma: {lemma}\n\
         - pos: part of speech (noun, verb, adjective, ...)\n\
         - form: {form}\n\
         - role: the word's grammatical role in this sentence (subject,\n\
           direct object, ...)\n\
         - usage: one practical note for the learner, in {native} - what to\n\
           watch out for, common confusions, or when this form is used\n\n\
         If the word is ambiguous, analyze it as used in the sentence. Be precise.",
        tln = target_language_name,
        native = native_language_name,
    )
}

// ─── The user turns that carry the data ──────────────────────────────────────

pub fn tokenize_reply_turn(reply: &str) -> String {
    format!("Tutor reply to tokenize:\n{reply}")
}

pub fn translate_reply_turn(reply: &str) -> String {
    format!("Tutor reply to translate:\n{reply}")
}

pub fn analyze_learner_turn(message: &str) -> String {
    format!("Learner message to analyze:\n{message}")
}

pub fn mechanics_turn(cefr_level: &str, learner_message: &str, reply: &str) -> String {
    format!("Learner message ({cefr_level} level):\n{learner_message}\n\nTutor reply:\n{reply}")
}

pub fn scaffolds_turn(learner_message: &str, reply: &str) -> String {
    format!("Learner message:\n{learner_message}\n\nTutor reply:\n{reply}")
}

pub fn scaffolds_from_transcript_turn(transcript: &str) -> String {
    format!("CONVERSATION SO FAR:\n{transcript}\n\nWrite the scaffolds now.")
}

pub fn word_insight_turn(word: &str, sentence: &str) -> String {
    format!("WORD: {word}\n\nSENTENCE: {sentence}")
}
