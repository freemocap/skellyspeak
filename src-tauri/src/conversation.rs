//! Where conversations live on disk.
//!
//! Each **language pairing** — what you are learning and what you already
//! speak — gets a directory, and inside it a numbered chat per conversation:
//!
//! ```text
//! <config>/conversations/es-ES__en/plan.json      ← what the tutor knows about
//! <config>/conversations/es-ES__en/profile.json     you, shared by every chat
//! <config>/conversations/es-ES__en/current.json    ← which chat is open
//! <config>/conversations/es-ES__en/chats/1788400000-a1b2/session.json
//!                                                 /coach.json
//! <config>/conversations/ar__en/...
//! ```
//!
//! Two levels, and the split matters. **Chats** are conversations you can list,
//! reopen and delete. **Plan and profile** sit above them, per pairing, because
//! they are what the tutor has learned about this learner in this language —
//! starting a new chat should not make it forget you.
//!
//! The **dialect is not part of the key**. Moving between Levantine and MSA, or
//! Spain and Mexico, is a setting applied to the conversation you are in.
//!
//! `settings.json` stays at the config root: it is global, and one of the
//! things it holds is which pairing is current.

use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};

pub const CONVERSATIONS: &str = "conversations";
pub const CHATS: &str = "chats";
pub const CURRENT_FILE: &str = "current.json";
pub const SESSION_FILE: &str = "session.json";
pub const COACH_FILE: &str = "coach.json";

/// Directory-name-safe form of an id. Language ids are already tame ("es-ES"),
/// but these become path segments and both the language and the chat id can
/// reach here from a file a person edited by hand.
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

/// The identity of a pairing: target language and native language.
pub fn pair_key(target: &str, native: &str) -> String {
    format!("{}__{}", slug(target), slug(native))
}

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|t| t.as_secs())
        .unwrap_or(0)
}

/// Where this pairing's documents live, creating the directory if needed.
///
/// A failure to create it is returned rather than swallowed: every document
/// written underneath would fail too, and the user would be left wondering why
/// nothing was remembered.
pub fn pair_dir(config_dir: &Path, target: &str, native: &str) -> Result<PathBuf, String> {
    let dir = config_dir.join(CONVERSATIONS).join(pair_key(target, native));
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("could not create the conversation folder {}: {e}", dir.display()))?;
    Ok(dir)
}

/// Where one chat's documents live, creating the directory if needed.
pub fn chat_dir(pair: &Path, id: &str) -> Result<PathBuf, String> {
    let dir = pair.join(CHATS).join(slug(id));
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("could not create the chat folder {}: {e}", dir.display()))?;
    Ok(dir)
}

/// A candidate chat id: creation time, plus random hex so two chats started in
/// the same second are very unlikely to match. Sorts oldest-first as plain text.
///
/// Prefer `unique_chat_id`, which turns "very unlikely" into "checked".
fn candidate_chat_id() -> String {
    let salt = uuid::Uuid::new_v4().simple().to_string();
    format!("{}-{}", now_secs(), &salt[..8])
}

/// A chat id that does not already name a chat in this pairing.
///
/// Random suffixes make collisions improbable, not impossible — 4 hex digits
/// look like plenty until the birthday bound is worked out, and a collision
/// here means one conversation silently writing over another. So the directory
/// is checked rather than assumed.
pub fn unique_chat_id(pair: &Path) -> Result<String, String> {
    for _ in 0..100 {
        let id = candidate_chat_id();
        if !pair.join(CHATS).join(&id).exists() {
            return Ok(id);
        }
    }
    Err("could not find an unused name for a new conversation.".into())
}

/// Everything is plain JSON, one document per file. At this size — dozens of
/// chats, each a few hundred KB at most, written by one process — a database
/// would buy nothing and cost inspectability: when something looks wrong you
/// can open the file and read it. SQLite would start to earn its keep with
/// thousands of conversations, cross-chat search, or concurrent writers, and
/// none of those are true yet.
///
/// Deleting sets a `deleted_at` field rather than removing anything, so the one
/// action a user can take by accident on something irreplaceable is reversible.
/// One row in the chat list.
#[derive(Debug, Clone, Serialize)]
pub struct ChatSummary {
    pub id: String,
    /// Derived by the webview from the first thing said, since it is the side
    /// that knows what a turn looks like. Empty until a chat has content.
    pub title: String,
    pub updated_at: u64,
    pub turn_count: usize,
}

