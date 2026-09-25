//! Drill publication authority; reusable media is owned by the shared result repository.
use crate::{
    language::reading::{ReadingAid, Request},
    model::*,
    storage::store::Store,
};
use rusqlite::params;

pub(crate) fn validate(store: &Store, request: &Request) -> Result<()> {
    let Some(item) = &request.input.reference_item else {
        return Ok(());
    };
    let valid: bool = store.connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM drill_items WHERE id=?1 AND text=?2 AND language_id=?3 AND variety_id=?4 AND archived=0)",
        params![item, request.input.text, request.context.language_id, request.context.variety_id], |r| r.get(0))?;
    if request.input.aid != ReadingAid::Speech || !valid {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "The reference phrase no longer matches this speech request.",
        ));
    }
    Ok(())
}

#[cfg(test)]
#[path = "reference_tests.rs"]
mod tests;
