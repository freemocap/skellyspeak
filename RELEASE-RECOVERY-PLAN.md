# Release recovery proposal

Status: proposed sequencing, not executed. No Git writes authorized to agents.
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
   names are proposals until chosen by the user; use codex/rebuild and
   codex/release-recovery if no different names are requested.
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
