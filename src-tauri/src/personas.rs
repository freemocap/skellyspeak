//! Who the learner is actually talking to.
//!
//! A conversation partner described as "encouraging and patient" is a job
//! description, not a person, and a model given a job description writes like
//! one: greet, ask how you are, agree, ask another question. The result is the
//! same conversation every time, in every language, with nobody in it.
//!
//! So the partner is a *character* — someone with a job, a bad night's sleep,
//! an opinion about their neighbour, and something they would rather be doing.
//! A person with a life has things to say that were not prompted by the last
//! thing the learner said, which is the whole difference between a
//! conversation and an interview.
//!
//! **The words live elsewhere.** The eight built-in sketches, and the prompt
//! block they are dropped into, are in `prompts::partner` with every other
//! string this app sends to a model. What is here is the storage, the ids, and
//! the draw: which person this conversation gets, and how the learner's own
//! characters are saved and loaded.
//!
//! Built-ins ship with the app and cannot be edited. Anything the learner
//! writes themselves lives in `<config>/personas.json` and is theirs — the two
//! sets are merged into one list, and a custom persona may not take a
//! built-in's id.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Where the learner's own characters live.
pub const PERSONAS_FILE: &str = "personas.json";

/// The id meaning "somebody different each conversation" — resolved from the
/// chat id, so it is stable inside one conversation and different in the next.
pub const SURPRISE: &str = "surprise";

/// The longest a sketch may be. Not arbitrary: the sketch goes into every
/// reply prompt of every turn, so an essay here is paid for on every message.
pub const MAX_SKETCH: usize = 1200;
/// A sketch shorter than this is an adjective list, which is the exact failure
/// this module exists to avoid. The modal says so before it gets here.
pub const MIN_SKETCH: usize = 60;
pub const MAX_LABEL: usize = 60;

/// One character the learner can be paired with.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Persona {
    /// Stable id: what the UI stores and what crosses IPC.
    pub id: String,
    /// What the picker shows.
    pub label: String,
    /// The character, dropped straight into the system prompt. Concrete and
    /// specific on purpose — "warm and curious" produces nothing, "still
    /// smells of flour at noon" produces a sentence.
    pub sketch: String,
    /// Ships with the app. Built-ins are readable in the editor but cannot be
    /// changed or deleted, so a learner can always get back to a working set.
    #[serde(default)]
    pub builtin: bool,
}



/// The characters that ship with the app.
///
/// Their words live in `prompts::partner::BUILTIN_PERSONAS` with every other
/// string the app sends to a model; this module owns the storage, the ids and
/// the draw.
pub fn builtins() -> Vec<Persona> {
    crate::prompts::partner::BUILTIN_PERSONAS
        .iter()
        .map(|b| Persona {
            id: b.id.to_string(),
            label: b.label.to_string(),
            sketch: b.sketch.to_string(),
            builtin: true,
        })
        .collect()
}

pub fn is_builtin(id: &str) -> bool {
    crate::prompts::partner::BUILTIN_PERSONAS.iter().any(|b| b.id == id)
}

fn path(config_dir: &Path) -> PathBuf {
    config_dir.join(PERSONAS_FILE)
}

/// The learner's own characters, and any fault worth telling them about.
///
/// A file that cannot be read is moved aside and reported rather than quietly
/// replaced: these are written by hand and losing them without a word is how
/// someone concludes the app ate their work.
pub fn load_custom(config_dir: &Path, faults: &mut Vec<String>) -> Vec<Persona> {
    let p = path(config_dir);
    let Ok(raw) = std::fs::read_to_string(&p) else {
        // No file yet simply means no custom personas yet.
        return Vec::new();
    };
    match serde_json::from_str::<Vec<Persona>>(&raw) {
        Ok(list) => list
            .into_iter()
            // A stored persona that has taken a built-in's id (a hand-edited
            // file) is dropped rather than allowed to shadow it: `resolve`
            // would then hand back something the picker does not list.
            .filter(|c| !is_builtin(&c.id))
            .map(|c| Persona { builtin: false, ..c })
            .collect(),
        Err(e) => {
            let bad = p.with_extension("json.bad");
            let mut fault = format!(
                "Your saved personas could not be read ({e}), so only the \
                 built-in ones are available. Nothing was deleted."
            );
            match std::fs::rename(&p, &bad) {
                Ok(()) => fault.push_str(&format!(" The file is kept at {}.", bad.display())),
                Err(e) => fault.push_str(&format!(" It could not be moved aside either: {e}.")),
            }
            faults.push(fault);
            Vec::new()
        }
    }
}

