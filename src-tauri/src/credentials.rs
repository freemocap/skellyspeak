use crate::model::{AppError, ErrorCode, Result};
use zeroize::Zeroizing;

fn unavailable() -> AppError {
    AppError::new(
        ErrorCode::Credential,
        "Secure credential storage is unavailable or access was denied. Check your system keychain.",
    )
}
#[cfg(any(
    target_os = "macos",
    target_os = "ios",
    target_os = "windows",
    target_os = "linux"
))]
fn entry(id: &str) -> Result<keyring::Entry> {
    keyring::Entry::new("org.skellyspeak.practice.openrouter", id).map_err(|_| unavailable())
}
pub fn save(id: &str, secret: &str) -> Result<()> {
    #[cfg(any(
        target_os = "macos",
        target_os = "ios",
        target_os = "windows",
        target_os = "linux"
    ))]
    {
        entry(id)?.set_password(secret).map_err(|_| unavailable())
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "ios",
        target_os = "windows",
        target_os = "linux"
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
        target_os = "linux"
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
        target_os = "linux"
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
        target_os = "linux"
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
        target_os = "linux"
    )))]
    {
        let _ = id;
        Err(unavailable())
    }
}
