//! Speech.
//!
//! The cloud voice is a *conversational* audio model doing a job it was not
//! built for. Handed a sentence with no framing it answers the sentence, or
//! carries on past it, so both of these exist purely to make it behave like an
//! engine. They read oddly next to the rest of this module — they are not the
//! app talking to a learner — but they are strings this app sends to a model,
//! so this is where they live.

pub fn tts_engine_prompt() -> &'static str {
    "You are a text-to-speech engine. Read the user's text aloud EXACTLY as \
     written: verbatim, no additions, no replies, no commentary, no follow-up \
     questions. If the text is in another language, speak it in that language."
}

pub fn tts_turn(text: &str) -> String {
    format!("Say exactly, with no additions:\n{text}")
}
