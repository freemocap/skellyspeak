#[cfg(any(target_os = "android", target_os = "ios"))]
use super::fault;
use super::mobile_callback;
#[cfg(any(target_os = "android", target_os = "ios"))]
use super::{Proof, exchange, start_url};
use crate::model::Result;
#[cfg(any(
    target_os = "android",
    target_os = "ios",
    all(test, target_os = "macos")
))]
use std::sync::{Mutex, OnceLock};
#[cfg(any(target_os = "android", target_os = "ios"))]
use std::time::Duration;
#[cfg(target_os = "android")]
use tauri_plugin_deep_link::DeepLinkExt;
#[cfg(any(target_os = "android", target_os = "ios"))]
use tauri_plugin_opener::OpenerExt;
#[cfg(any(target_os = "android", target_os = "ios"))]
use zeroize::Zeroizing;

type Pending = Option<(String, tokio::sync::oneshot::Sender<Result<String>>)>;
#[cfg(any(
    target_os = "android",
    target_os = "ios",
    all(test, target_os = "macos")
))]
fn pending() -> &'static Mutex<Pending> {
    static SLOT: OnceLock<Mutex<Pending>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}
#[cfg(any(target_os = "android", target_os = "ios"))]
struct Attempt(String);
#[cfg(any(target_os = "android", target_os = "ios"))]
impl Drop for Attempt {
    fn drop(&mut self) {
        let mut slot = pending().lock().expect("sign-in lock poisoned");
        if slot.as_ref().is_some_and(|(state, _)| state == &self.0) {
            slot.take();
        }
    }
}

/// iOS URL delivery belongs to the native lifecycle, not a webview event relay.
/// Keep callback codes out of the plugin's general event broadcast/current-URL cache.
#[cfg(any(target_os = "ios", all(test, target_os = "macos")))]
pub fn ios_callback_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("hosted-sign-in-callback")
        .on_event(|_, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                receive_urls(urls);
            }
        })
        .build()
}

fn take_callback(
    slot: &mut Pending,
    urls: &[reqwest::Url],
) -> Option<(tokio::sync::oneshot::Sender<Result<String>>, Result<String>)> {
    let (state, _) = slot.as_ref()?;
    let result = urls.iter().find_map(|url| mobile_callback(url, state))?;
    slot.take().map(|(_, sender)| (sender, result))
}

#[cfg(any(
    target_os = "android",
    target_os = "ios",
    all(test, target_os = "macos")
))]
fn receive_urls(urls: &[reqwest::Url]) {
    let callback = {
        let Ok(mut slot) = pending().lock() else {
            crate::diagnostics::native_event("hosted_callback_lock_failed", &[]);
            return;
        };
        crate::diagnostics::native_event(
            "hosted_callback_received",
            &[
                ("url_count", urls.len() as u64),
                ("pending", u64::from(slot.is_some())),
            ],
        );
        if let Some((state, _)) = slot.as_ref() {
            for url in urls {
                if let Some(reason) = super::mobile_callback_rejection(url, state) {
                    crate::diagnostics::native_event(reason, &[]);
                }
            }
        }
        take_callback(&mut slot, urls)
    };
    if let Some((sender, result)) = callback {
        crate::diagnostics::native_event(
            "hosted_callback_validated",
            &[("accepted", u64::from(result.is_ok()))],
        );
        // Wake the task only after releasing the slot; cancellation drops Attempt.
        let delivered = sender.send(result).is_ok();
        crate::diagnostics::native_event(
            "hosted_callback_delivered",
            &[("delivered", u64::from(delivered))],
        );
    } else {
        crate::diagnostics::native_event("hosted_callback_ignored", &[]);
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
pub async fn sign_in(app: &tauri::AppHandle) -> Result<Zeroizing<String>> {
    #[cfg(target_os = "android")]
    {
        static HANDLER: OnceLock<()> = OnceLock::new();
        HANDLER.get_or_init(|| {
            app.deep_link()
                .on_open_url(|event| receive_urls(&event.urls()));
        });
    }
    let proof = Proof::create()?;
    let (sender, receiver) = tokio::sync::oneshot::channel();
    *pending().lock().map_err(|_| {
        crate::diagnostics::failures::poisoned(fault("Sign-in state unavailable."))
    })? = Some((proof.challenge.clone(), sender));
    // Removes the pending sender on timeout, cancellation, or browser failure.
    let _attempt = Attempt(proof.challenge.clone());
    let browser_url = start_url("skellyspeak://auth", &proof.challenge)?;
    app.opener()
        .open_url(&browser_url, None::<&str>)
        .map_err(|cause| {
            crate::diagnostics::failures::platform(
                &cause,
                "hosted_sign_in_browser",
                &[&browser_url, &proof.challenge],
                fault("Could not open your system browser."),
            )
        })?;
    crate::diagnostics::native_event("hosted_waiting_for_callback", &[]);
    let code = Zeroizing::new(
        tokio::time::timeout(Duration::from_secs(300), receiver)
            .await
            .map_err(|_| {
                fault("Sign-in timed out. Try again.").with_diagnostics(
                    serde_json::json!({"stage":"hosted_callback_wait", "timeout_seconds":300}),
                )
            })?
            .map_err(|_| fault("Sign-in was cancelled."))??,
    );
    crate::diagnostics::native_event("hosted_code_exchange_started", &[]);
    let result = exchange(&code, &proof.verifier).await;
    crate::diagnostics::native_event(
        "hosted_code_exchange_finished",
        &[("succeeded", u64::from(result.is_ok()))],
    );
    result
}

#[cfg(test)]
#[path = "hosted_mobile_tests.rs"]
mod tests;
