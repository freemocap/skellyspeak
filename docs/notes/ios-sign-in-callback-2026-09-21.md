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

No build has been installed. Follow-up signing setup created a Personal Team
Apple Development identity. Its missing Apple WWDR G3 intermediate was downloaded
from Apple's official PKI endpoint, verified, and added to the login keychain
without trust overrides; the signing identity now validates.

A signed development build with explicit version 2.2.4 and Personal Team
`N2Q2VACXFB` failed at Apple's registration/provisioning step: the existing
`com.freemocap.skellyspeak` identifier is unavailable to this team. The release
workflow uses team `U8LBJLBYPR`; access to that team is needed to sign the existing
identifier. No release or signing-profile workaround was applied. Neither the compile check nor
the mock runtime tests establish UIKit callback delivery, successful Google
sign-in, or credential persistence on the device.

## Required device verification

Build and install the patch through the authorized iOS development/distribution
workflow. Reproduce Google sign-in and verify that the app shows the signed-in
account and usable settings. Also cancel an attempt and retry, and leave/reopen
settings during an attempt. If completion still fails, retrieve the new native
diagnostic events to distinguish callback delivery from validation/exchange.

Changes are uncommitted. No release, server deployment or app-data reset was done.

## Follow-up device investigation, September 22

The correct FreeMoCap Foundation Apple Development identity is now available
(team U8LBJLBYPR). Registered the paired iPad with that team using Xcode's
explicit device destination and provisioning-device registration. The native
build reached codesign with an iOS Team Provisioning Profile for the existing
app identifier, and is waiting for signing-key access. No local installation
has completed yet.

Retrieved the device's release 2.2.5 structured logs through devicectl. They
show hosted_waiting_for_callback followed by hosted_callback_received with
url_count=1 and pending=1, then hosted_callback_ignored and the five-minute
timeout. Thus the new lifecycle hook did receive this callback; validation
rejected it. The earlier relay-failure hypothesis does not explain this captured
attempt.

Added authored rejection categories for the individual URL/state checks while
preserving validation behavior. These log no actual URLs, state values or
codes. Five callback tests pass, including the new rejection-category test.
The local diagnostic build must be installed and the login repeated to identify
the specific rejected field before a further behavioral fix.

## Local installation completed

The signed diagnostic v2.2.5 archive passed codesign verification and was installed
on the paired iPad using devicectl. Launch succeeded. The user was asked to repeat
Google sign-in so the authored rejection category can identify the failing check.
This is a development installation, not a release or server deployment.

### Safari invalid-address error: local bundle registration

The user reported Safari could not open the return address. Inspection of both
local generated and archived app Info.plist files found no CFBundleURLTypes.
The diagnostic build therefore could not register `skellyspeak://` with iOS.
Added the scheme explicitly to the application-owned `native/Info.plist`;
the rebuilt archive now contains the expected CFBundleURLTypes entry, and its
signature passes `codesign --verify --deep --strict`. This is a confirmed
packaging defect in the local build. It does not establish why the earlier
release received a callback and rejected it. End-to-end sign-in remains pending
an actual account login with the corrected diagnostic build.

### Confirmed callback rejection after URL registration repair

The next real iPad login (debug process 810) recorded, in order:
`hosted_waiting_for_callback`, `hosted_callback_received` with pending=1,
`hosted_callback_fragment`, and `hosted_callback_ignored`. Native iOS event
delivery works; the callback validator rejects the URL fragment and leaves the
attempt waiting. The fragment's content was not logged or inspected.

Removed the blanket fragment rejection. The callback continues to validate the
scheme, authority, path, total URL size and exactly one matching query state.
Only query parameters supply the login code, which is exchanged using PKCE;
fragment fields cannot supply or override credentials. Browser fragment inheritance
across redirects is specified in RFC 9110 section 10.2.2:
https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.2
This explains a possible source of the fragment, not its observed provenance.

All six mobile callback tests pass, including empty/nonempty fragments, misleading
fragment credentials, missing/mismatched/duplicate query state, and missing query
code. Real iPad account exchange remains unverified until the updated build is
installed and the user completes a fresh login.

### User verification

After installing the fragment-handling fix, the user confirmed: “ok that worked!”
This verifies the reported iPad sign-in flow through user observation. Desktop
uses a loopback HTTP callback; HTTP request targets exclude URL fragments, whereas
the iOS native URL event delivered a fragment and hit the former rejection guard.
Android shares the mobile validator and benefits from this fix, but no Android
callback capture establishes whether its browser supplied a fragment. Changes
remain uncommitted and no release or server deployment was performed.
