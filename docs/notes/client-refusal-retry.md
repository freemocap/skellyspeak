# Client refusal retry

## Implemented behavior

Server refusals pause related queued turns and retain their original errors,
request IDs, diagnostics and retry guidance. They no longer create an access-wide
persistent lockout. New requests and explicit Retry/Resume actions let the server
decide current access, including immediately after an administrative reset.
Other paused turns remain paused; Step does not release a refusal pause. Existing
bounded transport retries and explicit application pause controls are unchanged.

Removed the unused recovery command and snapshot contract. Startup drops only the
retired inference_holds table after workspace ownership, version, integrity and
current-schema checks. The table owns no foreign keys or product records. No
workspace format conversion or full data reset is required. Attempt history and
per-turn refusal diagnostics remain intact.

## Verification

- Native library: 701 passed, 4 ignored. Includes retry before daily reset,
  refusal persistence across restart, repeated refusal, paused queue isolation,
  retained diagnostics and removal of pre-existing access lockouts.
- Targeted conversation UI regressions: 107 passed across 3 files.
- UI TypeScript check and fast validation passed.
- Contracts regenerated from Rust.
- Clippy with tests remains blocked by an unrelated pre-existing
  `cloned_ref_to_slice_refs` warning in `native/src/learning/effort/tests.rs:102`.
  That file was not changed.
Source changes require a rebuilt client. No server deployment or live reset.
