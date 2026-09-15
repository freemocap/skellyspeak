use super::{Proof, exchange, fault, mobile_callback, start_url};
use crate::model::Result;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;
use zeroize::Zeroizing;

type Pending = Option<(String, tokio::sync::oneshot::Sender<Result<String>>)>;
fn pending() -> &'static Mutex<Pending> {
    static SLOT: OnceLock<Mutex<Pending>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}
struct Attempt(String);
impl Drop for Attempt {
    fn drop(&mut self) {
        let mut slot = pending().lock().expect("sign-in lock poisoned");
        if slot.as_ref().is_some_and(|(state, _)| state == &self.0) {
            slot.take();
        }
    }
}

pub async fn sign_in(app: &tauri::AppHandle) -> Result<Zeroizing<String>> {
    static HANDLER: OnceLock<()> = OnceLock::new();
    HANDLER.get_or_init(|| {
        app.deep_link().on_open_url(|event| {
            let mut slot = pending().lock().expect("sign-in lock poisoned");
            let Some((state, _)) = slot.as_ref() else {
                return;
            };
            let result = event
                .urls()
                .iter()
                .find_map(|url| mobile_callback(url, state));
            if let Some(result) = result {
                if let Some((_, sender)) = slot.take() {
                    let _ = sender.send(result);
                }
            }
        });
    });
    let proof = Proof::create()?;
    let (sender, receiver) = tokio::sync::oneshot::channel();
    *pending()
        .lock()
        .map_err(|_| fault("Sign-in state unavailable."))? =
        Some((proof.challenge.clone(), sender));
    // Removes the pending sender on timeout, cancellation, or browser failure.
    let _attempt = Attempt(proof.challenge.clone());
    app.opener()
        .open_url(
            start_url("skellyspeak://auth", &proof.challenge)?,
            None::<&str>,
        )
        .map_err(|_| fault("Could not open your system browser."))?;
    let code = Zeroizing::new(
        tokio::time::timeout(Duration::from_secs(300), receiver)
            .await
            .map_err(|_| fault("Sign-in timed out. Try again."))?
            .map_err(|_| fault("Sign-in was cancelled."))??,
    );
    exchange(&code, &proof.verifier).await
}
