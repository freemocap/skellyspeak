# Repeated macOS credential authorization — 2026-09-23

## Rejected approach, reverted

The initial change suppressed automatic connection checks, made the shell check
manual, deferred startup credential cleanup and removed masked token reads from
Settings. The user rejected the functionality regression. All those behavior
changes have been reverted, preserving unrelated concurrent work. Automatic
startup/focus/reconnect checks, cleanup and credential previews remain enabled.

## Initial finding (incomplete; see correction below)

`codesign -d -r- -vv native/target/debug/skellyspeak` reported:

- `Signature=adhoc`, `flags=0x20002(adhoc,linker-signed)`;
- a designated requirement consisting solely of `cdhash H"…"`;
- no certificate identity.

A changed executable therefore changes the identity Keychain remembers. The normal
`macos:dev` route used standard Tauri dev without certificate signing. The separate
`macos:dev-signed` route had stable signing but lacked native watching and was not
used by the normal launcher. The existing local development signing certificate
was confirmed outside the tool sandbox; sandboxed identity lookup returned none.

Apple documents that ad-hoc identity is specific to one version of the code:
[Inside Code Signing: Requirements](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements).
See also [Code Signing In Depth](https://developer.apple.com/library/archive/technotes/tn2206/).

## Initial implementation (superseded signing choice)

`tools/tauri.ts` now supplies a Cargo executable runner for macOS desktop dev.
Tauri still owns Cargo builds and the watcher. Immediately before launch,
`tools/macos-dev-runner.ts` signs and verifies the executable, then uses Node 24
`process.execve` to preserve process/cancellation ownership. Cargo/app argument
separators are preserved; build and mobile commands do not receive this runner.

`tools/macos-signing.ts` shares identity selection and verification with the
standalone bundle launcher. Both use `com.freemocap.skellyspeak` and an explicit
designated requirement binding that identifier to the existing certificate's
fingerprint. Code hashes change; this requirement does not. Signing failure stops
launch rather than silently falling back to an ad-hoc identity. No credential ACLs,
certificate trust, saved secrets or workspace data were changed.

Existing running launchers need one restart to adopt the new runner. Existing
credentials may need one authorization for this certificate-bound identity. An
actual Keychain “Always Allow” interaction across app launches remains to verify;
matching designated requirements establish the identity prerequisite, not proof
that the user's existing ACL has already been updated.

## Verification

- 40 UI tests passed, covering automatic checks on startup/remount, revision
  changes and reconnect for both service routes, focus deduplication, shell,
  access settings and cleanup recovery.
- Launcher TypeScript checks passed.
- 4 launcher tests passed including the opt-in real macOS Cargo/signing test:
  compiled and executed two different versions of a disposable executable,
  confirmed different code hashes and identical designated requirements, and
  verified the second build against the first build's requirement.
- Reusing an already signed artifact passes without signing again. Cargo may
  restore its cached ad-hoc executable before `cargo run`; the runner signs that
  restored artifact again with the same certificate and requirement.
- No commit, deployment, certificate installation or real credential read was
  performed. No active application process was terminated for this test.


## Confirmed second failure and correction — 13:45–13:52

The launcher was restarted at 13:38 with signing enabled. Both the 13:38 and
13:45 launches used the same certificate-bound designated requirement. This was
not an HMR failure to adopt the launcher.

macOS `securityd` logged at 13:45:46:

- `ACL partition mismatch: client cdhash:bece…`;
- a partition list containing individual historical build hashes;
- a prompt for action 65538, followed at 13:45:53 by “always allow” and adding
  that build's `cdhash` partition.

The self-signed certificate had no Apple Team ID. The first fix stabilized the
app's designated requirement but missed securityd's independent partition check.
[Apple's securityd implementation](https://github.com/apple-oss-distributions/Security/blob/main/securityd/src/clientid.cpp)
uses a certificate Team ID for recognized Apple developer signatures, and falls
back to the code hash for other signed code. Merely comparing designated
requirements did not test this requirement.

The default signer now selects an existing, valid Apple Development identity for
FreeMoCap's team U8LBJLBYPR (the same team used by release configuration). Both
launcher routes verify Apple certificate provenance against the developer partition
requirement and require a Team ID before launching. Self-signed overrides are
rejected. No broad Keychain ACL changes, password extraction or trust changes.

Added structured launcher signing phases and identity metadata, and native
credential-cache/Keychain I/O timing without credential identifiers or content.
Existing native failures still retain their redacted OS diagnostics.

Verification: five signing/runner tests passed, including real rebuilt binaries
with the same Team ID and designated requirement. A separate actual Keychain test
passed: an Apple-signed fixture created a unique disposable credential, a different
build read it twice with system interaction disabled, and the creator deleted it.
No password prompt could be accepted during that test. Three native credential
cache tests and launcher TypeScript checks passed. This establishes cross-build
access for a real test item; the existing user's item still needs authorization
for the newly selected Apple identity, which has not yet been observed.

The old launcher pins the former self-signed fingerprint and stopped at the new
validation instead of launching another known-bad build. It must be replaced by
the corrected launcher to select the Apple certificate.

At 13:52 the corrected launcher was started. The actual app's verified signature
reports Team ID U8LBJLBYPR and the Apple Development certificate. Its native log
records the first credential read starting (PID 35001); authorization of the
existing credential was still pending at that observation. This launch is in
`.local/logs/app-2026-09-23T17-52-11.890Z-1ba1e11e-4eb3-45a1-90ef-871744b414b7/`.
Rust Clippy (`--lib --tests -- -D warnings`) also passed.
