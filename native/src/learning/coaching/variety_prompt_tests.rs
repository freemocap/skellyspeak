use super::*;
use crate::configuration::Registry;

#[test]
fn corrections_and_suggestions_receive_writing_rules_in_both_roles() {
    let registry = Registry::bundled().unwrap();
    for language in &registry.languages {
        for variety in &language.varieties {
            // A different explanation language catches accidentally applying the
            // target's script/usage rules to rationale or translated glosses.
            let context = registry
                .resolve_pair(
                    &language.id,
                    Some(&variety.id),
                    "english",
                    Some("english-united-kingdom"),
                )
                .unwrap();
            let captured = json!({"languageContext": context, "practiceFocus": null});
            for kind in [SUGGESTIONS, FEEDBACK] {
                let prompt = system_prompt(kind, &captured).unwrap();
                for scope in ["target_writing", "explanation_writing"] {
                    for rule in context.guidance(scope) {
                        assert!(
                            prompt.contains(&format!("{scope}: {rule}")),
                            "{}/{kind}/{scope}",
                            variety.id
                        );
                    }
                }
                if kind != SUGGESTIONS {
                    assert!(prompt.contains("Quote only learnerSource"));
                    assert!(
                        prompt.contains("A valid form from another variety is not a learner error")
                    );
                }
            }
        }
    }
}

#[test]
fn cantonese_explanations_reach_coaching_for_every_learning_language() {
    let registry = Registry::bundled().unwrap();
    for language in &registry.languages {
        let context = registry
            .resolve_pair(&language.id, None, "cantonese", Some("cantonese-hong-kong"))
            .unwrap();
        assert!(
            context
                .guidance("explanation_writing")
                .iter()
                .any(|rule| { rule.contains("Traditional Chinese characters") })
        );
        for kind in [SUGGESTIONS, FEEDBACK] {
            let prompt = system_prompt(kind, &json!({"languageContext": context})).unwrap();
            for scope in ["target_writing", "explanation_writing"] {
                for rule in context.guidance(scope) {
                    assert!(
                        prompt.contains(&format!("{scope}: {rule}")),
                        "{}/{kind}/{scope}",
                        language.id
                    );
                }
            }
        }
    }
}

#[test]
fn same_language_different_varieties_remain_separate_in_correction_fields() {
    let registry = Registry::bundled().unwrap();
    let context = registry
        .resolve_pair(
            "english",
            Some("english-united-states"),
            "english",
            Some("english-united-kingdom"),
        )
        .unwrap();
    let prompt = system_prompt(FEEDBACK, &json!({"languageContext": context})).unwrap();
    assert!(prompt.contains("target_writing: Use American spelling such as color and center"));
    assert!(prompt.contains("explanation_writing: Use British spelling such as colour and centre"));
    assert!(!prompt.contains("target_writing: Use British spelling"));
    assert!(!prompt.contains("explanation_writing: Use American spelling"));
}
