use super::*;

pub(crate) fn prepare_private_directory(path: &Path) -> std::io::Result<()> {
    let mut builder = std::fs::DirBuilder::new();
    builder.recursive(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder.create(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if std::fs::symlink_metadata(path)?.file_type().is_symlink() {
            return Err(std::io::Error::other(
                "Application data directory cannot be a symbolic link.",
            ));
        }
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

/// The workspace database, inside the application data directory.
pub(crate) const WORKSPACE_FILE: &str = "skellyspeak.sqlite3";

/// A stable lock inode. Reset must retain this guard and leave the lock file in
/// place, including after closing SQLite, so a second process cannot enter.
#[derive(Clone)]
pub(crate) struct WorkspaceOwnership {
    _file: std::sync::Arc<std::fs::File>,
}

pub(crate) const WORKSPACE_LOCK: &str = "skellyspeak.lock";

impl WorkspaceOwnership {
    pub(crate) fn acquire(path: &Path) -> Result<Self> {
        let lock_path = path.with_extension("lock");
        if std::fs::symlink_metadata(&lock_path)
            .is_ok_and(|m| !m.is_file() || m.file_type().is_symlink())
        {
            return Err(AppError::new(
                ErrorCode::Storage,
                "Workspace lock is not a regular file.",
            ));
        }
        let mut options = std::fs::OpenOptions::new();
        options.read(true).write(true).create(true).truncate(false);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let lock = options
            .open(lock_path)
            .map_err(|e| AppError::new(ErrorCode::Storage, e.to_string()))?;
        lock.try_lock().map_err(|_| AppError::new(
            ErrorCode::Conflict,
            "The workspace is already open or cannot be locked. Close other instances and restart the app.",
        ))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            lock.set_permissions(std::fs::Permissions::from_mode(0o600))
                .map_err(|e| AppError::new(ErrorCode::Storage, e.to_string()))?;
        }
        Ok(Self {
            _file: std::sync::Arc::new(lock),
        })
    }
}

impl Store {
    pub(crate) fn ownership(&self) -> WorkspaceOwnership {
        self.ownership.clone()
    }
}
