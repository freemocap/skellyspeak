//! Recomputable learner state. Never writes evidence or changes XP.
//! Logistic update follows [@pelanek2016]; recall shape follows [@settles_meeder2016].
//! Weights, half-life multipliers and uncertainty are uncalibrated product heuristics.
use crate::{config::Registry, model::*, store::Store};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Arc,
};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ConstructState {
    pub construct_id: String,
    pub variety_id: String,
    pub rating: f64,
    pub uncertainty: f64,
    #[ts(type = "number")]
    pub last_seen: i64,
    pub half_life_days: f64,
    pub n: u32,
    pub independent_n: u32,
    pub effective_n: f64,
    pub recall: f64,
    #[ts(type = "number")]
    pub due_at: i64,
    pub due: bool,
    pub insufficient_evidence: bool,
    pub evidence_attempt_ids: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LearnerState {
    pub learner_id: String,
    pub language_id: String,
    #[ts(type = "number")]
    pub as_of_secs: i64,
    pub config_hash: String,
    pub construct_registry_hash: String,
    pub estimator_hash: String,
    pub estimator_version: u32,
    pub calibration: String,
    #[ts(type = "unknown")]
    pub choices: Value,
    #[ts(type = "unknown[]")]
    pub observations: Vec<Value>,
    pub constructs: Vec<ConstructState>,
}
fn invalid(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}
fn string<'a>(value: &'a Value, key: &str) -> Result<&'a str> {
    value[key]
        .as_str()
        .ok_or_else(|| invalid(&format!("Learner evidence lacks {key}.")))
}
pub fn fold(registry: &Registry, evidence: &Value, as_of_secs: i64) -> Result<LearnerState> {
    if as_of_secs < 0 {
        return Err(invalid("Learner-state time must be nonnegative."));
    }
    let language = string(evidence, "target")?;
    registry.language(language)?;
    let learner = string(evidence, "learner_id")?;
    let records = evidence["records"]
        .as_array()
        .ok_or_else(|| invalid("Missing learner observations."))?;
    let choices = &evidence["profile"]["choices"];
    let excluded = choices["excluded_attempts"]
        .as_array()
        .ok_or_else(|| invalid("Missing evidence exclusions."))?;
    let policy = registry.estimator_policy();
    let hash = crate::coaching::construct_hash(registry);
    let mut sorted: Vec<_> = records.iter().collect();
    sorted.sort_by_key(|r| {
        (
            r["at_secs"].as_i64(),
            r["chat_id"].as_str(),
            r["message_id"].as_i64(),
            r["attempt_id"].as_str(),
        )
    });
    let mut states: BTreeMap<(String, String), ConstructState> = BTreeMap::new();
    let mut seen = BTreeSet::new();
    for record in sorted {
        if record["status"] != "complete" || record["construct_registry_hash"] != hash {
            continue;
        }
        if string(record, "learner_id")? != learner || string(record, "target")? != language {
            return Err(invalid("Learner evidence crosses its owner or language."));
        }
        let attempt = string(record, "attempt_id")?;
        if excluded.iter().any(|id| id.as_str() == Some(attempt)) {
            continue;
        }
        let at = record["at_secs"]
            .as_i64()
            .filter(|at| *at >= 0)
            .ok_or_else(|| invalid("Invalid observation time."))?;
        if at > as_of_secs {
            continue;
        }
        let variety = record["variety"].as_str().unwrap_or("");
        let judgments = record["assessment"]["judgments"]
            .as_array()
            .ok_or_else(|| invalid("Complete evidence lacks judgments."))?;
        for item in judgments {
            let outcome = match string(item, "outcome")? {
                "demonstrated" => 1.0,
                "partial" => 0.5,
                "not_demonstrated" => 0.0,
                "not_observed" | "uncertain" => continue,
                _ => return Err(invalid("Unknown observation outcome.")),
            };
            let construct = string(item, "skill_id")?;
            let definition = registry.construct(construct)?;
            if definition
                .language
                .as_deref()
                .is_some_and(|id| id != language)
            {
                return Err(invalid("Construct belongs to another language."));
            }
            let source = string(record, "source")?;
            let quotes = item["quotes"]
                .as_array()
                .ok_or_else(|| invalid("Missing evidence quotes."))?;
            if quotes.is_empty()
                || quotes.iter().any(|q| {
                    q.as_str()
                        .is_none_or(|q| q.trim().is_empty() || !source.contains(q))
                })
            {
                return Err(invalid("Invalid learner-state source quote."));
            }
            // Retries or replayed identical wording cannot manufacture independent evidence.
            let wording = source.split_whitespace().collect::<Vec<_>>().join(" ");
            if !seen.insert((variety.to_owned(), construct.to_owned(), wording)) {
                continue;
            }
            let step = item["support_step"]
                .as_str()
                .or(record["support_step"].as_str());
            let step = step.unwrap_or(
                if record["input"]["suggestion"] == true || record["input"]["scaffold"] == true {
                    "suggestion"
                } else if record["input"]["revision"] == true {
                    "revision"
                } else {
                    "none"
                },
            );
            let weight = *policy
                .support
                .get(step)
                .ok_or_else(|| invalid("Unknown evidence support step."))?;
            let state = states
                .entry((variety.into(), construct.into()))
                .or_insert_with(|| ConstructState {
                    construct_id: construct.into(),
                    variety_id: variety.into(),
                    rating: policy.initial_rating,
                    uncertainty: 1.0,
                    last_seen: at,
                    half_life_days: policy.initial_half_life_days,
                    n: 0,
                    independent_n: 0,
                    effective_n: 0.0,
                    recall: 1.0,
                    due_at: at,
                    due: false,
                    insufficient_evidence: true,
                    evidence_attempt_ids: vec![],
                });
            let expected = 1.0 / (1.0 + (-state.rating).exp());
            state.rating += policy.learning_rate * weight * (outcome - expected);
            state.half_life_days = (state.half_life_days
                * (policy.success_growth.powf(outcome)
                    * policy.failure_shrink.powf(1.0 - outcome))
                .powf(weight))
            .clamp(policy.min_half_life_days, policy.max_half_life_days);
            state.n += 1;
            state.independent_n += u32::from(step == "none");
            state.effective_n += weight;
            state.uncertainty = 1.0 / (1.0 + state.effective_n).sqrt();
            state.last_seen = at;
            state.evidence_attempt_ids.push(attempt.into());
        }
    }
    for state in states.values_mut() {
        let elapsed = (as_of_secs - state.last_seen) as f64 / 86400.0;
        state.recall = 2.0_f64.powf(-elapsed / state.half_life_days);
        let interval = -policy.due_recall.log2() * state.half_life_days * 86400.0;
        state.due_at = state.last_seen.saturating_add(interval.ceil() as i64);
        state.due = as_of_secs >= state.due_at;
        state.insufficient_evidence = state.independent_n < policy.minimum_independent_observations;
    }
    Ok(LearnerState {
        learner_id: learner.into(),
        language_id: language.into(),
        as_of_secs,
        config_hash: registry.hash().into(),
        construct_registry_hash: hash,
        estimator_hash: registry.estimator_hash(),
        estimator_version: policy.version,
        calibration: "uncalibrated_product_heuristic".into(),
        choices: choices.clone(),
        observations: records.clone(),
        constructs: states.into_values().collect(),
    })
}
pub fn snapshot(store: &Store, target: &str, at: i64) -> Result<LearnerState> {
    fold(
        &store.config,
        &crate::progression::snapshot(store, target)?,
        at,
    )
}
/// Evidence and estimates share one locked read so exclusions cannot race the UI.
#[tauri::command]
pub(crate) fn get_learner_profile(
    state: tauri::State<'_, Arc<crate::Application>>,
    target: String,
) -> Result<Value> {
    let at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| invalid("System clock precedes epoch."))?
        .as_secs() as i64;
    let store = state.lock()?;
    let evidence = crate::progression::snapshot(&store, &target)?;
    let model = fold(&store.config, &evidence, at)?;
    Ok(serde_json::json!({"evidence": evidence, "model": model}))
}
#[tauri::command]
pub(crate) fn get_learner_state(
    state: tauri::State<'_, Arc<crate::Application>>,
    target: String,
) -> Result<LearnerState> {
    let at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| invalid("System clock precedes epoch."))?
        .as_secs() as i64;
    {
        let store = state.lock()?;
        snapshot(&store, &target, at)
    }
}
#[tauri::command]
pub(crate) fn export_learner_state(
    state: tauri::State<'_, Arc<crate::Application>>,
    target: String,
) -> Result<String> {
    let snapshot = get_learner_state(state, target)?;
    serde_yaml_ng::to_string(&snapshot)
        .map_err(|e| invalid(&format!("Learner-state export failed: {e}")))
}

