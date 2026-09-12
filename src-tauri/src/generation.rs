//! Volatile ownership for reviewable persona proposals. Durable inference receipts
//! attach at begin, dispatch and finish; request text and proposals stay volatile.
use crate::{access, execution, holds, model::*, persona, store::Store};
use std::{
    collections::HashMap,
    future::Future,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
use tokio::sync::Notify;

const CAPACITY: usize = 4;
const PENDING_TTL: Duration = Duration::from_secs(30);

pub struct Request {
    pub id: String,
    pub language_id: String,
    pub brief: Option<String>,
    pub target: access::ResolvedTarget,
    pub credential: String,
    pub install_id: String,
    pub attempt: String,
    pub operation: String,
    created: Instant,
    claimed: AtomicBool,
    submitted: AtomicBool,
    cancelled: AtomicBool,
    changed: Notify,
}
impl Request {
    pub fn capture(store: &Store, language_id: String, brief: Option<String>) -> Result<Self> {
        crate::languages::language(&language_id)?;
        if brief
            .as_deref()
            .is_some_and(|brief| brief.chars().count() > persona::BRIEF_MAX || brief.contains('\0'))
        {
            return Err(AppError::new(
                ErrorCode::Validation,
                format!(
                    "A generation brief must be at most {} characters.",
                    persona::BRIEF_MAX
                ),
            ));
        }
        let target = access::resolve(&store.connection, access::Capability::Chat)?;
        let credential = execution::active_credential(&store.connection)?.ok_or_else(|| {
            AppError::new(
                ErrorCode::Credential,
                "Configure the selected AI connection before generating a contact.",
            )
        })?;
        let (attempt, operation) = crate::generation_identity();
        let request = Self {
            id: uuid::Uuid::new_v4().to_string(),
            language_id,
            brief,
            target,
            credential,
            install_id: store.snapshot()?.learner.id,
            attempt,
            operation,
            created: Instant::now(),
            claimed: AtomicBool::new(false),
            submitted: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
            changed: Notify::new(),
        };
        request.validate(store)?;
        Ok(request)
    }
    pub fn was_submitted(&self) -> bool {
        self.submitted.load(Ordering::SeqCst)
    }
    pub fn mark_submitted(&self) {
        self.submitted.store(true, Ordering::SeqCst);
    }
    fn stopped(&self, reason: &str) -> AppError {
        if self.was_submitted() {
            AppError::new(
                ErrorCode::UnknownOutcome,
                format!(
                    "Persona generation stopped locally: {reason} Provider outcome and billing may be unknown. No automatic retry was made."
                ),
            )
        } else {
            AppError::new(
                ErrorCode::Conflict,
                format!("Persona generation was not submitted: {reason}"),
            )
        }
    }
    fn check_cancelled(&self) -> Result<()> {
        if self.cancelled.load(Ordering::SeqCst) {
            Err(self.stopped("cancelled"))
        } else {
            Ok(())
        }
    }
    pub fn validate(&self, store: &Store) -> Result<()> {
        self.check_cancelled()?;
        let config = execution::config(&store.connection)?;
        if config.paused {
            return Err(if self.was_submitted() {
                self.stopped("AI execution is paused")
            } else {
                AppError::new(
                    ErrorCode::AdmissionHeld,
                    "AI execution is paused. Resume AI execution before generating a contact.",
                )
            });
        }
        if config.revision != self.target.revision
            || config.route != self.target.route
            || execution::active_credential(&store.connection)?.as_deref() != Some(&self.credential)
        {
            return Err(self.stopped("connection authority changed"));
        }
        let current = access::resolve(&store.connection, access::Capability::Chat)?;
        if current.url != self.target.url
            || current.model != self.target.model
            || current.credential != self.target.credential
        {
            return Err(self.stopped("connection authority changed"));
        }
        if let Err(error) = holds::check(&store.connection, &self.target) {
            return Err(
                if self.was_submitted() && error.code == ErrorCode::AdmissionHeld {
                    self.stopped("AI access was held while generation was running")
                } else {
                    error
                },
            );
        }
        self.check_cancelled()
    }
}

/// Persist provider refusals before returning them. Checking the new self-hold
/// afterward would incorrectly replace the original refusal with AdmissionHeld.
pub fn accept_completion(
    store: &mut Store,
    request: &Request,
    outcome: &Result<crate::provider::Completion>,
) -> Result<()> {
    match outcome {
        Err(error) => {
            store.note_refusal(&request.target, error)?;
            Err(error.clone())
        }
        Ok(completion) => {
            request.validate(store)?;
            if completion.finish_reason != "stop" {
                return Err(AppError::new(
                    ErrorCode::Provider,
                    "The AI service did not finish the persona generation. Usage may have been incurred; no automatic retry was made.",
                ));
            }
            Ok(())
        }
    }
}

#[derive(Default)]
pub struct Registry {
    requests: Mutex<HashMap<String, Arc<Request>>>,
}
impl Registry {
    /// Return expired ownership for the caller's durable terminal receipts.
    pub fn expire(&self) -> Result<Vec<Arc<Request>>> {
        let mut requests = self.requests.lock().map_err(|_| crate::internal())?;
        let expired: Vec<_> = requests
            .values()
            .filter(|r| !r.claimed.load(Ordering::SeqCst) && r.created.elapsed() >= PENDING_TTL)
            .cloned()
            .collect();
        for request in &expired {
            requests.remove(&request.id);
        }
        Ok(expired)
    }
    pub fn insert(&self, request: Request) -> Result<Arc<Request>> {
        let mut requests = self.requests.lock().map_err(|_| crate::internal())?;
        if requests.len() >= CAPACITY {
            return Err(AppError::new(
                ErrorCode::AdmissionHeld,
                "Too many persona generations are pending. Close a pending generation or let it finish.",
            ));
        }
        let request = Arc::new(request);
        requests.insert(request.id.clone(), request.clone());
        Ok(request)
    }
    pub fn claim(&self, id: &str) -> Result<Run<'_>> {
        let requests = self.requests.lock().map_err(|_| crate::internal())?;
        let request = requests.get(id).ok_or_else(|| {
            AppError::new(
                ErrorCode::Conflict,
                "This persona generation is unavailable or expired. Start a new generation.",
            )
        })?;
        if request.claimed.swap(true, Ordering::SeqCst) {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "This persona generation has already been run.",
            ));
        }
        request.check_cancelled()?;
        Ok(Run {
            registry: self,
            request: request.clone(),
        })
    }
    pub fn cancel(&self, id: &str) -> Result<Option<Arc<Request>>> {
        let mut requests = self.requests.lock().map_err(|_| crate::internal())?;
        let Some(request) = requests.get(id).cloned() else {
            return Ok(None);
        };
        request.cancelled.store(true, Ordering::SeqCst);
        request.changed.notify_one();
        if !request.claimed.load(Ordering::SeqCst) {
            requests.remove(id);
        }
        Ok(Some(request))
    }
}

