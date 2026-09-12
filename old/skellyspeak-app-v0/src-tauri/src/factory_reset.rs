//! Reset at startup, before workers and persistence can recreate erased data.
use std::path::Path;
use tauri::Manager;

const MARKER: &str = ".factory-reset";

#[tauri::command]
pub fn factory_reset(app: tauri::AppHandle, state: tauri::State<'_, crate::AppState>, confirmation: String) -> Result<(), String> {
    if confirmation != "DELETE" { return Err("Type DELETE to confirm the factory reset.".into()); }
    let marker = state.config_dir.join(MARKER);
    let file = tempfile::NamedTempFile::new_in(&state.config_dir).map_err(|e| format!("Could not schedule reset: {e}"))?;
    file.as_file().sync_all().map_err(|e| format!("Could not persist reset request: {e}"))?;
    file.persist(&marker).map_err(|e| format!("Could not activate reset request: {e}"))?;
    app.exit(0);
    Ok(())
}

fn clear_directory(dir: &Path, keep_marker: bool) -> Result<(), String> {
    let metadata = match std::fs::symlink_metadata(dir) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Could not inspect {}: {error}", dir.display())),
    };
    if !metadata.is_dir() || metadata.is_symlink() { return Err(format!("Reset directory must be a real directory: {}", dir.display())); }
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if keep_marker && entry.file_name() == MARKER { continue; }
        let path = entry.path();
        let kind = entry.file_type().map_err(|e| e.to_string())?;
        let result = if kind.is_dir() { std::fs::remove_dir_all(&path) } else { std::fs::remove_file(&path) };
        result.map_err(|e| format!("Could not erase {}: {e}", path.display()))?;
    }
    Ok(())
}

pub fn complete(app: &tauri::AppHandle, config: &Path) -> Result<(), String> {
    if !config.join(MARKER).try_exists().map_err(|e| e.to_string())? { return Ok(()); }
    crate::credentials::clear(config)?;
    // Keep the request until every step succeeds; an interrupted reset retries.
    clear_directory(config, true)?;
    for dir in [app.path().app_cache_dir(), app.path().app_log_dir()] {
        let dir = dir.map_err(|e| e.to_string())?;
        if dir != config { clear_directory(&dir, false)?; }
    }
    for webview in app.webview_windows().values() {
        webview.clear_all_browsing_data().map_err(|e| format!("Could not clear browser storage: {e}"))?;
    }
    std::fs::remove_file(config.join(MARKER)).map_err(|e| format!("Could not complete reset: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reset_removes_nested_data_but_preserves_request_until_completion() {
        let root = tempfile::tempdir().unwrap();
        std::fs::write(root.path().join(MARKER), "").unwrap();
        let chats = root.path().join("conversations/chat");
        std::fs::create_dir_all(&chats).unwrap();
        std::fs::write(chats.join("evidence.json"), "private").unwrap();
        std::fs::write(root.path().join("settings.json"), "private").unwrap();
        clear_directory(root.path(), true).unwrap();
        assert!(root.path().join(MARKER).exists());
        assert_eq!(std::fs::read_dir(root.path()).unwrap().count(), 1);
        clear_directory(root.path(), true).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn reset_does_not_follow_links_outside_app_storage() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::fs::write(outside.path().join("keep"), "private").unwrap();
        std::os::unix::fs::symlink(outside.path(), root.path().join("link")).unwrap();
        clear_directory(root.path(), true).unwrap();
        assert!(outside.path().join("keep").exists());
        std::os::unix::fs::symlink(outside.path(), root.path().join("link")).unwrap();
        assert!(clear_directory(&root.path().join("link"), false).is_err());
    }
}
