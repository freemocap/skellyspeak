# Local data and AI requests

Partners, conversations, messages, settings and execution records are stored on the
device. SkellySpeak does not synchronize them. Hosted requests are metered by the service;
local activity reports remain on device.

Access uses an explicitly selected Google-authenticated hosted session or OpenRouter
API key. Pressing Send transmits the selected conversation's recent messages, initiating message,
practice settings and partner description through the hosted service when selected, or directly to OpenRouter when using your
key, and onward to the serving provider.
Saving a key and opening a conversation do not initiate inference. Partner prompts exclude coach threads and other conversations. Coach prompts include
the selected conversation and its separate coach thread; relationship-memory retrieval
is not implemented.

The device credential store holds API keys and hosted sessions; SQLite contains only its opaque
reference. React does not retain keys in component state. The key-entry field and
IPC necessarily carry a submitted key transiently. Rust uses zeroizing secret buffers
and does not echo provider error bodies or secrets into diagnostics. HTTPS is fixed
to OpenRouter for this route; redirects are refused. The hosted route uses its fixed HTTPS service origin. Custom URLs are not implemented.

Attempts retain model identifiers, timing, provider request identifiers and reported
token counts when available. Unknown usage stays unknown. Cancel prevents local
publication and drops the local request; it cannot guarantee that remote processing
or charges cease. Retries are explicit and can incur additional charges. The app
does not silently switch models, credentials or billing routes.

Deleting a conversation removes its messages, captured context, operations, attempts
and scoped receipts. Deleting a partner removes its dependent conversations. Late
worker callbacks cannot recreate deleted records. Disconnecting revokes unpublished
work and removes the credential; pending credential cleanup is recorded and completed
on startup if interrupted. No backup, migration or synchronization subsystem exists.

Provider-side handling is governed by the user's provider agreement and settings:
[OpenRouter privacy policy](https://openrouter.ai/privacy).

Google sign-in opens the system browser. Rust receives a state-bound one-time code
on a temporary loopback port, exchanges it with the hosted service and queries account
status. The service receives account authentication and owns quota/metering. Requests
include application version, OS and a random local learner UUID as installation ID;
that identifier changes with a fresh workspace. The account response exposes email,
name and allowance figures to the UI, never its session token. Signing out removes
the local session and revokes unpublished hosted work; it does not erase incurred
server metering or sign out of Google in the browser. See `hosted-api.md`.

Desktop Record captures microphone samples in memory. Stop uploads WAV audio and the
target language to the hosted transcription service, which uses Groq Whisper. Discard
uploads nothing. Recordings are capped at two minutes and are not stored on disk.
Transcripts are inserted into the draft and become conversation data only on Send.
Hosted audio accounting is independent of local text-attempt totals.
