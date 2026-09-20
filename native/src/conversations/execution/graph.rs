//! Execution and inspection resolve the same Rust operation declarations.
use super::*;
use crate::conversations::turn_plan::{Declaration, RETAINED};

pub(super) fn declaration_for(
    db: &Connection,
    turn: &str,
    kind: &str,
) -> Result<&'static Declaration> {
    plan_for(db, turn)?
        .iter()
        .chain(RETAINED)
        .find(|node| node.kind == kind)
        .ok_or_else(|| fail("Unknown operation declaration."))
}

pub(super) fn dependencies_succeeded(db: &Connection, turn: &str, kind: &str) -> Result<bool> {
    let mut ready = true;
    for dependency in declaration_for(db, turn, kind)?.dependencies {
        ready &= ops_succeeded(db, turn, dependency)?;
    }
    Ok(ready)
}

pub(super) fn release_dependents(db: &Connection, turn: &str) -> Result<()> {
    let kinds = db
        .prepare("SELECT kind FROM operations WHERE turn_id=?1 AND state='waiting_dependencies'")?
        .query_map([turn], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    for kind in kinds {
        if dependencies_succeeded(db, turn, &kind)? {
            db.execute("UPDATE operations SET state='ready' WHERE turn_id=?1 AND kind=?2 AND state='waiting_dependencies'", params![turn, kind])?;
        }
    }
    Ok(())
}
