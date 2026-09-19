//! The Android bridge owns the share sheet; only the native log root crosses it.
#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(target_os = "android")]
struct ShareBridge(tauri::plugin::PluginHandle<tauri::Wry>);

#[cfg(target_os = "android")]
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("diagnostic-sharing")
        .setup(|app, api| {
            app.manage(ShareBridge(api.register_android_plugin(
                "com.freemocap.skellyspeak",
                "DiagnosticSharePlugin",
            )?));
            Ok(())
        })
        .build()
}

#[tauri::command]
pub async fn share_diagnostic_logs(app: tauri::AppHandle) -> crate::model::Result<()> {
    #[cfg(target_os = "android")]
    {
        let root = super::log_root()?;
        app.state::<ShareBridge>()
            .0
            .run_mobile_plugin_async::<serde_json::Value>(
                "share",
                serde_json::json!({"root": root, "nativeVersion": env!("CARGO_PKG_VERSION")}),
            )
            .await
            .map_err(|error| {
                use tauri::plugin::mobile::PluginInvokeError;
                let stage = match error {
                    PluginInvokeError::InvokeRejected(ref response) => {
                        match response.code.as_deref() {
                            Some(
                                code @ ("busy" | "locate_logs" | "create_archive"
                                | "collect_metadata" | "write_archive" | "create_share_uri"
                                | "open_share_sheet"),
                            ) => code,
                            _ => "unknown_plugin_error",
                        }
                    }
                    PluginInvokeError::UnreachableWebview => "unreachable_webview",
                    PluginInvokeError::Jni(_) => "jni",
                    PluginInvokeError::CannotDeserializeResponse(_) => "decode_response",
                    PluginInvokeError::CannotSerializePayload(_) => "encode_request",
                };
                crate::model::AppError::new(
                    crate::model::ErrorCode::Internal,
                    "Could not prepare or share diagnostic logs. Please try again.",
                )
                .with_diagnostics(
                    serde_json::json!({"stage": stage, "untrustedDetailsOmitted": true}),
                )
            })?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err(crate::model::AppError::new(
            crate::model::ErrorCode::Validation,
            "Native log sharing is available on Android.",
        ))
    }
}
