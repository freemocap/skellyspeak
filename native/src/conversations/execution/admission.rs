use super::*;

// Bounds include running, paused and dependency-waiting operations.
pub(super) const OUTSTANDING_NETWORK_LIMIT: i64 = 512;
pub(super) const TURN_ATTEMPT_LIMIT: i64 = 16;

pub(super) fn budget_error(message: &str) -> AppError {
    crate::diagnostics::native_event(
        "work_budget_rejected",
        &[
            ("outstanding_limit", OUTSTANDING_NETWORK_LIMIT as u64),
            ("turn_attempt_limit", TURN_ATTEMPT_LIMIT as u64),
        ],
    );
    AppError::new(ErrorCode::AdmissionHeld, message)
}

pub(super) fn admit_network_work(db: &Connection, additional: i64) -> Result<()> {
    let outstanding: i64 = db.query_row(
        "SELECT count(*) FROM operations o JOIN turns t ON t.id=o.turn_id WHERE t.state IN ('pending','assisting') AND o.state IN ('ready','waiting_dependencies','running') AND o.kind NOT IN ('persona_context','coach_context')",
        [], |r| r.get(0),
    )?;
    if additional < 0 || additional > OUTSTANDING_NETWORK_LIMIT - outstanding {
        return Err(budget_error(
            "AI work queue is full. Let pending work finish or cancel it before submitting again. This action was not accepted.",
        ));
    }
    Ok(())
}

pub(super) fn admit_turn_retry(db: &Connection, turn: &str) -> Result<()> {
    let attempts: i64 = db.query_row(
        "SELECT count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE o.turn_id=?1 AND a.requested_model!='local'",
        [turn], |r| r.get(0),
    )?;
    let additional: i64 = db.query_row(
        "SELECT count(*) FROM operations WHERE turn_id=?1 AND state IN ('failed','unknown') AND kind NOT IN ('persona_context','coach_context','persona_speech')",
        [turn], |r| r.get(0),
    )?;
    if additional == 0 {
        return Err(fail("Retry speech explicitly from its source message."));
    }
    let dependent: i64 = db.query_row("SELECT count(*) FROM operations WHERE turn_id=?1 AND state='waiting_dependencies' AND kind NOT IN ('persona_context','coach_context')", [turn], |r| r.get(0))?;
    if attempts + additional + dependent > TURN_ATTEMPT_LIMIT {
        return Err(budget_error(
            "This turn has reached its network attempt budget. No retry was accepted. Start a new exchange if you want to continue.",
        ));
    }
    admit_network_work(db, additional + dependent)
}
