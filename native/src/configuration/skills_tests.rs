use super::*;
use crate::learning::practice_assessment;

#[test]
fn twelve_shared_skills_and_explicit_pilot_coverage() {
    let registry = Registry::bundled().unwrap();
    assert_eq!(registry.shared_skills().skills.len(), 12);
    assert_eq!(registry.shared_skills().categories.len(), 4);
    for (language, variety) in [
        ("spanish", "spanish-mexico"),
        ("arabic", "arabic-levantine"),
        ("mandarin", "mandarin-mainland-china"),
    ] {
        let coverage = registry.skill_coverage(language, variety).unwrap();
        assert_eq!(coverage.len(), 12);
        assert_eq!(coverage.iter().filter(|s| s.guide_available).count(), 12);
        // Complete pilot content produces all twelve questions.
        assert!(
            registry
                .skill_presence_request(language, variety, serde_json::json!({}))
                .is_ok()
        );
    }
    assert!(
        registry
            .skill_prompt("spanish", "spanish-spain", "past_reference")
            .is_ok()
    );
    assert!(
        registry
            .skill_prompt("arabic", "spanish-mexico", "past_reference")
            .is_err()
    );
}

#[test]
fn rich_content_and_compact_assessment_share_the_core_but_not_examples() {
    let mut registry = Registry::bundled().unwrap();
    let before = registry
        .skill_content_hash("spanish", "spanish-mexico")
        .unwrap();
    registry
        .documents
        .get_mut("spanish")
        .unwrap()
        .learning
        .skill_guides
        .get_mut("possession_relationships")
        .unwrap()
        .varieties
        .get_mut("spanish-mexico")
        .unwrap()
        .explanation
        .push_str("\n\nHuman-only sentinel.");
    let prompt = registry
        .skill_prompt("spanish", "spanish-mexico", "possession_relationships")
        .unwrap();
    let markdown = registry
        .skill_markdown("spanish", "spanish-mexico", "possession_relationships")
        .unwrap();
    assert!(markdown.contains("Human-only sentinel."));
    assert!(markdown.contains("> Es el libro de mi hermana."));
    assert!(!prompt.language_guidance.contains("Human-only sentinel."));
    assert!(!prompt.language_guidance.contains("Es el libro"));
    assert!(markdown.contains(&prompt.overview));
    assert_ne!(
        before,
        registry
            .skill_content_hash("spanish", "spanish-mexico")
            .unwrap()
    );
    let request = practice_assessment::request(
        serde_json::json!({"currentLearnerMessage":"Ana."}),
        &[prompt],
        &registry.presence_instructions,
    )
    .unwrap();
    assert_eq!(
        request["questions"]["possession_relationships"]["criteria"]
            .as_object()
            .unwrap()
            .len(),
        4
    );
}

#[test]
fn language_extensions_compose_without_inheritance_and_cannot_shadow_shared_ids() {
    let mut registry = Registry::bundled().unwrap();
    let mut extra = registry.skills.skills[0].clone();
    extra.id = "spanish_test_extension".into();
    let doc = registry.documents.get_mut("spanish").unwrap();
    doc.learning.skills.push(extra);
    assert_eq!(registry.skills_for_language("spanish").unwrap().len(), 13);
    assert_eq!(registry.skills_for_language("arabic").unwrap().len(), 12);
    let citations =
        crate::configuration::citations::parse_bib(include_str!("../../../references.bib"))
            .unwrap()
            .into_keys()
            .collect();
    registry.validate_skills(&citations).unwrap();
    registry
        .documents
        .get_mut("spanish")
        .unwrap()
        .learning
        .skills[0]
        .id = "past_reference".into();
    assert!(registry.validate_skills(&citations).is_err());
}

#[test]
fn invalid_guide_references_and_shared_instructions_fail_loading() {
    let registry = Registry::bundled().unwrap();
    let citations =
        crate::configuration::citations::parse_bib(include_str!("../../../references.bib"))
            .unwrap()
            .into_keys()
            .collect();
    let mut bad = registry.clone();
    let guide = bad
        .documents
        .get_mut("arabic")
        .unwrap()
        .learning
        .skill_guides
        .get_mut("past_reference")
        .unwrap();
    let local = guide.varieties.remove("arabic-levantine").unwrap();
    guide.varieties.insert("spanish-mexico".into(), local);
    assert!(bad.validate_skills(&citations).is_err());
    let mut bad = registry.clone();
    bad.presence_instructions.criteria.remove("absent");
    assert!(bad.validate_skills(&citations).is_err());
    let mut bad = registry.clone();
    bad.documents
        .get_mut("spanish")
        .unwrap()
        .learning
        .skill_guides
        .get_mut("past_reference")
        .unwrap()
        .sources
        .push("unknown_source".into());
    assert!(bad.validate_skills(&citations).is_err());
}
