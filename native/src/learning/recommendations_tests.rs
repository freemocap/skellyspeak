use super::*;
fn history() -> Vec<Candidate> {
    vec![
        Candidate {
            skill_id: "present".into(),
            experience: 80,
            effort: 0,
        },
        Candidate {
            skill_id: "past".into(),
            experience: 2,
            effort: 3,
        },
        Candidate {
            skill_id: "possession".into(),
            experience: 8,
            effort: 12,
        },
        Candidate {
            skill_id: "quantity".into(),
            experience: 0,
            effort: 0,
        },
    ]
}
#[test]
fn breadth_and_depth_use_different_evidence_without_success_scores() {
    let rows = history();
    assert_eq!(
        choose(&rows, RecommendationMode::Explore, "chat")
            .unwrap()
            .skill
            .skill_id,
        "quantity"
    );
    assert_eq!(
        choose(&rows, RecommendationMode::ContinuePracticing, "chat")
            .unwrap()
            .skill
            .skill_id,
        "possession"
    );
    assert_eq!(
        choose(&rows, RecommendationMode::CoachChoice, "chat").unwrap(),
        choose(&rows, RecommendationMode::CoachChoice, "chat").unwrap()
    );
    let modes: std::collections::BTreeSet<_> = (0..32)
        .map(|i| {
            format!(
                "{:?}",
                choose(&rows, RecommendationMode::CoachChoice, &i.to_string())
                    .unwrap()
                    .selected
            )
        })
        .collect();
    assert_eq!(modes.len(), 2);
}
#[test]
fn no_history_is_exploration_not_a_claim_of_inability() {
    let rows = vec![Candidate {
        skill_id: "past".into(),
        experience: 0,
        effort: 0,
    }];
    assert_eq!(
        choose(&rows, RecommendationMode::CoachChoice, "chat")
            .unwrap()
            .selected,
        RecommendationMode::Explore
    );
    assert!(choose(&rows, RecommendationMode::ContinuePracticing, "chat").is_err());
    assert!(choose(&[], RecommendationMode::Explore, "chat").is_err());
}
#[test]
fn ties_vary_by_conversation_but_never_change_priority() {
    let rows = vec![
        Candidate {
            skill_id: "one".into(),
            experience: 0,
            effort: 0,
        },
        Candidate {
            skill_id: "two".into(),
            experience: 0,
            effort: 0,
        },
        Candidate {
            skill_id: "used".into(),
            experience: 1,
            effort: 0,
        },
    ];
    let ids: std::collections::BTreeSet<_> = (0..32)
        .map(|i| {
            choose(&rows, RecommendationMode::Explore, &i.to_string())
                .unwrap()
                .skill
                .skill_id
        })
        .collect();
    assert_eq!(
        ids,
        std::collections::BTreeSet::from(["one".into(), "two".into()])
    );
}
#[test]
fn variety_counts_include_only_eligible_ledger_credits() {
    let profile = json!({"records":[{"attempt_id":"a","variety":"one"},{"attempt_id":"b","variety":"two"}],"profile":{"credits":[{"attempt_id":"a","skill_id":"past","experience":1,"effort":0},{"attempt_id":"b","skill_id":"past","experience":0,"effort":1}]}});
    let result = candidates(&profile, "one", &["past".into(), "new_extension".into()]).unwrap();
    assert_eq!((result[0].experience, result[0].effort), (1, 0));
    assert_eq!(result[1].experience, 0);
}

#[test]
fn practice_prompt_uses_readable_focus_without_assessment_or_selection_metadata() {
    let registry = Registry::bundled().unwrap();
    let captured = json!({
        "identity": {"catalog": "private-catalog-id"},
        "selection": {"policy": "internal-policy", "experience": 42},
        "skill": {"id": "internal-skill-id", "name": "Everyday quantities",
            "overview": "Talk about amounts.\nPreserve this second line.",
            "boundary": "assessment-only-boundary", "language_guidance": "assessment-only-guidance"}
    });
    let original = captured.clone();
    let task = "Immediate conversation task and difficulty.";
    let mut prompt = task.to_owned();
    append_prompt(&mut prompt, &registry, Some(&captured)).unwrap();
    assert!(
        prompt
            .contains("> Everyday quantities\n> Talk about amounts.\n> Preserve this second line.")
    );
    assert!(prompt.ends_with(task));
    for omitted in [
        "private-catalog-id",
        "internal-policy",
        "internal-skill-id",
        "assessment-only-boundary",
        "assessment-only-guidance",
        "42",
    ] {
        assert!(!prompt.contains(omitted));
    }
    assert_eq!(captured, original);
    assert!(append_prompt(&mut String::new(), &registry, Some(&json!({"skill": {}}))).is_err());
}
