//! Rust owns archive creation and lifetime; UIKit owns export destinations.
use crate::model::{AppError, ErrorCode, Result};
use tauri::Manager;

fn failure() -> AppError {
    AppError::new(ErrorCode::Storage, "Could not share diagnostic logs.")
}

pub(super) async fn share(app: &tauri::AppHandle) -> Result<()> {
    let root = crate::diagnostics::log_root()?;
    let directory = app
        .path()
        .app_cache_dir()
        .map_err(|cause| {
            crate::diagnostics::failures::platform(&cause, "share_logs_directory", &[], failure())
        })?
        .join("diagnostic-shares");
    let archive = tauri::async_runtime::spawn_blocking(move || {
        std::fs::create_dir_all(&directory).map_err(|cause| {
            crate::diagnostics::response::io_context(&cause, "share_logs_directory", failure())
        })?;
        crate::diagnostics::archive::save(&root, &directory)
    })
    .await
    .map_err(|cause| {
        crate::diagnostics::failures::join(&cause, "share_logs_worker", failure())
    })??;
    // The bridge resolves on completion/cancellation, not merely on presentation.
    let result = tauri_plugin_diagnostic_sharing::share(app, &archive)
        .await
        .map_err(|cause| {
            use tauri::plugin::mobile::PluginInvokeError;
            let stage = match &cause {
                PluginInvokeError::InvokeRejected(response) => match response.code.as_deref() {
                    Some(
                        code @ ("busy" | "read_archive" | "open_share_sheet" | "share_completion"),
                    ) => code,
                    _ => "unknown_plugin_error",
                },
                PluginInvokeError::UnreachableWebview => "unreachable_webview",
                PluginInvokeError::CannotDeserializeResponse(_) => "decode_response",
                PluginInvokeError::CannotSerializePayload(_) => "encode_request",
            };
            crate::diagnostics::failures::platform(&cause, stage, &[], failure())
        });
    if let Err(cause) = std::fs::remove_file(&archive) {
        let cleanup =
            crate::diagnostics::response::io_context(&cause, "share_logs_cleanup", failure());
        return match result {
            Ok(()) => Err(cleanup),
            Err(mut error) => {
                let details = error
                    .diagnostics
                    .get_or_insert_with(|| serde_json::json!({}));
                details["cleanup_error"] =
                    crate::diagnostics::response::error_metadata(&cleanup, &[]);
                Err(error)
            }
        };
    }
    result
}
