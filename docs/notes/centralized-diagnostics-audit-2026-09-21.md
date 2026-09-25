# Centralized diagnostics and retention audit — September 21, 2026

Status: implemented in source; verification below. No commit, deployment, release,
or replacement of the installed Android application. This supersedes the earlier
reports' claims of a completed general error-retention repair. Those repairs were
partial. The Linux packaging investigation remains valid.

## Incident and recurring cause

The supplied Android 2.2.1 archive contains a `reply_explanations` native validation
failure at 17:02:28 UTC. Its provider receipt reports normal completion, and the
structural inspector reports no structural mismatch. The inference logger kept
that receipt, the error code, and a narrow allowlisted domain reason. It omitted
the actual validator error and its diagnostics. The archive cannot establish
which domain rule failed. No validation rule was relaxed or speculative provider
fix introduced to make the incident appear solved.

The recurring defects were independent field allowlists, selecting successful
receipt metadata instead of the later failure, generic exception conversion,
ignored background failures, and privacy tests which did not require useful
information to survive all the way to disk/export. Earlier reports explicitly
left several categories unimplemented. This was not an export-file problem:
information had already been discarded before ZIP creation.

## Shared ownership

`redaction-policy/policy.json` is the authored redaction policy. Rust compiles
it directly. `tools/diagnostic-policy.ts` generates the frontend, Python, and
Android asset copies; `npm run diagnostics:check` rejects drift in CI and before
production UI builds. The teaching-language registry excludes this separate
policy directory. Server Docker/upload allowlists include its generated module.

Credentials use `[secret redacted]`; user content uses `[user content redacted]`.
Redaction keeps the rest of an explanation. Known private values are removed at
producers; field classification and shared patterns protect the persistence and
presentation boundaries. Unknown string fields remain privacy-classified instead
of being blindly persisted. Numeric metadata and approved diagnostic fields are
retained. Size/depth limits explicitly mark truncation. Error fields get priority
before optional attachments when budgets are exhausted.

The policy is shared; OS-specific sinks remain necessary. Native owns app disk
logging, the frontend sends sanitized failures through the native bridge, and the
server owns request/runtime events. The process launcher uses the same policy for
files and terminal mirroring. It buffers split lines before mirroring so a split
credential cannot leak to the terminal. Raw process stdout/stderr are deliberately
not added to share archives: arbitrary process output is not a typed app record.

Native error envelopes retain code, explanation, diagnostics, and refusal; response
receipts and subsequent failures remain separate sibling records. The server's
exception owner retains cause chains, frames, typed parser/Unicode/OS details and
attached diagnostics. Code-authored ValueError/RuntimeError explanations use
explicit diagnostic subclasses; an AST regression check rejects new unclassified
literal explanations or interpolated content passed as an authored explanation.
Unclassified arbitrary exception payloads are redacted while their identity,
location, cause chain and typed details remain. A regex cannot reliably distinguish
arbitrary unlabelled user text from an explanation; producers must supply context.

The native command registration list now generates both the native diagnostic
command enum and the frontend command list. New commands cannot silently lose
their identity because somebody forgot a second or third list.

## Audit coverage and repairs

Scanned active native, UI, server, Android bridge and developer-tool sources for
ignored errors, discarded catch/map arguments, optional conversion, error rewriting,
raw logging, sink failures and serialization. Reviewed the capture → conversion →
receipt/publication → bridge → durable sink → view/export boundaries. Archived
`old/` code, generated contracts and third-party dependency implementation are not
application audit targets.

