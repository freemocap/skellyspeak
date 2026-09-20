# Hosted server administration — September 20, 2026

## Requested behavior and ownership

The user requested a server-hosted admin panel using the existing Google login,
restricted to `info@freemocap.org`, for user accounts, exceptional limits, recent
requests/errors, usage histories, configurable limits and account resets.

Identity owns owner authentication. Accounting owns effective limits and audited
adjustments. Diagnostics owns read-only reports, Cloud Logging access and HTTP
composition. The standalone browser surface lives under `ui/src/features/admin/`;
its scoped stylesheet uses the shared design tokens. No learner session, provider
key, deployment credential or local desktop data is exposed to the browser.

“Maximum entry” is interpreted as maximum registered accounts. The extended
allowance is a preset applied explicitly to selected accounts. Existing per-account
limits remain independent numeric exceptions. No email address other than the
specified administrator is hardcoded or guessed.

## Implemented in source; not deployed

- `/admin` serves the owner panel. `/admin/login` starts Google authorization using
  the existing client and callback, with separately signed, single-use admin state
  bound to a Secure/HttpOnly browser cookie. The native redirect allowlist is unchanged.
- The callback verifies Google's identity and exact normalized owner email before
  issuing a one-hour, audience-specific Secure/HttpOnly/SameSite cookie. Ordinary
  app bearer tokens cannot access admin endpoints; admin tokens cannot access the
  learner API. Each admin API request validates the session and current account
  token version. Changes also require the configured same origin and an explicit
  custom header. Responses are non-cacheable; the panel has a restrictive CSP.
- Admin access has separate per-process read/write admission and bypasses the
  learner's daily diagnostic/auth quota. Admin login does not create a learner
  account or consume an account slot. The ordinary app login remains subject to
  its existing pre-consumption daily admission.
- Overview: current revision, registered-account count (bounded at 10,001), spending
  pause state, shared request counters, effective limits and daily allowance usage.
  Account pages have 25 rows; selected-account reports include usage, registrations
  and the latest 100 reservations. These are sequential reads, not a globally
  consistent transaction snapshot.
- Policy overrides live in `service_controls/limits`. Missing values use existing
  deployment defaults. New signups, principal resolution, request admission and
  budget reservations read the relevant overrides; redeployment does not erase
  them. Existing provider work continues when limits change.
- Changes check a revision and write an audit receipt in the same transaction.
  Re-delivery of the same operation UUID returns its receipt without repeating the
  action. Conflicting/stale changes fail. Audit TTL is 365 days and is included in
  the existing retention provisioning checklist; it has not been provisioned live.
- Personal resets retain original counters and add/reset allowance-credit offsets.
  Spending resets include current holds in that allowance adjustment; later
  settlements still update the original accounting ledgers. Shared counters and
  actual/estimated charges are never erased. Session revocation increments the
  account token version; it is not an account ban.
- The extended preset initially equals the default allowance until changed. Selecting
  it copies its numeric value into the account's custom allowance; subsequent preset
  changes do not silently rewrite existing agreements.
- Cloud Logging reads use runtime Application Default Credentials, fixed project/
  service scope, 1–168 hour windows, 500-event pages and a 4 MiB response cap. Request
  IDs and errors can be filtered. Pagination preserves its initial time boundary.
  The adapter sanitizes content/credentials and preserves bounded metadata with
  explicit redaction markers. It does not return raw Cloud Run HTTP logs/IPs/URLs.
- The arrival heat map counts distinct `request_started` events in loaded pages,
  by UTC day/hour. It is explicitly incomplete when more pages remain; filtered
  error results do not establish total request traffic. Daily numeric usage tables
  accompany the charts; allowance amounts include estimates and holds, not invoices.

## Remaining decisions and deployment requirements

- Geographic counts are not collected. The user was asked whether country-level
  counts should be collected or geography deferred; no answer has been received.
  A trusted geolocation source, retention choice and deployment configuration need
  agreement before adding that collection. Client-supplied country headers or the
  server's own region must not be presented as verified user location.
- Existing logs deliberately omit user identifiers. Recent event inspection is
  service-wide and correlates by request ID; per-user activity is from usage and
  reservation records. This does not reconstruct per-user historical HTTP traces.
- Administrative audit history covers panel changes after deployment, not historical
  CLI/console edits. No agreement text has been invented for existing exceptions.
