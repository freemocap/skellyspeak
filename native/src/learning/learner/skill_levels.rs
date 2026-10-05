//! Read-only practice levels over the eligible, already-awarded credit ledger.
use crate::model::{AppError, ErrorCode, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use ts_rs::TS;

const POLICY: &str = "skill-levels-fibonacci-1";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SkillLevelProgress {
    pub skill_id: String,
    pub points: u32,
    pub level: u32,
    pub current_threshold: u32,
    pub next_threshold: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SkillLevelSummary {
    pub policy_id: String,
    pub skills: Vec<SkillLevelProgress>,
    /// Minimum skill level within this evidence scope, not a proficiency rating.
    pub level: u32,
    pub current_threshold: u32,
    pub next_threshold: u32,
    /// Thresholds for levels 1 through the scope's next level, inclusive.
    pub bands: Vec<u32>,
}

fn invalid(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}

fn position(points: u32) -> Result<(u32, u32, u32)> {
    let (mut level, mut current, mut next) = (0, 0_u32, 1_u32);
    while points >= next {
        let following = if current == 0 {
            Some(2)
        } else {
            current.checked_add(next)
        }
        .ok_or_else(|| invalid("Skill points exceed the supported level threshold range."))?;
        (level, current, next) = (level + 1, next, following);
    }
    Ok((level, current, next))
}

/// Catalog order is preserved. Callers apply eligibility and scope first.
/// Counting credits never recalculates their XP or evaluates assessment content.
pub(crate) fn project(catalog: &Value, credits: &[Value]) -> Result<SkillLevelSummary> {
    let nodes = catalog
        .as_array()
        .ok_or_else(|| invalid("Missing skill level catalog."))?;
    let mut ids = Vec::new();
    let mut counts = BTreeMap::new();
    for node in nodes.iter().filter(|node| node["kind"] == "skill") {
        let id = node["id"]
            .as_str()
            .filter(|id| !id.is_empty())
            .ok_or_else(|| invalid("Missing skill level catalog identity."))?;
        if counts.insert(id, 0_u32).is_some() {
            return Err(invalid("Duplicate skill level catalog identity."));
        }
        ids.push(id);
    }
    if ids.is_empty() {
        return Err(invalid("Skill level catalog has no skills."));
    }
    let mut seen = BTreeSet::new();
    for credit in credits {
        let attempt = credit["attempt_id"]
            .as_str()
            .filter(|id| !id.is_empty())
            .ok_or_else(|| invalid("Missing skill credit attempt identity."))?;
        let skill = credit["skill_id"]
            .as_str()
            .ok_or_else(|| invalid("Missing skill credit identity."))?;
        if !seen.insert((attempt, skill)) {
            return Err(invalid("Duplicate skill credit in level projection."));
        }
        let count = counts
            .get_mut(skill)
            .ok_or_else(|| invalid("Skill credit is outside the level catalog."))?;
        *count = count
            .checked_add(1)
            .ok_or_else(|| invalid("Skill point count exceeds the supported range."))?;
    }
    let skills = ids
        .into_iter()
        .map(|id| {
            let points = counts[id];
            let (level, current_threshold, next_threshold) = position(points)?;
            Ok(SkillLevelProgress {
                skill_id: id.into(),
                points,
                level,
                current_threshold,
                next_threshold,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    let weakest = skills.iter().min_by_key(|skill| skill.level).unwrap();
    let (level, current_threshold, next_threshold) = (
        weakest.level,
        weakest.current_threshold,
        weakest.next_threshold,
    );
    let mut bands = vec![1_u32];
    while bands.len() <= level as usize {
        let last = *bands.last().unwrap();
        bands.push(if bands.len() == 1 {
            2
        } else {
            last.checked_add(bands[bands.len() - 2])
                .ok_or_else(|| invalid("Skill threshold band exceeds the supported range."))?
        });
    }
    Ok(SkillLevelSummary {
        policy_id: POLICY.into(),
        skills,
        level,
        current_threshold,
        next_threshold,
        bands,
    })
}

#[cfg(test)]
#[path = "skill_levels_tests.rs"]
mod tests;
