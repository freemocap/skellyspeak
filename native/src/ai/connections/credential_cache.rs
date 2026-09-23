//! macOS process-only reuse of credentials already authorized through Keychain.
//! Never persisted or logged. Save/delete invalidate under the same lock as reads.
use crate::model::{AppError, ErrorCode, Result};
use std::collections::BTreeMap;
use std::sync::{LazyLock, Mutex};
use zeroize::Zeroizing;

pub(super) static CACHE: LazyLock<CredentialCache> = LazyLock::new(CredentialCache::default);

#[derive(Default)]
pub(super) struct CredentialCache(Mutex<BTreeMap<String, Zeroizing<String>>>);

impl CredentialCache {
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, BTreeMap<String, Zeroizing<String>>>> {
        self.0.lock().map_err(|_| {
            AppError::new(
                ErrorCode::Credential,
                "Credential memory is unavailable. Restart the app.",
            )
        })
    }

    pub(super) fn read(
        &self,
        id: &str,
        load: impl FnOnce() -> Result<Zeroizing<String>>,
    ) -> Result<Zeroizing<String>> {
        // Serialize misses: simultaneous UI refreshes must not stack OS prompts.
        let mut entries = self.lock()?;
        if let Some(secret) = entries.get(id) {
            return Ok(secret.clone());
        }
        let secret = load()?;
        // Bound retained hosted/custom secrets across workspaces.
        if entries.len() >= 8 {
            entries.clear();
        }
        entries.insert(id.into(), secret.clone());
        Ok(secret)
    }

    pub(super) fn mutate(&self, id: &str, action: impl FnOnce() -> Result<()>) -> Result<()> {
        let mut entries = self.lock()?;
        // Also discard on failure; never serve a stale value after a mutation attempt.
        entries.remove(id);
        action()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reuses_authorized_reads_and_invalidates_on_successful_and_failed_changes() {
        let cache = CredentialCache::default();
        cache
            .read("a", || Ok(Zeroizing::new("fixture".into())))
            .unwrap();
        assert_eq!(
            &*cache
                .read("a", || panic!("must not re-read Keychain"))
                .unwrap(),
            "fixture"
        );
        cache.mutate("a", || Ok(())).unwrap();
        assert_eq!(
            &*cache
                .read("a", || Ok(Zeroizing::new("replacement".into())))
                .unwrap(),
            "replacement"
        );
        assert!(
            cache
                .mutate("a", || Err(AppError::new(ErrorCode::Credential, "denied")))
                .is_err()
        );
        assert!(
            cache
                .read("a", || Err(AppError::new(ErrorCode::Credential, "missing")))
                .is_err()
        );
    }
    #[test]
    fn failures_are_not_cached_and_retention_is_bounded() {
        let cache = CredentialCache::default();
        assert!(
            cache
                .read("a", || Err(AppError::new(ErrorCode::Credential, "denied")))
                .is_err()
        );
        cache
            .read("a", || Ok(Zeroizing::new("fixture".into())))
            .unwrap();
        for id in 0..20 {
            cache
                .read(&id.to_string(), || Ok(Zeroizing::new("fixture".into())))
                .unwrap();
        }
        assert!(cache.lock().unwrap().len() <= 8);
    }
    #[test]
    fn concurrent_requests_only_prompt_once() {
        let cache = CredentialCache::default();
        let calls = std::sync::atomic::AtomicUsize::new(0);
        std::thread::scope(|scope| {
            for _ in 0..8 {
                scope.spawn(|| {
                    cache
                        .read("a", || {
                            calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                            Ok(Zeroizing::new("fixture".into()))
                        })
                        .unwrap();
                });
            }
        });
        assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
    }
}
