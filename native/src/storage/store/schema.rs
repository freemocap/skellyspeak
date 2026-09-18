use super::*;

/// Current development schema; other versions require explicit reset.
pub(crate) const SCHEMA_VERSION: i32 = 23;
pub(super) const GENERATION_SCHEMA: &str = include_str!("../schemas/generation_schema.sql");

pub(super) fn validate_database(connection: &Connection) -> Result<()> {
    let application_id: i32 =
        connection.pragma_query_value(None, "application_id", |r| r.get(0))?;
    if application_id != 1397443659 {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Unexpected database identity.",
        ));
    }
    let integrity: String = connection.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
    if integrity != "ok" {
        return Err(AppError::new(ErrorCode::Storage, integrity));
    }
    if connection.prepare("PRAGMA foreign_key_check")?.exists([])? {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Invalid database ownership references.",
        ));
    }
    Ok(())
}

/// Check current DDL, including revision constraints, before startup writes.
pub(super) fn validate_current_schema(connection: &Connection) -> Result<()> {
    let reference = Connection::open_in_memory()?;
    reference.execute_batch(include_str!("../schemas/schema.sql"))?;
    reference.execute_batch(GENERATION_SCHEMA)?;
    let mut statement = reference.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'")?;
    for row in statement.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
        ))
    })? {
        let (kind, name, sql) = row?;
        let actual: Option<(String, String)> = connection
            .query_row(
                "SELECT type,sql FROM sqlite_master WHERE name=?1",
                [&name],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        if actual != Some((kind, sql)) {
            return Err(AppError::new(
                ErrorCode::Storage,
                format!("Unexpected current schema object: {name}. No data was changed."),
            ));
        }
    }
    Ok(())
}
