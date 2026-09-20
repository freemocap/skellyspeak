# Grouped request connection failure

Status: local server restored; transport classification fix implemented, uncommitted.

The screenshot's attempt ended in 34 ms with the generic grouped-protocol error,
no provider ID, no usage and no retained underlying cause. Read-only inspection
confirmed the app's custom route points to localhost port 8765. A direct health
probe failed to connect. The server was restarted with `npm run server:local`,
reusing its existing session token; `/health` then returned `{"status":"ok"}`.
No provider request, retry, data reset, error-display edit or deployment was made.
The original receipt cannot conclusively establish its lost transport cause, but
the configured server was demonstrably unavailable during investigation.

`ai/transport/grouped.rs` mapped both protocol-probe and inference-request network
errors to “Grouped response is incomplete or invalid.” It now preserves bounded,
content-free stage/reason metadata via the existing response diagnostics helper.
Connection failures before submission and protocol-probe failures are ordinary
provider failures; protocol timeout likewise states no inference was sent.
Failures after submission retain unknown-outcome semantics and explicit retry.
Malformed/incomplete streams still fail validation; no automatic retry was added.

Verification: 16 grouped transport tests pass, including a refused local connection
for protocol negotiation and request submission, metadata retention, credential/
address redaction, partial-result durability and strict stream validation.
`git diff --check` passed. Server health was checked after startup. The running
native app needs its normal rebuild/restart to load the classification change;
the restored server is already available to its existing Retry action.
