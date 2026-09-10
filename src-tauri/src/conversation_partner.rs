//! A chat owns its character template and the first reply that establishes identity.

use std::path::Path;
use serde::{Deserialize, Serialize};
use crate::{personas::{self, Persona}, persistence};

const FILE: &str = "partner.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Origin { NewChat, RecoveredHistory }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationPartner {
    pub persona: Persona,
    pub introduction: Option<String>,
    pub origin: Origin,
}

pub fn load(chat: &Path) -> Result<ConversationPartner, String> {
    let raw = persistence::read(&chat.join(FILE))?
        .ok_or("This chat has no saved partner. Reopen the conversation to initialize it.")?;
    serde_json::from_str(&raw).map_err(|e| format!("Could not read saved conversation partner: {e}"))
}

fn save(chat: &Path, partner: &ConversationPartner) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(partner).map_err(|e| e.to_string())?;
    persistence::write(&chat.join(FILE), &bytes)
}

/// Called while holding the context lock. Existing snapshots never consult the catalog.
pub fn ensure(config: &Path, chat: &Path, id: &str, selection: &str, turns: &serde_json::Value) -> Result<ConversationPartner, String> {
    if persistence::read(&chat.join(FILE))?.is_some() { return load(chat); }
    let turns = turns.as_array().ok_or("A conversation must be a list of turns.")?;
    let partner = if turns.is_empty() {
        let mut faults = Vec::new();
        let available = personas::all(config, &mut faults);
        if !faults.is_empty() { return Err(faults.join("\n")); }
        // A deleted preference must be corrected explicitly, not silently reassigned.
        if selection != personas::NONE && selection != personas::SURPRISE && !available.iter().any(|p| p.id == selection) {
            return Err("The selected persona no longer exists. Choose another persona for the new chat.".into());
        }
        ConversationPartner { persona: personas::resolve(Some(selection), id, &available), introduction: None, origin: Origin::NewChat }
    } else {
        let introduction = turns.iter().find_map(|turn| turn.get("assistant")?.get("reply")?.as_str().filter(|s| !s.trim().is_empty()))
            .ok_or("Cannot recover this chat's partner: no saved assistant reply was found.")?;
        ConversationPartner {
            persona: Persona { id: "__legacy__".into(), label: "Partner from saved conversation".into(),
                sketch: "Continue the character established in the saved introduction. The original persona template is unknown; do not infer a different identity from current settings. If the introduction established no name or home, leave those unspecified rather than inventing them.".into(), builtin: false },
            introduction: Some(introduction.into()), origin: Origin::RecoveredHistory,
        }
    };
    save(chat, &partner)?;
    Ok(partner)
}

/// Freeze the first reply before exposing it as complete. Caller holds the context lock.
pub fn establish(chat: &Path, reply: &str) -> Result<(), String> {
    if reply.trim().is_empty() { return Err("Cannot establish identity from an empty reply.".into()); }
    let mut partner = load(chat)?;
    if partner.persona.id == personas::NONE { return Ok(()); }
    if partner.introduction.is_some() { return Err("This chat's identity was already established by another request.".into()); }
    partner.introduction = Some(reply.into());
    save(chat, &partner)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn snapshot_survives_preferences_catalog_changes_and_reopening() {
        let dir = tempfile::tempdir().unwrap();
        let custom = Persona { id: "custom".into(), label: "Carmen".into(), sketch: "A retired teacher in Valencia.".into(), builtin: false };
        personas::save_custom(dir.path(), &[custom]).unwrap();
        let first = ensure(dir.path(), dir.path(), "chat", "custom", &json!([])).unwrap();
        establish(dir.path(), "Soy Carmen. Vivo cerca de Valencia.").unwrap();
        let edited = Persona { id: "custom".into(), label: "Lola".into(), sketch: "A different person in Madrid.".into(), builtin: false };
        personas::save_custom(dir.path(), &[edited]).unwrap();
        assert_eq!(ensure(dir.path(), dir.path(), "chat", "custom", &json!([])).unwrap().persona.sketch, first.persona.sketch);
        personas::save_custom(dir.path(), &[]).unwrap();
        let restored = ensure(dir.path(), dir.path(), "chat", "__none__", &json!([])).unwrap();
        assert_eq!(restored.persona.sketch, first.persona.sketch);
        assert_eq!(restored.introduction.as_deref(), Some("Soy Carmen. Vivo cerca de Valencia."));
        assert!(establish(dir.path(), "Soy Lola.").is_err());
        assert_eq!(load(dir.path()).unwrap().introduction, restored.introduction);
    }

    #[test]
    fn legacy_uses_earliest_reply_without_guessing_a_template() {
        let dir = tempfile::tempdir().unwrap();
        let turns = json!([{ "assistant": { "reply": "Soy Carmen. Vivo en Valencia." } }, { "assistant": { "reply": "Soy Lola. Vivo en Madrid." } }]);
        let partner = ensure(dir.path(), dir.path(), "old", "baker", &turns).unwrap();
        assert_eq!(partner.origin, Origin::RecoveredHistory);
        assert_eq!(partner.persona.id, "__legacy__");
        assert_eq!(partner.introduction.as_deref(), Some("Soy Carmen. Vivo en Valencia."));
    }

    #[test]
    fn no_persona_and_invalid_persistence_are_explicit() {
        let dir = tempfile::tempdir().unwrap();
        ensure(dir.path(), dir.path(), "chat", personas::NONE, &json!([])).unwrap();
        establish(dir.path(), "Hola.").unwrap();
        assert!(load(dir.path()).unwrap().introduction.is_none());
        persistence::write(&dir.path().join(FILE), b"broken").unwrap();
        assert!(ensure(dir.path(), dir.path(), "chat", "baker", &json!([])).is_err());
    }
}
