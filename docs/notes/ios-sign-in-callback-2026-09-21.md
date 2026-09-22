# iOS sign-in callback and recovery

## Observed on the device

Read the attached iPad's structured SkellySpeak 2.2.2 logs over its paired USB
connection. One `hosted_sign_in` ran for 300,011 ms and failed with “Sign-in timed
out. Try again.” A later attempt remained pending while subsequent requests
reported “Sign-in is already in progress.” Other configuration requests succeeded.
The supplied system log also showed WebKit processing taps after returning to the
app. This establishes an uncompleted callback wait, not a confirmed process freeze
or a completed account/token exchange.

The settings view disabled controls and prevented normal closure during the
pending operation, without showing sign-in progress or a cancellation action.
Removing the view through another navigation path did not cancel the native
attempt. These are confirmed source-level recovery defects.

## Implemented source changes

- iOS registers a native lifecycle plugin at startup and handles `RunEvent::Opened`
  directly. It no longer relies on the general deep-link event broadcast or keeps
  callback URLs in that plugin's current-URL cache. The deep-link dependency and
  configuration still generate the iOS URL-scheme registration at build time.
  Android retains its existing deep-link transport.
- Both mobile paths use the same one-time callback extraction. The existing
  scheme, authority, path, state, code, and PKCE checks remain in force. Delivery
  wakes the awaiting task after releasing the pending-slot lock.
- Native diagnostic events identify callback receipt, validation, delivery and
  code exchange. They contain authored codes and numeric outcomes, not URLs,
  state values, login codes or tokens. Callback timeouts identify the wait stage.
- Settings shows pending sign-in status and an enabled Cancel action. Cancellation
  uses the existing native epoch mechanism; the form remains locked until the
  original operation settles. Unmounting a view with pending sign-in requests
  cancellation. Progress/action text is included in all seven interface locales.

The direct callback route is a candidate correction for the failed handoff. The
old capture cannot distinguish an undelivered OS event, an event-relay problem,
or a URL rejected by validation. It does not prove which caused this device's
timeout. Changing the relay alone cannot repair a callback the OS never delivers.

## Verification

- UI suite: 161 files, 1,082 tests passed, including five new sign-in recovery tests.
- Native suite: 528 passed, six ignored.
- Rust formatting and Clippy with warnings denied passed.
- Shared mobile code type-checked with `cargo check --locked --target
  aarch64-linux-android --lib` and the installed Android NDK. This covers the
  mobile browser/wait/exchange code, not UIKit integration.
- Four callback tests passed, including the actual lifecycle plugin invoked with
  `RunEvent::Opened` using Tauri's mock runtime on macOS, with no webview or
  deep-link broadcast. Cases include duplicate delivery, wrong/stale state,
  unrelated URLs, provider refusal and invalid codes.
- UI production build, localization checks, contract drift check, stylesheet
  check and iOS release-tool checks passed. The build reports the existing large
  JavaScript-chunk advisory.

Follow-up local setup: Xcode 27.0 and its iOS SDK are now installed, along with
CocoaPods and the Rust `aarch64-apple-ios` target. The paired iPad has Developer
Mode enabled. The actual iOS `cargo check --locked --target aarch64-apple-ios
--lib --features tauri/custom-protocol` passed, and Tauri produced an unsigned
Debug archive at `native/gen/apple/build/skellyspeak_iOS.xcarchive`.
The initial CLI archive used its default bundle version; rebuild with an explicit
version from `native/Cargo.toml` when signing the installable build.

No build has been installed: the local keychain reports zero valid signing
identities. The user was asked to add their SkellySpeak Apple account/team and
create an Apple Development certificate in Xcode. Neither the compile check nor
the mock runtime tests establish UIKit callback delivery, successful Google
sign-in, or credential persistence on the device.

## Required device verification

Build and install the patch through the authorized iOS development/distribution
workflow. Reproduce Google sign-in and verify that the app shows the signed-in
account and usable settings. Also cancel an attempt and retry, and leave/reopen
settings during an attempt. If completion still fails, retrieve the new native
diagnostic events to distinguish callback delivery from validation/exchange.

Changes are uncommitted. No release, server deployment or app-data reset was done.
