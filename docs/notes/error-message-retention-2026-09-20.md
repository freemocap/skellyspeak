# Error message retention — implemented, verification below

## Incident evidence

The September 20 white screen while selecting Spanish coincided with an
unhandled frontend error at 19:35:22 EDT. The previous logger retained only
`name: Error` and `cause: unknown`; its message and stack were discarded.
A native stdio panic followed approximately 27 seconds later. These records do
not establish the original JavaScript exception or prove a connection between
the two failures. Existing picker tests did not reproduce the crash.

## Implemented behavior

- Frontend errors retain scrubbed messages, names, bounded cause chains and
  source stack locations. Browser events without an Error object retain their
  supplied filename/line/column. Console errors select the error object rather
  than discarding it alongside arbitrary arguments.
- Redaction happens before in-memory logging, console output, native delivery
  and fault presentation. Native persistence applies its own scrubber too.
  Delivery failures retain a scrubbed explanation locally without recursive IPC.
- Sensitive structured fields are omitted explicitly. Known private field values
  are removed from error prose; credential assignments, bearer/API/JWT/private
  keys, URLs, emails, labelled content and quoted prose are scrubbed. Existing
  schema/permission identifiers remain useful. Stack URLs lose host, credentials,
  query and fragment while source filenames and line/column survive.
- Native warnings/errors and string panic payloads now retain scrubbed messages.
  Non-string panic payloads are marked omitted. Persisted failure receipts retain
  their error message; persona generation supplies the known credential, brief
  and rejected completion for exact removal of echoes.
- Oversized native metadata keeps the top-level error explanation and available
  stack fields, with an explicit truncation marker.
- A root React crash boundary outside the shell displays the scrubbed exception,
  technical details and Reload app control. It records the component stack too.
  Existing fault surfaces retain scrubbed technical details.

A generic redactor cannot identify arbitrary unlabelled private prose or an
unrecognizable secret without context. Producers must keep content in labelled
fields and supply known private values when errors can echo them. Tests cover
both useful information retention and removal of representative sensitive data;
regex matching is not proof that arbitrary prose is content-free.

## Verification

- Full UI suite: 155 files / 1,006 tests passed before the final focused
  scrubber refinements; the focused diagnostics/boundary tests were rerun afterward.
- Full native suite: 466 passed, two ignored. The sandbox initially prevented
  loopback HTTP fixtures from binding; the unrestricted test run passed.
- Production UI build and Clippy with warnings denied passed. Targeted Rust
  formatting and whitespace checks passed.
- Verified error messages and stack locations survive a native JSONL disk write.
  Verified rendering failures display the error and reload control in the DOM.
  No manual native-app reproduction of the Spanish picker crash established.

No commit, deployment or application relaunch performed. Native logging changes
require rebuilding/relaunching the native app; frontend-only reload is insufficient.
The original discarded message cannot be recovered from the saved logs.

## Ownership and size

`diagnostics/response.rs` (523 lines including tests) remains the existing bounded
metadata/redaction owner so both receipts and logger persistence use the same
policy. `diagnostics/mod.rs` (654 lines including tests) retains its existing
sink/bridge ownership. These danger-zone files were not reorganized during this
correctness repair; a deliberate decomposition belongs in the separate size pass.
