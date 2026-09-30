//! Short-lived, non-consuming PCM delivery, keyed by shared execution identity.
use crate::model::{AppError, ErrorCode, Result};
use std::{
    collections::VecDeque,
    time::{Duration, Instant},
};

#[derive(Default)]
pub(crate) struct Registry(VecDeque<Entry>);
struct Entry {
    id: String,
    pcm: Vec<u8>,
    alignment: Option<super::alignment::SpeechAlignment>,
    touched: Instant,
}

impl Registry {
    pub(crate) fn begin(&mut self, id: &str) {
        self.0
            .retain(|entry| entry.touched.elapsed() < Duration::from_secs(180) && entry.id != id);
        while self.0.len() >= 4 {
            self.0.pop_front();
        }
        self.0.push_back(Entry {
            id: id.into(),
            pcm: Vec::new(),
            alignment: None,
            touched: Instant::now(),
        });
    }

    pub(crate) fn append(
        &mut self,
        id: &str,
        pcm: &[u8],
        alignment: Option<&super::alignment::SpeechAlignment>,
    ) -> Result<()> {
        // Eviction ends provisional delivery; it must never recreate a prefix at zero.
        // Shared synthesis still completes for retained replay and other consumers.
        let Some(index) = self.0.iter().position(|entry| entry.id == id) else {
            return Ok(());
        };
        let entry = &mut self.0[index];
        if entry.pcm.len() + pcm.len() > super::delivery::AUDIO_LIMIT || pcm.len() % 2 != 0 {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Speech stream exceeds delivery bounds.",
            ));
        }
        entry.pcm.extend_from_slice(pcm);
        entry.alignment = alignment.cloned();
        entry.touched = Instant::now();
        Ok(())
    }

    pub(crate) fn alignment(&self, id: &str) -> Option<super::alignment::SpeechAlignment> {
        self.0
            .iter()
            .find(|entry| entry.id == id)
            .and_then(|entry| entry.alignment.clone())
    }

    pub(crate) fn read(&self, id: &str, offset: usize) -> Result<Option<&[u8]>> {
        let Some(entry) = self
            .0
            .iter()
            .find(|entry| entry.id == id && entry.touched.elapsed() < Duration::from_secs(180))
        else {
            return Ok(None);
        };
        if entry.pcm.is_empty() {
            return Ok(None);
        }
        if offset > entry.pcm.len() / 2 {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Speech stream cursor is ahead of delivery.",
            ));
        }
        let start = offset * 2;
        Ok(Some(&entry.pcm[start..entry.pcm.len().min(start + 48_000)]))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn readers_are_independent_bounded_and_cannot_skip_ahead() {
        let mut registry = Registry::default();
        registry.begin("shared");
        registry.append("shared", &[1, 0, 2, 0], None).unwrap();
        assert_eq!(registry.read("shared", 0).unwrap(), Some(&[1, 0, 2, 0][..]));
        assert_eq!(registry.read("shared", 0).unwrap(), Some(&[1, 0, 2, 0][..]));
        assert_eq!(registry.read("shared", 1).unwrap(), Some(&[2, 0][..]));
        assert!(registry.read("shared", 3).is_err());
        for n in 0..4 {
            registry.begin(&n.to_string());
            registry.append(&n.to_string(), &[0, 0], None).unwrap();
        }
        assert!(registry.read("shared", 0).unwrap().is_none());
        registry.begin("big");
        assert!(
            registry
                .append(
                    "big",
                    &vec![0; super::super::delivery::AUDIO_LIMIT + 2],
                    None
                )
                .is_err()
        );
    }
}
