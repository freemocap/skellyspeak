//! Deterministic graduated help. Hidden hypotheses stay in native turn context;
//! display decisions contain only the help the learner has chosen to see.
use crate::{coaching::*, model::*};
use rusqlite::{Connection, OptionalExtension, params};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::HashMap;

#[derive(Deserialize)]
struct Intensity {
    start_at: String,
    max_revisions: u32,
    show_logged: bool,
}
#[derive(Deserialize)]
struct Policy {
    max_corrections_per_turn: usize,
    skip_sources: Vec<String>,
    ladder: Vec<String>,
    intensity: HashMap<String, Intensity>,
}
fn invalid(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}
fn movement(value: &str) -> Result<CoachMove> {
    serde_json::from_value(json!(value)).map_err(|_| invalid("Unknown configured coach move."))
}
fn summary(item: &ObservedItem) -> ObservedItemSummary {
    ObservedItemSummary {
        construct: item.construct.clone(),
        quote: item.quote.clone(),
        outcome: item.outcome,
        rationale: if item.error.is_none() {
            item.rationale.clone()
        } else {
            String::new()
        },
    }
}
pub(crate) fn view(captured: &Value) -> Result<Option<CoachObservationView>> {
    let Some(raw) = captured.get("coachObservation") else {
        return Ok(None);
    };
    let observation: CoachObservation = serde_json::from_value(raw.clone())?;
    Ok(Some(CoachObservationView {
        meaning_recovered: observation.meaning_recovered,
        items: observation.items.iter().map(summary).collect(),
        candidates_sent: captured["candidateConstructs"]
            .as_array()
            .ok_or_else(|| invalid("Missing captured candidates."))?
            .len(),
        items_returned: observation.items.len(),
    }))
}
fn correction(item: &ObservedItem, rung: CoachMove, _captured: &Value) -> Result<Correction> {
    let error = item
        .error
        .as_ref()
        .ok_or_else(|| invalid("Correction requires an observed error."))?;
    let text = match rung {
        CoachMove::Hint => error.hint.clone(),
        CoachMove::Elicit | CoachMove::PartnerClarify => error.elicitation.clone(),
        CoachMove::Metalinguistic => error.metalinguistic.clone(),
        CoachMove::Explicit => error.target_hypothesis.clone(),
    };
    Ok(Correction {
        construct: item.construct.clone(),
        quote: item.quote.clone(),
        r#move: rung.clone(),
        explanation: (rung == CoachMove::Explicit).then(|| item.rationale.clone()),
        text,
    })
}
pub(crate) fn decide(
    captured: &Value,
    observation: &CoachObservation,
    repaired: Option<bool>,
) -> Result<CoachDecision> {
    let policy: Policy = serde_json::from_value(captured["feedbackPolicy"].clone())?;
    if policy.max_corrections_per_turn != 1 {
        return Err(invalid("This build requires one correction per turn."));
    }
    let intensity = match captured["practiceSettings"]["coachProactivity"].as_str() {
        Some("on_request") => "light",
        Some("occasional") => "standard",
        Some("frequent") => "thorough",
        _ => return Err(invalid("Unknown coach intensity.")),
    };
    let intensity = policy
        .intensity
        .get(intensity)
        .ok_or_else(|| invalid("Missing feedback intensity policy."))?;
    let retry = &captured["coachRetry"];
    let focus = captured["practiceFocus"]["id"].as_str();
    let mut decision = CoachDecision {
        exposed_move: None,
        repair_status: None,
        shown: None,
        retry_invited: false,
        fixed: None,
        also_noticed: vec![],
        kept_going: false,
    };
    if let Some(repaired) = repaired {
        let target = observation
            .items
            .iter()
            .find(|i| Some(i.construct.as_str()) == retry["item"]["construct"].as_str());
        decision.repair_status = Some(if repaired {
            RepairStatus::Repaired
        } else if target
            .is_none_or(|i| matches!(i.outcome, Outcome::Uncertain | Outcome::NotObserved))
        {
            RepairStatus::Uncertain
        } else {
            RepairStatus::NotRepaired
        });
    }
    if repaired == Some(true) {
        let target = retry["item"]["construct"]
            .as_str()
            .ok_or_else(|| invalid("Missing repair target."))?;
        let item = observation
            .items
            .iter()
            .find(|i| {
                i.construct == target && i.outcome == Outcome::Demonstrated && i.error.is_none()
            })
            .ok_or_else(|| invalid("Repair has no demonstrated target evidence."))?;
        decision.fixed = Some(format!("Fixed: {}. {}", item.quote, item.rationale));
    } else {
        let selected = if repaired == Some(false) {
            observation.items.iter().find(|i| {
                Some(i.construct.as_str()) == retry["item"]["construct"].as_str()
                    && matches!(i.outcome, Outcome::Partial | Outcome::NotDemonstrated)
                    && i.error.is_some()
            })
        } else {
            observation
                .items
                .iter()
                .filter(|i| {
                    matches!(i.outcome, Outcome::Partial | Outcome::NotDemonstrated)
                        && i.error.as_ref().is_some_and(|e| {
                            let source = serde_json::to_value(&e.source).expect("enum serializes");
                            !policy.skip_sources.iter().any(|s| source == *s)
                                && (e.blocks_meaning || focus == Some(i.construct.as_str()))
                        })
                })
                .min_by_key(|i| !i.error.as_ref().unwrap().blocks_meaning)
        };
        if let Some(item) = selected {
            let depth = retry["depth"].as_u64().unwrap_or(0) as u32;
            let rung = if repaired == Some(false) {
                if retry["supportStep"].is_null() {
                    movement(
                        retry["shown"]["move"]
                            .as_str()
                            .ok_or_else(|| invalid("Missing selected support."))?,
                    )?
                } else if depth >= intensity.max_revisions || retry["shown"]["move"] == "explicit" {
                    CoachMove::Explicit
                } else {
                    let previous = retry["shown"]["move"]
                        .as_str()
                        .ok_or_else(|| invalid("Missing shown repair support."))?;
                    let index = policy
                        .ladder
                        .iter()
                        .position(|r| r == previous)
                        .ok_or_else(|| {
                            invalid("Previous support is absent from the captured ladder.")
                        })?;
                    movement(
                        policy
                            .ladder
                            .get(index + 1)
                            .ok_or_else(|| invalid("Feedback ladder has no next move."))?,
                    )?
                }
            } else {
                movement(&intensity.start_at)?
            };
            decision.retry_invited = depth < intensity.max_revisions && rung != CoachMove::Explicit;
            decision.shown = Some(correction(item, rung, captured)?);
        }
    }
    if intensity.show_logged {
        decision.also_noticed = observation
            .items
            .iter()
            .filter(|i| {
                decision
                    .shown
                    .as_ref()
                    .is_none_or(|s| s.construct != i.construct)
            })
            .map(summary)
            .collect();
    }
    Ok(decision)
}
pub(crate) fn control(
    db: &Connection,
    snapshot: &Snapshot,
    turn: &str,
    control: CoachControl,
    expected: i32,
) -> Result<String> {
    if snapshot.revision != expected {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Coaching changed. Review the current advice.",
        ));
    }
    let raw:Option<String>=db.query_row("SELECT context FROM turns t WHERE id=?1 AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id)",[turn],|r|r.get(0)).optional()?;
    let mut context: Value = serde_json::from_str(&raw.ok_or_else(|| {
        AppError::new(ErrorCode::NotFound, "Current coaching turn is unavailable.")
    })?)?;
    let mut decision: CoachDecision = serde_json::from_value(context["coachDecision"].clone())
        .map_err(|_| invalid("No coaching decision is available."))?;
    match control {
        CoachControl::OpenCard => {
            if decision.kept_going {
                return Err(invalid("This correction was skipped."));
            }
            // A learner explicitly asking for analysis may inspect an error
            // that automatic interruption policy deliberately left unselected.
            if decision.shown.is_none() {
                let observation: CoachObservation =
                    serde_json::from_value(context["coachObservation"].clone())?;
                if let Some(item) = observation.items.iter().find(|item| {
                    item.error.is_some()
                        && matches!(item.outcome, Outcome::Partial | Outcome::NotDemonstrated)
                }) {
                    decision.shown = Some(correction(item, CoachMove::Hint, &context)?);
                    decision.retry_invited = true;
                }
            }
            decision.exposed_move = decision.shown.as_ref().map(|shown| shown.r#move.clone());
        }

        CoachControl::KeepGoing => {
            decision.shown = None;
            decision.retry_invited = false;
            decision.kept_going = true;
        }
        CoachControl::ShowAnswer => {
            let selected = decision
                .shown
                .as_ref()
                .ok_or_else(|| invalid("No correction is selected."))?;
            let observation: CoachObservation =
                serde_json::from_value(context["coachObservation"].clone())?;
            let item = observation
                .items
                .iter()
                .find(|i| i.construct == selected.construct)
                .ok_or_else(|| invalid("Selected correction is unavailable."))?;
            decision.shown = Some(correction(item, CoachMove::Explicit, &context)?);
            decision.exposed_move = Some(CoachMove::Explicit);
            decision.retry_invited = false;
        }
    }
    context["coachDecision"] = serde_json::to_value(decision)?;
    db.execute(
        "UPDATE turns SET context=?2 WHERE id=?1",
        params![turn, serde_json::to_string(&context)?],
    )?;
    Ok(turn.into())
}
pub(crate) fn retry_context(db: &Connection, turn: &str) -> Result<Option<Value>> {
    let raw: String = db.query_row("SELECT context FROM turns WHERE id=?1", [turn], |r| {
        r.get(0)
    })?;
    let context: Value = serde_json::from_str(&raw)?;
    if context["coachDecision"]["shown"].is_null() || context["coachDecision"]["keptGoing"] == true
    {
        return Ok(None);
    }
    let decision: CoachDecision = serde_json::from_value(context["coachDecision"].clone())?;
    let observation: CoachObservation =
        serde_json::from_value(context["coachObservation"].clone())?;
    let shown = decision
        .shown
        .ok_or_else(|| invalid("Missing shown correction."))?;
    let item = observation
        .items
        .into_iter()
        .find(|i| i.construct == shown.construct && i.error.is_some())
        .ok_or_else(|| invalid("Missing native retry item."))?;
    Ok(Some(
        json!({"previousTurnId":turn,"item":item,"shown":shown,"supportStep":decision.exposed_move,"depth":context["coachRetry"]["depth"].as_u64().unwrap_or(0)+u64::from(decision.exposed_move.is_some())}),
    ))
}
