//! Where a conversation lives on disk.
//!
//! Each **language pairing** — what you are learning and what you already
//! speak — gets its own directory holding everything that belongs to it: the
//! turn log, the observer's plan and profile, and the private coach thread.
//! Switching from Spanish to Arabic therefore does not disturb the Spanish
//! conversation; it is still there when you switch back.
//!
//! ```text
//! <config>/conversations/es-ES__en/{session,plan,profile,coach_thread}.json
//! <config>/conversations/ar__en/{session,plan,profile,coach_thread}.json
//! ```
//!
//! The **dialect is not part of the key**. Moving between Levantine and MSA,
//! or between Spain and Mexico, is a setting applied to the same
//! conversation, not a different one.
//!
//! `settings.json` stays at the config root: it is global, and one of the
//! things it holds is which pairing is current.

use serde_json::Value;
use std::path::{Path, PathBuf};

pub const CONVERSATIONS: &str = "conversations";
pub const SESSION_FILE: &str = "session.json";

/// Directory-name-safe form of a language id. Ids are already tame
/// ("es-ES", "ar"), but this file path is built from stored settings, and a
/// settings file is something a person can edit by hand.
fn slug(id: &str) -> String {
    let cleaned: String = id
        .trim()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '_' })
        .collect();
    if cleaned.is_empty() {
        "unknown".into()
    } else {
        cleaned
    }
}

/// The identity of a conversation: target language and native language.
pub fn pair_key(target: &str, native: &str) -> String {
    format!("{}__{}", slug(target), slug(native))
}

/// Where this pairing's documents live, creating the directory if needed.
///
/// A failure to create it is returned rather than swallowed: every document
/// written underneath would fail too, and the user would be left wondering
/// why nothing was remembered.
pub fn pair_dir(config_dir: &Path, target: &str, native: &str) -> Result<PathBuf, String> {
    let dir = config_dir.join(CONVERSATIONS).join(pair_key(target, native));
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("could not create the conversation folder {}: {e}", dir.display()))?;
    Ok(dir)
}

/// The stored turn log, plus any fault the user must be told about.
///
/// Turns are stored exactly as the webview holds them. The Rust core never
/// interprets a turn — it composes prompts from the history the webview sends
/// with each request — so duplicating that shape here would be a second
/// definition to keep in step for no gain.
pub struct LoadedSession {
    pub turns: Value,
    pub fault: Option<String>,
}

fn empty() -> Value {
    Value::Array(Vec::new())
}

pub fn load_session(dir: &Path) -> LoadedSession {
    let path = dir.join(SESSION_FILE);
    let Ok(raw) = std::fs::read_to_string(&path) else {
        // No file yet simply means no conversation yet.
        return LoadedSession {
            turns: empty(),
            fault: None,
        };
    };

    match serde_json::from_str::<Value>(&raw) {
        Ok(doc) => {
            let turns = doc.get("turns").cloned().unwrap_or_else(empty);
            if turns.is_array() {
                LoadedSession { turns, fault: None }
            } else {
                LoadedSession {
                    turns: empty(),
                    fault: Some(format!(
                        "{} does not contain a turn list, so this conversation could not be \
                         restored.",
                        path.display()
                    )),
                }
            }
        }
        Err(e) => {
            // Never quietly replaced: that would discard someone's
            // conversation without a word. Move it aside and say so.
            let bad = dir.join(format!("{SESSION_FILE}.bad"));
            let mut fault = format!(
                "This conversation could not be read ({e}), so it starts empty. Nothing was \
                 deleted."
            );
            match std::fs::rename(&path, &bad) {
                Ok(()) => fault.push_str(&format!(" The unreadable file is kept at {}.", bad.display())),
                Err(e) => fault.push_str(&format!(" It could not be moved aside either: {e}.")),
            }
            LoadedSession {
                turns: empty(),
                fault: Some(fault),
            }
        }
    }
}

/// Write the turn log. Errors are returned, never swallowed: a failed save
/// means the conversation is not on disk and the user must know.
pub fn save_session(dir: &Path, turns: &Value) -> Result<(), String> {
    let doc = serde_json::json!({
        "turns": turns,
        "updated_at": now_secs(),
    });
    let raw = serde_json::to_string(&doc)
        .map_err(|e| format!("conversation serialization failed: {e}"))?;
    std::fs::write(dir.join(SESSION_FILE), raw)
        .map_err(|e| format!("conversation write failed: {e}"))
}

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|t| t.as_secs())
        .unwrap_or(0)
}

