//! Task policy captured with each turn, independent of prompt wording.
use crate::{access::ResolvedTarget, model::ConnectionRoute};
pub const FLASH: &str = "google/gemini-2.5-flash";
pub const LITE: &str = "google/gemini-2.5-flash-lite";
pub const OSS: &str = "openai/gpt-oss-120b";
pub fn hosted_model(model: &str) -> bool {
    matches!(model, FLASH | LITE | OSS)
}
pub fn target(base: &ResolvedTarget, kind: &str, fast: &str) -> ResolvedTarget {
    let mut target = base.clone();
    let easy = matches!(
        kind,
        "user_translation" | "reply_translation" | "coach_reaction"
    );
    target.model = if base.route == ConnectionRoute::Hosted {
        if easy {
            LITE
        } else if matches!(
            kind,
            "persona_reply" | "persona_opening" | "user_word_gloss" | "persona_word_gloss"
        ) {
            OSS
        } else {
            FLASH
        }
        .into()
    } else if easy {
        fast.into()
    } else {
        base.model.clone()
    };
    target
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn hosted_tasks_and_explicit_custom_models_are_distinct() {
        let mut base = ResolvedTarget {
            route: ConnectionRoute::Hosted,
            revision: 1,
            url: "https://example.test/v1/operations".into(),
            model: FLASH.into(),
            credential: Some("test".into()),
        };
        for kind in [
            "persona_reply",
            "persona_opening",
            "user_word_gloss",
            "persona_word_gloss",
        ] {
            assert_eq!(target(&base, kind, LITE).model, OSS);
        }
        for kind in ["user_translation", "reply_translation", "coach_reaction"] {
            assert_eq!(target(&base, kind, FLASH).model, LITE);
        }
        assert_eq!(target(&base, "coach_feedback", LITE).model, FLASH);
        base.route = ConnectionRoute::Custom;
        base.model = "chosen-standard".into();
        assert_eq!(
            target(&base, "persona_reply", "chosen-fast").model,
            "chosen-standard"
        );
        assert_eq!(
            target(&base, "reply_translation", "chosen-fast").model,
            "chosen-fast"
        );
    }
}
