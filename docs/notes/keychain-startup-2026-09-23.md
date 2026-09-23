# Repeated macOS credential authorization — 2026-09-23

## Rejected approach, reverted

The initial change suppressed automatic connection checks, made the shell check
manual, deferred startup credential cleanup and removed masked token reads from
Settings. The user rejected the functionality regression. All those behavior
changes have been reverted, preserving unrelated concurrent work. Automatic
startup/focus/reconnect checks, cleanup and credential previews remain enabled.

## Confirmed cause

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

## Implemented

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
