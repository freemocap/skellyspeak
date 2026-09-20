use super::*;

pub(crate) struct Application {
    pub(super) reading: crate::language::reading::Registry,
    pub(crate) admission: admission::Admission,
    pub(super) generations: generation::Registry,
    pub(crate) capture: Mutex<Option<voice::Recording>>,
    pub(crate) store: Mutex<Option<Store>>,
    /// Why the workspace could not be opened at startup. Commands report it
    /// rather than a generic failure, and the window stays open so the reason
    /// reaches the screen and the reset stays reachable.
    pub(super) refusal: Mutex<Option<AppError>>,
    /// A cleanup a previous reset recorded that this launch could not finish.
    pub(super) cleanup: Mutex<Option<AppError>>,
    pub(super) credential_cleanup: Mutex<Option<AppError>>,
    pub(super) credential_operations: Mutex<()>,
    pub(super) fatal: Mutex<Option<AppError>>,
    pub(super) signing_in: tokio::sync::Mutex<()>,
    pub(super) auth_epoch: std::sync::atomic::AtomicU64,
    /// The AI View's place, kept while it moves between the panel and its window.
    pub(super) ai_view_selection: Mutex<Option<crate::model::AiViewSelection>>,
    /// Streamed text of running attempts, between the transport and windows.
    pub(super) streams: Mutex<super::streams::StreamRegistry>,
    /// Whether each grouped target (URL, connection revision) speaks protocol
    /// version 2. Only successful answers are kept; a failed probe is retried.
    pub(super) delta_support: Mutex<std::collections::HashMap<(String, i32), bool>>,
}
pub(crate) struct StoreGuard<'a>(MutexGuard<'a, Option<Store>>);
impl Deref for StoreGuard<'_> {
    type Target = Store;
    fn deref(&self) -> &Self::Target {
        self.0.as_ref().expect("application store is unavailable")
    }
}
impl DerefMut for StoreGuard<'_> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.0.as_mut().expect("application store is unavailable")
    }
}
impl Application {
    /// Open the workspace without ever aborting the launch. A refused database is
    /// an ordinary outcome, and it has to reach a screen that can reset it.
    /// `cleanup` is the failure, if any, of finishing a previous reset; the caller
    /// runs that before the log sink opens, because the log directory is part of it.
    pub(super) fn start(workspace: &std::path::Path, cleanup: Option<AppError>) -> Arc<Self> {
        let (store, refusal) = match Store::open(workspace) {
            Ok(store) => (Some(store), None),
            Err(error) => (None, Some(error)),
        };
        Arc::new(Self {
            admission: admission::Admission::new(),
            reading: Default::default(),
            generations: generation::Registry::default(),
            capture: Mutex::new(None),
            store: Mutex::new(store),
            refusal: Mutex::new(refusal),
            cleanup: Mutex::new(cleanup),
            credential_cleanup: Mutex::new(None),
            credential_operations: Mutex::new(()),
            fatal: Mutex::new(None),
            signing_in: tokio::sync::Mutex::new(()),
            auth_epoch: std::sync::atomic::AtomicU64::new(0),
            ai_view_selection: Mutex::new(None),
            // Seconds since the epoch: a later launch always has a higher
            // generation, so windows adopt it and drop anything older.
            streams: Mutex::new(super::streams::StreamRegistry::new(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|elapsed| elapsed.as_secs() as u32)
                    .unwrap_or(1),
            )),
            delta_support: Mutex::new(std::collections::HashMap::new()),
        })
    }
    pub(super) fn refusal(&self) -> Option<AppError> {
        self.refusal.lock().ok().and_then(|value| value.clone())
    }
    pub(super) fn startup_state(&self) -> StartupState {
        StartupState {
            refusal: self.refusal(),
            cleanup: self.cleanup.lock().ok().and_then(|value| value.clone()),
            credential_cleanup: self
                .credential_cleanup
                .lock()
                .ok()
                .and_then(|value| value.clone()),
        }
    }
    pub(crate) fn lock(&self) -> Result<StoreGuard<'_>> {
        if let Some(error) = self.fatal.lock().map_err(|_| internal())?.as_ref() {
            return Err(error.clone());
        }
        let store = self.store.lock().map_err(|_| internal())?;
        if store.is_none() {
            if let Some(error) = self.refusal.lock().map_err(|_| internal())?.as_ref() {
                return Err(error.clone());
            }
            return Err(internal());
        }
        Ok(StoreGuard(store))
    }
    pub(crate) fn credential_operation(&self) -> Result<MutexGuard<'_, ()>> {
        self.credential_operations.lock().map_err(|_| internal())
    }
    fn clean_credentials_with(&self, remove: impl Fn(&str) -> Result<()>) -> Result<()> {
        loop {
            let id = self.lock()?.claim_credential_cleanup()?;
            let Some(id) = id else {
                return Ok(());
            };
            // A claimed unique ID cannot be reused while the external call blocks.
            let result = remove(&id);
            self.lock()?
                .finish_credential_cleanup(&id, result.is_ok())?;
            result?;
        }
    }
    pub(crate) fn clean_credentials(&self) -> Result<()> {
        self.clean_credentials_with(credentials::remove)
    }
    pub(super) fn recover_credential_cleanup_with(
        &self,
        remove: impl Fn(&str) -> Result<()>,
    ) -> Result<StartupState> {
        let _operation = self.credential_operation()?;
        let error = match self.clean_credentials_with(remove) {
            Ok(()) => None,
            Err(error) if error.code == ErrorCode::Credential => Some(error),
            Err(error) => return Err(error),
        };
        *self.credential_cleanup.lock().map_err(|_| internal())? = error;
        Ok(self.startup_state())
    }
    pub(crate) fn write_credential_with<T>(
        &self,
        prepare: impl FnOnce(&mut Store) -> Result<()>,
        write: impl FnOnce(&str) -> Result<()>,
        commit: impl FnOnce(&mut Store, &str) -> Result<T>,
        remove: impl Fn(&str) -> Result<()>,
    ) -> Result<T> {
        let _credential_operation = self.credential_operation()?;
        let id = uuid::Uuid::new_v4().to_string();
        {
            let mut store = self.lock()?;
            prepare(&mut store)?;
            // Durable before the secret exists: a reset that cannot read the
            // database still has to be able to find every keychain entry.
            credentials::remember(&store.credential_index, &id)?;
            store.reserve_credential(&id)?;
        }
        let written = write(&id);
        let result = {
            let mut store = self.lock()?;
            store.credential_writes.remove(&id);
            written.and_then(|_| commit(&mut store, &id))
        };
        self.clean_credentials_with(remove)?;
        result
    }
    pub(crate) fn stop(&self, error: AppError) {
        *self.fatal.lock().expect("execution fault mutex") = Some(error);
    }
}

#[cfg(test)]
#[path = "tests/credential_io.rs"]
mod tests;