/// Which chat is open for this pairing, if the pointer names one that exists.
pub fn current_chat(pair: &Path) -> Option<String> {
    let raw = std::fs::read_to_string(pair.join(CURRENT_FILE)).ok()?;
    let doc: Value = serde_json::from_str(&raw).ok()?;
    let id = doc.get("chat_id")?.as_str()?.trim().to_string();
    if id.is_empty() || !pair.join(CHATS).join(slug(&id)).exists() {
        // A pointer to a chat that is gone is not an error worth stopping for;
        // the caller opens or creates another.
        return None;
    }
    Some(id)
}

pub fn set_current_chat(pair: &Path, id: &str) -> Result<(), String> {
    let doc = serde_json::json!({ "chat_id": id });
    std::fs::write(pair.join(CURRENT_FILE), doc.to_string())
        .map_err(|e| format!("could not record which conversation is open: {e}"))
}

/// The open chat, starting one if there is none.
pub fn ensure_current_chat(pair: &Path) -> Result<String, String> {
    if let Some(id) = current_chat(pair) {
        return Ok(id);
    }
    let id = unique_chat_id(pair)?;
    chat_dir(pair, &id)?;
    set_current_chat(pair, &id)?;
    Ok(id)
}

/// Every chat in this pairing, most recently used first. Deleted ones are
/// filtered out; their files remain.
///
/// A chat whose document cannot be read is listed rather than hidden — it is
/// still something the user made, and silently dropping it from the list is how
/// people conclude the app lost their work.
pub fn list_chats(pair: &Path) -> Vec<ChatSummary> {
    let Ok(entries) = std::fs::read_dir(pair.join(CHATS)) else {
        return Vec::new();
    };
    let mut chats: Vec<ChatSummary> = entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .filter_map(|e| {
            let id = e.file_name().to_string_lossy().to_string();
            let doc = std::fs::read_to_string(e.path().join(SESSION_FILE))
                .ok()
                .and_then(|raw| serde_json::from_str::<Value>(&raw).ok());
            // Deleted chats keep their files but leave the list.
            if doc.as_ref().and_then(|d| d.get("deleted_at")).is_some() {
                return None;
            }
            let turn_count = doc
                .as_ref()
                .and_then(|d| d.get("turns"))
                .and_then(Value::as_array)
                .map(Vec::len)
                .unwrap_or(0);
            Some(ChatSummary {
                title: doc
                    .as_ref()
                    .and_then(|d| d.get("title"))
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                updated_at: doc
                    .as_ref()
                    .and_then(|d| d.get("updated_at"))
                    .and_then(Value::as_u64)
                    .unwrap_or(0),
                turn_count,
                id,
            })
        })
        .collect();
    chats.sort_by(|a, b| b.updated_at.cmp(&a.updated_at).then(b.id.cmp(&a.id)));
    chats
}

/// The stored turn log, plus any fault the user must be told about.
///
/// Turns are stored exactly as the webview holds them. The Rust core never
/// interprets a turn — it composes prompts from the history the webview sends
/// with each request — so duplicating that shape here would be a second
/// definition to keep in step for no gain. The title comes from the webview
/// for the same reason.
pub struct LoadedSession {
    pub turns: Value,
    pub fault: Option<String>,
}

fn empty() -> Value {
    Value::Array(Vec::new())
}

