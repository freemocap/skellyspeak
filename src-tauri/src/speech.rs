//! Source-owned speech media. Cache reads never admit work or retain audio in SQLite.
use crate::model::{AppError, ErrorCode, Result};
use std::collections::VecDeque;

pub const ATTEMPT_LIMIT: i64 = 3;
pub const AUDIO_LIMIT: usize = 4 * 1024 * 1024;
pub const CACHE_ENTRIES: usize = 4;
pub const CACHE_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone)]
pub struct Source {
    pub message_id: String,
    pub text: String,
    pub language: String,
    pub voice: String,
}

#[derive(Debug)]
pub struct ReadyAudio {
    pub operation_id: String,
    pub attempt_id: String,
    pub message_id: String,
    pub wav: Vec<u8>,
}

#[derive(Default)]
pub struct Cache {
    entries: VecDeque<ReadyAudio>,
    bytes: usize,
}
impl Cache {
    pub fn insert(&mut self, audio: ReadyAudio) -> Result<()> {
        if audio.wav.is_empty() || audio.wav.len() > AUDIO_LIMIT {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Speech audio exceeds its cache limits.",
            ));
        }
        // A new attempt replaces the previous media for the same operation.
        self.remove_operation(&audio.operation_id);
        while self.entries.len() >= CACHE_ENTRIES || self.bytes + audio.wav.len() > CACHE_BYTES {
            if let Some(removed) = self.entries.pop_front() {
                self.bytes -= removed.wav.len();
            }
        }
        self.bytes += audio.wav.len();
        self.entries.push_back(audio);
        Ok(())
    }
    pub fn get(&self, attempt_id: &str) -> Option<&ReadyAudio> {
        self.entries
            .iter()
            .find(|entry| entry.attempt_id == attempt_id)
    }
    pub fn remove_operation(&mut self, operation_id: &str) {
        self.entries
            .retain(|entry| entry.operation_id != operation_id);
        self.bytes = self.entries.iter().map(|entry| entry.wav.len()).sum();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn audio(operation: &str, attempt: &str, size: usize) -> ReadyAudio {
        ReadyAudio {
            operation_id: operation.into(),
            attempt_id: attempt.into(),
            message_id: "source".into(),
            wav: vec![0; size],
        }
    }
    #[test]
    fn cache_is_bounded_and_reads_do_not_restore_evicted_audio() {
        let mut cache = Cache::default();
        for index in 0..5 {
            cache
                .insert(audio(&index.to_string(), &index.to_string(), AUDIO_LIMIT))
                .unwrap();
        }
        assert_eq!(cache.entries.len(), 4);
        assert_eq!(cache.bytes, CACHE_BYTES);
        for _ in 0..20 {
            assert!(cache.get("0").is_none());
            assert!(cache.get("4").is_some());
        }
        assert_eq!(cache.bytes, CACHE_BYTES);
        cache.remove_operation("4");
        assert!(cache.get("4").is_none());
        assert_eq!(cache.bytes, 3 * AUDIO_LIMIT);
    }
    #[test]
    fn replacement_and_rejection_do_not_leak_or_destroy_previous_audio() {
        let mut cache = Cache::default();
        cache.insert(audio("op", "first", 16)).unwrap();
        assert!(cache.insert(audio("op", "bad", AUDIO_LIMIT + 1)).is_err());
        assert!(cache.insert(audio("op", "empty", 0)).is_err());
        assert!(cache.get("first").is_some());
        cache.insert(audio("op", "second", 32)).unwrap();
        assert!(cache.get("first").is_none());
        assert_eq!(cache.bytes, 32);
        assert_eq!(cache.entries.len(), 1);
    }
}
