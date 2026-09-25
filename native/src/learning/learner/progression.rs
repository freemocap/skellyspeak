//! Deterministic experience/effort projections over retained presence observations.
use crate::model::*;
use crate::storage::store::Store;
use rusqlite::{Connection, OptionalExtension, params};
use serde_json::{Value, json};
use std::sync::Arc;

pub fn initialize(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE IF NOT EXISTS skill_choices(language_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,focus TEXT,excluded TEXT NOT NULL CHECK(json_valid(excluded)));")?;
    Ok(())
}
pub fn snapshot(store: &Store, target: &str) -> Result<Value> {
    store.config.language(target)?;
    snapshot_db(&store.connection, &store.config, &store.session_id, target)
}
pub(crate) fn snapshot_db(
    db: &Connection,
    registry: &crate::configuration::Registry,
    session: &str,
    target: &str,
) -> Result<Value> {
    let mut guides = vec![];
    for variety in registry.language(target)?.varieties {
        let mut skills = serde_json::Map::new();
        for coverage in registry.skill_coverage(target, &variety.id)? {
            let markdown = if coverage.guide_available {
                json!(registry.skill_markdown(target, &variety.id, &coverage.skill_id)?)
            } else {
                Value::Null
            };
            skills.insert(coverage.skill_id, markdown);
        }
        guides.push(json!({"id":variety.id,"name":variety.name,"skills":skills}));
    }
    let construct_hash = crate::learning::coaching::construct_hash(registry);
    let catalog_version = crate::learning::coaching::version_for(registry);
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
    let rows=db.prepare("SELECT t.id,t.conversation_id,m.sequence,m.text,t.model,t.route,t.context,CAST(strftime('%s',m.created_at) AS INTEGER),o.state FROM turns t JOIN conversations c ON c.id=t.conversation_id JOIN messages m ON m.turn_id=t.id AND m.role='user' JOIN operations o ON o.id=(SELECT candidate.id FROM operations candidate WHERE candidate.turn_id=t.id AND candidate.kind IN ('skill_assessment') LIMIT 1) WHERE c.language_id=?1 ORDER BY m.created_at,t.id")?.query_map([target],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,i32>(2)?,r.get::<_,String>(3)?,r.get::<_,String>(4)?,r.get::<_,String>(5)?,r.get::<_,String>(6)?,r.get::<_,i64>(7)?,r.get::<_,String>(8)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
    let mut records = vec![];
    for (turn, chat, sequence, source, model, route, context, time, state) in rows {
        let context: Value = serde_json::from_str(&context)?;
        let assessment = context.get("skillAssessment");
        let attempt = context
            .get("skillAssessmentAttempt")
            .and_then(Value::as_str)
            .unwrap_or(&turn);
        let judgments: Vec<Value> = assessment.and_then(|a| a["answers"].as_object()).map(|answers| answers.iter().map(|(id, answer)| {
            let evidence = &context["skillAttribution"]["skills"][id];
            let spans = evidence["spans"].as_array().cloned().unwrap_or_default();
            let quotes: Vec<_> = spans.iter().map(|s|s["quote"].clone()).collect();
            json!({"skill_id":id,"presence":assessment.unwrap()["presence"][id],"evidence_kind":if spans.is_empty(){"whole_message"}else{"quoted"},"answer":answer,"quotes":quotes,"spans":spans,"rationale":"","attribution_reason":evidence["reason"]})
        }).collect()).unwrap_or_default();
        let attribution_state: Option<String> = db
            .query_row(
                "SELECT state FROM operations WHERE turn_id=?1 AND kind='skill_attribution'",
                [&turn],
                |r| r.get(0),
            )
            .optional()?;

        records.push(json!({"attribution_state":attribution_state,"attribution_error":context["skill_attributionError"],"attribution_attempt":context["skillAttributionAttempt"],"reward_credits":crate::learning::rewards::credits(&context)?,"attempt_id":attempt,"session_id":session,"turn_id":sequence,"message_id":sequence,"replaces_message_id":db.query_row("SELECT m.sequence FROM turns t JOIN messages m ON m.turn_id=t.replaces_turn_id AND m.role='user' WHERE t.id=?1",[&turn],|r|r.get::<_,i32>(0)).optional()?,"chat_id":chat,"learner_id":learner,"target":target,"variety":context["practiceSettings"]["varietyId"],"native":context["translationLanguage"],"source":source,"input":context["input"],"support_step":context["coachRetry"]["supportStep"],"at_secs":time,"model":assessment.and_then(|a|a.get("model")).cloned().unwrap_or(json!(model)),"provider_mode":assessment.and_then(|a|a.get("providerMode")).cloned().unwrap_or(json!(route)),"catalog_version":context["catalogVersion"],"construct_registry_hash":context["constructRegistryHash"],"mapping_error":if context["constructRegistryHash"]!=construct_hash{json!("This observation uses a different construct registry. Its evidence is retained; current credit is unavailable.")}else if assessment.is_some() && context.get("gamePolicy").is_none(){json!("This observation predates the durable reward policy. Its evidence is retained; start a new exchange to earn current rewards.")}else{Value::Null},"assessment_adapter":assessment.and_then(|a|a.get("adapter")).cloned().unwrap_or(json!("jev_choice")),"decision_policy":assessment.and_then(|a|a.get("policy")).cloned().unwrap_or(Value::Null),"prompt_version":assessment.and_then(|a|a.get("promptVersion")).cloned().unwrap_or_else(||if context.get("skillAssessment").is_some(){context["skillAssessmentPromptVersion"].clone()}else{context["coachFeedbackPromptVersion"].clone()}),"status":if assessment.is_some(){"complete"}else if !matches!(state.as_str(),"ready"|"running"|"waiting_dependencies"){"failed"}else{"pending"},"assessment":if assessment.is_some(){json!({"judgments":judgments})}else{Value::Null},"error":if assessment.is_none() && !matches!(state.as_str(),"ready"|"running"|"waiting_dependencies") {json!(format!("Skill presence unavailable: {state}."))} else {Value::Null}}));
    }
    let source_catalog = registry.practice_catalog(target)?;
    let catalog = source_catalog;
    let mut skills = vec![];
    let mut credits = vec![];
    for node in catalog
        .as_array()
        .unwrap()
        .iter()
        .filter(|n| n["kind"] == "skill")
    {
        let mut experience = 0_u64;
        let mut effort = 0_u64;
        let mut skill_xp = 0_u64;
        for record in &records {
            if record["construct_registry_hash"] != construct_hash
                || excluded.iter().any(|id| record["attempt_id"] == *id)
            {
                continue;
            }
            for credit in record["reward_credits"]
                .as_array()
                .ok_or_else(|| AppError::new(ErrorCode::Storage, "Missing reward ledger."))?
            {
                if credit["skill_id"] != node["id"] {
                    continue;
                }
                skill_xp += credit["xp"]
                    .as_u64()
                    .ok_or_else(|| AppError::new(ErrorCode::Storage, "Invalid reward XP."))?;
                experience += credit["experience"].as_u64().ok_or_else(|| {
                    AppError::new(ErrorCode::Storage, "Missing experience credit.")
                })?;
                effort += credit["effort"]
                    .as_u64()
                    .ok_or_else(|| AppError::new(ErrorCode::Storage, "Missing effort credit."))?;
                credits.push(credit.clone());
            }
        }
        skills.push(json!({"skill_id":node["id"],"experience":experience,"effort":effort,"xp":skill_xp,"checked":experience>0,"star":false}));
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
        .min_by_key(|s| s["experience"].as_u64().unwrap())
        .unwrap_or(&skills[0])["skill_id"]
        .clone();
    let xp: u64 = skills
        .iter()
        .map(|s| s["xp"].as_u64().unwrap())
        .sum::<u64>();
    let count: i64 = db.query_row(
        "SELECT count(*) FROM conversations WHERE language_id=?1",
        [target],
        |r| r.get(0),
    )?;
    Ok(
        json!({"guides":guides,"catalog":catalog,"catalog_version":catalog_version,"construct_registry_hash":construct_hash,"learner_id":learner,"target":target,"conversation_count":count,"records":records,"profile":{"rules_version":3,"choices":{"version":1,"revision":revision,"learner_id":learner,"target":target,"focus":focus,"excluded_attempts":excluded},"xp":xp,"skills":skills,"branches":branches,"credits":credits,"recommended_focus":recommended,"active_focus":focus.map(Value::String).unwrap_or(recommended)}}),
    )
}
#[tauri::command]
pub(crate) fn get_skill_evidence(
    state: tauri::State<'_, Arc<crate::application::Application>>,
    target: String,
) -> Result<Value> {
    {
        let store = state.lock()?;
        snapshot(&store, &target)
    }
}
#[tauri::command]
pub(crate) fn get_practice_overview(
    state: tauri::State<'_, Arc<crate::application::Application>>,
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
    state: tauri::State<'_, Arc<crate::application::Application>>,
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
pub(crate) fn capture_focus(
    db: &Connection,
    registry: &crate::configuration::Registry,
    session: &str,
    target: &str,
) -> Result<Value> {
    let snapshot = snapshot_db(db, registry, session, target)?;
    focus_from_snapshot(registry, &snapshot)
}
pub(crate) fn focus_from_snapshot(
    _registry: &crate::configuration::Registry,
    snapshot: &Value,
) -> Result<Value> {
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
        json!({"id":focus,"label":node["label"],"opportunity":node["description"],"source":if chosen {"learner"} else {"recommended"},"reason":if chosen {"Chosen by the learner."} else {"Skill with the least recorded experience."}}),
    )
}
