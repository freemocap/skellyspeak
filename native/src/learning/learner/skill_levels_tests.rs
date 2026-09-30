use super::*;
use serde_json::json;

#[test]
fn thresholds_include_zero_exact_boundaries_and_next_band() {
    for (points, expected) in [
        (0, (0, 0, 1)),
        (1, (1, 1, 2)),
        (2, (2, 2, 3)),
        (3, (3, 3, 5)),
        (4, (3, 3, 5)),
        (5, (4, 5, 8)),
        (7, (4, 5, 8)),
        (8, (5, 8, 13)),
        (13, (6, 13, 21)),
    ] {
        assert_eq!(position(points).unwrap(), expected);
    }
    assert!(position(2_971_215_072).is_ok());
    assert!(position(2_971_215_073).is_err());
    assert!(position(u32::MAX).is_err());
}

#[test]
fn catalog_order_weakest_skill_and_scoped_counts_ignore_xp_weight() {
    let catalog = json!([{"kind":"domain","id":"domain"},
        {"kind":"skill","id":"b"},{"kind":"skill","id":"a"}]);
    let mut credits = Vec::new();
    for n in 0..8 {
        credits.push(json!({"attempt_id":n.to_string(),"skill_id":"b","xp":99}));
    }
    let summary = project(&catalog, &credits).unwrap();
    assert_eq!(summary.level, 0);
    assert_eq!(summary.bands, vec![1]);
    assert_eq!(summary.skills[0].points, 8);
    assert_eq!(summary.skills[0].level, 5);
    for n in 0..5 {
        credits.push(json!({"attempt_id":n.to_string(),"skill_id":"a","xp":1}));
    }
    let summary = project(&catalog, &credits).unwrap();
    assert_eq!(summary.level, 4);
    assert_eq!(summary.bands, vec![1, 2, 3, 5, 8]);
    assert_eq!(project(&catalog, &credits[..8]).unwrap().level, 0);
}

#[test]
fn invalid_catalogs_and_credits_are_errors() {
    let catalog = json!([{"kind":"skill","id":"a"}]);
    let credit = json!({"attempt_id":"one","skill_id":"a"});
    assert!(project(&catalog, &[credit.clone(), credit]).is_err());
    assert!(
        project(
            &catalog,
            &[json!({"attempt_id":"one","skill_id":"unknown"})]
        )
        .is_err()
    );
    assert!(project(&catalog, &[json!({"skill_id":"a"})]).is_err());
    assert!(project(&json!([]), &[]).is_err());
    assert!(
        project(
            &json!([{"kind":"skill","id":"a"},{"kind":"skill","id":"a"}]),
            &[]
        )
        .is_err()
    );
}