| Boundary | Repair / reviewed behavior |
| --- | --- |
| Native text and speech completion | Keep receipt and validation/decoder error together. Exact Android-shaped regression goes through FileSink and ZIP, retaining reason/path/request ID/usage and removing canaries. |
| Conversation explanations | Rejections identify card index/field; prose bounds retain actual/maximum lengths and empty/NUL/length reason. No learner text retained. |
| Coaching, translation, persona and provider decoding | JSON category/position and existing context survive; structured schema inspection remains separate from domain validation. |
| Word-gloss adapter and recovery | Preserve JSON category/line/column and rejected-span diagnostic details instead of reducing parser errors to one enum code. |
| Audio | Distinguish UTF-8, base64 offset/length/padding, WAV header/sample/spec and transcript validation failures. Preserve partial receipts. |
| HTTP, hosted 429, sign-in and key verification | Retain transport causes, read/decode stages, status/headers/refusal and parse positions; socket failures preserve OS identity. |
| Credentials and worker/synchronization errors | Keyring variants, scrubbed platform causes and safe counts survive; credential containers/bytes are never Debug-formatted. JNI initialization, worker panic/cancellation and poisoned state have explicit context. |
| Background execution | Scheduler stop, stream capability probe, update delivery, state reads and preview persistence failures have a durable reporting path. Startup-state lock failure is no longer represented as no error. |
| Storage | Structured SQLite codes, source location, conversion category and safe diagnostics survive without logging SQL statements or column payloads. |
| Native sink | Standard Rust log capture runs on mobile too. Panic/write failures use a nonrecursive stderr channel containing the sanitized original event and sink failure. |
| Frontend | Shared policy, full registered command identity, explicit collection truncation and diagnostic bridge failure details. Existing IPC owner reports rejection before UI summaries. Admin live parse/render errors retain details. |
| Server grouped/ungrouped streams | Preserve stream failure and settlement failure separately from upstream receipts. Framing exceptions supplement partial receipts without changing outcome/settlement behavior. |
| Server runtime/admin | Runtime phases and final request events retain diagnostics. Admin live/log readers retain causes; the live feed includes operation failures as well as request/runtime events. |
| Export | Save ZIP is separate from Share. Archive allowlists exclude database, credentials, audio and raw process logs; links are refused and active file reads use a finite length snapshot. |

Reviewed intentional catches include promise-chain release where the rejecting
promise is still returned, UI catches after the IPC owner already recorded the
failure, cancellation/disconnect cleanup, optional locale/lookup parsing, polling
admission with a separately emitted capacity event, and success-only metadata
selection when a separate error receipt is retained. These are not equivalent to
replacing a real failure with an empty catch or generic error.

## Save logs

The same export controls are available in normal navigation and failure surfaces.
Desktop saves to Downloads. Android opens its native Create Document picker and
copies the ZIP to the selected destination; cancellation does not report success.
Android Share remains available separately. iOS saves to Documents, with Files
access enabled; application workspace storage remains in the application-data
location, separate from exported Documents. iOS behavior has not been device-tested
on this Linux host.

The archive captures already-sanitized structured files. It does not retroactively
recover missing reasons from older releases or claim to sanitize arbitrary old
raw process output. Platform/framework stderr outside the app logging API is not
a guaranteed durable source in ordinary packaged launches. The diagnostic process
launcher captures that source during a reproduction, as it did for the Linux
AppImage incident. This coverage boundary must not be presented as complete OS
telemetry or proof of absence of errors.

## Verification

- Shared retention/privacy fixtures run in Rust, TypeScript and Python. They check
  useful explanation clauses, precise redaction tags, and idempotent redaction.
- Exact incident-shaped text failure crosses real native disk and ZIP boundaries.
- ZIP tests reject linked files and exclude workspace/credential/audio/raw-output
  canaries. UI tests cover desktop saving, cancellation, sharing failure and retry.
- Full UI suite: 157 files / 1,054 tests passed in the final rerun;
  production UI build and localization usage check passed.
- Full native suite: 516 passed / six ignored in the final rerun;
  Clippy with warnings denied passed after all source refinements.
- Server diagnostics/inference/deployment: 322 passed in the final rerun.
- Launcher logging: five tests passed, including split-secret terminal mirroring.
- Android Kotlin compile and unit tests passed. Android arm64 native check passed.
- Shared-policy freshness, generated contracts and Cloud Build upload boundary
  checks passed. No upload or deployment occurred.
- Generated contracts and production UI build passed again after the final edits.
  The build reports a bundle-size advisory; server tests report a dependency
  deprecation warning. Neither was introduced as a logging fallback.

## Practical limits

The source repairs require rebuilding/restarting native applications and the
server. They are not active in the installed 2.2.1 Android release. No test can
promise that an arbitrary future dependency exception contains enough information
or can be safely retained without classification. The enforced contract is to
retain authored/typed evidence and causes, redact sensitive spans, explicitly mark
omissions/truncation, and test the useful evidence at the final consumer—not merely
assert that secrets disappeared.