/// Write the learner's characters. Errors are returned, never swallowed: a
/// failed save means the persona they just wrote is not on disk, and they must
/// find that out now rather than after a restart.
pub fn save_custom(config_dir: &Path, custom: &[Persona]) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(custom)
        .map_err(|e| format!("could not serialize your personas: {e}"))?;
    std::fs::write(path(config_dir), raw)
        .map_err(|e| format!("could not save your personas: {e}"))
}

/// Everything the picker offers: built-ins first, then the learner's own.
pub fn all(config_dir: &Path, faults: &mut Vec<String>) -> Vec<Persona> {
    let mut list = builtins();
    list.extend(load_custom(config_dir, faults));
    list
}

/// Turn a label into an id. Custom ids are derived rather than typed, so the
/// learner never has to think about one and it can never contain a character
/// that breaks a filename or a JSON key.
pub fn slug(label: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for c in label.trim().to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
            dash = false;
        } else if !out.is_empty() && !dash {
            out.push('-');
            dash = true;
        }
    }
    let out = out.trim_end_matches('-').to_string();
    if out.is_empty() {
        "persona".into()
    } else {
        out
    }
}

/// An id not already taken, by a built-in or by another custom persona.
pub fn unique_id(base: &str, taken: &[Persona]) -> String {
    let base = slug(base);
    let clashes = |id: &str| is_builtin(id) || taken.iter().any(|p| p.id == id);
    if !clashes(&base) {
        return base;
    }
    for n in 2..1000 {
        let candidate = format!("{base}-{n}");
        if !clashes(&candidate) {
            return candidate;
        }
    }
    // A thousand personas called the same thing is not a state to paper over.
    format!("{base}-{}", uuid::Uuid::new_v4().simple())
}

/// What the learner wrote, checked before it can reach a prompt.
///
/// The limits are the ones the editor states, enforced here because the editor
/// is not the only way in: `personas.json` is a file a person can open.
pub fn validate(label: &str, sketch: &str) -> Result<(), String> {
    let label = label.trim();
    let sketch = sketch.trim();
    if label.is_empty() {
        return Err("Give the persona a name — it is what the picker shows.".into());
    }
    if label.chars().count() > MAX_LABEL {
        return Err(format!("That name is too long (keep it under {MAX_LABEL} characters)."));
    }
    if sketch.chars().count() < MIN_SKETCH {
        return Err(format!(
            "The description is too short to be a person ({MIN_SKETCH} characters at least). \
             Give them a job, a mood, and something that is annoying them today — vague \
             adjectives produce exactly the bland partner this replaces."
        ));
    }
    if sketch.chars().count() > MAX_SKETCH {
        return Err(format!(
            "The description is too long (keep it under {MAX_SKETCH} characters). It is sent \
             with every single message, so length here is paid for on every turn."
        ));
    }
    Ok(())
}

/// The persona for this conversation.
///
/// `SURPRISE` (and anything unrecognised, which is what an id from a deleted
/// custom persona looks like) is resolved from `seed` — the chat id — so the
/// partner is the same person for the whole of one conversation and a
/// different one in the next. That is deliberate: "why is it the same boring
/// person every single time" is answered by it not being the same person.
///
/// Custom personas are in the draw. Someone who wrote one wants to meet them.
pub fn resolve(id: Option<&str>, seed: &str, available: &[Persona]) -> Persona {
    if let Some(chosen) = id
        .map(str::trim)
        .filter(|s| !s.is_empty() && *s != SURPRISE)
        .and_then(|s| available.iter().find(|p| p.id == s))
    {
        return chosen.clone();
    }
    // `available` is empty only if the built-ins were emptied, which is a
    // programming error rather than a state to degrade through.
    assert!(!available.is_empty(), "no personas to choose from");
    available[hash(seed) % available.len()].clone()
}

