//! One native inference pool, independent of route, model and window.
#[cfg(any(desktop, test))]
use crate::model::{AppError, ErrorCode, Result};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

// Provisional policy, not a provider guarantee. Tune from actual queue waits.
pub const NETWORK_CAPACITY: usize = 4;
#[cfg(any(desktop, test))]
const AUDIO_WAITING_CAPACITY: usize = 1;
const WARNING_INTERVAL: Duration = Duration::from_secs(60);

struct Warnings {
    last: Mutex<[Option<Instant>; 3]>,
}

impl Warnings {
    fn allow(&self, event: usize, now: Instant) -> bool {
        let mut last = self.last.lock().expect("admission diagnostics mutex");
        if last[event].is_some_and(|previous| now.duration_since(previous) < WARNING_INTERVAL) {
            return false;
        }
        last[event] = Some(now);
        true
    }
}

pub struct Admission {
    network: Arc<Semaphore>,
    warnings: Warnings,
    // Chat waits durably in SQLite. Audio is volatile and must not accumulate
    // an unbounded collection of recordings while waiting for network capacity.
    #[cfg(any(desktop, test))]
    audio_waiters: Arc<Semaphore>,
}

impl Admission {
    pub fn new() -> Self {
        Self::with_capacity(NETWORK_CAPACITY)
    }

    fn with_capacity(capacity: usize) -> Self {
        assert!(capacity > 0);
        Self {
            network: Arc::new(Semaphore::new(capacity)),
            warnings: Warnings {
                last: Mutex::new([None; 3]),
            },
            #[cfg(any(desktop, test))]
            audio_waiters: Arc::new(Semaphore::new(AUDIO_WAITING_CAPACITY)),
        }
    }

    // Called only when eligible work is actually waiting, never on idle polls.
    pub fn warn_chat_wait(&self) {
        if self.warnings.allow(0, Instant::now()) {
            eprintln!("WARN ai_admission event=chat_capacity_wait limit={NETWORK_CAPACITY}");
        }
    }

    pub fn try_chat(&self) -> Option<OwnedSemaphorePermit> {
        self.network.clone().try_acquire_owned().ok()
    }

    #[cfg(any(desktop, test))]
    pub async fn audio(
        &self,
        mut validate: impl FnMut() -> Result<()>,
    ) -> Result<OwnedSemaphorePermit> {
        validate()?;
        let waiting = self.audio_waiters.clone().try_acquire_owned().map_err(|_| {
            if self.warnings.allow(1, Instant::now()) {
                eprintln!("WARN ai_admission event=audio_queue_full limit={AUDIO_WAITING_CAPACITY}");
            }
            AppError::new(
                ErrorCode::Provider,
                "Another recording is waiting for AI capacity. This recording was not submitted. Wait for transcription before recording again.",
            )
        })?;
        let started = Instant::now();
        let acquire = self.network.clone().acquire_owned();
        tokio::pin!(acquire);
        let permit = loop {
            tokio::select! {
                result = &mut acquire => break result.map_err(|_| AppError::new(
                    ErrorCode::Internal, "AI request admission is unavailable."
                ))?,
                _ = tokio::time::sleep(std::time::Duration::from_millis(100)) => validate()?,
            }
        };
        // Settings/source changes while queued must defeat dispatch even if the
        // permit and invalidation become ready together.
        validate()?;
        drop(waiting);
        let waited = started.elapsed();
        if waited >= Duration::from_millis(100) && self.warnings.allow(2, Instant::now()) {
            eprintln!(
                "WARN ai_admission event=audio_capacity_wait wait_ms={} limit={NETWORK_CAPACITY}",
                waited.as_millis()
            );
        }
        Ok(permit)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;

    #[tokio::test]
    async fn mixed_work_shares_capacity_and_waiting_audio_is_not_starved() {
        let admission = Admission::with_capacity(2);
        let partner = admission.try_chat().unwrap();
        let coach = admission.try_chat().unwrap();
        let audio = admission.audio(|| Ok(()));
        tokio::pin!(audio);
        assert!(
            tokio::time::timeout(Duration::from_millis(10), &mut audio)
                .await
                .is_err()
        );
        assert!(admission.try_chat().is_none());
        assert!(admission.audio(|| Ok(())).await.is_err());
        drop(partner);
        // Tokio reserves released capacity for the existing waiter.
        assert!(admission.try_chat().is_none());
        let transcription = audio.await.unwrap();
        assert!(admission.try_chat().is_none());
        drop(coach);
        let another_route = admission.try_chat().unwrap();
        assert!(admission.try_chat().is_none());
        drop((transcription, another_route));
        assert!(admission.try_chat().is_some());
    }

    #[tokio::test]
    async fn invalidation_while_waiting_releases_queue_slot_without_dispatch() {
        let admission = Admission::with_capacity(2);
        let first = admission.try_chat().unwrap();
        let second = admission.try_chat().unwrap();
        let valid = AtomicBool::new(true);
        let audio = admission.audio(|| {
            if valid.load(Ordering::SeqCst) {
                Ok(())
            } else {
                Err(AppError::new(ErrorCode::Conflict, "Connection changed."))
            }
        });
        tokio::pin!(audio);
        assert!(
            tokio::time::timeout(Duration::from_millis(10), &mut audio)
                .await
                .is_err()
        );
        valid.store(false, Ordering::SeqCst);
        assert!(audio.await.is_err());
        drop((first, second));
        assert!(admission.audio(|| Ok(())).await.is_ok());
    }

    #[tokio::test]
    async fn dropping_waiter_or_active_request_releases_capacity() {
        let admission = Admission::with_capacity(2);
        let first = admission.try_chat().unwrap();
        let second = admission.try_chat().unwrap();
        // Timeout owns and drops this future, unlike the borrowed future above.
        assert!(
            tokio::time::timeout(Duration::from_millis(10), admission.audio(|| Ok(())))
                .await
                .is_err()
        );
        drop((first, second));
        let audio = admission.audio(|| Ok(())).await.unwrap();
        let chat = admission.try_chat().unwrap();
        assert!(admission.try_chat().is_none());
        drop(audio);
        assert!(admission.try_chat().is_some());
        drop(chat);
    }

    #[test]
    fn production_capacity_is_shared_and_reusable() {
        let admission = Admission::new();
        let permits: Vec<_> = (0..NETWORK_CAPACITY)
            .map(|_| admission.try_chat().unwrap())
            .collect();
        assert!(admission.try_chat().is_none());
        drop(permits);
        let permits: Vec<_> = (0..NETWORK_CAPACITY)
            .map(|_| admission.try_chat().unwrap())
            .collect();
        assert_eq!(permits.len(), NETWORK_CAPACITY);
    }

    #[test]
    fn warning_storm_is_bounded_without_suppressing_other_events() {
        let warnings = Warnings {
            last: Mutex::new([None; 3]),
        };
        let now = Instant::now();
        assert!(warnings.allow(0, now));
        for _ in 0..10000 {
            assert!(!warnings.allow(0, now));
        }
        assert!(warnings.allow(1, now));
        assert!(warnings.allow(2, now));
        assert!(!warnings.allow(0, now + WARNING_INTERVAL - Duration::from_millis(1)));
        assert!(warnings.allow(0, now + WARNING_INTERVAL));
    }
}
