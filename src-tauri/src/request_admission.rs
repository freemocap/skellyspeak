//! Shared inference capacity and explicit recovery after an account/provider refusal.
use std::{collections::HashMap, sync::{Mutex, OnceLock}};
use tokio::sync::{Semaphore, SemaphorePermit};

const CONCURRENT: usize = 4;
const OUTSTANDING: usize = 64;
pub struct Admission {
    slots: Semaphore,
    outstanding: Semaphore,
    endpoints: Mutex<HashMap<String, (u64, bool)>>,
}
pub struct Permit<'a> {
    _slot: SemaphorePermit<'a>,
    _outstanding: SemaphorePermit<'a>,
}
impl Default for Admission {
    fn default() -> Self {
        Self { slots: Semaphore::new(CONCURRENT), outstanding: Semaphore::new(OUTSTANDING), endpoints: Mutex::new(HashMap::new()) }
    }
}
fn endpoint(url: &str) -> &str {
    url.strip_suffix("/chat/completions").or_else(|| url.strip_suffix("/audio/transcriptions")).unwrap_or(url).trim_end_matches('/')
}
impl Admission {
    pub async fn acquire(&self, url: &str) -> Result<Permit<'_>, String> {
        let outstanding = self.outstanding.try_acquire().map_err(|_| "AI request queue is full. No request was sent.")?;
        let key = endpoint(url);
        let generation = {
            let mut endpoints = self.endpoints.lock().map_err(|_| "AI admission state unavailable.")?;
            if !endpoints.contains_key(key) && endpoints.len() >= 64 { return Err("AI endpoint limit reached. Restart the application.".into()); }
            let (generation, held) = endpoints.entry(key.to_owned()).or_default();
            if *held { return Err("AI access is paused after a refusal. Check sign-in or allowance, then use Resume in the AI panel. No automatic retry was made.".into()); }
            *generation
        };
        let slot = self.slots.acquire().await.map_err(|_| "AI admission stopped.")?;
        let endpoints = self.endpoints.lock().map_err(|_| "AI admission state unavailable.")?;
        if endpoints.get(key) != Some(&(generation, false)) {
            return Err("Queued AI request cancelled because access was refused or explicitly resumed. Retry the action explicitly.".into());
        }
        Ok(Permit { _slot: slot, _outstanding: outstanding })
    }
    pub fn refuse(&self, url: &str, status: u16) {
        if !matches!(status, 401 | 402 | 403 | 429) { return; }
        let mut endpoints = self.endpoints.lock().expect("AI admission lock poisoned");
        let entry = endpoints.entry(endpoint(url).to_owned()).or_default();
        entry.0 = entry.0.wrapping_add(1);
        entry.1 = true;
        drop(endpoints);
        crate::gate::pause();
    }
    pub fn invalidate(&self) {
        let mut endpoints = self.endpoints.lock().expect("AI admission lock poisoned");
        for entry in endpoints.values_mut() { entry.0 = entry.0.wrapping_add(1); }
    }
    pub fn resume(&self) {
        let mut endpoints = self.endpoints.lock().expect("AI admission lock poisoned");
        for entry in endpoints.values_mut() {
            if entry.1 { entry.0 = entry.0.wrapping_add(1); entry.1 = false; }
        }
    }
}
pub fn shared() -> &'static Admission {
    static VALUE: OnceLock<Admission> = OnceLock::new();
    VALUE.get_or_init(Admission::default)
}

static TURNS: OnceLock<Mutex<std::collections::HashSet<String>>> = OnceLock::new();
pub struct ActiveTurn(String);
pub fn active_turn(chat: &str) -> Result<ActiveTurn, String> {
    let mut turns = TURNS.get_or_init(Default::default).lock().map_err(|_| "Turn admission unavailable.")?;
    if !turns.insert(chat.to_owned()) { return Err("This conversation already has a reply in progress.".into()); }
    Ok(ActiveTurn(chat.to_owned()))
}
impl Drop for ActiveTurn {
    fn drop(&mut self) {
        if let Some(turns) = TURNS.get() { turns.lock().expect("Turn admission lock poisoned").remove(&self.0); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn hosted_chat_and_audio_preserve_four_concurrent_calls() {
        let state = Admission::default();
        let base = crate::settings::HOSTED_BASE_URL;
        let audio_url = format!("{base}/audio/transcriptions");
        let chat_url = format!("{base}/chat/completions");
        let mut permits = Vec::new();
        for url in [base, &audio_url, &chat_url, base] {
            permits.push(tokio::time::timeout(std::time::Duration::from_millis(100), state.acquire(url)).await.unwrap().unwrap());
        }
        assert!(tokio::time::timeout(std::time::Duration::from_millis(10), state.acquire(&chat_url)).await.is_err());
        permits.pop();
        let following = state.acquire(&audio_url).await.unwrap();
        state.refuse(base, 429);
        drop(following);
        drop(permits);
        assert!(state.acquire(base).await.err().unwrap().contains("paused after a refusal"));
    }

    #[tokio::test]
    async fn capacity_is_parallel_bounded_and_cancellation_releases_it() {
        let state = Admission::default();
        let mut permits = Vec::new();
        for _ in 0..CONCURRENT { permits.push(state.acquire("https://example.invalid/v1").await.unwrap()); }
        assert!(tokio::time::timeout(std::time::Duration::from_millis(10), state.acquire("https://example.invalid/v1")).await.is_err());
        permits.pop();
        assert!(state.acquire("https://example.invalid/v1").await.is_ok());
    }
    #[tokio::test]
    async fn refusal_cancels_queued_work_without_poisoning_other_routes() {
        let state = Admission::default();
        let mut permits = Vec::new();
        for _ in 0..CONCURRENT { permits.push(state.acquire("https://example.invalid/v1").await.unwrap()); }
        let pending = state.acquire("https://example.invalid/v1");
        tokio::pin!(pending);
        assert!(tokio::time::timeout(std::time::Duration::from_millis(10), &mut pending).await.is_err());
        state.refuse("https://example.invalid/v1/audio/transcriptions", 429);
        state.resume();
        permits.pop();
        assert!(pending.await.is_err());
        assert!(state.acquire("https://other.invalid/v1").await.is_ok());
        assert!(state.acquire("https://example.invalid/v1").await.is_ok());
    }
}



#[cfg(test)]
mod turn_tests {
    use super::*;
    #[test]
    fn same_chat_has_one_inflight_turn_and_different_chats_remain_independent() {
        let first = active_turn("test-chat-a").unwrap();
        assert!(active_turn("test-chat-a").is_err());
        let _other = active_turn("test-chat-b").unwrap();
        drop(first);
        assert!(active_turn("test-chat-a").is_ok());
    }
    #[tokio::test]
    async fn queue_has_a_finite_bound_and_cancelled_waiters_release_capacity() {
        let state = Admission::default();
        let permits = futures_util::future::join_all((0..CONCURRENT).map(|_| state.acquire("https://bounded.invalid"))).await;
        let mut waiters = Vec::new();
        for _ in CONCURRENT..OUTSTANDING {
            let mut waiter = Box::pin(state.acquire("https://bounded.invalid"));
            assert!(futures_util::poll!(&mut waiter).is_pending());
            waiters.push(waiter);
        }
        assert!(state.acquire("https://bounded.invalid").await.err().unwrap().contains("queue is full"));
        drop(waiters);
        drop(permits);
        assert!(state.acquire("https://bounded.invalid").await.is_ok());
    }
}
