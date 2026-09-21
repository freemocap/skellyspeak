//! Immutable effort awards, saved alongside the validated source observation.
pub(crate) mod reward_settings;
use crate::configuration::GamePolicy;
use crate::model::*;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::sync::Arc;
use ts_rs::TS;
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RewardEvent {
    pub id: String,
    pub attempt_id: String,
    pub construct_id: String,
    pub kind: String,
    pub tier: u8,
    pub xp: u32,
    pub quote: String,
    pub support: String,
    pub difficulty: String,
    pub novelty: String,
    pub policy_hash: String,
    pub at_secs: i64,
    pub claimed: bool,
}
fn fail(text: &str) -> AppError {
    AppError::new(ErrorCode::Validation, text)
}
/// Called only inside observation publication's transaction, never by a read.
pub(crate) fn publish(db: &Connection, turn: &str, attempt: &str) -> Result<()> {
    let (raw,language,learner,source,at):(String,String,String,String,i64)=db.query_row("SELECT t.context,c.language_id,r.learner_id,m.text,CAST(strftime('%s',m.created_at) AS INTEGER) FROM turns t JOIN conversations c ON c.id=t.conversation_id JOIN contacts r ON r.id=c.contact_id JOIN messages m ON m.turn_id=t.id AND m.role='user' WHERE t.id=?1",[turn],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?)))?;
    let captured: Value = serde_json::from_str(&raw)?;
    if captured.get("rewardEvents").is_some() {
        return Ok(());
    }
    let policy: GamePolicy = serde_json::from_value(captured["gamePolicy"].clone())
        .map_err(|_| fail("This exchange has no captured reward policy. Start a new exchange."))?;
    let policy_hash = captured["gamePolicyHash"]
        .as_str()
        .ok_or_else(|| fail("Missing reward policy identity."))?;
    let difficulty = captured["practiceSettings"]["difficulty"]
        .as_str()
        .ok_or_else(|| fail("Missing reward difficulty."))?;
    let difficulty_weight = *policy
        .difficulty
        .get(difficulty)
        .ok_or_else(|| fail("Unknown reward difficulty."))?;
    let prior:Vec<(String,String)>=db.prepare("SELECT t.context,m.text FROM turns t JOIN conversations c ON c.id=t.conversation_id JOIN contacts r ON r.id=c.contact_id JOIN messages m ON m.turn_id=t.id AND m.role='user' WHERE c.language_id=?1 AND r.learner_id=?2 AND t.id!=?3 AND json_type(t.context,'$.rewardEvents')='array'")?.query_map(params![language,learner,turn],|r|Ok((r.get(0)?,r.get(1)?)))?.collect::<rusqlite::Result<_>>()?;
    let prior: Vec<(Vec<RewardEvent>, String)> = prior
        .into_iter()
        .map(|(raw, text)| -> Result<_> {
            let v: Value = serde_json::from_str(&raw)?;
            Ok((serde_json::from_value(v["rewardEvents"].clone())?, text))
        })
        .collect::<Result<_>>()?;
    let normalize = |s: &str| {
        s.split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase()
    };
    let observation = captured
        .get("skillAssessment")
        .or_else(|| captured.get("coachObservation"))
        .ok_or_else(|| fail("Rewards require validated observations."))?;
    let items = observation["items"]
        .as_array()
        .ok_or_else(|| fail("Rewards require validated observations."))?;
    let mut events = Vec::new();
    for item in items {
        let construct = item["construct"]
            .as_str()
            .ok_or_else(|| fail("Reward construct missing."))?;
        let repaired = captured["nativeRepairObservation"].is_object()
            && captured["coachRetry"]["item"]["construct"] == construct;
        let base_key = if repaired {
            "repair"
        } else {
            match item["outcome"].as_str() {
                Some("demonstrated") => "demonstrated",
                Some("partial") => "partial",
                _ => continue,
            }
        };
        let previous: Vec<_> = prior
            .iter()
            .flat_map(|(events, text)| {
                events
                    .iter()
                    .filter(move |e| e.construct_id == construct)
                    .map(move |e| (e, text))
            })
            .collect();
        if previous
            .iter()
            .any(|(_, text)| normalize(text) == normalize(&source))
        {
            continue;
        }
        let novelty = if previous.is_empty() {
            "first_ever"
        } else if previous
            .iter()
            .all(|(e, _)| (e.at_secs + 259200) / 604800 != (at + 259200) / 604800)
        {
            "first_this_week"
        } else {
            "routine"
        };
        let step = captured["coachRetry"]["supportStep"].as_str().unwrap_or(
            if captured["input"]["suggestion"] == true || captured["input"]["scaffold"] == true {
                "suggestion"
            } else if captured["input"]["revision"] == true {
                "revision"
            } else {
                "none"
            },
        );
        let support = *policy
            .support
            .get(step)
            .ok_or_else(|| fail("Unknown reward assistance."))?;
        let kind = if repaired {
            "repair"
        } else if novelty == "first_ever" && base_key == "demonstrated" {
            "construct_discovered"
        } else {
            "xp_tick"
        };
        let quote = if item["evidenceKind"] == "whole_message" && observation["adapter"] == "jev_choice" {
            source.as_str()
        } else { item["quote"]
            .as_str()
            .filter(|q| !q.trim().is_empty() && source.contains(q))
            .ok_or_else(|| fail("Reward lacks an exact source quote."))? };
        let xp = (f64::from(policy.base[base_key])
            * support
            * difficulty_weight
            * policy.novelty[novelty])
            .round() as u32;
        if xp == 0 {
            continue;
        }
        events.push(RewardEvent {
            id: format!("{attempt}:{construct}"),
            attempt_id: attempt.into(),
            construct_id: construct.into(),
            kind: kind.into(),
            tier: policy.tiers[kind],
            xp,
            quote: quote.into(),
            support: step.into(),
            difficulty: difficulty.into(),
            novelty: novelty.into(),
            policy_hash: policy_hash.into(),
            at_secs: at,
            claimed: false,
        });
    }
    db.execute(
        "UPDATE turns SET context=json_set(context,'$.rewardEvents',json(?2)) WHERE id=?1",
        params![turn, serde_json::to_string(&events)?],
    )?;
    Ok(())
}
/// Atomic at-most-once presentation claim. A crash after claiming can omit a
/// celebration; it cannot erase the award or replay it after restart.
pub(crate) fn claim(
    db: &mut Connection,
    language: &str,
    ids: &[String],
) -> Result<Vec<RewardEvent>> {
    if ids.len() > 100 {
        return Err(fail("Too many reward claims."));
    }
    let tx = db.transaction()?;
    let rows:Vec<(String,String)>=tx.prepare("SELECT t.id,t.context FROM turns t JOIN conversations c ON c.id=t.conversation_id WHERE c.language_id=?1 AND json_type(t.context,'$.rewardEvents')='array'")?.query_map([language],|r|Ok((r.get(0)?,r.get(1)?)))?.collect::<rusqlite::Result<_>>()?;
    let mut claimed = Vec::new();
    for (turn, raw) in rows {
        let value: Value = serde_json::from_str(&raw)?;
        let mut events: Vec<RewardEvent> = serde_json::from_value(value["rewardEvents"].clone())?;
        let mut changed = false;
        for event in &mut events {
            if !event.claimed && ids.contains(&event.id) {
                event.claimed = true;
                changed = true;
                claimed.push(event.clone());
            }
        }
        if changed {
            tx.execute(
                "UPDATE turns SET context=json_set(context,'$.rewardEvents',json(?2)) WHERE id=?1",
                params![turn, serde_json::to_string(&events)?],
            )?;
        }
    }
    tx.commit()?;
    Ok(claimed)
}
#[tauri::command]
pub(crate) fn claim_reward_events(
    state: tauri::State<'_, Arc<crate::application::Application>>,
    target: String,
    ids: Vec<String>,
) -> Result<Vec<RewardEvent>> {
    let mut store = state.lock()?;
    store.config.language(&target)?;
    claim(&mut store.connection, &target, &ids)
}
pub(crate) fn credits(context: &Value) -> Result<Vec<Value>> {
    let events: Vec<RewardEvent> = context
        .get("rewardEvents")
        .cloned()
        .map(serde_json::from_value)
        .transpose()?
        .unwrap_or_default();
    Ok(events
        .into_iter()
        .map(|e| json!({"attempt_id":e.attempt_id,"skill_id":e.construct_id,"xp":e.xp,"event":e}))
        .collect())
}
