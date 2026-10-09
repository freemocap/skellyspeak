//! Product status fields are projections of native nodes and exact resolved
//! sources. This does not create operations, topology or scheduling rules.
use super::*;
use crate::{
    language::{gloss_graph, source_graph::SourceText, translation_graph},
    learning::coaching::{assessment_graph, feedback_graph, support_graph},
    model::ChatMessage,
};
use rusqlite::OptionalExtension;

pub(super) fn state(disposition: &Disposition) -> Option<String> {
    Some(
        match disposition {
            Disposition::Disabled | Disposition::Unrequested | Disposition::Skipped => return None,
            Disposition::Adopted => "succeeded",
            Disposition::Ready | Disposition::Prepared => "ready",
            Disposition::Running | Disposition::Available => "running",
            Disposition::Waiting => "waiting_dependencies",
            Disposition::Paused | Disposition::Held => "held",
            Disposition::Unknown => "unknown",
            Disposition::Failed | Disposition::Blocked => "failed",
            Disposition::Cancelled => "cancelled",
        }
        .into(),
    )
}
impl Runtime {
    pub fn message_status(&self, db: &Connection, message: &mut ChatMessage) -> Result<()> {
        let owner:Option<(String,String)> = db.query_row("SELECT engine_id,run_id FROM turn_execution_owners WHERE turn_id=?1 AND executor='graph'",[&message.turn_id],|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
        let Some((engine_id, run)) = owner else {
            return Ok(());
        };
        let Some(engine) = self.engines.get(&engine_id) else {
            return Ok(());
        };
        let view = engine.inspect(&run).map_err(error)?;
        let tx = db.unchecked_transaction()?;
        let mut reader =
            graph_store::BorrowedReadStore::new(&tx, self.partition(&engine_id)?).map_err(error)?;
        let expected = SourceText {
            id: message.id.clone(),
            text: message.text.clone(),
        };
        let mut assessment_error = None;
        for (node, definition) in &view.artifact.definition.nodes {
            let operation = &definition.operation;
            if ![
                translation_graph::operation_contract(),
                gloss_graph::operation_contract(),
                feedback_graph::operation_contract(),
                assessment_graph::operation_contract(),
                support_graph::Task::Brief.operation(),
                support_graph::Task::Assistance.operation(),
                support_graph::explanation::operation_contract(),
            ]
            .contains(operation)
            {
                continue;
            }
            let Some(source) = engine
                .read_node_input(&run, node, "source", &mut reader)
                .map_err(error)?
            else {
                continue;
            };
            if serde_json::from_value::<SourceText>(source)? != expected {
                continue;
            }
            let dependencies = ancestors(&view, node)?;
            let status = if view.nodes[node] == Disposition::Waiting
                && dependencies
                    .iter()
                    .any(|n| view.nodes[n] == Disposition::Unrequested)
            {
                None
            } else if view.nodes[node] == Disposition::Blocked
                && dependencies
                    .iter()
                    .any(|n| view.nodes[n] == Disposition::Unknown)
            {
                Some("unknown".into())
            } else {
                state(&view.nodes[node])
            };
            let mut failure = None;
            if matches!(
                view.nodes[node],
                Disposition::Failed | Disposition::Unknown | Disposition::Blocked
            ) {
                let mut responses = Vec::new();
                for dependency in ancestors(&view, node)? {
                    if let Some(attempt) = view.attempts.get(&dependency).and_then(|a| a.last())
                        && let Some(evidence) = engine
                            .read_execution_evidence(attempt.execution, &mut reader)
                            .map_err(error)?
                    {
                        responses.push(serde_json::json!({"node":dependency,"execution":attempt.execution,"observations":evidence.observations,"capture_failed":evidence.evidence_failure.is_some(),"complete":evidence.complete}));
                    }
                }
                failure=Some(serde_json::json!({"message":"Requested assistance did not complete.","diagnostics":{"engine":engine_id,"run":run,"node":node,"state":view.nodes[node],"responses":responses}}).to_string());
            }
            if *operation == translation_graph::operation_contract() {
                message.translation_state = status;
            } else if *operation == gloss_graph::operation_contract() {
                message.gloss_state = status;
                message.gloss_operation_id = Some(format!(
                    "graph:{}",
                    serde_json::to_string(&(&engine_id, &run, node))?
                ));
                message.gloss_error = failure;
            } else if *operation == feedback_graph::operation_contract() {
                message.feedback_state = status;
                message.feedback_error = failure;
            } else if *operation == assessment_graph::operation_contract() {
                assessment_error = failure;
            } else if *operation == support_graph::Task::Brief.operation() {
                message.brief_state = status;
                message.brief_error = failure;
            } else if *operation == support_graph::Task::Assistance.operation() {
                message.suggestions_state = status;
                message.suggestions_error = failure;
            } else {
                message.explanations_state = status;
                message.explanations_error = failure;
            }
        }
        if message.role == "user" && message.feedback_error.is_none() {
            message.feedback_error = assessment_error;
        }
        Ok(())
    }
}
