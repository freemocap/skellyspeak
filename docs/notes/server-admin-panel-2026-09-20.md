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
