//! Bounded local diagnostic retention. Content is private and never uploaded here.
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::persistence;

const MAX_RUNS: usize = 300;
const MAX_BYTES: usize = 8 * 1024 * 1024;
#[derive(Serialize, Deserialize, Clone)]
struct Stored { version: u32, evicted: u64, runs: Vec<Value> }
pub struct Archive { path: PathBuf, stored: Stored }
impl Archive {
    pub fn open(config: &Path) -> Result<Self, String> {
        let path = config.join("ai-traces.json");
        let stored = match persistence::read(&path)? {
            None => Stored { version: 1, evicted: 0, runs: Vec::new() },
            Some(raw) => {
                if raw.len() > MAX_BYTES { return Err("AI trace archive exceeds its size limit.".into()); }
                let value: Stored = serde_json::from_str(&raw).map_err(|e| format!("Could not read AI traces: {e}"))?;
                if value.version != 1 || value.runs.len() > MAX_RUNS { return Err("Unsupported AI trace archive format.".into()); }
                for run in &value.runs {
                    if run["id"].as_u64().is_none() || run["session_id"].as_str().is_none() { return Err("Invalid AI trace identity.".into()); }
                }
                value
            }
        };
        Ok(Self { path, stored })
    }
    pub fn runs(&self) -> Vec<Value> { self.stored.runs.clone() }
    pub fn evicted(&self) -> u64 { self.stored.evicted }
    pub fn put(&mut self, run: Value) -> Result<(), String> {
        let mut next = self.stored.clone();
        if let Some(index) = next.runs.iter().position(|r| r["id"] == run["id"] && r["session_id"] == run["session_id"]) { next.runs[index] = run; }
        else { next.runs.push(run); }
        loop {
            let bytes = serde_json::to_vec(&next).map_err(|e| e.to_string())?;
            if next.runs.len() <= MAX_RUNS && bytes.len() <= MAX_BYTES {
                persistence::write(&self.path, &bytes)?;
                self.stored = next;
                return Ok(());
            }
            if next.runs.len() <= 1 { return Err("An AI trace exceeds the archive size limit.".into()); }
            next.runs.remove(0);
            next.evicted += 1;
        }
    }
    pub fn clear(&mut self) -> Result<(), String> {
        let next = Stored { version: 1, evicted: 0, runs: Vec::new() };
        persistence::write(&self.path, &serde_json::to_vec(&next).map_err(|e| e.to_string())?)?;
        self.stored = next;
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn retained_records_update_survive_restart_and_clear() {
        let dir = tempfile::tempdir().unwrap();
        let mut archive = Archive::open(dir.path()).unwrap();
        archive.put(json!({"id":1,"session_id":"session","application_status":"ready"})).unwrap();
        archive.put(json!({"id":1,"session_id":"session","application_status":"saved"})).unwrap();
        let mut reopened = Archive::open(dir.path()).unwrap();
        assert_eq!(reopened.runs().len(), 1);
        assert_eq!(reopened.runs()[0]["application_status"], "saved");
        reopened.clear().unwrap();
        assert!(Archive::open(dir.path()).unwrap().runs().is_empty());
        persistence::write(&dir.path().join("ai-traces.json"), b"broken").unwrap();
        assert!(Archive::open(dir.path()).is_err());
    }
    #[test]
    fn eviction_is_bounded_and_reported() {
        let dir = tempfile::tempdir().unwrap();
        let mut archive = Archive::open(dir.path()).unwrap();
        for id in 0..=MAX_RUNS { archive.put(json!({"id":id,"session_id":"session"})).unwrap(); }
        assert_eq!(archive.runs().len(), MAX_RUNS);
        assert_eq!(archive.evicted(), 1);
        assert_eq!(archive.runs()[0]["id"], 1);
    }
}
