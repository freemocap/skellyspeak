//! Atomic replacement of application files.

use std::io::Write;
use std::path::Path;

pub fn write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("File has no parent directory")?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| format!("Could not create a temporary file in {}: {e}", parent.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        temporary.as_file().set_permissions(std::fs::Permissions::from_mode(0o600))
            .map_err(|_| "Could not restrict application file permissions.")?;
    }
    temporary.write_all(bytes).and_then(|_| temporary.as_file().sync_all())
        .map_err(|e| format!("Could not write {}: {e}", path.display()))?;
    temporary.persist(path)
        .map_err(|e| format!("Could not atomically replace {}: {e}", path.display()))?;
    Ok(())
}

pub fn read(path: &Path) -> Result<Option<String>, String> {
    match std::fs::read_to_string(path) {
        Ok(raw) => Ok(Some(raw)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Could not read {}: {e}", path.display())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn replacement_preserves_complete_files_and_read_errors_are_not_absence() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("settings.json");
        assert!(read(&file).unwrap().is_none());
        write(&file, b"one").unwrap();
        write(&file, b"two").unwrap();
        assert_eq!(read(&file).unwrap().unwrap(), "two");
        assert!(read(dir.path()).is_err());
        assert!(write(dir.path(), b"invalid").is_err());
        assert_eq!(read(&file).unwrap().unwrap(), "two");
    }
}
