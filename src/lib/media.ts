/// Getting at the browser microphone API, and saying something useful when it
/// is missing.

/// The browser microphone API, or an error rather than a TypeError.
///
/// Only the **mobile** recorder reaches this. Desktop records in the core with
/// cpal, because `navigator.mediaDevices` exists only in a secure context and
/// WKWebView does not treat Tauri's `tauri://localhost` scheme as one — a
/// packaged macOS build has no browser recording API at all. Windows and
/// Android are served `http://tauri.localhost`, and Linux marks its custom
/// scheme secure, so those three do have it; desktop simply does not use it.
///
/// So reaching the throw below means an Android webview that did not provide
/// audio capture, which is not something the app can work around.
export function mediaDevices(): MediaDevices {
  const devices = navigator.mediaDevices
  if (!devices) {
    throw new Error(
      'This device did not offer a microphone to the app. Its system webview ' +
        'may be out of date, or audio capture may be blocked for this app in ' +
        'Android settings. Type your reply instead for now.'
    )
  }
  return devices
}