pub struct Run<'a> {
    registry: &'a Registry,
    pub request: Arc<Request>,
}
impl Drop for Run<'_> {
    fn drop(&mut self) {
        if let Ok(mut requests) = self.registry.requests.lock() {
            requests.remove(&self.request.id);
        }
    }
}

/// Cancels local credential/provider awaits promptly and checks mutable authority
/// even while a server is silent. The caller revalidates once more before adoption.
pub async fn await_checked<T>(
    request: &Request,
    future: impl Future<Output = T>,
    mut validate: impl FnMut() -> Result<()>,
) -> Result<T> {
    request.check_cancelled()?;
    validate()?;
    tokio::pin!(future);
    loop {
        tokio::select! {
            biased;
            _ = request.changed.notified() => { request.check_cancelled()?; },
            _ = tokio::time::sleep(Duration::from_millis(100)) => { request.check_cancelled()?; validate()?; },
            result = &mut future => return Ok(result),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;

    fn fixture() -> (tempfile::TempDir, Store) {
        let directory = tempfile::tempdir().unwrap();
        let store = Store::open(&directory.path().join("generation.sqlite3")).unwrap();
        store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl','http://127.0.0.1:8765/v1','$.bearerAuth',json('false'),'$.standardModel','fixture','$.fastModel','fixture')", []).unwrap();
        (directory, store)
    }
    fn capture(store: &Store) -> Request {
        Request::capture(store, "es".into(), Some("A quiet librarian".into())).unwrap()
    }

    #[test]
    fn pending_capacity_expiry_single_use_and_cancel_are_bounded() {
        let (_directory, store) = fixture();
        let registry = Registry::default();
        let mut ids = Vec::new();
        for _ in 0..CAPACITY {
            ids.push(registry.insert(capture(&store)).unwrap().id.clone());
        }
        assert!(registry.insert(capture(&store)).is_err());
        let run = registry.claim(&ids[0]).unwrap();
        assert!(registry.claim(&ids[0]).is_err());
        registry.cancel(&ids[0]).unwrap();
        assert_eq!(
            run.request.validate(&store).unwrap_err().code,
            ErrorCode::Conflict
        );
        drop(run);
        assert!(registry.claim(&ids[0]).is_err());
        registry.cancel(&ids[1]).unwrap();
        assert!(registry.claim(&ids[1]).is_err());
        let mut expired = capture(&store);
        expired.created = Instant::now() - PENDING_TTL;
        let expired = registry.insert(expired).unwrap();
        assert_eq!(registry.expire().unwrap()[0].id, expired.id);
        assert!(registry.claim(&expired.id).is_err());
        assert_eq!(registry.requests.lock().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn pause_authority_and_credential_changes_during_key_read_prevent_dispatch() {
        for change in [
            "UPDATE ai_config SET paused=1",
            "UPDATE ai_config SET revision=revision+1",
            "UPDATE ai_config SET custom_credential_id='replacement',custom_config=json_set(custom_config,'$.bearerAuth',json('true'))",
        ] {
            let (_directory, store) = fixture();
            let request = capture(&store);
            let provider_calls = AtomicUsize::new(0);
            let key = await_checked(
                &request,
                async {
                    store.connection.execute(change, []).unwrap();
                    "key"
                },
                || request.validate(&store),
            )
            .await
            .unwrap();
            assert_eq!(key, "key");
            let result = async {
                request.validate(&store)?;
                request.mark_submitted();
                provider_calls.fetch_add(1, Ordering::SeqCst);
                Ok::<_, AppError>(())
            }
            .await;
            assert!(result.is_err());
            assert!(!request.was_submitted());
            assert_eq!(provider_calls.load(Ordering::SeqCst), 0);
        }
    }

    #[tokio::test]
    async fn cancellation_during_key_read_prevents_provider_dispatch() {
        let (_directory, store) = fixture();
        let registry = Registry::default();
        let request = registry.insert(capture(&store)).unwrap();
        let run = registry.claim(&request.id).unwrap();
        let waiting = await_checked(&run.request, std::future::pending::<()>(), || {
            request.validate(&store)
        });
        tokio::pin!(waiting);
        assert!(
            tokio::time::timeout(Duration::from_millis(1), &mut waiting)
                .await
                .is_err()
        );
        registry.cancel(&request.id).unwrap();
        assert_eq!(waiting.await.unwrap_err().code, ErrorCode::Conflict);
        assert!(!request.was_submitted());
    }

    #[tokio::test]
    async fn cancellation_defeats_a_simultaneously_ready_late_provider_result() {
        let (_directory, store) = fixture();
        let registry = Registry::default();
        let request = registry.insert(capture(&store)).unwrap();
        let run = registry.claim(&request.id).unwrap();
        request.mark_submitted();
        let (send, receive) = tokio::sync::oneshot::channel();
        let waiting = await_checked(&run.request, receive, || request.validate(&store));
        tokio::pin!(waiting);
        assert!(
            tokio::time::timeout(Duration::from_millis(1), &mut waiting)
                .await
                .is_err()
        );
        send.send("late proposal").unwrap();
        registry.cancel(&request.id).unwrap();
        assert_eq!(waiting.await.unwrap_err().code, ErrorCode::UnknownOutcome);
    }

    #[tokio::test]
    async fn silent_provider_is_revoked_on_pause_and_result_adoption_rechecks_authority() {
        let (_directory, store) = fixture();
        let request = capture(&store);
        request.mark_submitted();
        let waiting = await_checked(&request, std::future::pending::<()>(), || {
            request.validate(&store)
        });
        tokio::pin!(waiting);
        assert!(
            tokio::time::timeout(Duration::from_millis(1), &mut waiting)
                .await
                .is_err()
        );
        store
            .connection
            .execute("UPDATE ai_config SET paused=1", [])
            .unwrap();
        assert_eq!(
            tokio::time::timeout(Duration::from_millis(250), waiting)
                .await
                .unwrap()
                .unwrap_err()
                .code,
            ErrorCode::UnknownOutcome
        );
        store
            .connection
            .execute("UPDATE ai_config SET paused=0", [])
            .unwrap();
        let proposal = await_checked(
            &request,
            async {
                store
                    .connection
                    .execute("UPDATE ai_config SET revision=revision+1", [])
                    .unwrap();
                "proposal"
            },
            || request.validate(&store),
        )
        .await
        .unwrap();
        assert_eq!(proposal, "proposal");
        assert_eq!(
            request.validate(&store).unwrap_err().code,
            ErrorCode::UnknownOutcome
        );
    }

    #[test]
    fn own_refusal_is_preserved_and_a_later_shared_hold_marks_dispatched_work_unknown() {
        let (_directory, mut store) = fixture();
        let request = capture(&store);
        request.mark_submitted();
        let error = AppError::new(ErrorCode::Provider, "Original provider refusal")
            .with_refusal(crate::refusal::classify(None, Some(60), None));
        let result = accept_completion(&mut store, &request, &Err(error.clone())).unwrap_err();
        assert_eq!(result.code, ErrorCode::Provider);
        assert_eq!(result.message, error.message);
        assert!(result.refusal.is_some());
        assert_eq!(
            request.validate(&store).unwrap_err().code,
            ErrorCode::UnknownOutcome
        );
        assert!(matches!(
            Request::capture(&store, "es".into(), None),
            Err(AppError {
                code: ErrorCode::AdmissionHeld,
                ..
            })
        ));
    }

    #[test]
    fn paused_or_held_authority_never_begins_and_refusals_block_followups() {
        let (_directory, store) = fixture();
        store
            .connection
            .execute("UPDATE ai_config SET paused=1", [])
            .unwrap();
        assert!(matches!(
            Request::capture(&store, "es".into(), None),
            Err(AppError {
                code: ErrorCode::AdmissionHeld,
                ..
            })
        ));
        store
            .connection
            .execute("UPDATE ai_config SET paused=0", [])
            .unwrap();
        let request = capture(&store);
        let error = AppError::new(ErrorCode::Provider, "Request rate limited")
            .with_refusal(crate::refusal::classify(None, Some(60), None));
        holds::record(&store.connection, &request.target, &error).unwrap();
        assert!(matches!(
            Request::capture(&store, "es".into(), None),
            Err(AppError {
                code: ErrorCode::AdmissionHeld,
                ..
            })
        ));
    }
}
