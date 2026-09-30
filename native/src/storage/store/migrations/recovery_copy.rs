use super::*;
use std::path::PathBuf;

/// SQLite produces a consistent image, including committed WAL pages. These are
/// local recovery files, retained until explicit reset/removal, never synced.
pub(super) fn create(db: &Connection, path: &Path, from: i32, to: i32) -> Result<PathBuf> {
    let directory = path.with_file_name("migration-backups");
    if let Ok(metadata) = std::fs::symlink_metadata(&directory)
        && (!metadata.is_dir() || metadata.file_type().is_symlink())
    {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Migration backup destination is not a real directory. No data was changed.",
        ));
    }
    super::super::private_directory(&directory).map_err(io_error)?;
    let token = Uuid::new_v4();
    let destination = directory.join(format!("workspace-{from}-to-{to}-{token}.sqlite3"));
    let staging = directory.join(format!(".{token}.partial"));
    let result = (|| -> Result<()> {
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let file = options.open(&staging).map_err(io_error)?;
        drop(file);
        let name = staging.to_str().ok_or_else(|| {
            AppError::new(
                ErrorCode::Storage,
                "Migration backup path is not valid Unicode. No data was changed.",
            )
        })?;
        db.execute("VACUUM INTO ?1", [name])?;
        let copy =
            Connection::open_with_flags(&staging, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
        validate_database(&copy)?;
        drop(copy);
        std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&staging)
            .and_then(|file| file.sync_all())
            .map_err(io_error)?;
        std::fs::rename(&staging, &destination).map_err(io_error)?;
        #[cfg(unix)]
        std::fs::File::open(&directory)
            .and_then(|file| file.sync_all())
            .map_err(io_error)?;
        Ok(())
    })();
    if let Err(cause) = result {
        let cleanup = match std::fs::remove_file(&staging) {
            Ok(()) => None,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => Some(io_error(error)),
        };
        return Err(AppError::new(
            ErrorCode::Storage,
            "Could not complete the migration recovery copy. No data was changed.",
        )
        .with_diagnostics(serde_json::json!({"stage":"migration_backup",
                "cause":cause, "partial_cleanup_error":cleanup})));
    }
    Ok(destination)
}

fn io_error(cause: std::io::Error) -> AppError {
    crate::diagnostics::response::io_context(
        &cause,
        "migration_backup",
        AppError::new(
            ErrorCode::Storage,
            "Migration recovery file operation failed.",
        ),
    )
}
