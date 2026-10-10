//! Persisted owner identities select engines; registering a new artifact never
//! changes the catalog of an existing run or retargets its executable.
use super::*;

impl Runtime {
    /// Current authoritative persisted state, without replaying historical events.
    /// The caller holds a domain read transaction; every record is stamp-checked.
    pub(crate) fn persisted_inspection(
        &self,
        db: &Connection,
        engine: &str,
        run: &str,
    ) -> Result<Option<InspectionSnapshot>> {
        let Some(host) = self.engines.get(engine) else {
            return Ok(None);
        };
        let mut reader =
            graph_store::BorrowedReadStore::new(db, self.partition(engine)?).map_err(error)?;
        host.read_inspection(
            run,
            ExportLimits {
                bytes: 4 * 1024 * 1024,
                attempts: 4096,
            },
            &mut reader,
        )
        .map(Some)
        .map_err(error)
    }

    pub fn history(
        &self,
        db: &Connection,
        conversation: &str,
        run: &str,
        before: Option<&str>,
        count: u32,
    ) -> Result<RunHistory> {
        if !(1..=64).contains(&count) {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Graph history page size must be between 1 and 64.",
            ));
        }
        let before = before
            .map(|value| {
                value
                    .parse::<u64>()
                    .ok()
                    .filter(|n| n.to_string() == value)
                    .ok_or_else(|| {
                        AppError::new(ErrorCode::Validation, "Invalid graph history revision.")
                    })
            })
            .transpose()?;
        let engine = self.owner_engine(db, conversation, run)?;
        let catalog = db.query_row(
            "SELECT catalog FROM graph_engines WHERE id=?1",
            [&engine],
            |r| r.get(0),
        )?;
        let mut reader = graph_store::ReadStore::from_transaction(
            db.unchecked_transaction()?,
            Partition {
                owner: crate::ai::graph_store::Owner::Conversation(conversation.into()),
                catalog,
            },
        );
        let checkpoint = reader
            .checkpoint(limits().checkpoint)
            .map_err(error)?
            .ok_or_else(|| AppError::new(ErrorCode::Storage, "Graph checkpoint missing."))?;
        checkpoint
            .run_history(
                run,
                before,
                count as usize,
                HistoricalLimits {
                    history: limits().history,
                    state: limits().state,
                },
                ExportLimits {
                    bytes: 8 * 1024 * 1024,
                    attempts: 4096,
                },
                &mut reader,
            )
            .map_err(error)
    }

    pub(super) fn retained(
        &self,
        db: &Connection,
        conversation: &str,
        run: &str,
    ) -> Result<HistoricalInspection> {
        let engine = self.owner_engine(db, conversation, run)?;
        let catalog = db.query_row(
            "SELECT catalog FROM graph_engines WHERE id=?1",
            [&engine],
            |r| r.get(0),
        )?;
        let mut reader = graph_store::ReadStore::from_transaction(
            db.unchecked_transaction()?,
            Partition {
                owner: crate::ai::graph_store::Owner::Conversation(conversation.into()),
                catalog,
            },
        );
        let checkpoint = reader
            .checkpoint(limits().checkpoint)
            .map_err(error)?
            .ok_or_else(|| AppError::new(ErrorCode::Storage, "Graph checkpoint missing."))?;
        checkpoint
            .historical_inspection(
                checkpoint.stamp().revision,
                HistoricalLimits {
                    history: limits().history,
                    state: limits().state,
                },
                &mut reader,
            )
            .map_err(error)
    }

    pub(crate) fn register_artifact(&mut self, graph: Arc<Executable>) -> Result<String> {
        let catalog = graph_store::catalog_id([graph.identity()]).map_err(error)?;
        self.catalogs
            .entry(catalog.clone())
            .or_insert_with(|| vec![graph]);
        Ok(catalog)
    }
    pub(super) fn owner_engine(
        &self,
        db: &Connection,
        conversation: &str,
        run: &str,
    ) -> Result<String> {
        db.query_row(
            "SELECT o.engine_id FROM graph_conversation_runs o JOIN turns t ON t.id=o.turn_id JOIN graph_engines e ON e.id=o.engine_id WHERE o.run_id=?1 AND t.conversation_id=?2 AND e.conversation_id=?2",
            params![run, conversation], |r| r.get(0),
        ).map_err(Into::into)
    }

    pub(super) fn partition(&self, engine: &str) -> Result<Partition> {
        self.partitions.get(engine).cloned().ok_or_else(|| {
            AppError::new(
                ErrorCode::Conflict,
                "Graph engine partition is unavailable.",
            )
        })
    }

    pub(super) fn install(&mut self, partition: Partition, engine: DurableEngine) {
        let id = engine.stamp().engine.clone();
        self.partitions.insert(id.clone(), partition);
        self.engines.insert(id, engine);
    }
}
