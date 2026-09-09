//! Deterministic local progress derived from live evidence, never model-written rewards.
use std::{collections::HashMap};
use serde::Serialize;
use crate::learner::LanguageProfile;
use super::{Outcome, Snapshot, Status};

#[derive(Debug, Serialize)]
pub struct SkillProgress { pub skill_id: String, pub successes: usize, pub assisted: usize, pub xp: usize, pub checked: bool, pub star: bool }
#[derive(Debug, Serialize)]
pub struct BranchProgress { pub skill_id: String, pub available: bool }
#[derive(Serialize)]
pub struct Credit { pub attempt_id: String, pub skill_id: String, pub xp: usize }
#[derive(Serialize)]
pub struct Profile {
    pub rules_version: u32, pub choices: LanguageProfile, pub xp: usize,
    pub skills: Vec<SkillProgress>, pub branches: Vec<BranchProgress>,
    pub credits: Vec<Credit>,
    pub recommended_focus: String, pub active_focus: String,
}
/// Identical source text contributes once per skill across conversations. Assisted
/// attempts cannot block later unassisted evidence for the same wording.
pub fn project(snapshot: &Snapshot, choices: LanguageProfile) -> Result<Profile, String> {
    choices.validate(&snapshot.target)?;
    if snapshot.learner_id != crate::learner::LOCAL_LEARNER || snapshot.records.iter().any(|record| record.target != snapshot.target || record.learner_id != snapshot.learner_id) {
        return Err("Progress evidence belongs to another language or learner.".into());
    }
    let mut skills = vec![];
    let mut credits = vec![];
    let mut records: Vec<_> = snapshot.records.iter().collect();
    records.sort_by(|a, b| (a.at_secs, a.turn_id, &a.attempt_id).cmp(&(b.at_secs, b.turn_id, &b.attempt_id)));
    for skill in snapshot.catalog.iter().filter(|s| s.kind == "skill") {
        let mut direct = HashMap::new();
        let mut assisted = HashMap::new();
        for record in &records {
            if record.catalog_version != super::CATALOG_VERSION || record.status != Status::Complete || choices.excluded_attempts.contains(&record.attempt_id) { continue; }
            if !record.assessment.as_ref().is_some_and(|a| a.judgments.iter().any(|j| j.skill_id == skill.id && j.outcome == Outcome::Demonstrated)) { continue; }
            let source = record.source.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase();
            if record.input.suggestion || record.input.scaffold || record.input.revision { assisted.entry(source).or_insert(&record.attempt_id); } else { direct.entry(source).or_insert(&record.attempt_id); }
        }
        assisted.retain(|source, _| !direct.contains_key(source));
        for (owners, xp) in [(&direct, 10), (&assisted, 2)] {
            for attempt_id in owners.values() {
                credits.push(Credit { attempt_id: (*attempt_id).clone(), skill_id: skill.id.clone(), xp });
            }
        }
        let successes = direct.len();
        let assisted = assisted.len();
        skills.push(SkillProgress { skill_id: skill.id.clone(), successes, assisted, xp: successes * 10 + assisted * 2, checked: successes >= 1, star: successes >= 3 });
    }
    let branches: Vec<_> = snapshot.catalog.iter().filter(|s| s.kind == "skill").map(|node| {
        let available = snapshot.catalog.iter().any(|p| Some(&p.id) == node.parent.as_ref() && p.kind == "domain") || skills.iter().any(|s| Some(&s.skill_id) == node.parent.as_ref() && s.star);
        BranchProgress { skill_id: node.id.clone(), available }
    }).collect();
    let recommended = skills.iter().filter(|s| !s.star && branches.iter().any(|b| b.skill_id == s.skill_id && b.available))
        .min_by_key(|s| snapshot.catalog.iter().find(|n| n.id == s.skill_id).map(|n| n.code.matches('.').count()).unwrap_or(usize::MAX))
        .or_else(|| skills.iter().min_by_key(|s| s.successes)).ok_or("Skill catalog has no practice targets")?;
    let recommended_focus = recommended.skill_id.clone();
    credits.sort_by(|a, b| (&a.attempt_id, &a.skill_id).cmp(&(&b.attempt_id, &b.skill_id)));
    Ok(Profile { rules_version: 1, xp: skills.iter().map(|s| s.xp).sum(), active_focus: choices.focus.clone().unwrap_or_else(|| recommended_focus.clone()), recommended_focus, choices, skills, branches, credits })
}