/// Save a fresh native projection, never a frontend-supplied assessment.
#[tauri::command]
pub(crate) fn save_learner_state(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<crate::Application>>,
    target: String,
) -> Result<String> {
    use tauri::Manager;
    let model = get_learner_state(state, target)?;
    let downloads = app.path().download_dir().map_err(|error| {
        AppError::new(
            ErrorCode::Storage,
            format!("Could not locate Downloads: {error}"),
        )
    })?;
    let path = downloads.join(format!(
        "skellyspeak-learning-{}.yaml",
        uuid::Uuid::new_v4()
    ));
    write_export(&path, &model)?;
    Ok(path.display().to_string())
}

fn write_export(path: &std::path::Path, model: &LearnerState) -> Result<()> {
    use std::io::Write;
    let bytes = serde_yaml_ng::to_string(model).map_err(|error| {
        AppError::new(
            ErrorCode::Storage,
            format!("Could not serialize learning evidence: {error}"),
        )
    })?;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| {
            AppError::new(
                ErrorCode::Storage,
                format!("Could not create learning evidence file: {error}"),
            )
        })?;
    file.write_all(bytes.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|error| {
            AppError::new(
                ErrorCode::Storage,
                format!("Learning evidence file could not be completed: {error}"),
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn record(registry: &Registry, id: &str, outcome: &str, step: &str, at: i64) -> Value {
        json!({"attempt_id":id,"learner_id":"l","target":"es","variety":"","chat_id":"c","message_id":at,"source":format!("¿Cómo estás {id}?"),"at_secs":at,"status":"complete","construct_registry_hash":crate::coaching::construct_hash(registry),"input":{},"support_step":step,"assessment":{"judgments":[{"skill_id":"question","outcome":outcome,"quotes":["¿Cómo estás"]}]}})
    }
    fn evidence(records: Vec<Value>) -> Value {
        json!({"target":"es","learner_id":"l","records":records,"profile":{"choices":{"excluded_attempts":[]}}})
    }
    #[test]
    fn export_round_trips_owned_evidence_and_never_overwrites_a_file() {
        let r = Registry::bundled().unwrap();
        let data = evidence(vec![record(&r, "a", "demonstrated", "none", 1)]);
        let state = fold(&r, &data, 10).unwrap();
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("learning.yaml");
        write_export(&path, &state).unwrap();
        let saved = std::fs::read_to_string(&path).unwrap();
        let restored: LearnerState = serde_yaml_ng::from_str(&saved).unwrap();
        assert_eq!(restored.learner_id, state.learner_id);
        assert_eq!(restored.language_id, state.language_id);
        assert_eq!(restored.observations, state.observations);
        assert_eq!(restored.choices, state.choices);
        assert_eq!(restored.estimator_hash, state.estimator_hash);
        assert_eq!(restored.constructs[0].evidence_attempt_ids, vec!["a"]);
        assert!(write_export(&path, &state).is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), saved);
        assert!(write_export(&directory.path().join("missing/learning.yaml"), &state).is_err());
    }
    #[test]
    fn ignores_absence_uncertainty_exclusions_and_old_registry_without_inventing_state() {
        let r = Registry::bundled().unwrap();
        let mut data = evidence(vec![
            record(&r, "a", "uncertain", "none", 1),
            record(&r, "b", "not_observed", "none", 2),
            record(&r, "c", "demonstrated", "none", 3),
            record(&r, "d", "demonstrated", "none", 4),
        ]);
        data["profile"]["choices"]["excluded_attempts"] = json!(["c"]);
        data["records"][3]["construct_registry_hash"] = json!("old");
        let view = fold(&r, &data, 10).unwrap();
        assert!(view.constructs.is_empty());
        assert_eq!(view.observations.len(), 4);
    }
    #[test]
    fn support_reduces_update_and_due_never_reduces_rating() {
        let r = Registry::bundled().unwrap();
        let direct = fold(
            &r,
            &evidence(vec![record(&r, "a", "demonstrated", "none", 1)]),
            1,
        )
        .unwrap();
        let assisted = fold(
            &r,
            &evidence(vec![record(&r, "a", "demonstrated", "explicit", 1)]),
            1,
        )
        .unwrap();
        assert!(direct.constructs[0].rating > assisted.constructs[0].rating);
        assert_eq!(assisted.constructs[0].independent_n, 0);
        let later = fold(
            &r,
            &evidence(vec![record(&r, "a", "demonstrated", "none", 1)]),
            864000,
        )
        .unwrap();
        assert!(later.constructs[0].due);
        assert_eq!(later.constructs[0].rating, direct.constructs[0].rating);
        assert!(later.constructs[0].insufficient_evidence);
    }
    #[test]
    fn failed_opportunity_is_negative_and_replay_does_not_inflate_evidence() {
        let r = Registry::bundled().unwrap();
        let item = record(&r, "a", "not_demonstrated", "none", 1);
        let value = evidence(vec![item.clone(), item]);
        let state = fold(&r, &value, 10).unwrap();
        assert!(state.constructs[0].rating < 0.0);
        assert_eq!(state.constructs[0].n, 1);
        assert_eq!(
            serde_json::to_value(&state).unwrap(),
            serde_json::to_value(fold(&r, &value, 10).unwrap()).unwrap()
        );
        let exported = serde_yaml_ng::to_string(&state).unwrap();
        let restored: LearnerState = serde_yaml_ng::from_str(&exported).unwrap();
        assert_eq!(restored.constructs[0].n, 1);
    }
    #[test]
    fn owner_source_and_support_errors_are_not_silent_fallbacks() {
        let r = Registry::bundled().unwrap();
        for key in ["learner_id", "support_step", "source"] {
            let mut item = record(&r, "a", "demonstrated", "none", 1);
            item[key] = json!("invalid");
            assert!(fold(&r, &evidence(vec![item]), 10).is_err());
        }
    }
    #[test]
    fn varieties_are_separate_and_future_evidence_is_not_used() {
        let r = Registry::bundled().unwrap();
        let a = record(&r, "a", "demonstrated", "none", 1);
        let mut b = record(&r, "b", "demonstrated", "none", 2);
        b["variety"] = json!("es-ES");
        let data = evidence(vec![record(&r, "c", "demonstrated", "none", 30), b, a]);
        let state = fold(&r, &data, 10).unwrap();
        assert_eq!(state.constructs.len(), 2);
        assert!(state.constructs.iter().all(|s| s.n == 1));
    }
}
