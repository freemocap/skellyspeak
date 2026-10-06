//! Ordered, database-only upgrades. Released steps and their input contracts are frozen.
use super::*;
use rusqlite::TransactionBehavior;

mod recovery_copy;
#[cfg(test)]
mod tests;
mod v48_assessment;
mod v49_execution;
mod v50_coaching;
mod v51_skill_direction;
mod v52_speech_default;
mod v53_speech_reliability;

const MIN_VERSION: i32 = 45;
const BASELINE: &str = include_str!("v45.sql");
const OPTIONAL_BASELINE: &str = include_str!("v45_optional.sql");

struct Step {
    from: i32,
    apply: fn(&Connection) -> Result<()>,
    validate: fn(&Connection) -> Result<()>,
}

const STEPS: &[Step] = &[
    Step {
        from: 45,
        apply: upgrade_45,
        validate: validate_46,
    },
    Step {
        from: 46,
        apply: upgrade_46,
        validate: validate_47,
    },
    Step {
        from: 47,
        apply: v48_assessment::apply,
        validate: v48_assessment::validate,
    },
    Step {
        from: 48,
        apply: v49_execution::apply,
        validate: v49_execution::validate,
    },
    Step {
        from: 49,
        apply: v50_coaching::apply,
        validate: v50_coaching::validate,
    },
    Step {
        from: 50,
        apply: v51_skill_direction::apply,
        validate: v51_skill_direction::validate,
    },
    Step {
        from: 51,
        apply: v52_speech_default::apply,
        validate: v52_speech_default::validate,
    },
    Step {
        from: 52,
        apply: v53_speech_reliability::apply,
        validate: v52_speech_default::validate,
    },
];

fn upgrade_46(db: &Connection) -> Result<()> {
    db.execute_batch(include_str!("v47_skill_level_events.sql"))?;
    Ok(())
}

fn validate_47(db: &Connection) -> Result<()> {
    validate_46(db)?;
    let reference = Connection::open_in_memory()?;
    reference.execute_batch(include_str!("v47_skill_level_events.sql"))?;
    schema::validate_objects(db, &reference, false)
}

fn validate_45(db: &Connection) -> Result<()> {
    let reference = Connection::open_in_memory()?;
    reference.execute_batch(BASELINE)?;
    schema::validate_objects(db, &reference, false)?;
    let optional = Connection::open_in_memory()?;
    optional.execute_batch(OPTIONAL_BASELINE)?;
    // Version 45 created these separately after committing its core schema.
    schema::validate_objects(db, &optional, true)
}

fn validate_46(db: &Connection) -> Result<()> {
    let reference = Connection::open_in_memory()?;
    reference.execute_batch(BASELINE)?;
    reference.execute_batch(OPTIONAL_BASELINE)?;
    schema::validate_objects(db, &reference, false)
}

fn upgrade_45(db: &Connection) -> Result<()> {
    db.execute_batch(OPTIONAL_BASELINE)?;
    // Retired access lockouts and discovery caches own no learner evidence.
    // This is the existing cleanup, moved out of ordinary startup into a step.
    db.execute_batch(
        "DROP TABLE IF EXISTS inference_holds;
        DROP TABLE IF EXISTS drill_references; DROP TABLE IF EXISTS inference_profiles;",
    )?;
    Ok(())
}

fn check_chain(steps: &[Step], target: i32) -> Result<()> {
    if target < MIN_VERSION
        || steps.len() != (target - MIN_VERSION) as usize
        || steps
            .iter()
            .enumerate()
            .any(|(i, step)| step.from != MIN_VERSION + i as i32)
    {
        return Err(AppError::new(
            ErrorCode::Storage,
            "The workspace migration chain is incomplete. No data was changed.",
        ));
    }
    Ok(())
}

pub(super) fn validate_registry() -> Result<()> {
    check_chain(STEPS, SCHEMA_VERSION)
}

pub(super) fn upgrade(
    db: &mut Connection,
    path: &Path,
    config: &crate::configuration::Registry,
) -> Result<()> {
    validate_registry()?;
    let version: i32 = db.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if version < MIN_VERSION {
        return Err(AppError::new(
            ErrorCode::Storage,
            format!(
                "Workspace format {version} predates supported format {MIN_VERSION}. Save a copy before choosing Factory Reset. No data was changed."
            ),
        ));
    }
    if version > SCHEMA_VERSION {
        return Err(AppError::new(
            ErrorCode::Storage,
            format!(
                "Workspace format {version} is newer than this build supports ({SCHEMA_VERSION}). Update the app to open it. No data was changed."
            ),
        ));
    }
    if version == SCHEMA_VERSION {
        return Ok(());
    }
    validate_database(db)?;
    if version == MIN_VERSION {
        validate_45(db)?;
    } else {
        (STEPS[(version - MIN_VERSION - 1) as usize].validate)(db)?;
    }
    let backup = recovery_copy::create(db, path, version, SCHEMA_VERSION)?;
    run_chain(db, version, SCHEMA_VERSION, STEPS, |tx| {
        validate_current_schema(tx)?;
        // Decode the actual learner-facing state before committing the upgrade.
        snapshot::read_snapshot(tx, "migration-validation", config)?;
        Ok(())
    })
    .map_err(|mut error| {
        error
            .message
            .push_str(&format!(" Recovery copy: {}.", backup.display()));
        error
    })
}

fn run_chain(
    db: &mut Connection,
    start: i32,
    target: i32,
    steps: &[Step],
    validate_final: impl FnOnce(&Connection) -> Result<()>,
) -> Result<()> {
    check_chain(steps, target)?;
    let tx = db.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let mut stage = "source_version";
    let mut from = start;
    let result = (|| -> Result<()> {
        let actual: i32 = tx.pragma_query_value(None, "user_version", |r| r.get(0))?;
        if actual != start {
            return Err(AppError::new(
                ErrorCode::Storage,
                "Workspace version changed during upgrade.",
            ));
        }
        for step in steps.iter().filter(|step| step.from >= start) {
            from = step.from;
            stage = "apply";
            (step.apply)(&tx)?;
            stage = "validate_step";
            (step.validate)(&tx)?;
            validate_database(&tx)?;
            tx.pragma_update(None, "user_version", step.from + 1)?;
        }
        stage = "validate_final";
        validate_final(&tx)
    })();
    if let Err(cause) = result {
        let rollback = tx.rollback();
        return Err(AppError::new(ErrorCode::Storage, if rollback.is_ok() {
            format!("Workspace migration {from} → {} failed during {stage}. The upgrade was rolled back; no data was changed.", from + 1)
        } else {
            format!("Workspace migration {from} → {} failed; rollback could not be confirmed. Close the app and retain the recovery copy.", from + 1)
        }).with_diagnostics(serde_json::json!({
            "stage":stage, "source_version":start, "target_version":target,
            "step_from":from, "step_to":from+1,
            "cause": {"code":cause.code,"message":cause.message,"diagnostics":cause.diagnostics},
            "rollback":rollback.err().map(AppError::from),
        })));
    }
    tx.commit().map_err(|cause| {
        let cause = AppError::from(cause);
        AppError::new(ErrorCode::Storage,
            "Workspace migration commit failed. Reopen the workspace to check its state; retain the recovery copy.")
            .with_diagnostics(serde_json::json!({"stage":"commit", "source_version":start,
                "target_version":target,"cause":cause}))
    })
}
