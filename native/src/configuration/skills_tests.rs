use super::*;
use serde_json::json;

#[test]
fn message_assessment_edits_change_the_captured_assessment_hash() {
    let mut registry = Registry::bundled().unwrap();
    let hash = registry
        .skill_content_hash("spanish", "spanish-spain")
        .unwrap();
    let questions = serde_json::to_value(registry.message_assessment_questions().unwrap()).unwrap();
    registry
        .source_files
        .get_mut("prompts/assessment/grammar.md")
        .unwrap()
        .push_str("\nAuthored criterion sentinel.");
    assert_ne!(
        hash,
        registry
            .skill_content_hash("spanish", "spanish-spain")
            .unwrap()
    );
    let changed = serde_json::to_value(registry.message_assessment_questions().unwrap()).unwrap();
    assert_ne!(questions["grammar"], changed["grammar"]);
    assert_eq!(questions["understandability"], changed["understandability"]);
}

#[test]
fn eight_main_skills_have_the_same_identity_in_every_language() {
    let registry = Registry::bundled().unwrap();
    let expected = [
        "coordinating_action",
        "feelings_viewpoints",
        "information_exchange",
        "managing_conversation",
        "people_places",
        "possibilities_constraints",
        "reasons_connections",
        "time_events",
    ];
    for language in &registry.languages {
        let skills = registry.skills_for_language(&language.id).unwrap();
        assert_eq!(
            skills.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            expected
        );
        let catalog = registry.practice_catalog(&language.id).unwrap();
        let nodes = catalog.as_array().unwrap();
        assert_eq!(nodes.len(), 9);
        for node in nodes.iter().filter(|n| n["kind"] == "skill") {
            assert_eq!(node["parent"], "experience");
            assert_eq!(
                node["criterion"],
                registry
                    .skill_definition(node["id"].as_str().unwrap())
                    .unwrap()
                    .boundary
            );
        }
    }
    assert!(registry.skills_for_language("unknown").is_err());
}

#[test]
fn compact_assessments_use_explicit_variety_guidance_and_fail_on_missing_content() {
    let registry = Registry::bundled().unwrap();
    for variety in &registry.language("spanish").unwrap().varieties {
        for skill in registry.skills_for_language("spanish").unwrap() {
            let prompt = registry
                .skill_prompt("spanish", &variety.id, &skill.id)
                .unwrap();
            assert!(!prompt.language_guidance.is_empty());
        }
    }
    assert!(
        registry
            .skill_prompt("spanish", "arabic-levantine", "time_events")
            .is_err()
    );
    assert!(
        registry
            .skill_prompt("spanish", "spanish-spain", "past_events")
            .is_err()
    );
    let mut missing = registry.clone();
    let path = "languages/spanish/skills/time-events/spanish-time-events-assessment.yaml";
    missing.authored.assessments.remove(path);
    let error = missing
        .skill_prompt("spanish", "spanish-spain", "time_events")
        .unwrap_err();
    assert_eq!(error.path, path);
    assert_eq!(error.code, "missing_skill_assessment");
}

#[test]
fn teaching_edits_do_not_change_assessment_input_or_its_hash() {
    let mut registry = Registry::bundled().unwrap();
    let hash = registry
        .skill_content_hash("spanish", "spanish-spain")
        .unwrap();
    let report_hash = registry.communication_content_hash();
    let path = "languages/spanish/skills/time-events/spanish-time-events-explained-in-english.yaml";
    registry.authored.guides.get_mut(path).unwrap().sections[0]
        .explanation
        .push_str(" Learner-only sentinel.");
    let markdown = registry
        .communication_markdown("spanish", "spanish-spain", "english", "time_events")
        .unwrap();
    assert!(markdown.contains("Learner-only sentinel"));
    let prompt = registry
        .skill_prompt("spanish", "spanish-spain", "time_events")
        .unwrap();
    assert!(!prompt.language_guidance.contains("Learner-only sentinel"));
    assert_eq!(
        hash,
        registry
            .skill_content_hash("spanish", "spanish-spain")
            .unwrap()
    );
    assert_ne!(report_hash, registry.communication_content_hash());
    let request = practice_assessment::request(
        json!({"currentLearnerMessage":"Ayer fui.","precedingExchange":[]}),
        &[prompt],
        registry.assessment_instructions(),
    )
    .unwrap();
    assert_eq!(
        request["questions"]["time_events"]["criteria"]
            .as_object()
            .unwrap()
            .len(),
        4
    );
    let path = "languages/spanish/skills/time-events/spanish-time-events-assessment.yaml";
    registry
        .authored
        .assessments
        .get_mut(path)
        .unwrap()
        .guidance
        .push_str(" Assessment sentinel.");
    assert_ne!(
        hash,
        registry
            .skill_content_hash("spanish", "spanish-spain")
            .unwrap()
    );
}

