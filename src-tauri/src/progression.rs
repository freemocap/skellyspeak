//! Deterministic XP projections over retained, validated coach evidence.
use crate::{model::*, store::Store};
use rusqlite::{Connection, OptionalExtension, params};
use serde_json::{Value, json};
use std::{collections::HashSet, sync::Arc};

pub fn initialize(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE IF NOT EXISTS skill_choices(language_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,focus TEXT,excluded TEXT NOT NULL CHECK(json_valid(excluded)));")?;
    Ok(())
}
pub fn snapshot(store: &Store, target: &str) -> Result<Value> {
    crate::languages::language(target)?;
    snapshot_db(&store.connection, &store.session_id, target)
}
pub(crate) fn snapshot_db(db: &Connection, session: &str, target: &str) -> Result<Value> {
    let learner: String = db.query_row("SELECT id FROM learner", [], |r| r.get(0))?;
    let choice: Option<(i32, Option<String>, String)> = db
        .query_row(
            "SELECT revision,focus,excluded FROM skill_choices WHERE language_id=?1",
            [target],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    let (revision, focus, excluded) = choice.unwrap_or((0, None, "[]".into()));
    let excluded: Vec<String> = serde_json::from_str(&excluded)?;
    let rows=db.prepare("SELECT t.id,t.conversation_id,m.sequence,m.text,t.model,t.route,t.context,CAST(strftime('%s',m.created_at) AS INTEGER),o.state FROM turns t JOIN conversations c ON c.id=t.conversation_id JOIN messages m ON m.turn_id=t.id AND m.role='user' JOIN operations o ON o.turn_id=t.id AND o.kind='coach_feedback' WHERE c.language_id=?1 ORDER BY m.created_at,t.id")?.query_map([target],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,i32>(2)?,r.get::<_,String>(3)?,r.get::<_,String>(4)?,r.get::<_,String>(5)?,r.get::<_,String>(6)?,r.get::<_,i64>(7)?,r.get::<_,String>(8)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
    let mut records = vec![];
    for (turn, chat, sequence, source, model, route, context, time, state) in rows {
        let context: Value = serde_json::from_str(&context)?;
        let assessment = context.get("coachFeedback");
        let attempt = context
            .get("coachFeedbackAttempt")
            .and_then(Value::as_str)
            .unwrap_or(&turn);
        let judgments:Vec<Value>=assessment.and_then(|a|a["evidence"].as_array()).map(|items|items.iter().map(|i|json!({"skill_id":i["skill_id"],"outcome":i["outcome"],"quotes":[i["quote"]],"rationale":i["rationale"]})).collect()).unwrap_or_default();
        records.push(json!({"attempt_id":attempt,"session_id":session,"turn_id":sequence,"message_id":sequence,"replaces_message_id":db.query_row("SELECT m.sequence FROM turns t JOIN messages m ON m.turn_id=t.replaces_turn_id AND m.role='user' WHERE t.id=?1",[&turn],|r|r.get::<_,i32>(0)).optional()?,"chat_id":chat,"learner_id":learner,"target":target,"native":context["translationLanguage"],"source":source,"input":context["input"],"at_secs":time,"model":model,"provider_mode":route,"catalog_version":context["catalogVersion"],"prompt_version":context["coachFeedbackPromptVersion"],"status":if assessment.is_some(){"complete"}else if !matches!(state.as_str(),"ready"|"running"|"waiting_dependencies"){"failed"}else{"pending"},"assessment":if assessment.is_some(){json!({"judgments":judgments})}else{Value::Null},"error":if assessment.is_none() && !matches!(state.as_str(),"ready"|"running"|"waiting_dependencies") {json!(format!("Coach observation unavailable: {state}."))} else {Value::Null}}));
    }
    let catalog = crate::coaching::catalog();
    let mut skills = vec![];
    let mut credits = vec![];
    for node in catalog
        .as_array()
        .unwrap()
        .iter()
        .filter(|n| n["kind"] == "skill")
    {
        let mut direct = HashSet::new();
        let mut assisted = HashSet::new();
        // Direct evidence owns identical text before assisted evidence, irrespective of arrival order.
        for assistance in [false, true] {
            for record in &records {
                let key = record["source"]
                    .as_str()
                    .unwrap()
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ")
                    .to_lowercase();
                let id = record["attempt_id"].as_str().unwrap();
                if record["catalog_version"] != crate::coaching::catalog_version()
                    || excluded.iter().any(|e| e == id)
                    || (record["input"]["suggestion"] == true
                        || record["input"]["scaffold"] == true
                        || record["input"]["revision"] == true)
                        != assistance
                    || !record["assessment"]["judgments"]
                        .as_array()
                        .is_some_and(|j| {
                            j.iter().any(|j| {
                                j["skill_id"] == node["id"] && j["outcome"] == "demonstrated"
                            })
                        })
                {
                    continue;
                }
                if direct.contains(&key) || assisted.contains(&key) {
                    continue;
                }
                if assistance {
                    assisted.insert(key);
                } else {
                    direct.insert(key);
                }
                credits.push(
                    json!({"attempt_id":id,"skill_id":node["id"],"xp":if assistance{2}else{10}}),
                );
            }
        }
        skills.push(json!({"skill_id":node["id"],"successes":direct.len(),"assisted":assisted.len(),"xp":direct.len()*10+assisted.len()*2,"checked":!direct.is_empty(),"star":direct.len()>=3}));
    }
    let branches:Vec<_>=catalog.as_array().unwrap().iter().filter(|n|n["kind"]=="skill").map(|n|json!({"skill_id":n["id"],"available":catalog.as_array().unwrap().iter().any(|p|p["id"]==n["parent"]&&p["kind"]=="domain")||skills.iter().any(|p|p["skill_id"]==n["parent"]&&p["star"]==true)})).collect();
    let recommended = skills
        .iter()
        .filter(|s| {
            s["star"] != true
                && branches
                    .iter()
                    .any(|b| b["skill_id"] == s["skill_id"] && b["available"] == true)
        })
        .min_by_key(|s| s["successes"].as_u64().unwrap())
        .unwrap_or(&skills[0])["skill_id"]
        .clone();
    let xp: u64 = skills.iter().map(|s| s["xp"].as_u64().unwrap()).sum();
    let count: i64 = db.query_row(
        "SELECT count(*) FROM conversations WHERE language_id=?1",
        [target],
        |r| r.get(0),
    )?;
    Ok(
        json!({"catalog":catalog,"catalog_version":crate::coaching::catalog_version(),"learner_id":learner,"target":target,"conversation_count":count,"records":records,"profile":{"rules_version":1,"choices":{"version":1,"revision":revision,"learner_id":learner,"target":target,"focus":focus,"excluded_attempts":excluded},"xp":xp,"skills":skills,"branches":branches,"credits":credits,"recommended_focus":recommended,"active_focus":focus.map(Value::String).unwrap_or(recommended)}}),
    )
}
#[tauri::command]
pub(crate) fn get_skill_evidence(
    state: tauri::State<'_, Arc<crate::Application>>,
    target: String,
) -> Result<Value> {
    {
        let store = state.lock()?;
        snapshot(&store, &target)
    }
}
#[tauri::command]
pub(crate) fn get_practice_overview(
    state: tauri::State<'_, Arc<crate::Application>>,
) -> Result<Value> {
    let store = state.lock()?;
    let mut languages = vec![];
    for language in store.snapshot()?.languages {
        languages.push(json!({"name":language.name,"endonym":language.native_name,"snapshot":snapshot(&store,&language.id)?}));
    }
    Ok(json!({"languages":languages}))
}
#[tauri::command]
pub(crate) fn save_skill_profile(
    state: tauri::State<'_, Arc<crate::Application>>,
    target: String,
    expected_revision: i32,
    choices: Value,
) -> Result<Value> {
    let store = state.lock()?;
    let current = snapshot(&store, &target)?;
    if current["profile"]["choices"]["revision"] != expected_revision
        || choices["target"] != target
        || choices["learner_id"] != current["learner_id"]
    {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Skill profile changed. Reload before editing.",
        ));
    }
    let focus = choices["focus"].as_str();
    if !choices["focus"].is_null()
        && focus.is_none_or(|f| {
            !current["catalog"]
                .as_array()
                .unwrap()
                .iter()
                .any(|n| n["id"] == f && n["kind"] == "skill")
        })
    {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Unknown practice skill.",
        ));
    }
    let excluded: Vec<String> = serde_json::from_value(choices["excluded_attempts"].clone())?;
    if excluded.iter().any(|id| {
        !current["records"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["attempt_id"] == *id)
    }) {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Unknown evidence record.",
        ));
    }
    store.connection.execute("INSERT INTO skill_choices VALUES(?1,?2,?3,?4) ON CONFLICT(language_id) DO UPDATE SET revision=excluded.revision,focus=excluded.focus,excluded=excluded.excluded",params![target,expected_revision+1,focus,serde_json::to_string(&excluded)?])?;
    snapshot(&store, &target)
}

/// Freeze the learner-selected or transparent recommended focus into each turn.
pub(crate) fn capture_focus(db: &Connection, session: &str, target: &str) -> Result<Value> {
    let snapshot = snapshot_db(db, session, target)?;
    let focus = &snapshot["profile"]["active_focus"];
    if focus.is_null() {
        return Ok(Value::Null);
    }
    let node = snapshot["catalog"]
        .as_array()
        .unwrap()
        .iter()
        .find(|n| n["id"] == *focus)
        .ok_or_else(|| AppError::new(ErrorCode::Storage, "Unknown active practice focus."))?;
    let chosen = snapshot["profile"]["choices"]["focus"].is_string();
    Ok(
        json!({"id":focus,"label":node["label"],"opportunity":node["criterion"],"source":if chosen {"learner"} else {"recommended"},"reason":if chosen {"Chosen by the learner."} else {"Available skill with the fewest direct demonstrations."}}),
    )
}
