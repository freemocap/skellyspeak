# Release recovery proposal

Status: recovery worktree restored; local reliability fixes and verification in progress.
The user performs Git mutations. Main and the rebuild worktree remain unchanged.
Prerequisite satisfied: workflow 34497425319 deployed e05a870 successfully;
all eight TTL policies are ACTIVE, exact revision promotion passed, and the user
verified hosted chat. The local receipt records success at 2026-09-10T17:09:33.808Z.

## Intended result

- main: tested release application based on v0.13.5 (3d300e8), with current server,
  deployment/security controls and targeted client reliability fixes.
- Dedicated rebuild branch: current rebuild preserved for continued development.
- One active app per branch; no runtime UI switch or duplicate application trees.
- Existing tags remain immutable. Publish a new patch only after verification.

## Sequence

1. Record the deployed server commit and confirm hosted diagnostics/chat. Resolve
   the TTL/IAM rollout before changing application baselines.
2. User creates and pushes a rebuild branch at the current verified HEAD. Branch
   names are proposals until chosen by the user; use rebuild and
   release-recovery if no different names are requested.
3. User creates the recovery branch from that same HEAD in a separate worktree.
   Preserve shared ancestry. Do not reset main, force-push, or merge the entire
   rebuild branch back into the release application.
4. Review a path inventory before restoring application files from v0.13.5.
   Restore the complete coherent app source/assets/configuration and necessary
   build/test inputs, removing incompatible app files. Keep current server code,
   server tests, deploy helper, retention policies and upload/secret protections.
   Reconcile manifests, lockfiles, Tauri permissions and ignore files explicitly.
5. Review tagged release/CI/iOS workflows against the recovered app. Retain current
   action pinning, minimal permissions and secret boundaries. Constrain production
   server deployment to main and app publication to intentional release triggers;
   rebuild branch pushes must not publish production artifacts.
6. Reproduce reported application failure where possible. Separately address the
   established amplification mechanisms: automatic 429 retries, unbounded gate
   release, duplicate logical work and bounded structured-output repair attempts.
   Keep independent work concurrent and progressive results available. Do not
   introduce a global serial queue or automatic route fallback.
7. Verify the recovered client against the current server contract. Adapt request
   payloads/errors/session handling as needed; do not weaken server authentication,
   pricing, payload validation or accounting to accommodate the app. Determine
   explicitly whether this release uses grouped transport or bounded standalone
   requests; do not assume grouped duplicate protection covers standalone routes.
8. Run recovered-app tests and new regressions, current server/emulator tests,
   packaging and security checks. Perform manual sign-in, hosted/direct-key chat,
   recording, cancellation, gate resume, restart and controlled refusal checks.
   Test synthetic load locally; do not reproduce a request storm on production.
9. Review the candidate diff and verification evidence. User merges the recovery
   branch into main through a normal reviewed change, then publishes a new patch.
   Confirm artifacts identify their source commit and test the installed build.
10. Bring shared server/security fixes into the rebuild branch selectively. Keep
    app restoration commits out of it. Prefer small, separately scoped shared
    fixes so ongoing maintenance can be applied to both branches explicitly.

## Evidence and unresolved questions

INCIDENT-POSTMORTEM.md establishes request bursts, refusal amplification and failed
rollouts. It does not establish the initiating client action, exact exhausted
counter, or a particular process crash. Obtain crash details only if reproduction
cannot identify them. Do not promise one small fix resolves all observed failures.
The tag's UI and features are the recovery target; its security posture is not.
No release is considered stable solely because it is tagged or compiles.


## Recovery implementation checkpoint

The tagged app is restored in release-recovery. Current server runtime,
retention/deployment helpers, server workflow and cloud upload restrictions are
unchanged. The unrelated tagged cloud bootstrap script is excluded.

Implemented: no automatic HTTP 429 retry; four shared inference slots across
chat, structured work, transcription and speech; 64 outstanding requests;
endpoint refusal holds with explicit pipeline Resume; queued-request invalidation;
one in-flight guided turn per chat; bounded JSON and reply accumulation;
custom-credential destination binding; private config directory and file modes.
The recovered app uses the secured standalone server endpoints. Grouped transport
and its distributed operation-identity guarantees are not claimed for this client.

Verification: 394 frontend tests, 189 Rust tests (two paid benchmarks ignored),
Clippy, frontend build, native binary build, documentation build and updater
signature verification test pass. A self-contained unsigned macOS debug bundle
also builds successfully with embedded frontend assets.
Representative streaming-chat, structured-analysis and speech payloads pass the
current server validator. No paid inference calls were made during verification.
The duplicate Vitest configuration has been removed. The docs dependency audit
reports image-size parser denial-of-service advisories with no published fix;
these are docs build dependencies, not app/server runtime packages. Nineteen
reported affected package paths trace back to this dependency. No audit suppression
or forced major dependency update is used.

Still required: installed-client/server end-to-end checks,
installed macOS QA (chat, partial analysis, audio, refusal recovery, restart),
remaining platform/release verification and final source/security review before
merging into main. The exact incident crash trigger remains unproven.

Manual checkpoint: quit other SkellySpeak instances and open
`src-tauri/target/debug/bundle/macos/SkellySpeak Dev.app` from the recovery
worktree. Verify hosted sign-in/chat, progressive analysis and recording, then
restart and verify persistence. This is an unsigned local test bundle; macOS
signing/permission behavior is not release verification. No Git writes or
publication were performed. Generated documentation output is ignored.