pub fn load_session(chat: &Path) -> LoadedSession {
    let path = chat.join(SESSION_FILE);
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
            // Never quietly replaced: that would discard someone's conversation
            // without a word. Move it aside and say so.
            let bad = chat.join(format!("{SESSION_FILE}.bad"));
            let mut fault = format!(
                "This conversation could not be read ({e}), so it opens empty. Nothing was \
                 deleted."
            );
            match std::fs::rename(&path, &bad) {
                Ok(()) => {
                    fault.push_str(&format!(" The unreadable file is kept at {}.", bad.display()))
                }
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
pub fn save_session(chat: &Path, turns: &Value, title: &str) -> Result<(), String> {
    let doc = serde_json::json!({
        "turns": turns,
        "title": title,
        "updated_at": now_secs(),
    });
    let raw =
        serde_json::to_string(&doc).map_err(|e| format!("conversation serialization failed: {e}"))?;
    std::fs::write(chat.join(SESSION_FILE), raw)
        .map_err(|e| format!("conversation write failed: {e}"))
}

/// Remove a chat from the list, keeping its files.
///
/// A `deleted_at` field in the document, not a renamed file and not an erased
/// directory: deleting a conversation is the one action a user can take by
/// accident on something irreplaceable, so it stays recoverable by anyone who
/// opens the file. `list_chats` skips it from then on.
pub fn delete_chat(pair: &Path, id: &str) -> Result<(), String> {
    let dir = pair.join(CHATS).join(slug(id));
    if !dir.exists() {
        // Already gone is the state that was asked for.
        return Ok(());
    }
    let path = dir.join(SESSION_FILE);
    let mut doc = std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .unwrap_or_else(|| serde_json::json!({ "turns": [], "title": "" }));
    // An unreadable document is replaced by a marker rather than left listed
    // forever: the user asked for it to go, and there was nothing to preserve.
    if !doc.is_object() {
        doc = serde_json::json!({ "turns": [], "title": "" });
    }
    doc["deleted_at"] = serde_json::json!(now_secs());
    std::fs::write(&path, doc.to_string())
        .map_err(|e| format!("could not remove that conversation: {e}. It was left where it was."))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "skellyspeak-{name}-{}-{}",
            now_secs(),
            uuid::Uuid::new_v4().simple()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_pairing_is_the_target_and_native_language() {
        assert_eq!(pair_key("es-ES", "en"), "es-ES__en");
        assert_ne!(pair_key("es-ES", "en"), pair_key("ar", "en"));
        assert_ne!(pair_key("es-ES", "en"), pair_key("es-ES", "fr-FR"));
        // The dialect has no place in the key: Levantine and MSA share a chat.
        assert_eq!(pair_key("ar", "en"), pair_key("ar", "en"));
    }

    #[test]
    fn a_hand_edited_id_cannot_escape_its_folder() {
        // Both language ids and chat ids become path segments, and both can
        // arrive from a file a person edited.
        for hostile in ["../../etc", "a/b", "..", "with space", ""] {
            for key in [pair_key(hostile, "en"), slug(hostile)] {
                assert!(!key.contains('/'), "{hostile:?} -> {key}");
                assert!(!key.contains('\\'), "{hostile:?} -> {key}");
                assert!(!key.contains(".."), "{hostile:?} -> {key}");
            }
        }
    }

    #[test]
    fn chat_ids_never_reuse_an_existing_chat() {
        // Deterministic, not probabilistic: each id is materialised before the
        // next is drawn, so a repeat would be caught rather than merely being
        // unlikely. A collision here means one conversation writing over
        // another, which is not a risk worth taking on a random suffix alone.
        let pair = scratch("ids");
        let mut seen = std::collections::HashSet::new();
        for _ in 0..200 {
            let id = unique_chat_id(&pair).unwrap();
            chat_dir(&pair, &id).unwrap();
            assert!(seen.insert(id.clone()), "{id} was handed out twice");
        }
        assert_eq!(seen.len(), 200);
        std::fs::remove_dir_all(&pair).ok();
    }

    #[test]
    fn the_open_chat_is_remembered_and_created_on_demand() {
        let pair = scratch("current");
        assert!(current_chat(&pair).is_none());

        let id = ensure_current_chat(&pair).unwrap();
        // Stable across calls — asking again must not start a second chat.
        assert_eq!(ensure_current_chat(&pair).unwrap(), id);
        assert_eq!(current_chat(&pair).as_deref(), Some(id.as_str()));

        std::fs::remove_dir_all(&pair).ok();
    }

    #[test]
    fn a_pointer_to_a_chat_that_is_gone_starts_a_new_one() {
        let pair = scratch("dangling");
        set_current_chat(&pair, "1788400000-dead").unwrap();
        // Not an error: the caller simply gets a fresh chat rather than a crash.
        assert!(current_chat(&pair).is_none());
        assert!(ensure_current_chat(&pair).is_ok());
        std::fs::remove_dir_all(&pair).ok();
    }

    #[test]
    fn chats_are_listed_newest_first_with_their_titles() {
        let pair = scratch("list");
        for (id, title, updated) in [
            ("1788400000-aaaa", "Ordering coffee", 100u64),
            ("1788400500-bbbb", "Talking about the weather", 300),
            ("1788400900-cccc", "Weekend plans", 200),
        ] {
            let dir = chat_dir(&pair, id).unwrap();
            std::fs::write(
                dir.join(SESSION_FILE),
                serde_json::json!({
                    "turns": [{ "id": 1 }, { "id": 2 }],
                    "title": title,
                    "updated_at": updated,
                })
                .to_string(),
            )
            .unwrap();
        }
        let listed = list_chats(&pair);
        assert_eq!(
            listed.iter().map(|c| c.title.as_str()).collect::<Vec<_>>(),
            ["Talking about the weather", "Weekend plans", "Ordering coffee"],
            "most recently used first"
        );
        assert_eq!(listed[0].turn_count, 2);
        std::fs::remove_dir_all(&pair).ok();
    }

    #[test]
    fn an_unreadable_chat_is_still_listed() {
        // Hiding it is how someone concludes the app lost their work.
        let pair = scratch("unreadable");
        let dir = chat_dir(&pair, "1788400000-aaaa").unwrap();
        std::fs::write(dir.join(SESSION_FILE), "{not json").unwrap();
        let listed = list_chats(&pair);
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].turn_count, 0);
        std::fs::remove_dir_all(&pair).ok();
    }

    #[test]
    fn turns_round_trip_and_a_corrupt_file_is_kept_not_dropped() {
        let pair = scratch("roundtrip");
        let chat = chat_dir(&pair, "1788400000-aaaa").unwrap();

        let turns = serde_json::json!([{ "id": 1, "user": "hola" }]);
        save_session(&chat, &turns, "Saying hello").unwrap();
        assert_eq!(load_session(&chat).turns, turns);
        assert_eq!(list_chats(&pair)[0].title, "Saying hello");

        std::fs::write(chat.join(SESSION_FILE), "{not json").unwrap();
        let loaded = load_session(&chat);
        assert_eq!(loaded.turns, empty());
        assert!(loaded.fault.unwrap().contains("Nothing was deleted"));
        assert!(chat.join(format!("{SESSION_FILE}.bad")).exists());

        std::fs::remove_dir_all(&pair).ok();
    }

    #[test]
    fn deleting_a_chat_hides_it_but_keeps_the_turns() {
        let pair = scratch("delete");
        let chat = chat_dir(&pair, "1788400000-aaaa").unwrap();
        let turns = serde_json::json!([{ "id": 1, "user": "hola" }]);
        save_session(&chat, &turns, "Coffee").unwrap();
        assert_eq!(list_chats(&pair).len(), 1);

        delete_chat(&pair, "1788400000-aaaa").unwrap();
        assert!(list_chats(&pair).is_empty(), "gone from the list");

        // Recoverable by anyone who opens the file: the turns are untouched and
        // the only change is a dated marker. No renamed files, nothing erased.
        let raw = std::fs::read_to_string(chat.join(SESSION_FILE)).unwrap();
        let doc: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(doc["turns"], turns);
        assert_eq!(doc["title"], "Coffee");
        assert!(doc["deleted_at"].as_u64().unwrap() > 0);

        // Deleting something already gone is the state that was asked for.
        assert!(delete_chat(&pair, "1788400000-aaaa").is_ok());
        assert!(delete_chat(&pair, "never-existed").is_ok());

        std::fs::remove_dir_all(&pair).ok();
    }

    #[test]
    fn a_deleted_chat_is_not_reopened_as_the_current_one() {
        let pair = scratch("delete-current");
        let id = ensure_current_chat(&pair).unwrap();
        save_session(&chat_dir(&pair, &id).unwrap(), &serde_json::json!([]), "x").unwrap();
        delete_chat(&pair, &id).unwrap();
        // The pointer still names a directory that exists, so the caller has to
        // notice the chat is gone from the list rather than trusting the pointer.
        assert!(list_chats(&pair).is_empty());
        std::fs::remove_dir_all(&pair).ok();
    }

    #[test]
    fn two_languages_keep_separate_chats() {
        // The whole point: Arabic and Spanish conversations coexist.
        let root = scratch("pairs");
        let es = pair_dir(&root, "es-ES", "en").unwrap();
        let ar = pair_dir(&root, "ar", "en").unwrap();
        assert_ne!(es, ar);

        let es_chat = chat_dir(&es, &ensure_current_chat(&es).unwrap()).unwrap();
        let ar_chat = chat_dir(&ar, &ensure_current_chat(&ar).unwrap()).unwrap();
        save_session(&es_chat, &serde_json::json!([{ "user": "hola" }]), "Spanish").unwrap();
        save_session(&ar_chat, &serde_json::json!([{ "user": "marhaba" }]), "Arabic").unwrap();

        assert_eq!(list_chats(&es).len(), 1);
        assert_eq!(list_chats(&es)[0].title, "Spanish");
        assert_eq!(list_chats(&ar)[0].title, "Arabic");

        std::fs::remove_dir_all(&root).ok();
    }
}
