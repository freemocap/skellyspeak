use super::*;
use crate::configuration::content_files;
use serde_json::json;
use std::path::Path;

fn files() -> BTreeMap<String, String> {
    content_files::read(&Path::new(env!("CARGO_MANIFEST_DIR")).join("../content")).unwrap()
}
fn load(files: &BTreeMap<String, String>) -> crate::configuration::Result<Content> {
    Content::from_files(files, include_str!("../../../../references.bib"))
}
fn edit(
    files: &mut BTreeMap<String, String>,
    path: &str,
    edit: impl FnOnce(&mut serde_json::Value),
) {
    let mut d = serde_yaml_ng::from_str(&files[path]).unwrap();
    edit(&mut d);
    files.insert(path.into(), serde_yaml_ng::to_string(&d).unwrap());
}

#[test]
fn explicit_coverage_reports_exact_missing_paths_and_blocks_release() {
    let files = files();
    let c = load(&files).unwrap();
    assert_eq!(c.definitions.len(), 8);
    assert_eq!(c.coverage().subskills, 42);
    assert_eq!(c.languages.len(), 20);
    let coverage = c.coverage();
    let total = c.definitions.len() * (3 + c.languages.len() + c.languages.len() * 3);
    let bundled = |path: &&String| {
        c.guide_policy
            .bundled_explanation_languages
            .iter()
            .any(|id| path.ends_with(&format!("-explained-in-{id}.yaml")))
    };
    assert_eq!(
        coverage.missing.len()
            + c.explanations.keys().filter(bundled).count()
            + c.assessments.len()
            + c.guides.keys().filter(bundled).count(),
        total
    );
    assert_eq!(
        c.require_complete().is_ok(),
        coverage.required_missing.is_empty()
    );
    if !coverage.missing.is_empty() {
        assert!(coverage.missing.iter().all(|p| !files.contains_key(p)));
    }
}

#[test]
fn optional_translation_gaps_do_not_change_source_requirements() {
    let mut c = load(&files()).unwrap();
    let before = c.coverage();
    let path = "languages/spanish/skills/time-events/spanish-time-events-explained-in-spanish.yaml";
    c.guides.remove(path);
    assert_eq!(c.coverage().required_missing, before.required_missing);
    assert!(c.coverage().missing.contains(&path.to_string()));
    c.guides.remove(
        "languages/spanish/skills/time-events/spanish-time-events-explained-in-english.yaml",
    );
    assert_eq!(
        c.coverage().required_missing.len(),
        before.required_missing.len() + 1
    );
    let mut policy = c.guide_policy.clone();
    policy.source_explanation_languages.remove("spanish");
    assert!(policy.validate(&c.languages).is_err());
    policy = c.guide_policy.clone();
    policy.bundled_explanation_languages.push("english".into());
    assert!(policy.validate(&c.languages).is_err());
}

#[test]
fn rejects_unknown_fields_wrong_paths_and_unregistered_files() {
    let mut files = files();
    let path = "skills/time-events/time-events-definition.yaml";
    edit(&mut files, path, |d| d["xp"] = json!(1));
    assert!(load(&files).unwrap_err().message.contains("unknown field"));
    files.remove(path);
    files.insert("skills/time-events/typo.md".into(), "Unknown prompt".into());
    assert!(load(&files).is_err());
}

#[test]
fn rejects_missing_duplicate_or_reordered_sections() {
    let path = "languages/spanish/skills/time-events/spanish-time-events-explained-in-english.yaml";
    let original = files();
    for mode in 0..3 {
        let mut files = original.clone();
        edit(&mut files, path, |d| {
            let sections = d["sections"].as_array_mut().unwrap();
            match mode {
                0 => {
                    sections.pop();
                }
                1 => sections.push(sections[0].clone()),
                _ => sections.swap(0, 1),
            }
        });
        assert!(load(&files).unwrap_err().message.contains("Sections"));
    }
}

