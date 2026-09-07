//! Platform credential storage. Secrets never belong in the preferences file.

use std::collections::HashMap;
use std::path::Path;
use keyring_core::{Entry, Error};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[cfg(target_os = "android")]
use jni::{JNIEnv, objects::{JObject, GlobalRef}};
#[cfg(target_os = "android")]
use std::sync::OnceLock;

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn Java_com_freemocap_skellyspeak_MainActivity_initializeCredentials(
    mut env: JNIEnv, _activity: JObject, context: JObject,
) {
    static CONTEXT: OnceLock<GlobalRef> = OnceLock::new();
    if CONTEXT.get().is_some() { return; }
    let result = (|| -> Result<(), String> {
        let reference = env.new_global_ref(context).map_err(|e| e.to_string())?;
        let vm = env.get_java_vm().map_err(|e| e.to_string())?;
        let pointer = reference.as_obj().as_raw();
        CONTEXT.set(reference).map_err(|_| "Android context initialized concurrently".to_string())?;
        // The global reference remains alive for the lifetime of the process.
        unsafe { ndk_context::initialize_android_context(vm.get_java_vm_pointer().cast(), pointer.cast()); }
        Ok(())
    })();
    if let Err(error) = result {
        env.throw_new("java/lang/IllegalStateException", error).expect("could not report credential initialization failure");
    }
}

#[derive(Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Secrets {
    pub openrouter_key: String,
    pub groq_key: String,
    pub custom_api_key: String,
    pub hosted_token: String,
}

pub fn initialize() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    use windows_native_keyring_store::Store;
    #[cfg(target_os = "macos")]
    use apple_native_keyring_store::keychain::Store;
    #[cfg(target_os = "ios")]
    use apple_native_keyring_store::protected::Store;
    #[cfg(target_os = "linux")]
    use zbus_secret_service_keyring_store::Store;
    #[cfg(target_os = "android")]
    use android_native_keyring_store::Store;
    let store = Store::new_with_configuration(&HashMap::new())
        .map_err(|e| format!("Could not open the platform credential store: {e}"))?;
    keyring_core::set_default_store(store);
    Ok(())
}

fn entry(dir: &Path) -> Result<Entry, String> {
    let path = dir.canonicalize().map_err(|e| format!("Credential directory is inaccessible: {e}"))?;
    let user: String = Sha256::digest(path.to_string_lossy().as_bytes())
        .iter().map(|byte| format!("{byte:02x}")).collect();
    Entry::new("com.freemocap.skellyspeak", &user)
        .map_err(|e| format!("Could not open application credentials: {e}"))
}

pub fn read(dir: &Path) -> Result<Option<Secrets>, String> {
    match entry(dir)?.get_password() {
        Ok(raw) => serde_json::from_str(&raw).map(Some).map_err(|e| format!("Stored credentials are invalid: {e}")),
        Err(Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Could not read application credentials: {e}")),
    }
}

pub fn clear(dir: &Path) -> Result<(), String> {
    match entry(dir)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Could not erase application credentials: {error}")),
    }
}

pub fn write(dir: &Path, secrets: &Secrets) -> Result<(), String> {
    let raw = serde_json::to_string(secrets).map_err(|e| format!("Credential serialization failed: {e}"))?;
    entry(dir)?.set_password(&raw).map_err(|e| format!("Could not store application credentials: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inline_credentials_move_to_the_vault_and_failed_preferences_preserve_it() {
        keyring_core::set_default_store(keyring_core::mock::Store::new().unwrap());
        let dir = tempfile::tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");
        let settings = crate::settings::Settings {
            openrouter_key: "test-secret-do-not-write".into(),
            ..crate::settings::Settings::default()
        };
        std::fs::write(&settings_path, serde_json::to_vec(&settings).unwrap()).unwrap();
        let loaded = crate::settings::load_or_create(dir.path());
        assert!(loaded.fault.is_none(), "{:?}", loaded.fault);
        assert_eq!(loaded.settings.openrouter_key, settings.openrouter_key);
        let public = std::fs::read_to_string(&settings_path).unwrap();
        assert!(!public.contains("test-secret"));
        assert!(!public.contains("openrouter_key"));
        assert_eq!(crate::settings::load_or_create(dir.path()).settings.openrouter_key, settings.openrouter_key);

        std::fs::remove_file(&settings_path).unwrap();
        std::fs::create_dir(&settings_path).unwrap();
        assert!(crate::settings::persist(dir.path(), &crate::settings::Settings::default()).is_err());
        assert_eq!(read(dir.path()).unwrap().unwrap().openrouter_key, settings.openrouter_key);
    }
}
