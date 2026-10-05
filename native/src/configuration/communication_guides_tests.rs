use super::*;
use serde_json::json;

#[test]
fn full_request_has_ten_questions_and_no_explanation_language_dependency() {
    let registry = Registry::bundled().unwrap();
    let state = json!({"currentLearnerMessage":"Ayer fui al mercado.","precedingExchange":[{"role":"assistant","content":"¿Qué hiciste ayer?"}]});
    let request = |explanation| {
        registry
            .communication_request("spanish", "spanish-spain", explanation, state.clone())
            .unwrap()
    };
    let body = request("english");
    assert_eq!(body, request("spanish"));
    assert_eq!(body, request("french"));
    let questions = body["questions"].as_object().unwrap();
    assert_eq!(questions.len(), 10);
    for skill in registry.shared_skills().skills.iter() {
        assert_eq!(questions[&skill.id]["type"], "choice");
    }
    assert!(body.to_string().contains("Ayer yo ir al mercado"));
    assert_eq!(
        body["state"]["currentLearnerMessage"],
        state["currentLearnerMessage"]
    );
    assert!(
        registry
            .communication_request("spanish", "spanish-spain", "english", json!({}))
            .is_err()
    );
}

#[test]
fn completeness_is_an_authoring_gate_and_missing_guides_have_no_fallback() {
    let mut registry = Registry::bundled().unwrap();
    assert!(registry.require_complete_communication_content().is_ok());
    let report = registry.communication_coverage();
    assert_eq!(report.len(), registry.languages.len() * 3);
    assert!(
        report
            .iter()
            .find(|r| r.language == "spanish" && r.explanation_language == "english")
            .unwrap()
            .missing_groups
            .is_empty()
    );
    let path = "languages/spanish/skills/time-events/spanish-time-events-explained-in-english.yaml";
    assert!(registry.authored.guides.remove(path).is_some());
    assert!(registry.require_complete_communication_content().is_err());
    assert_eq!(
        registry
            .communication_markdown("spanish", "spanish-spain", "english", "time_events")
            .unwrap_err()
            .path,
        path
    );
    assert!(
        registry
            .skill_prompt("spanish", "spanish-spain", "time_events")
            .is_ok()
    );
}

#[test]
fn localized_guides_join_shared_concepts_and_language_examples_by_subskill() {
    let registry = Registry::bundled().unwrap();
    for skill in &registry.shared_skills().skills {
        let stem = skill.id.replace('_', "-");
        let en_path =
            format!("languages/spanish/skills/{stem}/spanish-{stem}-explained-in-english.yaml");
        let es_path =
            format!("languages/spanish/skills/{stem}/spanish-{stem}-explained-in-spanish.yaml");
        let english = &registry.authored.guides[&en_path];
        let spanish = &registry.authored.guides[&es_path];
        let shared = &registry.authored.explanations[&spanish.shared_explanation];
        let markdown = registry
            .communication_markdown("spanish", "spanish-spain", "spanish", &skill.id)
            .unwrap();
        assert!(markdown.starts_with(&format!("# {}", shared.title)));
        assert!(markdown.contains(&en_path.replace("english", "spanish")));
        for section in &spanish.sections {
            let source = english
                .sections
                .iter()
                .find(|s| s.subskill_id == section.subskill_id)
                .unwrap();
            let concept = shared
                .sections
                .iter()
                .find(|s| s.subskill_id == section.subskill_id)
                .unwrap();
            assert!(markdown.contains(&format!("### {}", concept.title)));
            assert!(markdown.contains(&concept.concept));
            assert_eq!(source.examples[0].text, section.examples[0].text);
            assert_ne!(source.examples[0].meaning, section.examples[0].meaning);
        }
    }
}

#[test]
fn learner_markdown_excludes_authoring_and_assessment_instructions() {
    let registry = Registry::bundled().unwrap();
    let guide = registry
        .skill_guide_markdown("spanish", "spanish-spain", "english", "time_events")
        .unwrap();
    assert!(guide.contains("> Ayer fui al mercado."));
    assert!(guide.contains("Yesterday I went to the market."));
    assert!(!guide.contains("content/"));
    assert!(!guide.contains("Choice criteria"));
    assert!(!guide.contains("currentLearnerMessage"));
    assert!(!guide.contains("needs_review"));
}

#[test]
fn english_has_all_source_guides_and_assessments_for_both_varieties() {
    let registry = Registry::bundled().unwrap();
    for variety in ["english-united-states", "english-united-kingdom"] {
        assert_eq!(
            registry
                .communication_prompts("english", variety, "spanish")
                .unwrap()
                .len(),
            8
        );
        let mut sections = 0;
        for skill in registry.skills_for_language("english").unwrap() {
            let guide = registry.guide_source("english", &skill.id).unwrap();
            sections += guide.guide.sections.len();
            assert!(!guide.markdown(variety).is_empty());
            assert!(
                registry
                    .guide_edition("english", "spanish", &skill.id)
                    .unwrap()
                    .is_none()
            );
        }
        assert_eq!(sections, 42);
    }
}

#[test]
fn french_source_bundle_composes_for_both_varieties_without_translation_or_inference() {
    let registry = Registry::bundled().unwrap();
    for variety in ["french-france", "french-canada"] {
        let state = json!({"currentLearnerMessage":"Hier, il pleuvait quand nous avons quitté la maison.","precedingExchange":[{"role":"assistant","content":"Comment s’est passé votre départ ?"}]});
        let request = registry
            .communication_request("french", variety, "english", state.clone())
            .unwrap();
        assert_eq!(
            request,
            registry
                .communication_request("french", variety, "arabic", state)
                .unwrap()
        );
        assert_eq!(request["questions"].as_object().unwrap().len(), 10);
        let mut sections = 0;
        for skill in registry.skills_for_language("french").unwrap() {
            let edition = registry.guide_source("french", &skill.id).unwrap();
            sections += edition.guide.sections.len();
            let rendered = registry
                .skill_guide_markdown("french", variety, "english", &skill.id)
                .unwrap();
            assert!(!rendered.contains("Credit requires"));
            for section in &edition.guide.sections {
                assert!(rendered.contains(&section.explanation));
                for example in &section.examples {
                    assert!(rendered.contains(&format!("> {}", example.text)));
                }
            }
            let mut settings = registry.defaults("french", "english").unwrap();
            settings.variety_id = variety.into();
            settings.direction.topic = Some(crate::conversations::direction::TopicChoice::Skill {
                skill_id: skill.id.clone(),
                subskill_id: None,
            });
            let focus = registry
                .skill_conversation_focus("french", &settings)
                .unwrap()
                .unwrap();
            assert!(focus.len() <= 16000);
            assert!(focus.contains(&edition.guide.sections[0].explanation));
            assert!(!focus.contains("Credit requires"));
        }
        assert_eq!(sections, 42);
        assert!(request.to_string().contains("Hier nous aller au marché"));
    }
}
