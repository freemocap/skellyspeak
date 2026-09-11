use crate::model::{AppError, ErrorCode, Result};
use zeroize::Zeroizing;

fn unavailable() -> AppError {
    AppError::new(
        ErrorCode::Credential,
        "Secure credential storage is unavailable or access was denied. Check your system keychain.",
    )
}
#[cfg(not(target_os = "android"))]
fn entry(id: &str) -> Result<keyring::Entry> {
    keyring::Entry::new("org.skellyspeak.practice.openrouter", id).map_err(|_| unavailable())
}
#[cfg(target_os = "android")]
use keyring_core as keyring;
#[cfg(target_os = "android")]
fn entry(id: &str) -> Result<keyring_core::Entry> {
    keyring_core::Entry::new("com.freemocap.skellyspeak", id).map_err(|_| unavailable())
}
#[cfg(target_os = "android")]
#[unsafe(no_mangle)]
pub extern "system" fn Java_com_freemocap_skellyspeak_MainActivity_initializeCredentials(
    mut env: jni::JNIEnv,
    _activity: jni::objects::JObject,
    context: jni::objects::JObject,
) {
    static CONTEXT: std::sync::OnceLock<jni::objects::GlobalRef> = std::sync::OnceLock::new();
    if CONTEXT.get().is_some() {
        return;
    }
    let result = (|| -> std::result::Result<(), ()> {
        let reference = env.new_global_ref(context).map_err(|_| ())?;
        let vm = env.get_java_vm().map_err(|_| ())?;
        let pointer = reference.as_obj().as_raw();
        CONTEXT.set(reference).map_err(|_| ())?;
        // The global reference retains the application context for the process lifetime.
        unsafe {
            ndk_context::initialize_android_context(
                vm.get_java_vm_pointer().cast(),
                pointer.cast(),
            );
        }
        let store = android_native_keyring_store::Store::new_with_configuration(
            &std::collections::HashMap::new(),
        )
        .map_err(|_| ())?;
        keyring_core::set_default_store(store);
        Ok(())
    })();
    if result.is_err() {
        env.throw_new(
            "java/lang/IllegalStateException",
            "Secure credential initialization failed",
        )
        .expect("could not report credential initialization failure");
    }
}
pub fn save(id: &str, secret: &str) -> Result<()> {
    #[cfg(any(
        target_os = "macos",
        target_os = "ios",
        target_os = "windows",
        target_os = "linux",
        target_os = "android"
    ))]
    {
        entry(id)?.set_password(secret).map_err(|_| unavailable())
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "ios",
        target_os = "windows",
        target_os = "linux",
        target_os = "android"
    )))]
    {
        let _ = (id, secret);
        Err(unavailable())
    }
}
pub fn read(id: &str) -> Result<Zeroizing<String>> {
    #[cfg(any(
        target_os = "macos",
        target_os = "ios",
        target_os = "windows",
        target_os = "linux",
        target_os = "android"
    ))]
    {
        entry(id)?
            .get_password()
            .map(Zeroizing::new)
            .map_err(|_| unavailable())
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "ios",
        target_os = "windows",
        target_os = "linux",
        target_os = "android"
    )))]
    {
        let _ = id;
        Err(unavailable())
    }
}
pub fn remove(id: &str) -> Result<()> {
    #[cfg(any(
        target_os = "macos",
        target_os = "ios",
        target_os = "windows",
        target_os = "linux",
        target_os = "android"
    ))]
    {
        match entry(id)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(unavailable()),
        }
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "ios",
        target_os = "windows",
        target_os = "linux",
        target_os = "android"
    )))]
    {
        let _ = id;
        Err(unavailable())
    }
}
