# Reply-help graph dependency correction

Status: implemented in source; uncommitted. September 20, 2026.

The on-demand reply_assistance and reply_explanations declarations incorrectly
had empty dependencies. Admission already required a published persona reply or
opening; prompt assembly fetched that exact turn's assistant message as
actualPartnerReply. Read-only inspection of the user's failed attempt confirmed
actualPartnerReply equals the saved assistant message. The displayed entry node
was therefore misleading, not evidence that the model lacked its input.

## Single-source execution correction (supersedes the initial resolver approach)

The initial proposed correction used an opening-specific dependency remapping.
That approach was removed: it could itself drift from execution. The audit also
found a hard-coded publication release list separate from declaration edges,
and translation roles labeled standard while routing selected the fast model.

Implemented behavior:

- Normal and opening Rust plans explicitly contain reply_assistance and
  reply_explanations with their actual persona_reply or persona_opening edge.
  There is no inspection-specific dependency remapping.
- Declarations own automatic, explicit and speech-enabled activation. Admission
  and operation creation consume those flags, rather than another exclusion list.
- Local completion, network completion, dispatch, explicit help admission and
  retry all resolve prerequisites from the same declarations. Ready flags cannot
  bypass a dependency. Publication no longer names a separate list of children.
- Default model routing and retries consume declared model roles. Translation
  declarations now accurately identify their existing fast-model policy.
- Recorded snapshots resolve declared dependency kinds mechanically to operation
  IDs and use declaration order. Blueprint edges copy the same declarations.
  Retained historical coaching operations still have Rust declarations used by
  both execution and inspection; they are not automatically admitted.
- The UI has no operation catalog or connection configuration. Its generic
  layout positions nodes by dependency depth and native declaration order. It
  no longer silently drops missing edges, accepts cycles or orders nodes by
  attempt timing. Duplicate nodes/dependencies and missing parents are errors.

Scope: this is the operation dependency DAG. It is not static analysis of every
Rust function, prompt field or source read. Runtime prompt hydration remains in
native operation implementations. Blueprint explanatory text and prompt previews
remain native diagnostic presentation; they do not define execution edges.
Ordinary serialization, ID resolution and generic drawing remain necessary, but
none has an independently maintained connection policy. Tests guard this boundary;
they do not prove that all future implementation bugs are impossible.

Verification after this correction: full Rust suite 463 passed, 2 ignored;
27 targeted graph/UI tests passed; UI production build passed (existing large
bundle warning); Clippy with warnings denied and generated-contract verification
passed. The initial sandboxed Rust run could not bind loopback HTTP
fixtures; the complete run with fixture networking passed. No live inference,
workspace reset, deployment or commit was performed. Desktop runtime verification
requires rebuilding/restarting the application.

Persona context is an existing local validation/dependency gate, not inference:
it checks captured history roles, limits and source ownership before releasing
work. Its blueprint description now explicitly names these responsibilities and
states that no AI request or tokens are used. Operation identities are unchanged.

The new provider-backed failure is separate from the earlier offline-server
failure: the provider returned Arabic text beginning U+0623 in replies[0].romanization.
Native validation correctly rejected it as not Latin transliteration. Its provider
ID and usage were retained. No result was fabricated, no validation was disabled,
and no live request was retried during this investigation. The graph correction
does not repair that saved failed output or guarantee future provider compliance.

Tests assert normal/opening help edges, exact actualPartnerReply prompt content,
and blueprint completeness. Full native run: 461 passed, 2 ignored, one unrelated
transcription restart test hit a workspace-lock failure; targeted rerun recorded
below. `git diff --check` passed. No workspace reset or deployment performed.

The transcription restart test passed in isolation on rerun. Clippy with
`--lib --tests -- -D warnings` passed. All graph/input regression tests passed in
the full run; the transient lock failure is reported separately, not hidden.