#[test]
fn all_teaching_editions_and_variety_sections_leave_the_full_assessment_unchanged() {
    let bundled = Registry::bundled().unwrap();
    let state = json!({
        "currentLearnerMessage": "Learner message fixture.",
        "precedingExchange": [{"role": "assistant", "content": "Preceding turn fixture."}],
        "input": {"modality": "text", "suggestion": false, "revision": false, "scaffold": false}
    });
    for language in ["english", "spanish", "arabic"] {
        for variety in &bundled.language(language).unwrap().varieties {
            let mut registry = bundled.clone();
            let original = registry
                .skill_presence_request(language, &variety.id, state.clone())
                .unwrap();
            let questions = original["questions"].as_object().unwrap();
            assert_eq!(questions.len(), 10);
            for skill in &registry.shared_skills().skills {
                assert!(questions.contains_key(&skill.id));
            }
            assert!(questions.contains_key("grammar"));
            assert!(questions.contains_key("understandability"));
            let original_bytes = serde_json::to_vec(&original).unwrap();
            let original_hash = registry.skill_content_hash(language, &variety.id).unwrap();
            let assert_assessment_unchanged = |registry: &Registry, context: &str| {
                let request = registry
                    .skill_presence_request(language, &variety.id, state.clone())
                    .unwrap();
                assert_eq!(original, request, "{language}/{}: {context}", variety.id);
                assert_eq!(
                    original_bytes,
                    serde_json::to_vec(&request).unwrap(),
                    "Serialized request changed for {language}/{}: {context}",
                    variety.id
                );
                assert_eq!(
                    original_hash,
                    registry.skill_content_hash(language, &variety.id).unwrap(),
                    "Assessment hash changed for {language}/{}: {context}",
                    variety.id
                );
            };
            let guide_paths: Vec<_> = registry
                .authored
                .guides
                .iter()
                .filter(|(_, guide)| guide.language == language)
                .map(|(path, _)| path.clone())
                .collect();
            for path in guide_paths {
                let guide = &registry.authored.guides[&path];
                let skill = guide.skill_id.clone();
                let explanation = guide.explanation_language.clone();
                let shared_path = guide.shared_explanation.clone();
                let render = |registry: &Registry| {
                    registry
                        .skill_guide_markdown(language, &variety.id, &explanation, &skill)
                        .unwrap()
                };

                let before_shared = render(&registry);
                let shared = registry
                    .authored
                    .explanations
                    .get_mut(&shared_path)
                    .unwrap();
                shared.title.push_str(" Shared title sentinel.");
                shared
                    .introduction
                    .push_str(" Shared introduction sentinel.");
                for concept in &mut shared.sections {
                    concept.title.push_str(" Shared heading sentinel.");
                    concept.concept.push_str(" Shared concept sentinel.");
                }
                let after_shared = render(&registry);
                assert_ne!(before_shared, after_shared, "{path}");
                for marker in [
                    "Shared title sentinel",
                    "Shared introduction sentinel",
                    "Shared heading sentinel",
                    "Shared concept sentinel",
                ] {
                    assert!(after_shared.contains(marker), "{path}: {marker}");
                }
                assert_assessment_unchanged(&registry, &format!("shared explanation for {path}"));

                let before_core = render(&registry);
                let guide = registry.authored.guides.get_mut(&path).unwrap();
                let has_replacement = guide.variety_sections.contains_key(&variety.id);
                for section in &mut guide.sections {
                    section.explanation.push_str(" Core explanation sentinel.");
                    for example in &mut section.examples {
                        example.text.push_str(" Core principal example sentinel.");
                        example.meaning.push_str(" Core meaning sentinel.");
                        example.note.push_str(" Core note sentinel.");
                    }
                }
                let after_core = render(&registry);
                if has_replacement {
                    assert_eq!(
                        before_core, after_core,
                        "Unselected core leaked into {path}"
                    );
                } else {
                    assert_ne!(before_core, after_core, "{path}");
                    for marker in [
                        "Core explanation sentinel",
                        "Core principal example sentinel",
                        "Core meaning sentinel",
                        "Core note sentinel",
                    ] {
                        assert!(after_core.contains(marker), "{path}: {marker}");
                    }
                }
                assert_assessment_unchanged(&registry, &format!("core teaching for {path}"));

                // Exercise the replacement path even for documents that currently share
                // all teaching across varieties; use a complete, ordered section list.
                let guide = registry.authored.guides.get_mut(&path).unwrap();
                let sections = guide
                    .variety_sections
                    .entry(variety.id.clone())
                    .or_insert_with(|| guide.sections.clone());
                for section in sections {
                    section
                        .explanation
                        .push_str(" Selected explanation sentinel.");
                    for example in &mut section.examples {
                        example
                            .text
                            .push_str(" Selected principal example sentinel.");
                        example.meaning.push_str(" Selected meaning sentinel.");
                        example.note.push_str(" Selected note sentinel.");
                    }
                }
                let after_selected = render(&registry);
                assert_ne!(after_core, after_selected, "{path}");
                for marker in [
                    "Selected explanation sentinel",
                    "Selected principal example sentinel",
                    "Selected meaning sentinel",
                    "Selected note sentinel",
                ] {
                    assert!(after_selected.contains(marker), "{path}: {marker}");
                }
                assert_assessment_unchanged(&registry, &format!("selected teaching for {path}"));
            }
            // Positive control: an edit to the actual assessment owner must be
            // observable in both the same full request and its captured hash.
            let assessment_path = format!(
                "languages/{language}/skills/time-events/{language}-time-events-assessment.yaml"
            );
            registry
                .authored
                .assessments
                .get_mut(&assessment_path)
                .unwrap()
                .guidance
                .push_str(" Assessment owner sentinel.");
            let changed = registry
                .skill_presence_request(language, &variety.id, state.clone())
                .unwrap();
            assert_ne!(original, changed, "{assessment_path}");
            assert!(changed.to_string().contains("Assessment owner sentinel"));
            assert_ne!(
                original_hash,
                registry.skill_content_hash(language, &variety.id).unwrap(),
                "{assessment_path}"
            );
        }
    }
}
