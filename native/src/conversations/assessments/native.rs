//! Native receipts retain domain results; the native history decides whether a
//! receipt is current. There is no second SQL implementation of attempt state.
use super::*;
use crate::ai::{graph, graph_store};
use crate::conversations::execution::graph_runtime;

pub(super) fn owns(db: &Connection, turn: &str) -> Result<bool> {
    Ok(db.query_row(
        "SELECT EXISTS(SELECT 1 FROM turn_execution_owners WHERE turn_id=?1 AND executor='graph')",
        [turn],
        |r| r.get(0),
    )?)
}

pub(super) fn current(db: &Connection, turn: &str, kind: &str) -> Result<Option<(String, Value)>> {
    if db.is_autocommit() {
        let tx = db.unchecked_transaction()?;
        return current(&tx, turn, kind);
    }
    let saved: Option<(String,String,String,String,String,String,String)> = db.query_row(
        "SELECT a.id,a.result,a.node_key,a.attempt_id,o.run_id,t.conversation_id,e.catalog FROM conversation_graph_assessments a JOIN turn_execution_owners o ON o.turn_id=a.turn_id JOIN turns t ON t.id=o.turn_id JOIN graph_engines e ON e.id=o.engine_id WHERE a.turn_id=?1 AND a.kind=?2 AND t.state NOT IN ('cancelled','invalidated') ORDER BY a.rowid DESC LIMIT 1",
        params![turn,kind],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?))).optional()?;
    let Some((id, raw, node, attempt, run, conversation, catalog)) = saved else {
        return Ok(None);
    };
    let limits = graph_runtime::limits();
    let mut reader = graph_store::BorrowedReadStore::new(
        db,
        graph_store::Partition {
            conversation,
            catalog,
        },
    )
    .map_err(graph_runtime::error)?;
    let checkpoint = reader
        .checkpoint(limits.checkpoint)
        .map_err(graph_runtime::error)?
        .ok_or_else(|| {
            AppError::new(
                ErrorCode::Storage,
                "Assessment graph checkpoint is missing.",
            )
        })?;
    let snapshot = checkpoint
        .historical_inspection(
            checkpoint.stamp().revision,
            graph::HistoricalLimits {
                history: limits.history,
                state: limits.state,
            },
            &mut reader,
        )
        .map_err(graph_runtime::error)?
        .snapshot(
            &run,
            graph::ExportLimits {
                bytes: 4 * 1024 * 1024,
                attempts: 4096,
            },
        )
        .map_err(graph_runtime::error)?;
    if snapshot.nodes.get(&node) != Some(&graph::Disposition::Adopted)
        || !snapshot
            .attempts
            .get(&node)
            .and_then(|a| a.last())
            .is_some_and(|a| a.id == attempt)
    {
        return Ok(None);
    }
    Ok(Some((id, serde_json::from_str(&raw)?)))
}

pub(super) fn disclosure(db: &Connection, id: &str) -> Result<Option<String>> {
    Ok(db
        .query_row(
            "SELECT decision FROM conversation_graph_disclosures WHERE assessment_id=?1",
            [id],
            |r| r.get(0),
        )
        .optional()?)
}
pub(super) fn disclose(db: &Connection, id: &str, value: &Value) -> Result<()> {
    db.execute("INSERT INTO conversation_graph_disclosures(assessment_id,decision) VALUES(?1,?2) ON CONFLICT(assessment_id) DO UPDATE SET decision=excluded.decision",params![id,value.to_string()])?;
    Ok(())
}
