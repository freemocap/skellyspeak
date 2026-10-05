# iOS diagnostic sharing

## Observed cause

The export UI recognized only Android as supporting sharing. iOS used
`save_diagnostic_logs`, which wrote a ZIP to the sandbox Documents directory and
returned the internal path. There was no iOS share-sheet integration.

## Source implementation

- Native iPhone/iPad UI now selects Share logs, including iPadOS desktop user agents.
- Rust creates the existing allowlisted diagnostic ZIP in app cache and passes
  only that file to a private Tauri Swift plugin. It preserves the archive until
  the system sheet completes or is cancelled, then removes it.
- UIKit presents a file attachment through UIActivityViewController, with an iPad
  popover anchor. The system supplies sharing destinations and Save to Files.
- The old save IPC command also uses this flow on iOS; it no longer returns an
  inaccessible path. Cancellation produces no saved-path confirmation.
- Plugin failures retain their stage and redacted reason; completion errors retain
  NSError domain/code and explicitly omit userInfo and destination data.
- No workspace data format, release version, Android export or desktop destination
  changes. No deployment or release has been performed.

Integration follows [Tauri mobile plugin development](https://v2.tauri.app/develop/plugins/develop-mobile/)
and Apple's [UIActivityViewController](https://developer.apple.com/documentation/uikit/uiactivityviewcontroller)
presentation contract. The private plugin's build script links its Swift package;
the generated Apple project is not an authored integration point.

## Verification

Local verification on Windows, 2026-10-05:

- `npm run check:fast`: passed.
- `npm run build`: passed (existing bundle-size advisory).
- Affected UI regression suites: 11 tests passed, covering native mobile/desktop
  selection, iPadOS desktop identification, browser previews and button behavior.
  The first sandboxed Vitest launch could not read the Vite configuration; the
  rerun outside that restriction passed after correcting the jsdom touch fixture.
- README Clippy command: passed.
- README native library test command: 822 passed, 5 ignored, none failed.
- Private plugin Rust formatting, documentation links and diff whitespace: passed.

These checks do not compile the iOS-only Rust/Swift integration. Windows cannot
compile UIKit or run the iOS share sheet; iOS compilation and device behavior
remain unverified.

Required iOS checks: build through the normal Tauri iOS workflow on macOS, open
Share logs from More and an error panel on iPhone and iPad, save the ZIP to Files
and open it, send to a sharing destination, dismiss and retry, and verify errors
remain retryable. Check that the archive contains structured logs and its manifest,
and that temporary archives are removed after completion/cancellation. A process
termination during sharing can leave a cache ZIP for the OS to evict.