- Local reports work with the development memory store. Actual Google login requires
  the configured client/callback; the browser QA fixture used a temporary loopback
  process with disposable identities and synthetic logs, not real OAuth or GCP.
- Before an explicitly authorized deployment, verify the Cloud Run runtime identity
  has Cloud Logging read permission (`logging.logEntries.list`, commonly via Logs
  Viewer). No IAM changes were made. Log read failures are explicit, including status
  and sanitized metadata. No service-account key is used in the browser.
- Then verify real owner login, non-owner denial, read-only Cloud logs, Firestore
  transaction behavior and TTL activation against the deployed revision. No live
  resets, policy writes, IAM changes, commits or deployments were performed here.

## Verification

- Final full server suite: **418 passed, 7 local-emulator tests skipped**.
- Admin TypeScript and build tool strict type checks passed.
- Shared stylesheet checks passed; generated admin assets are reproducible.
- Actual gcloud upload-manifest sentinel check passed: runtime/assets included,
  private files and development tooling excluded.
- Browser fixture check: overview and selected account render, review dialog opens,
  account-check reset succeeds, personal credit changes from 0 to 120, and shared
  count remains 168. The audit view displays the before/after credit and actor.
  Synthetic logs render a 429 error, request IDs and a UTC day/hour heat map.

The existing large `main.py` remains the coordinator; only route registration,
admin callback branching and authenticated ingress were added. Its unrelated
decomposition remains a separate agreed pass. New authored admin modules are
below 500 lines; browser assets are generated.

The sandbox stalled existing async HTTP tests; the same mocked suite completes
outside it. No tests were pointed at production.

## Operational references

