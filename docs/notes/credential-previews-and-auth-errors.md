# Credential previews and authentication errors

Implemented September 16, 2026.

## Behavior

AI access shows the first and last five characters of saved OpenRouter/Groq keys
and custom server session tokens, separated by `***`. Native secure-storage reads
produce display-only previews; full stored credentials never cross the UI bridge.
Reads occur without holding the database lock, and the revision is checked again
before publishing previews. Secure-storage failures remain explicit failures.

Replacement fields remain password inputs with an adjacent live masked preview.
Leading/trailing whitespace is trimmed on entry, blur, submission and existing
native save paths. Embedded whitespace is still rejected as an invalid credential.
Credentials of ten characters or fewer remain fully masked to avoid revealing a
whole short secret through overlapping prefix/suffix displays. Preview strings
are not stored as credentials and are not added to diagnostic logs.

The previous transcription error used generic saved-key guidance for both Groq
and custom-server authentication. Authentication guidance now distinguishes custom
server session tokens, hosted sessions, and direct Groq/OpenRouter API keys across
transcription, checks, chat and speech. Local-server 401 guidance identifies the
session-token file. Following the persistent-local-session change, it explains
that explicit credential resets invalidate tokens while normal restarts preserve them. HTTP 403 remains a separate access-denied
case. Raw remote bodies and URLs are not echoed. No retries are introduced.

## Verification

- Settings access and settings IPC: 54 tests passed, including all three credential
  fields, masked saved/replacement values, short inputs, discard and whitespace.
- Native connection tests: 11 passed (two socket-based tests excluded).
- Native grouped-response tests: five passed (socket-based transport test excluded).
- UI TypeScript and production build passed.
- Rust formatting and generated contracts checked.

Source and UI build are ready; the running native application was not rebuilt or
restarted and live keychain/UI behavior was not exercised. Rebuild/relaunch the
native app to use the new credential previews and error messages. Existing
unrelated working-tree changes are preserved.
