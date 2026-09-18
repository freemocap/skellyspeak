# Shared AI access route

Implemented September 18, 2026, following the user's correction: AI access owns
one selected route for chat, transcription and read-aloud. Models owns only model
IDs. This supersedes earlier descriptions of independent audio access selections.

The native resolver reads `ConnectionConfig.route` for every capability. Hosted
and Custom URL use their selected server credentials for all capabilities. API
keys uses OpenRouter for chat/read-aloud and Groq for transcription, with keys
managed together in AI access. Missing credentials fail without route fallback.
Audio model preferences contain no route fields in Rust or generated TypeScript.
The transcription language warning also reads the shared route.

Development schema v20 removes persisted audio-route fields. Older workspaces
require the existing explicit Factory Reset flow; no migration or data reset was
performed in this change. Restart/rebuild the native app to load the resolver.

Verification: all 741 UI tests passed, including settings and architecture tests;
frontend production build and Rust formatting passed. Contracts regenerated from
Rust; contract freshness, Clippy with warnings denied and native binary checks
passed. All 9 native access tests and all 43 transport tests passed. Transport
fixtures required localhost access outside the sandbox. The full native run
also exposed an unrelated starter-persona count assertion (expected 3, found 2). The broad run
was stopped after its queue-budget test continued running for several minutes;
it is not a passing full-suite result. No live provider calls,
app restart, deployment, commit or push was performed.
