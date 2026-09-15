# Durable development logging

Implemented: private per-run files shared by all domains under the integration
checkout's `.local/logs/`. The native app launcher captures build, signing, Vite
and native process output; the local API launcher captures Python and inherited
native output. The logged-process entry point covers the Firestore emulator.
Frontend diagnostics and native/server structured sinks add reviewed event fields.
No Git operations or cloud deployment are part of this change.

The README's Development diagnostic coverage section defines capture, redaction,
retention, failure handling and startup limitations. Workflow guidance requires
reading every stream since the last checkpoint before filtering. Every domain
received the absolute integration checkout log path.

Verification on September 11:

- 379 frontend tests passed; frontend production build passed.
- Four Node launcher tests passed; launcher TypeScript check passed.
- Reliability reported final 176 native and 221 server tests passed (seven
  emulator tests skipped), with Clippy clean. Code Quality closed its sink
  findings after source review and four independent Python logging tests.
- Fresh native startup emitted frontend and native records readable from disk
  while the app remained open. Local server and emulator streams were readable.
- Local health returned 200; unauthenticated protected requests returned 401;
  authenticated account status returned 200. No inference calls were made.
- Actual log files were mode 600, Git-ignored, and passed an exact-match check
  against local provider credentials/session token without displaying those values.
- Code Quality independently reviewed frontend, launcher and native/server sinks;
  launcher failure cleanup and bounded unfinished-line handling were corrected.

A server restart changes the local session token; Custom URL must save the token
from `server/.local-server/session-token.txt` for authenticated testing.

## Latest native user check

At 10:56–10:57 local time on September 11, the Custom URL run recorded three
successful transcriptions (0.66–0.95 seconds), three partner replies, three speech
generations and four accepted gloss attempts. The second turn had an additional
gloss attempt. There were no inference holds or recorded attempt failures in that
interval. Speech and gloss started independently after each reply. All log streams
were inspected alongside durable attempts, not only HTTP status codes.

These observations verify this sample, not complete gloss coverage, general speech
fidelity, stop/replay behavior or release readiness. Reading assistance is the next
bounded slice defined in BUILD-PLAN.md. No further user testing is required merely
to checkpoint this work.

## Progression command contract correction

The progression UI emitted three reviewed command names absent from the native
DiagnosticCommand enum. Native argument decoding rejected these events before the
file sink. Other events continued to persist; this was not evidence of disk failure.
Added get_skill_evidence, get_practice_overview and save_skill_profile to the enum.
The enum is now exported in generated contracts and the frontend allowlist is
TypeScript-checked against it. A regression test decodes each command, writes it
through FileSink and reads it back immediately. Five logging tests, 394 frontend
tests, production build and Clippy pass. Restart the native application to load the
corrected decoder. Rejected events from the prior run cannot be reconstructed.
