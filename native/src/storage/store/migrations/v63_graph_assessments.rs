//! Native assessment receipts are additive; existing assessments/disclosures stay intact.
use super::*;
pub(super) fn apply(db: &Connection) -> Result<()> {
    v62_graph_reply_sources::validate(db)?;
    db.execute_batch(include_str!("v63_graph_assessments.sql"))?;
    Ok(())
}
pub(super) fn validate(db: &Connection) -> Result<()> {
    v62_graph_reply_sources::validate(db)?;
    let reference = Connection::open_in_memory()?;
    reference.execute_batch(include_str!("v63_graph_assessments.sql"))?;
    schema::validate_objects(db, &reference, false)
}
