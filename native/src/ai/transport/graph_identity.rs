//! Durable wire identities for native producer executions. This is not a scheduler
//! or an authorization check. The host calls bind inside authorized native Dispatch
//! and exposes the invocation only after that entire transaction has committed.
use crate::ai::graph::{CommitIntent, CommitRequest, InvocationIdentity, Resource};
use crate::model::{AppError, ErrorCode, Result};
use rusqlite::{Connection, OptionalExtension, params};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WireIdentity {
    pub attempt: String,
    pub operation: String,
}

fn invalid() -> AppError {
    AppError::new(
        ErrorCode::Conflict,
        "Native provider execution identity is unavailable or inconsistent.",
    )
    .with_diagnostics(
        serde_json::json!({"stage":"graph_transport_identity","reason":"identity_mismatch"}),
    )
}

/// Stage once per producer. Repeated binding returns the original IDs. The owner
/// must roll this back with the graph records on rejection; this never commits.
pub fn bind(db: &Connection, request: &CommitRequest<'_>) -> Result<WireIdentity> {
    if db.is_autocommit() {
        return Err(invalid());
    }
    let CommitIntent::Dispatch {
        authority, work, ..
    } = &request.intent
    else {
        return Err(invalid());
    };
    if work.resource != Resource::Provider
        || authority.artifact != work.artifact
        || authority.node.is_none()
    {
        return Err(invalid());
    }
    let engine = &request.next.stamp().engine;
    let execution = serde_json::to_string(&work.execution)?;
    let operation_contract = serde_json::to_string(&work.operation)?;
    if let Some((artifact, contract, identity)) = read(db, engine, &execution)? {
        if artifact != work.artifact || contract != operation_contract {
            return Err(invalid());
        }
        return Ok(identity);
    }
    let (attempt, operation) = crate::ai::identity::new_execution_ids();
    db.execute("INSERT INTO graph_transport_identities(engine_id,execution_id,artifact_id,operation_contract,attempt_id,operation_id) VALUES(?1,?2,?3,?4,?5,?6)",
        params![engine, execution, work.artifact, operation_contract, attempt, operation])?;
    Ok(WireIdentity { attempt, operation })
}

/// Load for an already committed invocation. Missing identity is an error, never
/// permission to mint another request ID. This does not establish current access.
pub fn load(db: &Connection, invocation: &InvocationIdentity) -> Result<WireIdentity> {
    let engine = invocation.engine.as_deref().ok_or_else(invalid)?;
    let execution = serde_json::to_string(&invocation.execution)?;
    let (artifact, contract, identity) = read(db, engine, &execution)?.ok_or_else(invalid)?;
    if artifact != invocation.artifact || contract != serde_json::to_string(&invocation.operation)?
    {
        return Err(invalid());
    }
    Ok(identity)
}

fn read(
    db: &Connection,
    engine: &str,
    execution: &str,
) -> Result<Option<(String, String, WireIdentity)>> {
    Ok(db.query_row("SELECT artifact_id,operation_contract,attempt_id,operation_id FROM graph_transport_identities WHERE engine_id=?1 AND execution_id=?2",
        params![engine, execution], |row| Ok((row.get(0)?, row.get(1)?, WireIdentity { attempt: row.get(2)?, operation: row.get(3)? })))
        .optional()?)
}