- [Cloud Logging entries.list](https://docs.cloud.google.com/logging/docs/reference/v2/rest/v2/entries/list)
  specifies project scope, pagination and required logging permission.
- [Cloud Logging LogEntry](https://docs.cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry)
  distinguishes application JSON metadata from platform HTTP request fields.

## Local app integration — implemented 2026-09-20

- Desktop development AI access / Custom URL offers **Open local admin**, using a
  registered native command. It reads only the fixed checkout credential file,
  requests a bounded one-use ticket over loopback, and opens the system browser.
  No launch credential or session is returned to the webview; access settings do
  not change. Release/mobile builds reject the command and hide the control.
- Normal local launcher installs development-only authentication and connects the
  existing panel to its actual in-memory database and sanitized logging stream.
  Loopback peer/Host checks, same-origin write checks, one-use 60-second tickets,
  HttpOnly one-hour cookies and restart rotation bound local access. Local identity
  is explicitly `local-administrator`, not a Google identity.
- Local logs are capped at 10,000 events in memory with stable backwards pagination;
  console mirrors are omitted from this report to avoid duplicate arrival counts.
  Full sanitized JSONL files continue using the existing logging lifecycle.
- `npm run server:local` builds assets before launch. Nothing has been deployed.

Verification: server regression suite passed (419 tests and seven emulator skips
before adding the pagination test); 24 focused settings/IPC tests passed; native
local credential tests and desktop debug binary build passed. TypeScript checking,
style validation and hosted upload manifest checks passed. Browser verified the
normal local server's account, actual account-check counter, local identity and
request log loading through the real one-use link flow. Desktop button interaction
is covered by component tests; native desktop UI clicking was not available to this
agent. New native command requires restarting any already-running desktop binary.

## Allowance controls and time chart — implemented 2026-09-20

Dollar fields now use explicit minus/plus $1 controls and decimal text entry,
without micro-dollar browser spinners or browser step-mismatch validation.
Frontend validation preserves six-decimal precision, nonnegative values and the
existing server caps ($10,000 shared; $1,000 personal/default/extended).

The overview chart has separate range and interval selectors: 1m, 5m, 10m, 1h,
12h, 1d, 1w and 1mo (plus a three-month range). It renders a line chart with
horizontal UTC date/time ticks, dollar-axis values, point details and a numeric
table. Account daily history has its own selector. Oversized combinations adjust
the paired control automatically; server reads are capped at 1,500 source buckets
and minute/hour document reads are batched. Month intervals use calendar months;
month ranges are rolling 30-day windows and three-month ranges are 90 days.

Minute and hour aggregates in `usage_timeline` are written in the existing reserve
and settlement transactions. Corrections stay attributed to the request-start
bucket. Retries do not duplicate charges, and expired buckets are not recreated
with negative balances. Existing daily ledgers supply day/week/month intervals.
No historical subdaily data is fabricated. Missing buckets remain explicit;
provider invoice cost and recorded allowance remain distinct. Retention provisioning
now includes this collection; no live cloud provisioning was performed.

Verification: 423 server tests passed, seven emulator tests skipped; two admin UI
tests passed; standalone TypeScript and generated-asset checks passed. Browser
verification used isolated synthetic data, including a successful shared allowance
change from $2 to $3. Hosted upload allowlist check passed. The global style check
subsequently encountered an unrelated concurrent change in components/reading.css
(literal z-index 1000); admin styles had passed before that change. No local user
server was stopped or restarted for this work. Restart it to enable new routes and
recording. Nothing committed or deployed.

## Live mode — implemented 2026-09-20

The header now offers an opt-in Live toggle and 5/15/30/60-second refresh cadence
(default 15 seconds). Each completed cycle refreshes overview metrics, timeline,
account rows and the latest filtered log page. This is polling, not a push stream;
cycles never overlap. The status displays the last successful update.

Polling pauses for hidden tabs, pending work, unsaved policy edits, focused edit
controls, confirmation dialogs, account details and expanded log details. Account
inspection has a Close button to resume polling. Older log pagination disables
Live so background refresh cannot discard the browsed history. Editable policy
fields and their original revision are preserved even if typing begins during a
fetch. A failed cycle stops Live and displays the error; enabling Live explicitly
retries. Sign-out and page departure stop scheduling. No administrative writes
are submitted automatically.

Verification: four admin UI tests passed (including scheduling, disabled/hidden
states, draft preservation and failure handling); standalone TypeScript,
generated-assets and style checks passed. Browser verified enabling Live fetched
an updated snapshot and latest logs in the isolated fixture preview. No running
user server restart or deployment was needed for this frontend-only change.

Live cadence follow-up: added a 1-second option (15 seconds remains the default).
Authenticated admin ingress/read limits now allow 240 requests/minute, supporting
three reads per second plus navigation headroom; write limits remain 20/minute.
Cycles still wait for completion before scheduling the next update. Four frontend
and eight admin endpoint tests passed. Restart the server to load the updated
limits before using the new cadence continuously.

## WebSocket live mode — implemented 2026-09-20; supersedes polling sections above

Replaced the polling timer and cadence selector with a persistent `/admin/live`
WebSocket. Initial page loading and explicit historical reports remain HTTP;
Live subscriptions, changed snapshots and process log events use the socket.
Committed transactions signal the feed directly, runtime events wake subscribers,
and hosted sessions attach bounded Firestore snapshot listeners to shared state.
Snapshots coalesce event bursts for 250 ms; no recurring report-fetch loop runs.
Thirty-second idle heartbeats revalidate authorization without refreshing reports.

Same-origin checks and existing hosted/local cookie validation guard the handshake
and ongoing session. Read-only subscriptions are validated and bounded; four live
connections per process, subscription/handshake rate limits, bounded event history,
and send deadlines bound resources. Disconnect cleanup removes event subscribers,
cancels pending tasks and unsubscribes Firestore listeners. Authentication failures
close the stream. UI connection/error states are explicit; no automatic retry loop.
Live updates preserve draft policy inputs and revision, account inspections and
expanded log details. The latest snapshot is rendered after hidden/busy states.
Historical log browsing disables Live; streamed events are explicitly instance-local.
Restored HTTP admin read limits to their pre-polling values.

Verification: 427 server tests passed, seven emulator tests skipped; four frontend
tests passed. Tests cover data-change pushes, settlement, hosted and local identity,
cross-origin rejection, read-only messages, revocation, cleanup, draft preservation,
and no periodic browser HTTP requests. Browser connected to an isolated preview;
a separate health request appeared in its live log view while overview/timeline
HTTP counts each remained one (initial page load). TypeScript, generated assets,
style and hosted upload checks passed. Starlette emitted a test-client dependency
deprecation warning. Hosted Firestore listeners have not been exercised against a
live cloud deployment. No deployment or running user-server restart was performed.
Restart the local server and reload the panel to use the WebSocket implementation.
