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

// std::fs::File::try_lock is unsupported on Android in our Rust toolchain.
// flock is available there and keeps ownership tied to the open file description,
// including across cloned guards. Closing the last handle releases the lock.
fn try_lock_workspace(file: &std::fs::File) -> std::result::Result<(), std::fs::TryLockError> {
    #[cfg(unix)]
    {
        use std::os::fd::AsRawFd;
        // SAFETY: the live File owns this descriptor; flock takes no pointers.
        if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0 {
            return Ok(());
        }
        let error = std::io::Error::last_os_error();
        if error.kind() == std::io::ErrorKind::WouldBlock {
            Err(std::fs::TryLockError::WouldBlock)
        } else {
            Err(std::fs::TryLockError::Error(error))
        }
    }
    #[cfg(not(unix))]
    file.try_lock()
}

fn lock_error(error: std::fs::TryLockError) -> AppError {
    match error {
        std::fs::TryLockError::WouldBlock => AppError::new(
            ErrorCode::Conflict,
            "Another process holds this workspace lock. Close the other instance of this app and restart. Factory Reset is unavailable while that process owns the workspace.",
        ),
        std::fs::TryLockError::Error(error) => AppError::new(
            ErrorCode::Storage,
            format!("Could not acquire the workspace lock: {error}. This is a filesystem or operating-system error; another running instance has not been established."),
        ).with_diagnostics(serde_json::json!({
            "stage":"workspace_lock", "kind":format!("{:?}",error.kind()),
            "os_code":error.raw_os_error(),
        })),
    }
}

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
        try_lock_workspace(&lock).map_err(lock_error)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn operating_system_failures_are_not_reported_as_another_owner() {
        let error = lock_error(std::fs::TryLockError::Error(std::io::Error::from(
            std::io::ErrorKind::Unsupported,
        )));
        assert!(matches!(error.code, ErrorCode::Storage));
        assert!(
            error
                .message
                .contains("Could not acquire the workspace lock")
        );
        let details = error.diagnostics.unwrap();
        assert_eq!(details["stage"], "workspace_lock");
        assert_eq!(details["kind"], "Unsupported");
        assert!(matches!(
            lock_error(std::fs::TryLockError::WouldBlock).code,
            ErrorCode::Conflict
        ));
    }

    #[test]
    fn ownership_lasts_until_the_last_guard_is_dropped() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(WORKSPACE_FILE);
        let first = WorkspaceOwnership::acquire(&path).unwrap();
        let retained = first.clone();
        drop(first);
        let error = match WorkspaceOwnership::acquire(&path) {
            Err(error) => error,
            Ok(_) => panic!("acquired a workspace still owned by a retained guard"),
        };
        assert!(matches!(error.code, ErrorCode::Conflict));
        drop(retained);
        assert!(WorkspaceOwnership::acquire(&path).is_ok());
    }
}
