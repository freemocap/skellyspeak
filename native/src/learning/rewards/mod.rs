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
    pub experience: u32,
    pub effort: u32,
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
    let (raw, source, at): (String, String, i64) = db.query_row("SELECT t.context,m.text,CAST(strftime('%s',m.created_at) AS INTEGER) FROM turns t JOIN messages m ON m.turn_id=t.id AND m.role='user' WHERE t.id=?1", [turn], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?)))?;
    let captured: Value = serde_json::from_str(&raw)?;
    // Coaching corrections and message ratings never create skill XP.
    let Some(raw_observation) = captured.get("practiceObservation") else {
        return Ok(());
    };
    let observation: crate::learning::practice::Observation =
        serde_json::from_value(raw_observation.clone())?;
    if observation.inference_attempt_id != attempt
        || observation.turn_id != turn
        || observation.policy != crate::learning::practice::POLICY
    {
        return Err(fail(
            "Reward does not belong to the saved practice observation.",
        ));
    }
    if captured.get("rewardEvents").is_some() {
        return Ok(());
    }
    let policy: GamePolicy = serde_json::from_value(captured["gamePolicy"].clone())?;
    let events: Vec<_> = observation
        .credits
        .iter()
        .map(|credit| RewardEvent {
            id: format!("{attempt}:{}", credit.skill_id),
            attempt_id: attempt.into(),
            construct_id: credit.skill_id.clone(),
            kind: if credit.effort > 0 {
                "effort"
            } else {
                "experience"
            }
            .into(),
            tier: policy.tiers[if credit.effort > 0 {
                "repair"
            } else {
                "xp_tick"
            }],
            xp: credit.xp,
            experience: credit.experience,
            effort: credit.effort,
            quote: source.clone(),
            support: "not_weighted".into(),
            difficulty: "not_weighted".into(),
            novelty: "not_weighted".into(),
            policy_hash: crate::learning::practice::POLICY.into(),
            at_secs: at,
            claimed: false,
        })
        .collect();
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
        .map(|e| json!({"attempt_id":e.attempt_id,"skill_id":e.construct_id,"xp":e.xp,"experience":e.experience,"effort":e.effort,"event":e}))
        .collect())
}
