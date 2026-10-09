//! Explicit product requests bind to native operations and exact message inputs.
//! Action receipts and native demand/retry commit in one owner transaction.
use super::*;
use crate::language::source_graph::SourceText;
use rusqlite::OptionalExtension;

pub struct HelpRequest {
    pub conversation: String,
    pub operation: String,
    engine: String,
    run: String,
    node: String,
    source: SourceText,
    retry: bool,
}
fn rejected() -> AppError {
    AppError::new(
        ErrorCode::Conflict,
        "This assistance is unavailable for the current message.",
    )
}
impl Runtime {
    pub fn resolve_help(
        &self,
        db: &Connection,
        message: &str,
        operation: &Contract,
        retry: bool,
    ) -> Result<Option<HelpRequest>> {
        let owner:Option<(String,String,String,String,String,String)> = db.query_row("SELECT o.executor,o.engine_id,o.run_id,m.conversation_id,m.text,t.id FROM messages m JOIN turns t ON t.id=m.turn_id JOIN turn_execution_owners o ON o.turn_id=t.id JOIN conversations c ON c.id=t.conversation_id JOIN contacts contact ON contact.id=c.contact_id WHERE m.id=?1 AND o.executor='graph' AND o.channel IN ('persona_reply','persona_opening') AND c.archived=0 AND contact.archived=0 AND t.state NOT IN ('cancelled','invalidated') AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id)",[message],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?))).optional()?;
        let Some((_, engine_id, run, conversation, text, _)) = owner else {
            if db.query_row("SELECT EXISTS(SELECT 1 FROM messages m JOIN turn_execution_owners o ON o.turn_id=m.turn_id WHERE m.id=?1 AND o.executor='graph')",[message],|r|r.get::<_,bool>(0))? { return Err(rejected()); }
            return Ok(None);
        };
        let engine = self.engines.get(&engine_id).ok_or_else(rejected)?;
        let view = engine.inspect(&run).map_err(error)?;
        let source = SourceText {
            id: message.into(),
            text,
        };
        let mut reader =
            graph_store::BorrowedReadStore::new(db, self.partition(&engine_id)?).map_err(error)?;
        let mut matching = Vec::new();
        for (node, definition) in &view.artifact.definition.nodes {
            if &definition.operation != operation {
                continue;
            }
            if let Some(value) = engine
                .read_node_input(&run, node, "source", &mut reader)
                .map_err(error)?
                && serde_json::from_value::<SourceText>(value)? == source
            {
                matching.push(node.clone());
            }
        }
        if matching.len() != 1 {
            return Err(rejected());
        }
        let node = matching.remove(0);
        Ok(Some(HelpRequest {
            conversation,
            operation: format!(
                "graph:{}",
                serde_json::to_string(&(&engine_id, &run, &node))?
            ),
            engine: engine_id,
            run,
            node,
            source,
            retry,
        }))
    }

    pub fn request_help(&mut self, tx: Transaction<'_>, request: HelpRequest) -> Result<()> {
        let current:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM messages m JOIN turns t ON t.id=m.turn_id JOIN turn_execution_owners o ON o.turn_id=t.id WHERE m.id=?1 AND m.text=?2 AND o.engine_id=?3 AND o.run_id=?4 AND t.state NOT IN ('cancelled','invalidated') AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id))",params![request.source.id,request.source.text,request.engine,request.run],|r|r.get(0))?;
        if !current {
            return Err(rejected());
        }
        let engine = self.engines.get(&request.engine).ok_or_else(rejected)?;
        let view = engine.inspect(&request.run).map_err(error)?;
        let disposition = &view.nodes[&request.node];
        let event = match disposition {
            Disposition::Failed | Disposition::Unknown if request.retry => Some(Event::Retry {
                run: request.run.clone(),
                node: request.node.clone(),
            }),
            Disposition::Blocked if request.retry => {
                let failed: Vec<_> = ancestors(&view, &request.node)?
                    .into_iter()
                    .filter(|node| {
                        matches!(view.nodes[node], Disposition::Failed | Disposition::Unknown)
                    })
                    .collect();
                match failed.as_slice() {
                    [node] => Some(Event::Retry {
                        run: request.run.clone(),
                        node: node.clone(),
                    }),
                    _ => return Err(rejected()),
                }
            }
            Disposition::Disabled | Disposition::Cancelled => return Err(rejected()),
            Disposition::Unrequested | Disposition::Waiting => {
                if request.retry {
                    return Err(AppError::new(
                        ErrorCode::Conflict,
                        "Request this assistance before retrying it.",
                    ));
                }
                let unrequested: Vec<_> = ancestors(&view, &request.node)?
                    .into_iter()
                    .filter(|node| view.nodes[node] == Disposition::Unrequested)
                    .collect();
                match unrequested.as_slice() {
                    [] => None,
                    [node] => Some(Event::Demand {
                        run: request.run.clone(),
                        node: node.clone(),
                    }),
                    _ => {
                        return Err(AppError::new(
                            ErrorCode::Conflict,
                            "This assistance requires multiple independent requests.",
                        ));
                    }
                }
            }
            _ => None,
        };
        let Some(event) = event else {
            tx.commit()?;
            return Ok(());
        };
        let target = match &event {
            Event::Demand { node, .. } | Event::Retry { node, .. } => node,
            _ => unreachable!(),
        };
        let providers = budget::requested(&view, target)?;
        super::super::admit_network_work(&tx, providers)?;
        let attempts: usize = view
            .attempts
            .iter()
            .filter(|(node, _)| {
                view.artifact.operations[&view.artifact.definition.nodes[*node].operation].resource
                    == Resource::Provider
            })
            .map(|(_, attempts)| attempts.len())
            .sum();
        if attempts as i64 + providers > super::super::TURN_ATTEMPT_LIMIT {
            return Err(super::super::budget_error(
                "This turn reached its assistance attempt budget.",
            ));
        }
        tx.execute(
            "UPDATE turns SET state='assisting' WHERE id=?1 AND state='succeeded'",
            [&request.run],
        )?;
        let partition = self.partition(&request.engine)?;
        let mut adapter = TransactionStore::new(
            tx,
            partition,
            limits().checkpoint.bytes,
            |_: &Connection, _: &CommitRequest<'_>| Ok(()),
        );
        self.engines
            .get_mut(&request.engine)
            .ok_or_else(rejected)?
            .apply(event, &mut adapter)
            .map_err(error)?;
        Ok(())
    }
}
