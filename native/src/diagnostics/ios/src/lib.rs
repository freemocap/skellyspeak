//! Private iOS presentation adapter. Archive ownership remains in the application.
use tauri::Manager;

tauri::ios_plugin_binding!(init_plugin_diagnostic_sharing);

struct ShareBridge(tauri::plugin::PluginHandle<tauri::Wry>);

pub fn init() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("diagnostic-sharing")
        .setup(|app, api| {
            app.manage(ShareBridge(
                api.register_ios_plugin(init_plugin_diagnostic_sharing)?,
            ));
            Ok(())
        })
        .build()
}

pub async fn share(
    app: &tauri::AppHandle,
    path: &std::path::Path,
) -> Result<(), tauri::plugin::mobile::PluginInvokeError> {
    app.state::<ShareBridge>()
        .0
        .run_mobile_plugin_async::<serde_json::Value>("share", serde_json::json!({"path": path}))
        .await?;
    Ok(())
}