/// FNV-1a. Any stable hash would do; `DefaultHasher` would not, because it is
/// explicitly not guaranteed to be stable across Rust releases and this value
/// decides who the learner is talking to.
fn hash(s: &str) -> usize {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x1000_0000_01b3);
    }
    h as usize
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "skellyspeak-personas-{name}-{}",
            uuid::Uuid::new_v4().simple()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn custom(id: &str, label: &str) -> Persona {
        Persona {
            id: id.into(),
            label: label.into(),
            sketch: "You do a specific job and something specific is annoying you today, \
                     at length and with feeling."
                .into(),
            builtin: false,
        }
    }

    #[test]
    fn a_named_persona_is_the_one_you_get() {
        let all = builtins();
        for p in &all {
            assert_eq!(resolve(Some(&p.id), "any-seed", &all).id, p.id);
        }
    }

    #[test]
    fn surprise_is_stable_within_a_conversation() {
        // The partner must not become a different person mid-chat: every turn
        // resolves independently, so this is the only thing keeping them one
        // person.
        let all = builtins();
        let first = resolve(Some(SURPRISE), "1788400000-a1b2", &all).id;
        for _ in 0..20 {
            assert_eq!(resolve(Some(SURPRISE), "1788400000-a1b2", &all).id, first);
        }
    }

    #[test]
    fn surprise_gives_different_conversations_different_people() {
        // Not a guarantee for any specific pair — a hash may collide — but
        // across a spread of chat ids the partner must actually vary, which is
        // the entire complaint this exists to answer.
        let all = builtins();
        let seen: std::collections::HashSet<String> = (0..200)
            .map(|i| resolve(Some(SURPRISE), &format!("178840{i:04}-abcd"), &all).id)
            .collect();
        assert!(
            seen.len() >= all.len() - 1,
            "only {} distinct partners across 200 chats: {seen:?}",
            seen.len()
        );
    }

    #[test]
    fn surprise_can_land_on_a_persona_the_learner_wrote() {
        // Someone who writes a character wants to meet them. Leaving custom
        // personas out of the draw would make "surprise me" quietly mean
        // "surprise me from the ones you did not write".
        let mut all = builtins();
        all.push(custom("mine", "Mine"));
        let seen: std::collections::HashSet<String> = (0..300)
            .map(|i| resolve(Some(SURPRISE), &format!("chat-{i}"), &all).id)
            .collect();
        assert!(seen.contains("mine"), "a custom persona is never drawn");
    }

    #[test]
    fn nothing_stored_still_yields_a_person() {
        // No setting, an empty setting, and an id from a persona that has been
        // deleted all mean the same thing: pick someone.
        let all = builtins();
        for id in [None, Some(""), Some("   "), Some("deleted-persona")] {
            let p = resolve(id, "1788400000-a1b2", &all);
            assert!(all.iter().any(|q| q.id == p.id));
        }
    }

    #[test]
    fn every_builtin_is_distinct_and_actually_describes_someone() {
        let all = builtins();
        let ids: std::collections::HashSet<&str> = all.iter().map(|p| p.id.as_str()).collect();
        assert_eq!(ids.len(), all.len(), "duplicate persona id");
        assert!(!ids.contains(SURPRISE), "`surprise` is not a real persona");
        for p in &all {
            // A sketch this short would be an adjective list, which is the
            // failure mode the whole module exists to avoid.
            assert!(p.sketch.len() > 150, "{} has a thin sketch", p.id);
            assert!(p.builtin);
            assert!(validate(&p.label, &p.sketch).is_ok(), "{} fails its own rules", p.id);
        }
    }

    #[test]
    fn custom_personas_survive_a_restart() {
        // The whole point of writing one.
        let dir = scratch("roundtrip");
        let mine = vec![custom("my-uncle", "My uncle"), custom("the-cat", "The cat")];
        save_custom(&dir, &mine).unwrap();

        let mut faults = Vec::new();
        let loaded = load_custom(&dir, &mut faults);
        assert!(faults.is_empty(), "{faults:?}");
        assert_eq!(loaded, mine);

        // And they are in the list the picker gets, after the built-ins.
        let listed = all(&dir, &mut faults);
        assert_eq!(listed.len(), crate::prompts::partner::BUILTIN_PERSONAS.len() + 2);
        assert!(listed.iter().any(|p| p.id == "the-cat" && !p.builtin));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn no_file_is_not_a_fault() {
        let dir = scratch("empty");
        let mut faults = Vec::new();
        assert!(load_custom(&dir, &mut faults).is_empty());
        assert!(faults.is_empty(), "an unused feature is not an error");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn an_unreadable_file_is_reported_and_kept() {
        // Hand-written characters. Replacing them silently is how someone
        // concludes the app ate their work.
        let dir = scratch("corrupt");
        std::fs::write(dir.join(PERSONAS_FILE), "{not json").unwrap();
        let mut faults = Vec::new();
        assert!(load_custom(&dir, &mut faults).is_empty());
        assert_eq!(faults.len(), 1);
        assert!(faults[0].contains("Nothing was deleted"));
        assert!(dir.join("personas.json.bad").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_stored_persona_cannot_shadow_a_builtin() {
        // A hand-edited file claiming id "baker" would make `resolve` hand back
        // something the picker never showed.
        let dir = scratch("shadow");
        std::fs::write(
            dir.join(PERSONAS_FILE),
            serde_json::to_string(&vec![custom("baker", "Not the baker")]).unwrap(),
        )
        .unwrap();
        let mut faults = Vec::new();
        assert!(load_custom(&dir, &mut faults).is_empty());
        let listed = all(&dir, &mut faults);
        assert_eq!(
            listed.iter().filter(|p| p.id == "baker").count(),
            1,
            "two personas share an id"
        );
        assert!(listed.iter().find(|p| p.id == "baker").unwrap().builtin);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_stored_persona_can_never_claim_to_be_builtin() {
        // `builtin` decides whether the editor lets you delete it. Trusting
        // the file would let a hand-edited entry become undeletable.
        let dir = scratch("liar");
        std::fs::write(
            dir.join(PERSONAS_FILE),
            r#"[{"id":"liar","label":"Liar","sketch":"A long enough description of somebody with a job and a grievance about it.","builtin":true}]"#,
        )
        .unwrap();
        let mut faults = Vec::new();
        let loaded = load_custom(&dir, &mut faults);
        assert_eq!(loaded.len(), 1);
        assert!(!loaded[0].builtin);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn ids_are_derived_from_the_name_and_never_collide() {
        assert_eq!(slug("My Uncle Kiko!"), "my-uncle-kiko");
        assert_eq!(slug("   ---   "), "persona");
        // Ids are ASCII and internal — the LABEL is what anyone reads, and it
        // keeps every character exactly as typed. A name with no ASCII in it
        // at all still gets a usable id, because `unique_id` numbers the
        // duplicates.
        assert_eq!(slug("Ünïcode ok"), "n-code-ok");
        assert_eq!(slug("Мой дядя"), "persona");
        let taken = vec![custom("persona", "Мой дядя")];
        assert_eq!(unique_id("Другой", &taken), "persona-2");

        let mut taken = vec![custom("my-uncle", "My uncle")];
        assert_eq!(unique_id("My uncle", &taken), "my-uncle-2");
        taken.push(custom("my-uncle-2", "My uncle"));
        assert_eq!(unique_id("My uncle", &taken), "my-uncle-3");
        // A built-in's name is taken too, even though it is not in `taken`.
        assert_eq!(unique_id("baker", &[]), "baker-2");
    }

    #[test]
    fn a_persona_has_to_be_a_person_before_it_reaches_a_prompt() {
        assert!(validate("", "a very long and specific description of somebody").is_err());
        assert!(validate("Someone", "warm and curious").is_err(), "adjectives are not a person");
        assert!(validate("Someone", &"x".repeat(MAX_SKETCH + 1)).is_err());
        assert!(validate(&"n".repeat(MAX_LABEL + 1), &"x".repeat(200)).is_err());
        assert!(validate(
            "My uncle",
            "You drive a taxi, you are convinced the radio is lying to you, and your \
             back hurts from a chair you refuse to replace."
        )
        .is_ok());
    }
}
