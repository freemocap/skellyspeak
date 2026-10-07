use super::*;
use crate::configuration::authoring;
use serde_json::json;

#[test]
fn every_authored_guide_fits_its_coaching_and_practice_focus_budgets() {
    let registry = Registry::bundled().unwrap();
    for language in &registry.languages {
        for variety in &language.varieties {
            for skill in registry.skills_for_language(&language.id).unwrap() {
                let mut settings = registry.defaults(&language.id, "english").unwrap();
                settings.variety_id = variety.id.clone();
                settings.direction.topic =
                    Some(crate::conversations::direction::TopicChoice::Skill {
                        skill_id: skill.id.clone(),
                        subskill_id: None,
                    });
                assert!(
                    registry
                        .skill_conversation_focus(&language.id, &settings)
                        .unwrap()
                        .is_some()
                );
                for explanation in &registry.languages {
                    if let Some(edition) = registry
                        .guide_edition(&language.id, &explanation.id, &skill.id)
                        .unwrap()
                    {
                        let markdown = edition.markdown(&variety.id);
                        assert!(
                            markdown.len() <= 24000,
                            "Guide coach budget: {}/{}/{}/{} is {} UTF-8 bytes",
                            language.id,
                            variety.id,
                            explanation.id,
                            skill.id,
                            markdown.len()
                        );
                    }
                }
            }
        }
    }
}

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
    assert_eq!(body, request("cantonese"));
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
fn cantonese_editions_cover_every_target_and_keep_source_examples_exact() {
    let registry = Registry::bundled().unwrap();
    let coverage = registry.communication_coverage();
    let editions: Vec<_> = coverage
        .iter()
        .filter(|row| row.explanation_language == "cantonese")
        .collect();
    assert_eq!(editions.len(), registry.languages.len());
    assert!(editions.iter().all(|row| row.missing_groups.is_empty()));
    for language in &registry.languages {
        for skill in &registry.shared_skills().skills {
            let stem = skill.id.replace('_', "-");
            let path = format!(
                "languages/{0}/skills/{stem}/{0}-{stem}-explained-in-cantonese.yaml",
                language.id
            );
            let guide = &registry.authored.guides[&path];
            let source = registry.guide_source(&language.id, &skill.id).unwrap();
            let shared = &registry.authored.explanations[&guide.shared_explanation];
            assert_eq!(guide.sections.len(), source.guide.sections.len(), "{path}");
            assert_eq!(
                guide.varieties.len(),
                source.guide.varieties.len(),
                "{path}"
            );
            for (variety, original) in &source.guide.varieties {
                match (&guide.varieties[variety], original) {
                    (
                        authoring::Disposition::UseCore { .. },
                        authoring::Disposition::UseCore { .. },
                    ) => {}
                    (
                        authoring::Disposition::Supplement { text, .. },
                        authoring::Disposition::Supplement { text: original, .. },
                    ) => assert_ne!(text, original, "{path}/{variety}"),
                    _ => panic!("Changed variety applicability: {path}/{variety}"),
                }
            }
            for (translated, original) in guide.sections.iter().zip(&source.guide.sections) {
                assert_eq!(translated.subskill_id, original.subskill_id, "{path}");
                assert_ne!(translated.explanation, original.explanation, "{path}");
                assert_eq!(translated.examples.len(), original.examples.len(), "{path}");
                for (translated, original) in translated.examples.iter().zip(&original.examples) {
                    assert_eq!(translated.text, original.text, "{path}");
                    assert_ne!(translated.meaning, original.meaning, "{path}");
                }
            }
            for variety in &language.varieties {
                let selected = guide.sections_for(&variety.id);
                let original = source.guide.sections_for(&variety.id);
                assert_eq!(selected.len(), original.len(), "{path}/{}", variety.id);
                for (translated, original) in selected.iter().zip(original) {
                    assert_eq!(translated.subskill_id, original.subskill_id);
                    assert_ne!(translated.explanation, original.explanation);
                    assert_eq!(translated.examples.len(), original.examples.len());
                    for (translated, original) in translated.examples.iter().zip(&original.examples)
                    {
                        assert_eq!(translated.text, original.text);
                        assert_ne!(translated.meaning, original.meaning);
                    }
                }
                let markdown = registry
                    .skill_guide_markdown(&language.id, &variety.id, "cantonese", &skill.id)
                    .unwrap();
                assert!(markdown.starts_with(&format!("# {}", shared.title)));
                for section in selected {
                    assert!(markdown.contains(&section.explanation));
                    for example in &section.examples {
                        assert!(markdown.contains(&example.text));
                        assert!(markdown.contains(&example.meaning));
                    }
                }
                assert!(!markdown.contains("needs_review"));
            }
        }
    }
}

#[test]
fn completeness_is_an_authoring_gate_and_missing_guides_have_no_fallback() {
    let mut registry = Registry::bundled().unwrap();
    assert!(registry.require_complete_communication_content().is_ok());
    let report = registry.communication_coverage();
    assert_eq!(
        report.len(),
        registry.languages.len()
            * registry
                .authored
                .guide_policy
                .bundled_explanation_languages
                .len()
    );
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
            let selected_sections = edition.guide.sections_for(variety);
            sections += selected_sections.len();
            let rendered = registry
                .skill_guide_markdown("french", variety, "english", &skill.id)
                .unwrap();
            assert!(!rendered.contains("Credit requires"));
            for section in selected_sections {
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
            assert!(focus.contains(&selected_sections[0].explanation));
            assert!(!focus.contains("Credit requires"));
        }
        assert_eq!(sections, 42);
        assert!(request.to_string().contains("Hier nous aller au marché"));
    }
}