/// Move a document aside under a timestamped name. Used when starting a new
/// conversation: superseded state is archived, never destroyed.
///
/// A file that is not there is not an error — there is simply nothing to keep.
pub fn archive(dir: &Path, name: &str) -> Result<(), String> {
    let src = dir.join(name);
    if !src.exists() {
        return Ok(());
    }
    let dst = dir.join(format!("{name}.{}.bak", now_secs()));
    std::fs::rename(&src, &dst).map_err(|e| {
        format!("could not archive {name}: {e}. The previous conversation was left in place.")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pairing_is_the_target_and_native_language() {
        assert_eq!(pair_key("es-ES", "en"), "es-ES__en");
        assert_eq!(pair_key("ar", "en"), "ar__en");
        // Different target, or different native, is a different conversation.
        assert_ne!(pair_key("es-ES", "en"), pair_key("ar", "en"));
        assert_ne!(pair_key("es-ES", "en"), pair_key("es-ES", "fr-FR"));
    }

    #[test]
    fn a_hand_edited_language_id_cannot_escape_the_conversations_folder() {
        // settings.json is a file a person can edit, so the key must not be
        // able to name a path outside where conversations belong.
        for hostile in ["../../etc", "a/b", "..", "with space", ""] {
            let key = pair_key(hostile, "en");
            assert!(!key.contains('/'), "{hostile:?} -> {key}");
            assert!(!key.contains('\\'), "{hostile:?} -> {key}");
            assert!(!key.contains(".."), "{hostile:?} -> {key}");
        }
    }

    #[test]
    fn an_absent_conversation_is_empty_and_not_a_fault() {
        let dir = std::env::temp_dir().join(format!("skellyspeak-conv-{}", now_secs()));
        std::fs::create_dir_all(&dir).unwrap();
        let loaded = load_session(&dir);
        // A first run is not a problem to report.
        assert_eq!(loaded.turns, empty());
        assert!(loaded.fault.is_none());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn turns_round_trip_and_a_corrupt_file_is_kept_not_dropped() {
        let dir = std::env::temp_dir().join(format!("skellyspeak-conv-rt-{}", now_secs()));
        std::fs::create_dir_all(&dir).unwrap();

        let turns = serde_json::json!([{ "id": 1, "user": "hola" }]);
        save_session(&dir, &turns).unwrap();
        assert_eq!(load_session(&dir).turns, turns);

        // Corrupt it: the conversation must be reported, and preserved.
        std::fs::write(dir.join(SESSION_FILE), "{not json").unwrap();
        let loaded = load_session(&dir);
        assert_eq!(loaded.turns, empty());
        let fault = loaded.fault.expect("a corrupt conversation must be reported");
        assert!(fault.contains("Nothing was deleted"), "got {fault:?}");
        assert!(dir.join(format!("{SESSION_FILE}.bad")).exists());

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn two_languages_keep_separate_conversations() {
        // The whole point: an Arabic conversation and a Spanish one coexist,
        // and switching between them returns each intact.
        let root = std::env::temp_dir().join(format!("skellyspeak-pairs-{}", now_secs()));
        std::fs::create_dir_all(&root).unwrap();

        let es = pair_dir(&root, "es-ES", "en").unwrap();
        let ar = pair_dir(&root, "ar", "en").unwrap();
        assert_ne!(es, ar);

        let spanish = serde_json::json!([{ "id": 1, "user": "hola" }]);
        let arabic = serde_json::json!([{ "id": 1, "user": "marhaba" }, { "id": 2 }]);
        save_session(&es, &spanish).unwrap();
        save_session(&ar, &arabic).unwrap();

        // Neither write disturbed the other.
        assert_eq!(load_session(&es).turns, spanish);
        assert_eq!(load_session(&ar).turns, arabic);

        // Starting fresh in Arabic leaves Spanish alone.
        archive(&ar, SESSION_FILE).unwrap();
        assert_eq!(load_session(&ar).turns, empty());
        assert_eq!(load_session(&es).turns, spanish);

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn the_dialect_is_not_part_of_a_conversation() {
        // Levantine and MSA, or Spain and Mexico, are settings applied to one
        // conversation — not separate ones. The key has no room for a dialect.
        let root = std::env::temp_dir().join(format!("skellyspeak-dialect-{}", now_secs()));
        std::fs::create_dir_all(&root).unwrap();
        let a = pair_dir(&root, "ar", "en").unwrap();
        let b = pair_dir(&root, "ar", "en").unwrap();
        assert_eq!(a, b);
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn archiving_moves_a_document_aside_and_missing_is_not_an_error() {
        let dir = std::env::temp_dir().join(format!("skellyspeak-conv-ar-{}", now_secs()));
        std::fs::create_dir_all(&dir).unwrap();
        // Nothing to archive is a perfectly ordinary state.
        assert!(archive(&dir, SESSION_FILE).is_ok());

        save_session(&dir, &serde_json::json!([{ "id": 1 }])).unwrap();
        archive(&dir, SESSION_FILE).unwrap();
        // The live file is gone, and the old conversation still exists.
        assert!(!dir.join(SESSION_FILE).exists());
        let kept: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().ends_with(".bak"))
            .collect();
        assert_eq!(kept.len(), 1, "the previous conversation must be kept");

        std::fs::remove_dir_all(&dir).ok();
    }
}
