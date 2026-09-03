//! The wire types for one turn: what the webview sends, what the analysis
//! calls return, and the events streamed back while a turn is in flight.

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

use crate::observer;

use super::super::coach::CoachFeedback;

#[derive(Debug, Clone, Deserialize)]
pub struct ChatTurn {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct GuidedToken {
    /// The exact word from the reply, punctuation attached.
    pub text: String,
    /// Short native-language meaning of the word in this context.
    #[serde(default)]
    pub gloss: Option<String>,
    /// Universal part of speech (NOUN, VERB, ADJ, ...).
    #[serde(default)]
    pub pos: Option<String>,
    /// Grammatically interesting form worth the learner's attention.
    #[serde(default)]
    pub notable: bool,
    /// Romanized form for non-Latin scripts (ALA-LC for Arabic).
    #[serde(default)]
    pub romanization: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Mechanic {
    /// Name of the grammar mechanic.
    pub title: String,
    /// CEFR level of the mechanic, e.g. A2.
    #[serde(default)]
    pub cefr: Option<String>,
    /// 2-3 sentences explaining how the mechanic works, in the learner's native language.
    pub body: String,
    /// One worked example close to the reply, with a native-language gloss.
    #[serde(default)]
    pub example: Option<String>,
    /// How this differs from English, in the learner's native language.
    #[serde(default)]
    pub contrast: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Scaffolds {
    /// Complete sentences the learner could plausibly send next.
    #[serde(default)]
    pub replies: Vec<String>,
    /// Fill-in-the-blank sentences using ___ for the missing part.
    #[serde(default)]
    pub frames: Vec<String>,
    /// Short openers of 2-4 words.
    #[serde(default)]
    pub starters: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct TokensOut {
    /// minItems is enforced at the schema level: constrained providers
    /// cannot return an empty token list.
    #[schemars(length(min = 1))]
    pub tokens: Vec<GuidedToken>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct TranslationOut {
    pub translation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct MechanicsOut {
    #[schemars(length(min = 1))]
    pub mechanics: Vec<Mechanic>,
}

/// FLAT on the wire on purpose: given a `{scaffolds: {replies, ...}}` wrapper,
/// models return the inner object at the top level instead. A flat shape plus
/// schema-level minItems keeps them compliant; `Scaffolds` below is the public
/// turn shape, and the schema-level list constraints mean constrained
/// providers cannot emit empty lists (the validate closure sense-checks).
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct ScaffoldsOut {
    #[schemars(length(min = 1))]
    pub replies: Vec<String>,
    #[schemars(length(min = 1))]
    pub frames: Vec<String>,
    #[schemars(length(min = 1))]
    pub starters: Vec<String>,
}

/// Tokenization + translation of the LEARNER's own message — the "did I say
/// what I meant" check.
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct LearnerTokensOut {
    /// Natural native-language translation of what the learner communicated.
    #[schemars(length(min = 1))]
    pub translation: String,
    #[schemars(length(min = 1))]
    pub tokens: Vec<GuidedToken>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GuidedTurnResult {
    pub reply: String,
    pub translation: Option<String>,
    pub tokens: Vec<GuidedToken>,
    /// Tokenization + translation of the LEARNER's own message.
    pub user_tokens: Vec<GuidedToken>,
    pub user_translation: Option<String>,
    pub mechanics: Vec<Mechanic>,
    pub scaffolds: Scaffolds,
    /// Analysis sub-calls that FAILED after retries. Nothing degrades
    /// silently: the breakdown pane renders these as visible errors.
    pub errors: Vec<String>,
}

/// Strip anything the model wrapped around its reply.
///
/// Models occasionally fence a reply in a code block. What the learner should
/// see is the text INSIDE the fence — so the opening fence line goes (with its
/// optional language tag) and so does everything from the closing fence on.
pub fn sanitize_reply(raw: &str) -> String {
    let mut text = raw.trim().to_string();
    if text.starts_with("```") {
        text = match text.split_once('\n') {
            // A real fenced block: drop the opening line, keep what is before
            // the closing fence.
            Some((_, rest)) => rest
                .rsplit_once("```")
                .map(|(body, _)| body)
                .unwrap_or(rest)
                .trim()
                .to_string(),
            // All on one line — peel the backticks off both ends.
            None => text.trim_matches('`').trim().to_string(),
        };
    }
    // Defensive: cut off any leaked translation/notes block.
    for marker in ["\n---", "\n***", "\n**English", "\n**Traducción"] {
        if let Some(pos) = text.find(marker) {
            text.truncate(pos);
        }
    }
    text.trim().to_string()
}

/// Events streamed to the frontend during one guided turn. The reply pass
/// resolves the turn; the analysis pass lands asynchronously afterwards so
/// the learner can keep typing while grammar notes are still being prepared.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuidedEvent {
    ReplyDelta { text: String },
    ReplyDone { reply: String },
    /// Progressive hydration: emitted the moment ONE analysis sub-call
    /// finishes; only that section's field is Some. The frontend merges
    /// sections into the turn as they arrive instead of waiting for the
    /// slowest call.
    AnalysisSection {
        tokens: Option<Vec<GuidedToken>>,
        translation: Option<String>,
        /// Learner-message tokenization + translation.
        user_tokens: Option<Vec<GuidedToken>>,
        user_translation: Option<String>,
        mechanics: Option<Vec<Mechanic>>,
        scaffolds: Option<Scaffolds>,
    },
    /// Sidebar-tutor feedback on the learner's latest message.
    CoachDone { feedback: CoachFeedback },
    /// The coach call failed after retries — surfaced loudly.
    CoachFailed { error: String },
    AnalysisDone { turn: GuidedTurnResult },
    PlanUpdated {
        plan: observer::TeachingPlan,
        profile: observer::Profile,
    },
    /// Anything that failed in background work started by this turn.
    /// The webview puts it on screen; background failures are never left
    /// to a log file.
    Fault { context: String, message: String },
    }

/// One filled-in analysis section, every other field left alone.
///
/// The webview merges sections into the turn as they land, so a section only
/// ever carries what its own call just learned. Building it this way keeps the
/// five call sites from each spelling out five `None`s.
#[derive(Debug, Default)]
pub struct Section {
    pub tokens: Option<Vec<GuidedToken>>,
    pub translation: Option<String>,
    pub user_tokens: Option<Vec<GuidedToken>>,
    pub user_translation: Option<String>,
    pub mechanics: Option<Vec<Mechanic>>,
    pub scaffolds: Option<Scaffolds>,
}

impl From<Section> for GuidedEvent {
    fn from(s: Section) -> Self {
        GuidedEvent::AnalysisSection {
            tokens: s.tokens,
            translation: s.translation,
            user_tokens: s.user_tokens,
            user_translation: s.user_translation,
            mechanics: s.mechanics,
            scaffolds: s.scaffolds,
        }
    }
}

/// Send an event to the webview, shouting if the channel is gone. This is
/// the one place a failure cannot be surfaced to the frontend — the
/// frontend channel is what broke — so the log is all that is left.
pub fn emit(channel: &Channel<GuidedEvent>, event: GuidedEvent) {
    if let Err(e) = channel.send(event) {
        log::error!("[ipc] event channel send FAILED, the webview will not see it: {e}");
    }
}

#[cfg(test)]
mod sanitize_tests {
    use super::sanitize_reply;

    #[test]
    fn a_fenced_reply_keeps_what_is_inside_the_fence() {
        // This used to come back EMPTY: the old code took the LAST line, which
        // is the closing fence, then stripped it to nothing. The learner saw a
        // blank tutor message and it looked like the model had failed.
        assert_eq!(sanitize_reply("```\nHola, ¿cómo estás?\n```"), "Hola, ¿cómo estás?");
        assert_eq!(sanitize_reply("```text\nHola, ¿cómo estás?\n```"), "Hola, ¿cómo estás?");
    }

    #[test]
    fn a_multi_line_fenced_reply_keeps_every_line() {
        assert_eq!(sanitize_reply("```\nHola.\nAdiós.\n```"), "Hola.\nAdiós.");
    }

    #[test]
    fn an_unterminated_fence_still_yields_the_text() {
        // A truncated stream can end without its closing fence.
        assert_eq!(sanitize_reply("```\nHola, ¿cómo estás?"), "Hola, ¿cómo estás?");
    }

    #[test]
    fn a_single_line_fence_is_peeled_from_both_ends() {
        assert_eq!(sanitize_reply("```Hola```"), "Hola");
    }

    #[test]
    fn ordinary_replies_are_left_alone() {
        assert_eq!(sanitize_reply("Hola, ¿cómo estás?"), "Hola, ¿cómo estás?");
        assert_eq!(sanitize_reply("  Hola.  "), "Hola.");
        // Backticks mid-sentence are not a fence.
        assert_eq!(sanitize_reply("Say `hola` to greet."), "Say `hola` to greet.");
    }

    #[test]
    fn a_leaked_translation_block_is_cut_off() {
        assert_eq!(sanitize_reply("Hola.\n---\nEnglish: Hello."), "Hola.");
        assert_eq!(sanitize_reply("Hola.\n**English**: Hello."), "Hola.");
    }

    #[test]
    fn nothing_but_a_fence_yields_nothing() {
        // The caller turns this into "the tutor returned an empty reply",
        // which is the honest thing to say.
        assert_eq!(sanitize_reply("```"), "");
        assert_eq!(sanitize_reply("```\n```"), "");
    }
}

#[cfg(test)]
mod wire_tests {
    use super::*;

    /// The exact JSON the webview parses. `src/types.ts::GuidedEvent` is the
    /// other half of this contract, and it is a union discriminated on `type`
    /// — so the tag name and every field name here are load-bearing.
    fn json_of(event: GuidedEvent) -> serde_json::Value {
        serde_json::to_value(event).expect("GuidedEvent must serialize")
    }

    #[test]
    fn an_analysis_section_carries_only_the_section_that_landed() {
        // Progressive hydration: one section arrives, the rest stay null and
        // the webview leaves those parts of the turn untouched.
        let event = GuidedEvent::AnalysisSection {
            tokens: None,
            translation: Some("Hello.".into()),
            user_tokens: None,
            user_translation: None,
            mechanics: None,
            scaffolds: None,
        };
        assert_eq!(
            json_of(event),
            serde_json::json!({
                "type": "analysis_section",
                "tokens": null,
                "translation": "Hello.",
                "user_tokens": null,
                "user_translation": null,
                "mechanics": null,
                "scaffolds": null,
            })
        );
    }

    #[test]
    fn every_variant_keeps_its_tag_and_field_names() {
        assert_eq!(
            json_of(GuidedEvent::ReplyDelta { text: "Ho".into() }),
            serde_json::json!({ "type": "reply_delta", "text": "Ho" })
        );
        assert_eq!(
            json_of(GuidedEvent::ReplyDone { reply: "Hola".into() }),
            serde_json::json!({ "type": "reply_done", "reply": "Hola" })
        );
        assert_eq!(
            json_of(GuidedEvent::CoachFailed { error: "nope".into() }),
            serde_json::json!({ "type": "coach_failed", "error": "nope" })
        );
        assert_eq!(
            json_of(GuidedEvent::Fault {
                context: "Observer".into(),
                message: "boom".into(),
            }),
            serde_json::json!({ "type": "fault", "context": "Observer", "message": "boom" })
        );
    }

    #[test]
    fn an_analysis_result_names_its_error_list_errors() {
        // The analysis pane renders `errors`; a rename here would silently
        // stop per-section degradations from ever being shown.
        let event = GuidedEvent::AnalysisDone {
            turn: GuidedTurnResult {
                reply: "Hola".into(),
                translation: None,
                tokens: Vec::new(),
                user_tokens: Vec::new(),
                user_translation: None,
                mechanics: Vec::new(),
                scaffolds: Scaffolds::default(),
                errors: vec!["tokens: boom".into()],
            },
        };
        let value = json_of(event);
        assert_eq!(value["type"], "analysis_done");
        assert_eq!(value["turn"]["errors"][0], "tokens: boom");
        assert_eq!(value["turn"]["reply"], "Hola");
    }
}
