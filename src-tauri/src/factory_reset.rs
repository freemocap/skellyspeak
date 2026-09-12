//! Irreversible local reset.
//!
//! The reset erases the secrets and the data directory itself, and clears the
//! webview's browsing data through WebView2, which owns its profile folder and may
//! hold files in it after this process exits. The log directory is still open while
//! this process runs, so it is recorded for the next launch, which clears it before
//! the log sink opens. A cleanup that fails again is reported on screen rather than
//! discarded.
use crate::{
    Application, Store, credentials, diagnostics,
    model::{AppError, ErrorCode, Result},
};
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Names the paths a reset still has to clear. It lives in the data root, and the
/// reset empties that directory while leaving this file in place.
const PENDING: &str = "pending-cleanup";

fn storage_error(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::Storage, message.into())
}

pub(crate) fn pending_path(directory: &Path) -> PathBuf {
    directory.join(PENDING)
}

/// Removes every entry in `directory`, leaving the pending record in place when the
/// caller still needs it to survive.
fn clear_directory(directory: &Path, keep: Option<&str>) -> Result<()> {
    let metadata = match std::fs::symlink_metadata(directory) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(storage_error(format!(
                "Could not inspect local data: {error}"
            )));
        }
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(storage_error(
            "Local data directory is not a real directory.",
        ));
    }
    for entry in std::fs::read_dir(directory)
        .map_err(|error| storage_error(format!("Could not read local data: {error}")))?
    {
        let entry =
            entry.map_err(|error| storage_error(format!("Could not read local data: {error}")))?;
        if keep.is_some_and(|name| entry.file_name().to_string_lossy() == name) {
            continue;
        }
        let path = entry.path();
        let kind = entry
            .file_type()
            .map_err(|error| storage_error(format!("Could not inspect local data: {error}")))?;
        if kind.is_dir() {
            std::fs::remove_dir_all(path)
        } else {
            std::fs::remove_file(path)
        }
        .map_err(|error| storage_error(format!("Could not erase local data: {error}")))?;
    }
    Ok(())
}

/// Records the directories a reset could not clear. Called before anything is
/// destroyed, so a record that cannot be written stops the reset while there is
/// still nothing to lose.
pub(crate) fn record_pending(directory: &Path, paths: &[PathBuf]) -> Result<()> {
    let body: String = paths
        .iter()
        .map(|path| format!("{}\n", path.display()))
        .collect();
    std::fs::write(pending_path(directory), body).map_err(|error| {
        storage_error(format!(
            "Could not record the directories still to clear: {error}"
        ))
    })
}

pub(crate) fn pending(directory: &Path) -> Result<Vec<PathBuf>> {
    let body = match std::fs::read_to_string(pending_path(directory)) {
        Ok(body) => body,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => {
            return Err(storage_error(format!(
                "Could not read the cleanup record: {error}"
            )));
        }
    };
    Ok(body
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(PathBuf::from)
        .collect())
}

pub(crate) fn clear_pending(directory: &Path) -> Result<()> {
    match std::fs::remove_file(pending_path(directory)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(storage_error(format!(
            "Could not clear the cleanup record: {error}"
        ))),
    }
}

/// Finishes the cleanup a previous reset recorded.
///
/// Called before the webview exists, which is the only moment its cache is not
/// held open. A directory that still cannot be cleared keeps its record, so the
/// next launch tries again and the failure is reported until it succeeds.
pub(crate) fn finish_pending(directory: &Path) -> Result<()> {
    let paths = pending(directory)?;
    if paths.is_empty() {
        return Ok(());
    }
    for path in &paths {
        if let Err(error) = clear_directory(path, None) {
            return Err(storage_error(format!(
                "Could not finish clearing {}: {error}",
                path.display()
            )));
        }
    }
    clear_pending(directory)
}

fn credential_ids(store: &Store) -> Result<BTreeSet<String>> {
    let mut statement = store.connection.prepare(
        "SELECT credential_id FROM ai_config
         UNION SELECT hosted_credential_id FROM ai_config
         UNION SELECT groq_credential_id FROM ai_config
         UNION SELECT custom_credential_id FROM ai_config
         UNION SELECT id FROM credential_cleanup",
    )?;
    let mut ids = store
        .credential_writes
        .iter()
        .cloned()
        .collect::<BTreeSet<_>>();
    for row in statement.query_map([], |row| row.get::<_, Option<String>>(0))? {
        if let Some(id) = row? {
            ids.insert(id);
        }
    }
    Ok(ids)
}

/// Erases every secret and the data directory, keeping the record of what the next
/// launch still has to clear. Split from the command so the case that matters most
/// — a refused workspace, where no store exists — is covered by a test rather than
/// only by the running app. Credential removal is injected so a test never touches
/// the real keychain.
pub(crate) fn erase(
    data: &Path,
    ids: &BTreeSet<String>,
    remove: &mut dyn FnMut(&str) -> Result<()>,
) -> Result<()> {
    for id in ids {
        remove(id)?;
    }
    clear_directory(data, Some(PENDING))
}