#[test]
fn rejects_implicit_variety_fallback_and_stale_review() {
    let path = "languages/spanish/skills/time-events/spanish-time-events-assessment.yaml";
    let mut files = files();
    edit(&mut files, path, |d| {
        d["varieties"]
            .as_object_mut()
            .unwrap()
            .remove("spanish-mexico");
    });
    assert!(load(&files).unwrap_err().message.contains("variety"));
    edit(&mut files, path, |d| d["revision"] = json!("new-revision"));
    assert!(load(&files).unwrap_err().message.contains("revision"));
}

#[test]
fn guide_reference_must_match_skill_and_explanation_language() {
    let mut files = files();
    edit(
        &mut files,
        "languages/spanish/skills/time-events/spanish-time-events-explained-in-english.yaml",
        |d| {
            d["shared_explanation"] =
                json!("skills/time-events/time-events-explained-in-spanish.yaml");
        },
    );
    assert!(
        load(&files)
            .unwrap_err()
            .message
            .contains("shared explanation")
    );
}

#[test]
fn ten_question_request_uses_assessment_files_and_no_learner_guides() {
    let files = files();
    let c = load(&files).unwrap();
    let state = json!({"currentLearnerMessage":"Ayer fui al mercado.","precedingExchange":[{"role":"assistant","content":"¿Qué hiciste ayer?"}]});
    let specimen = c
        .assessment_specimen("spanish", "spanish-mexico", state.clone())
        .unwrap();
    assert_eq!(specimen.request["questions"].as_object().unwrap().len(), 10);
    assert_eq!(
        specimen.request["state"]["currentLearnerMessage"],
        state["currentLearnerMessage"]
    );
    assert_eq!(specimen.request["questions"]["grammar"]["type"], "choice");
    assert!(
        specimen
            .sources
            .iter()
            .all(|s| !s.path.contains("explained-in"))
    );
    assert!(specimen.request["questions"]["time_events"]["instructions"].as_str().unwrap().contains(&c.assessments["languages/spanish/skills/time-events/spanish-time-events-assessment.yaml"].guidance));
    let again = c
        .assessment_specimen("spanish", "spanish-mexico", state)
        .unwrap();
    assert_eq!(
        serde_json::to_value(specimen).unwrap(),
        serde_json::to_value(again).unwrap()
    );
}

#[test]
fn missing_assessment_never_uses_a_learner_guide_as_fallback() {
    let mut files = files();
    files.remove("languages/spanish/skills/time-events/spanish-time-events-assessment.yaml");
    let c = load(&files).unwrap();
    let error = c
        .assessment_specimen(
            "spanish",
            "spanish-mexico",
            json!({"currentLearnerMessage":"Hola", "precedingExchange":[]}),
        )
        .unwrap_err();
    assert!(error.path.ends_with("spanish-time-events-assessment.yaml"));
}

#[test]
fn malformed_credit_policy_fails_before_prompt_assembly() {
    for value in [json!(2.0), json!(-0.1), json!("bad")] {
        let mut files = files();
        edit(&mut files, "policies/skill-credit.yaml", |d| {
            d["minimum_positive_probability"] = value
        });
        assert!(load(&files).is_err());
    }
}

#[test]
fn inventory_includes_prompt_markdown_and_excludes_readmes_templates_schemas() {
    let files = files();
    assert!(files.contains_key("prompts/assessment/skill-assessment.md"));
    assert!(files.keys().all(|p| !p.contains("__")
        && !p.ends_with("_README.md")
        && !p.starts_with("rust-schemas/")));
}

#[test]
fn unknown_generation_metadata_is_explicit_null_and_cannot_be_omitted() {
    let mut files = files();
    let path = "skills/time-events/time-events-definition.yaml";
    let d: Definition = serde_yaml_ng::from_str(&files[path]).unwrap();
    assert!(serde_json::to_value(d).unwrap()["provenance"]["generation"].is_null());
    edit(&mut files, path, |d| {
        d["provenance"]
            .as_object_mut()
            .unwrap()
            .remove("generation");
    });
    assert!(load(&files).unwrap_err().message.contains("generation"));
}
