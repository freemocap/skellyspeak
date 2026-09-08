//! Deterministic local progress derived from live evidence, never model-written rewards.
use std::{collections::{HashMap, HashSet}, path::{Path, PathBuf}};
use serde::{Deserialize, Serialize};
use super::{Outcome, Snapshot, Status};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Choices {
    pub version: u32,
    pub revision: u64,
    pub learner_id: String,
    pub target: String,
    pub focus: Option<String>,
    pub excluded_attempts: Vec<String>,
}
impl Choices {
    pub fn initial(target: &str) -> Self { Self { version: 1, revision: 0, learner_id: super::LEARNER.into(), target: target.into(), focus: None, excluded_attempts: vec![] } }
    fn validate(&self, target: &str) -> Result<(), String> {
        if self.version != 1 || self.learner_id != super::LEARNER || self.target != target { return Err("Profile ownership or version mismatch.".into()); }
        let nodes = super::catalog()?;
        if self.focus.as_ref().is_some_and(|id| !nodes.iter().any(|s| s.kind == "skill" && &s.id == id)) { return Err("Unknown practice focus.".into()); }
        if self.excluded_attempts.iter().collect::<HashSet<_>>().len() != self.excluded_attempts.len() { return Err("Duplicate excluded evidence.".into()); }
        Ok(())
    }
}
fn path(config: &Path, target: &str) -> Result<PathBuf, String> {
    if target.is_empty() || !target.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') { return Err("Invalid profile language.".into()); }
    Ok(config.join("learners").join(super::LEARNER).join(format!("{target}.json")))
}
pub fn load(config: &Path, target: &str) -> Result<Choices, String> {
    let Some(raw) = crate::persistence::read(&path(config, target)?)? else { return Ok(Choices::initial(target)); };
    let choices: Choices = serde_json::from_str(&raw).map_err(|e| format!("Invalid learner profile: {e}"))?;
    choices.validate(target)?;
    Ok(choices)
}
pub fn save(config: &Path, target: &str, expected_revision: u64, mut choices: Choices) -> Result<(), String> {
    choices.validate(target)?;
    let current = load(config, target)?;
    if current.revision != expected_revision || choices.revision != expected_revision { return Err("The profile changed. Refresh it before saving.".into()); }
    choices.revision += 1;
    let destination = path(config, target)?;
    std::fs::create_dir_all(destination.parent().ok_or("Profile has no parent directory")?).map_err(|e| format!("Cannot create learner profile directory: {e}"))?;
    crate::persistence::write(&destination, &serde_json::to_vec_pretty(&choices).map_err(|e| e.to_string())?)
}
#[derive(Debug, Serialize)]
pub struct SkillProgress { pub skill_id: String, pub successes: usize, pub assisted: usize, pub xp: usize, pub checked: bool, pub star: bool }
#[derive(Debug, Serialize)]
pub struct BranchProgress { pub skill_id: String, pub available: bool }
#[derive(Serialize)]
pub struct Credit { pub attempt_id: String, pub skill_id: String, pub xp: usize }
#[derive(Serialize)]
pub struct Profile {
    pub rules_version: u32, pub choices: Choices, pub xp: usize,
    pub skills: Vec<SkillProgress>, pub branches: Vec<BranchProgress>,
    pub credits: Vec<Credit>,
    pub recommended_focus: String, pub active_focus: String,
}
/// Identical source text contributes once per skill across conversations. Assisted
/// attempts cannot block later unassisted evidence for the same wording.
pub fn project(snapshot: &Snapshot, choices: Choices) -> Result<Profile, String> {
    choices.validate(&snapshot.target)?;
    if snapshot.learner_id != super::LEARNER || snapshot.records.iter().any(|record| record.target != snapshot.target || record.learner_id != snapshot.learner_id) {
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn profile_choices_are_isolated_persistent_and_revision_checked() {
        let dir = tempfile::tempdir().unwrap();
        let mut choices = Choices::initial("es-ES");
        choices.focus = Some("referent".into());
        save(dir.path(), "es-ES", 0, choices.clone()).unwrap();
        assert_eq!(load(dir.path(), "es-ES").unwrap().focus.as_deref(), Some("referent"));
        assert!(load(dir.path(), "ar").unwrap().focus.is_none());
        assert!(save(dir.path(), "es-ES", 0, choices.clone()).is_err());
        assert!(save(dir.path(), "ar", 0, choices).is_err());
        assert!(load(dir.path(), "../en").is_err());
    }
}