/// Copy every workspace file into a new folder under `destination`, named for the
/// moment of the copy, and return that folder. The database may carry journal
/// files beside it, so every `skellyspeak.sqlite3*` file is copied, not only the main
/// one. Nothing in `data` is changed.
pub(crate) fn export_to(data: &Path, destination: &Path, stamp: u64) -> Result<PathBuf> {
    let folder = destination.join(format!("skellyspeak-backup-{stamp}"));
    std::fs::create_dir_all(&folder).map_err(|error| {
        storage_error(format!("Could not create {}: {error}", folder.display()))
    })?;
    let mut copied = 0;
    let entries = std::fs::read_dir(data)
        .map_err(|error| storage_error(format!("Could not read local data: {error}")))?;
    for entry in entries {
        let entry =
            entry.map_err(|error| storage_error(format!("Could not read local data: {error}")))?;
        let name = entry.file_name();
        if !name
            .to_string_lossy()
            .starts_with(crate::store::WORKSPACE_FILE)
        {
            continue;
        }
        std::fs::copy(entry.path(), folder.join(&name)).map_err(|error| {
            storage_error(format!(
                "Could not copy {}: {error}",
                name.to_string_lossy()
            ))
        })?;
        copied += 1;
    }
    if copied == 0 {
        return Err(storage_error("There is no local workspace to save."));
    }
    Ok(folder)
}

/// Save a copy of the workspace to the Downloads folder: from Settings at any time,
/// and from the refusal screen before a reset. Returns the folder.
///
/// Every write goes through the store's lock, so holding it for the copy means no
/// write lands halfway through; the journal file is copied with the database. A
/// refused workspace has no store, and nothing can write to it.
#[tauri::command]
pub fn export_workspace(
    app: AppHandle,
    state: tauri::State<'_, std::sync::Arc<Application>>,
) -> Result<String> {
    let _writes = state
        .store
        .lock()
        .map_err(|_| storage_error("Local data is unavailable."))?;
    let data = app
        .path()
        .app_data_dir()
        .map_err(|error| storage_error(format!("Could not locate local data: {error}")))?;
    let downloads = app.path().download_dir().map_err(|error| {
        storage_error(format!("Could not locate the Downloads folder: {error}"))
    })?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| storage_error("The system clock is before 1970."))?
        .as_secs();
    Ok(export_to(&data, &downloads, stamp)?.display().to_string())
}

