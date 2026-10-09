use super::*;

/// Read native history inside an existing domain transaction. This borrows its
/// snapshot and never commits, recovers, or reconstructs state using SQL rules.
pub struct BorrowedReadStore<'a> {
    db: &'a Connection,
    partition: Partition,
}
impl<'a> BorrowedReadStore<'a> {
    pub fn new(db: &'a Connection, partition: Partition) -> Result<Self> {
        if db.is_autocommit() {
            return Err(fault("transaction_required", "graph_read"));
        }
        Ok(Self { db, partition })
    }
    pub fn checkpoint(&self, limits: CheckpointLimits) -> Result<Option<Checkpoint>> {
        read_checkpoint(self.db, &self.partition, limits)
    }
}
impl RecordStore for BorrowedReadStore<'_> {
    fn record_count(&mut self, expected: &Stamp) -> Result<usize> {
        count(self.db, &self.partition, expected)
    }
    fn read_record(
        &mut self,
        expected: &Stamp,
        key: &RecordKey,
        max_bytes: usize,
    ) -> Result<Vec<u8>> {
        record(self.db, &self.partition, expected, key, max_bytes)
    }
}
impl HistoryStore for BorrowedReadStore<'_> {
    fn read_archive(&mut self, expected: &Stamp, max_bytes: usize) -> Result<Vec<u8>> {
        archive(self.db, &self.partition, expected, max_bytes)
    }
}

fn read_checkpoint(
    db: &Connection,
    partition: &Partition,
    limits: CheckpointLimits,
) -> Result<Option<Checkpoint>> {
    let Some(expected) = stamp(db, partition)? else {
        return Ok(None);
    };
    let body = blob(
        db,
        "graph_engines",
        "checkpoint",
        "id=?1",
        &[&expected.engine],
        limits.bytes,
    )?;
    let checkpoint = Checkpoint::decode(&body, limits)?;
    if checkpoint.stamp() != &expected
        || catalog_id(checkpoint.artifact_ids())? != partition.catalog
    {
        return Err(fault("checkpoint_identity", "checkpoint"));
    }
    Ok(Some(checkpoint))
}

/// A stable protected read snapshot. No recovery, mutation or fallback to cache.
pub struct ReadStore<'a> {
    tx: Transaction<'a>,
    partition: Partition,
}
impl<'a> ReadStore<'a> {
    pub fn from_transaction(tx: Transaction<'a>, partition: Partition) -> Self {
        Self { tx, partition }
    }
    pub fn new(db: &'a mut Connection, partition: Partition) -> Result<Self> {
        Ok(Self {
            tx: db.transaction().map_err(|e| sql(e, "read_begin"))?,
            partition,
        })
    }
    pub fn checkpoint(&self, limits: CheckpointLimits) -> Result<Option<Checkpoint>> {
        read_checkpoint(&self.tx, &self.partition, limits)
    }
}
impl RecordStore for ReadStore<'_> {
    fn record_count(&mut self, expected: &Stamp) -> Result<usize> {
        count(&self.tx, &self.partition, expected)
    }
    fn read_record(
        &mut self,
        expected: &Stamp,
        key: &RecordKey,
        max_bytes: usize,
    ) -> Result<Vec<u8>> {
        record(&self.tx, &self.partition, expected, key, max_bytes)
    }
}
impl HistoryStore for ReadStore<'_> {
    fn read_archive(&mut self, expected: &Stamp, max_bytes: usize) -> Result<Vec<u8>> {
        archive(&self.tx, &self.partition, expected, max_bytes)
    }
}

pub(super) fn stamp(db: &Connection, partition: &Partition) -> Result<Option<Stamp>> {
    let row: Option<(String, String)> = db
        .query_row(
            "SELECT id,stamp FROM graph_engines WHERE conversation_id=?1 AND catalog=?2",
            params![partition.conversation, partition.catalog],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| sql(e, "stamp_read"))?;
    row.map(|(id, raw)| {
        let stamp: Stamp =
            serde_json::from_str(&raw).map_err(|_| fault("record_stamp", "stamp_decode"))?;
        if stamp.engine != id {
            return Err(fault("record_stamp", "engine"));
        }
        Ok(stamp)
    })
    .transpose()
}
pub(super) fn check_stamp(db: &Connection, partition: &Partition, expected: &Stamp) -> Result<()> {
    if stamp(db, partition)?.as_ref() != Some(expected) {
        return Err(fault("record_stamp", "checkpoint"));
    }
    Ok(())
}
pub(super) fn count(db: &Connection, partition: &Partition, expected: &Stamp) -> Result<usize> {
    check_stamp(db, partition, expected)?;
    let count: i64 = db
        .query_row(
            "SELECT count(*) FROM graph_records WHERE engine_id=?1",
            [&expected.engine],
            |r| r.get(0),
        )
        .map_err(|e| sql(e, "record_count"))?;
    usize::try_from(count).map_err(|_| fault("record_read", "record_count"))
}
pub(super) fn record(
    db: &Connection,
    partition: &Partition,
    expected: &Stamp,
    key: &RecordKey,
    limit: usize,
) -> Result<Vec<u8>> {
    check_stamp(db, partition, expected)?;
    blob(
        db,
        "graph_records",
        "payload",
        "engine_id=?1 AND key=?2",
        &[&expected.engine, &encode(key, "record_key")?],
        limit,
    )
}
pub(super) fn archive(
    db: &Connection,
    partition: &Partition,
    expected: &Stamp,
    limit: usize,
) -> Result<Vec<u8>> {
    let current = stamp(db, partition)?.ok_or_else(|| fault("record_missing", "engine"))?;
    if current.engine != expected.engine {
        return Err(fault("record_stamp", "archive_engine"));
    }
    let stored: String = db
        .query_row(
            "SELECT stamp FROM graph_archives WHERE engine_id=?1 AND checksum=?2",
            params![expected.engine, expected.checksum],
            |r| r.get(0),
        )
        .map_err(|e| sql(e, "archive_stamp"))?;
    let stored: Stamp =
        serde_json::from_str(&stored).map_err(|_| fault("history_mismatch", "archive_stamp"))?;
    if &stored != expected {
        return Err(fault("history_mismatch", "archive_stamp"));
    }
    blob(
        db,
        "graph_archives",
        "payload",
        "engine_id=?1 AND checksum=?2",
        &[&expected.engine, &expected.checksum],
        limit,
    )
}

// Identifiers/clauses are module-private constants; source values are parameters.
// Both queries run in the caller's read or owner transaction. CASE additionally
// prevents allocating an oversized/non-BLOB body if a future caller breaks that.
pub(super) fn blob(
    db: &Connection,
    table: &str,
    column: &str,
    clause: &str,
    values: &[&dyn rusqlite::ToSql],
    limit: usize,
) -> Result<Vec<u8>> {
    let length: Option<i64> = db
        .query_row(
            &format!("SELECT length({column}) FROM {table} WHERE {clause}"),
            values,
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| sql(e, "blob_length"))?;
    let length = length.ok_or_else(|| fault("record_missing", "blob"))?;
    if usize::try_from(length).ok().is_none_or(|n| n > limit) {
        return Err(fault("record_byte_limit", "blob"));
    }
    let body: Option<Vec<u8>> = db.query_row(&format!("SELECT CASE WHEN typeof({column})='blob' AND length({column})={length} THEN {column} ELSE NULL END FROM {table} WHERE {clause}"), values, |r| r.get(0)).map_err(|e| sql(e, "blob_read"))?;
    body.ok_or_else(|| fault("record_mismatch", "blob"))
}
