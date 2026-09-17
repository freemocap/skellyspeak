//! Task policy captured with each turn, independent of prompt wording.
use crate::ai::connections::access::ResolvedTarget;
pub fn target(base: &ResolvedTarget, kind: &str, fast: &str) -> ResolvedTarget {
    let mut target = base.clone();
    let easy = matches!(
        kind,
        "skill_assessment" | "user_translation" | "reply_translation" | "coach_reaction"
    );
    target.model = if easy {
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
    fn shared_models_apply_to_every_route() {
        let mut base = ResolvedTarget {
            route: crate::model::ConnectionRoute::Hosted,
            revision: 1,
            url: "https://example.test/v1/operations".into(),
            model: "chosen-standard".into(),
            credential: Some("test".into()),
        };
        for kind in [
            "persona_reply",
            "persona_opening",
            "user_word_gloss",
            "persona_word_gloss",
        ] {
            assert_eq!(target(&base, kind, "chosen-fast").model, "chosen-standard");
        }
        for kind in ["user_translation", "reply_translation", "coach_reaction"] {
            assert_eq!(target(&base, kind, "chosen-fast").model, "chosen-fast");
        }
        assert_eq!(
            target(&base, "coach_feedback", "chosen-fast").model,
            "chosen-standard"
        );
        base.route = crate::model::ConnectionRoute::Custom;
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