#[tauri::command]
pub fn factory_reset(
    app: AppHandle,
    state: tauri::State<'_, std::sync::Arc<Application>>,
    confirmation: String,
) -> Result<()> {
    if confirmation != "DELETE" {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Type DELETE to confirm deleting all local data.",
        ));
    }
    let data = app
        .path()
        .app_data_dir()
        .map_err(|error| storage_error(format!("Could not locate local data: {error}")))?;
    let logs = diagnostics::log_root()?;
    let _credential_operation = state.credential_operation()?;
    record_pending(&data, &[logs])?;
    // The identifiers normally live in the database. A refused workspace has no
    // database to read them from, so the index written before each secret is the
    // authority; when the workspace opens, both sources are erased from.
    let mut ids = credentials::indexed(&credentials::index_path(&data))?;
    if let Ok(store) = state.lock() {
        ids.extend(credential_ids(&store)?);
    }
    for webview in app.webview_windows().values() {
        webview
            .clear_all_browsing_data()
            .map_err(|error| storage_error(format!("Could not clear browser data: {error}")))?;
    }
    diagnostics::shutdown()?;
    state.stop(AppError::new(
        ErrorCode::Internal,
        "Local data was deleted.",
    ));
    if let Ok(store) = state.take_store() {
        drop(store);
    }
    erase(&data, &ids, &mut |id| credentials::remove(id))?;
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A path a clear cannot walk, standing in for a directory the webview holds.
    fn held(directory: &Path) -> PathBuf {
        let path = directory.join("held");
        std::fs::write(&path, "locked").unwrap();
        path
    }

    #[test]
    fn clears_nested_data_without_following_links() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(root.path().join("nested")).unwrap();
        std::fs::write(root.path().join("nested/data"), "private").unwrap();
        std::fs::write(outside.path().join("keep"), "outside").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(outside.path(), root.path().join("link")).unwrap();
        clear_directory(root.path(), None).unwrap();
        assert_eq!(std::fs::read_dir(root.path()).unwrap().count(), 0);
        assert!(outside.path().join("keep").exists());
    }

    #[test]
    fn a_refused_workspace_is_still_erasable_and_reopens_as_a_fresh_one() {
        let data = tempfile::tempdir().unwrap();
        let cache = tempfile::tempdir().unwrap();
        let logs = tempfile::tempdir().unwrap();
        let workspace = data.path().join("skellyspeak.sqlite3");
        drop(Store::open(&workspace).unwrap());
        {
            // An earlier schema: refused, and unreadable by this build.
            let connection = rusqlite::Connection::open(&workspace).unwrap();
            connection.pragma_update(None, "user_version", 8).unwrap();
        }
        assert!(Store::open(&workspace).is_err());
        // The identifier a reset needs cannot live only in the database.
        let index = credentials::index_path(data.path());
        credentials::remember(&index, "orphan-id").unwrap();
        std::fs::write(data.path().join("private"), "secret").unwrap();
        std::fs::write(cache.path().join("private"), "secret").unwrap();
        std::fs::write(logs.path().join("native.jsonl"), "secret").unwrap();

        record_pending(data.path(), &[cache.path().into(), logs.path().into()]).unwrap();
        let ids = credentials::indexed(&index)
            .unwrap()
            .into_iter()
            .chain(["live-id".to_string()])
            .collect::<BTreeSet<_>>();
        let mut removed: Vec<String> = Vec::new();
        erase(data.path(), &ids, &mut |id| {
            removed.push(id.to_owned());
            Ok(())
        })
        .unwrap();

        assert_eq!(
            removed,
            vec!["live-id".to_string(), "orphan-id".to_string()]
        );
        // The data directory is empty apart from the record of what is left.
        let left: Vec<String> = std::fs::read_dir(data.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(left, vec![PENDING.to_string()]);
        // The next launch finishes it, before any webview exists.
        finish_pending(data.path()).unwrap();
        assert_eq!(std::fs::read_dir(data.path()).unwrap().count(), 0);
        assert_eq!(std::fs::read_dir(cache.path()).unwrap().count(), 0);
        assert_eq!(std::fs::read_dir(logs.path()).unwrap().count(), 0);

        let store = Store::open(&workspace).unwrap();
        assert_eq!(
            store
                .connection
                .pragma_query_value(None, "user_version", |r| r.get::<_, i32>(0))
                .unwrap(),
            crate::store::SCHEMA_VERSION
        );
        assert!(store.snapshot().unwrap().contacts.is_empty());
    }

    #[test]
    fn a_derived_directory_that_still_cannot_be_cleared_is_reported_and_retried() {
        let data = tempfile::tempdir().unwrap();
        let cache = tempfile::tempdir().unwrap();
        let blocked = held(cache.path());
        record_pending(data.path(), std::slice::from_ref(&blocked)).unwrap();

        let error = finish_pending(data.path()).unwrap_err();
        assert!(
            error.message.contains("Could not finish clearing"),
            "{}",
            error.message
        );
        assert!(
            error.message.contains("held"),
            "the failure names the path: {}",
            error.message
        );
        // The record survives, so the next launch tries again instead of forgetting.
        assert_eq!(pending(data.path()).unwrap(), vec![blocked.clone()]);

        std::fs::remove_file(&blocked).unwrap();
        finish_pending(data.path()).unwrap();
        assert!(pending(data.path()).unwrap().is_empty());
        assert!(finish_pending(data.path()).is_ok());
    }
}

#[cfg(test)]
mod export_tests {
    use super::*;

    #[test]
    fn a_copy_takes_every_workspace_file_and_changes_nothing() {
        let data = tempfile::tempdir().unwrap();
        let downloads = tempfile::tempdir().unwrap();
        std::fs::write(data.path().join("skellyspeak.sqlite3"), b"database").unwrap();
        std::fs::write(data.path().join("skellyspeak.sqlite3-wal"), b"journal").unwrap();
        std::fs::write(data.path().join("credentials.index"), b"ids").unwrap();
        let folder = export_to(data.path(), downloads.path(), 42).unwrap();
        assert_eq!(folder, downloads.path().join("skellyspeak-backup-42"));
        assert_eq!(
            std::fs::read(folder.join("skellyspeak.sqlite3")).unwrap(),
            b"database"
        );
        assert_eq!(
            std::fs::read(folder.join("skellyspeak.sqlite3-wal")).unwrap(),
            b"journal"
        );
        assert!(!folder.join("credentials.index").exists());
        assert_eq!(
            std::fs::read(data.path().join("skellyspeak.sqlite3")).unwrap(),
            b"database"
        );
    }

    #[test]
    fn a_copy_without_a_workspace_is_refused() {
        let data = tempfile::tempdir().unwrap();
        let downloads = tempfile::tempdir().unwrap();
        assert_eq!(
            export_to(data.path(), downloads.path(), 1)
                .unwrap_err()
                .code,
            ErrorCode::Storage
        );
    }
}
