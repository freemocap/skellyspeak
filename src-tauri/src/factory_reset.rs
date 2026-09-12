//! Irreversible local reset. Data is erased before the process exits.
use crate::{
    Application, Store, credentials, diagnostics,
    model::{AppError, ErrorCode, Result},
};
use std::{collections::BTreeSet, path::Path};
use tauri::{AppHandle, Manager};

fn storage_error(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::Storage, message.into())
}

fn clear_directory(directory: &Path) -> Result<()> {
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
    let _credential_operation = state.credential_operation()?;
    let store = state.lock()?;
    let ids = credential_ids(&store)?;
    drop(store);
    for id in ids {
        credentials::remove(&id)?;
    }

    for webview in app.webview_windows().values() {
        webview
            .clear_all_browsing_data()
            .map_err(|error| storage_error(format!("Could not clear browser data: {error}")))?;
    }
    let data = app
        .path()
        .app_data_dir()
        .map_err(|error| storage_error(format!("Could not locate local data: {error}")))?;
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|error| storage_error(format!("Could not locate local cache: {error}")))?;
    let logs = diagnostics::log_root()?;
    diagnostics::shutdown()?;
    state.stop(AppError::new(
        ErrorCode::Internal,
        "Local data was deleted.",
    ));
    drop(state.take_store()?);
    for directory in [data, cache, logs] {
        clear_directory(&directory)?;
    }
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn clears_nested_data_without_following_links() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(root.path().join("nested")).unwrap();
        std::fs::write(root.path().join("nested/data"), "private").unwrap();
        std::fs::write(outside.path().join("keep"), "outside").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(outside.path(), root.path().join("link")).unwrap();
        clear_directory(root.path()).unwrap();
        assert_eq!(std::fs::read_dir(root.path()).unwrap().count(), 0);
        assert!(outside.path().join("keep").exists());
    }
}
