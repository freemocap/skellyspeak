//! The observability surface: language registry, run trace, execution
//! graph, retry counters, and the pop-out developer window.

use log::info;
use tauri::AppHandle;
// The pop-out window is desktop-only, and so is the trait that opens it.
#[cfg(desktop)]
use tauri::Manager;
use crate::graph;
use crate::languages;
use crate::trace;

// ─── Diagnostics ─────────────────────────────────────────────────────────────

/// Retry counters for the logs overlay. Retries here are ONLY for transient
/// failures (429s, malformed model output fed back for correction) — nothing
/// falls back silently anywhere in the app.
/// The language registry, verbatim from `languages.rs`. The webview holds no
/// language table of its own — it renders what this returns.
#[tauri::command]
pub fn get_languages() -> Vec<languages::LanguageInfo> {
    languages::registry()
}

/// Label of the popped-out observability window. Also listed in
/// `capabilities/default.json` — a window not named there gets no IPC.
pub const DEV_WINDOW_LABEL: &str = "skellyspeak-dev";

/// Pop the observability panel out into its own OS window.
///
/// Built in Rust rather than from JS on purpose: the JS route needs
/// `core:webview:allow-create-webview-window` in the capability set, and
/// there is no reason to hand the webview the ability to spawn windows when
/// the app only ever opens this one. Desktop only — Tauri mobile has no
/// second window.
#[tauri::command]
pub async fn open_dev_window(app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        // Already open: focus it instead of stacking duplicates.
        if let Some(existing) = app.get_webview_window(DEV_WINDOW_LABEL) {
            let _ = existing.unminimize();
            existing.set_focus().map_err(|e| e.to_string())?;
            info!("[cmd] dev window already open - focused");
            return Ok(());
        }
        tauri::WebviewWindowBuilder::new(
            &app,
            DEV_WINDOW_LABEL,
            // Same bundle and same entry point. The frontend routes on the
            // WINDOW LABEL, not a query string: WebviewUrl::App takes a
            // PathBuf, and '?' in a Windows path is asking for trouble.
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("SkellySpeak · observability")
        .inner_size(980.0, 720.0)
        .min_inner_size(420.0, 320.0)
        .resizable(true)
        .build()
        .map_err(|e| format!("could not open the observability window: {e}"))?;
        info!("[cmd] dev window opened");
        Ok(())
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("separate windows are desktop-only; use the dev tab instead".into())
    }
}

/// The execution graph, declared in `graph.rs`. The webview draws only what
/// this returns — there is no second copy of the graph in the frontend.
#[tauri::command]
pub fn get_graph() -> Vec<graph::Graph> {
    graph::all()
}

/// The declared graph diffed against what actually ran. The observability
/// layer reporting on its own fidelity — see `trace::reconcile`.
#[tauri::command]
pub fn get_reconciliation() -> trace::Reconciliation {
    trace::reconcile()
}

/// Every AI run still in memory, oldest first. The observability substrate:
/// one record per agent execution, with per-attempt detail.
#[tauri::command]
pub fn get_runs() -> Vec<trace::Run> {
    trace::snapshot()
}

/// Drop the in-memory run history.
#[tauri::command]
pub fn clear_runs() -> Result<(), String> {
    trace::clear();
    info!("[cmd] run history cleared");
    Ok(())
}

#[tauri::command]
pub fn get_diagnostics() -> Vec<(String, u64)> {
    crate::ai::retry_stats_snapshot()
        .iter()
        .map(|(k, v)| (k.to_string(), *v))
        .collect()
}
