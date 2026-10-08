use super::*;

#[test]
fn inspector_composes_the_same_authored_sections_as_the_readable_report() {
    let r = Registry::bundled().unwrap();
    let inspection = r
        .inspect_language("spanish", Some("spanish-spain"), "english", None)
        .unwrap();
    let editions: std::collections::BTreeSet<_> = inspection
        .guides
        .iter()
        .map(|item| item.guide.explanation_language.as_str())
        .collect();
    assert_eq!(
        editions,
        [
            "arabic",
            "cantonese",
            "english",
            "french",
            "mandarin",
            "portuguese",
            "spanish"
        ]
        .into()
    );
    assert_eq!(
        inspection.guides.len(),
        r.shared_skills().skills.len() * editions.len()
    );
    for item in inspection.guides {
        let guides::GuideTarget::Skill { skill, .. } = &item.guide.target else {
            panic!("Expected a skill guide")
        };
        let markdown = r
            .communication_markdown(
                "spanish",
                "spanish-spain",
                &item.guide.explanation_language,
                skill,
            )
            .unwrap();
        assert!(markdown.contains(&item.guide.title));
        for section in &item.guide.sections {
            assert!(markdown.contains(&section.title));
            assert!(markdown.contains(&section.text));
        }
        for example in &item.guide.examples {
            assert!(markdown.contains(&example.text));
        }
        assert!(
            inspection
                .sources
                .iter()
                .any(|source| source.path == item.source)
        );
        assert_eq!(item.selected_variety.as_deref(), Some("spanish-spain"));
        assert_eq!(item.fingerprint.len(), 64);
    }
    assert!(
        r.inspect_guides("spanish", Some("arabic-levantine"))
            .is_err()
    );
}

#[test]
fn inspector_keeps_explanation_identity_and_provenance_with_each_guide() {
    let r = Registry::bundled().unwrap();
    let items = r.inspect_guides("spanish", None).unwrap();
    for item in items {
        let authored = &r.authored.guides[&item.source];
        assert_eq!(
            item.guide.explanation_language,
            authored.explanation_language
        );
        assert_eq!(item.guide.authorship, authored.provenance.authorship);
        assert_eq!(
            item.guide.review.to_string(),
            authored.provenance.review.status.to_string()
        );
        assert_eq!(
            item.explanation_name,
            r.language(&authored.explanation_language).unwrap().name
        );
    }
}

#[test]
fn teaching_edit_changes_inspection_hash_without_changing_credit_definition() {
    let mut r = Registry::bundled().unwrap();
    let path = "languages/spanish/skills/time-events/spanish-time-events-explained-in-english.yaml";
    let find = |r: &Registry| {
        r.inspect_guides("spanish", None)
            .unwrap()
            .into_iter()
            .find(|g| g.source == path)
            .unwrap()
    };
    let before = find(&r);
    let credit_hash = r.learning_content_hash();
    r.authored.guides.get_mut(path).unwrap().sections[0]
        .explanation
        .push_str(" Human edit.");
    let after = find(&r);
    assert_ne!(before.fingerprint, after.fingerprint);
    assert_eq!(credit_hash, r.learning_content_hash());
    assert!(after.guide.sections[0].text.contains("Human edit."));
}
