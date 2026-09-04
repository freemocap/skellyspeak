//! The persona editor's IPC surface.
//!
//! The characters live in `personas.rs` because the reply prompt is built from
//! them; the webview asks rather than holding a copy. Built-ins are readable
//! here but every write refuses to touch one — a learner must always be able
//! to get back to a working set.
//!
//! Every load fault is returned alongside the list rather than logged. A
//! personas file that could not be read is exactly the kind of failure that
//! would otherwise show up as "my characters are gone" with no explanation.

use crate::personas::{self, Persona};
use crate::AppState;
use log::info;
use tauri::State;

/// The picker's list, plus anything that went wrong reading it.
#[derive(serde::Serialize)]
pub struct PersonaList {
    pub personas: Vec<Persona>,
    /// Surfaced by the webview through the fault bus. Never swallowed: the
    /// alternative is a learner's saved characters vanishing in silence.
    pub faults: Vec<String>,
}

#[tauri::command]
pub fn list_personas(state: State<'_, AppState>) -> PersonaList {
    let mut faults = Vec::new();
    let personas = personas::all(&state.config_dir, &mut faults);
    PersonaList { personas, faults }
}

/// Create or update one of the learner's own characters.
///
/// `id` empty means "new". An id naming a built-in is refused rather than
/// quietly forked: the picker would then show two entries claiming to be the
/// same person.
#[tauri::command]
pub fn save_persona(
    state: State<'_, AppState>,
    id: String,
    label: String,
    sketch: String,
) -> Result<Persona, String> {
    personas::validate(&label, &sketch)?;
    let id = id.trim().to_string();
    if personas::is_builtin(&id) {
        return Err(
            "That one ships with the app and cannot be changed. Use \"Duplicate\" to make \
             your own version of it."
                .into(),
        );
    }

    let mut faults = Vec::new();
    let mut custom = personas::load_custom(&state.config_dir, &mut faults);
    // A read that failed must not be written back over: saving now would
    // replace the whole file with just this one persona.
    if let Some(fault) = faults.into_iter().next() {
        return Err(fault);
    }

    let label = label.trim().to_string();
    let sketch = sketch.trim().to_string();
    let saved = match custom.iter_mut().find(|p| p.id == id) {
        Some(existing) => {
            existing.label = label;
            existing.sketch = sketch;
            existing.clone()
        }
        None => {
            // Either a genuinely new persona, or an id that no longer exists —
            // which is the same thing as far as the file is concerned.
            let fresh = Persona {
                id: personas::unique_id(if id.is_empty() { &label } else { &id }, &custom),
                label,
                sketch,
                builtin: false,
            };
            custom.push(fresh.clone());
            fresh
        }
    };
    personas::save_custom(&state.config_dir, &custom)?;
    info!("[cmd] persona saved: {} ({})", saved.label, saved.id);
    Ok(saved)
}

/// Remove one of the learner's own characters.
///
/// A conversation still steered to it falls back to `surprise` on its next
/// turn — `personas::resolve` treats an id it cannot find as "pick someone",
/// so a deleted persona cannot leave a chat with no partner.
#[tauri::command]
pub fn delete_persona(state: State<'_, AppState>, id: String) -> Result<(), String> {
    if personas::is_builtin(&id) {
        return Err("That one ships with the app and cannot be deleted.".into());
    }
    let mut faults = Vec::new();
    let mut custom = personas::load_custom(&state.config_dir, &mut faults);
    if let Some(fault) = faults.into_iter().next() {
        return Err(fault);
    }
    let before = custom.len();
    custom.retain(|p| p.id != id);
    if custom.len() == before {
        // Already gone is the state that was asked for.
        return Ok(());
    }
    personas::save_custom(&state.config_dir, &custom)?;
    info!("[cmd] persona deleted: {id}");
    Ok(())
}
