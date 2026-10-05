use super::*;

fn bundled() -> (Catalog, BTreeSet<String>) {
    let content = crate::configuration::authoring::Content::load(
        &std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../content"),
    )
    .unwrap();
    let first = content.definitions.values().next().unwrap();
    let catalog = Catalog {
        schema_version: 1,
        revision: first.revision.clone(),
        definition_language: "english".into(),
        origin: first.provenance.origin.clone(),
        authorship: first.provenance.authorship.clone(),
        review: first.provenance.review.status.clone(),
        sources: first.provenance.sources.clone(),
        groups: content
            .definitions
            .values()
            .map(|d| Group {
                id: d.id.clone(),
                name: d.name.clone(),
                purpose: d.purpose.clone(),
                boundary: d.boundary.clone(),
                subskills: content.subskills[&d.id].subskills.clone(),
            })
            .collect(),
    };
    let citations =
        crate::configuration::citations::parse_bib(include_str!("../../../references.bib"))
            .unwrap()
            .into_keys()
            .collect();
    (catalog, citations)
}

#[test]
fn groups_are_assessment_units_and_subskills_are_teaching_definitions() {
    let (catalog, citations) = bundled();
    catalog.validate(&citations).unwrap();
    assert_eq!(catalog.groups.len(), 8);
    assert_eq!(catalog.subskills().count(), 42);
    assert!(
        catalog
            .groups
            .iter()
            .all(|group| !group.subskills.is_empty())
    );
}

#[test]
fn rejects_ambiguous_identities_and_broken_boundaries() {
    let (catalog, citations) = bundled();
    let mut bad = catalog.clone();
    bad.groups[0].subskills[0].id = bad.groups[1].id.clone();
    assert!(bad.validate(&citations).is_err());
    let mut bad = catalog.clone();
    bad.groups[0].subskills[0].neighbors = vec!["missing".into()];
    assert!(bad.validate(&citations).is_err());
    let mut bad = catalog.clone();
    bad.groups[0].subskills[0].neighbors = vec![bad.groups[0].subskills[0].id.clone()];
    assert!(bad.validate(&citations).is_err());
    let mut bad = catalog.clone();
    bad.groups[0].boundary.clear();
    assert!(bad.validate(&citations).is_err());
    let mut bad = catalog;
    bad.groups[0].subskills[0].counterexample = "\0".into();
    assert!(bad.validate(&citations).is_err());
}

#[test]
fn provenance_is_required_and_unknown_fields_are_rejected() {
    let (catalog, citations) = bundled();
    let mut bad = catalog.clone();
    bad.sources.push("invented".into());
    assert!(bad.validate(&citations).is_err());
    let mut value = serde_json::to_value(&catalog).unwrap();
    value["groups"][0]["subskills"][0]["xp"] = serde_json::json!(1);
    assert!(serde_json::from_value::<Catalog>(value).is_err());
    let mut value = serde_json::to_value(&catalog).unwrap();
    value.as_object_mut().unwrap().remove("origin");
    assert!(serde_json::from_value::<Catalog>(value).is_err());
}
