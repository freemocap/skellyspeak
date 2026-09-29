# Token and allowance accounting audit — September 29, 2026

Status: source audit and controlled local verification. No application behavior
changed. No deployed service, personal account ledger, or live billing inspected.

## Findings

### P2: Account usage is a stale snapshot without freshness information

`ui/src/features/settings/access/SettingsAccess.tsx:42,65–80,211–221`
stores the account response in component state. Only successful sign-in and
the Refresh account button populate it. The settings read/refresh effect loads
connection configuration, not account usage. Completing requests does not refresh
this value. A zero obtained at sign-in can remain zero after spending. Remounting
the component drops the snapshot entirely until Refresh account is clicked.
The separate connection-health check calls the account endpoint but discards its
account data (`ui/src/state/session/connection-health.ts:43`).

Proposed repair: load usage for the current signed-in identity when opening this
panel; refresh after relevant activity or invalidate its snapshot, with visible
freshness/loading/error state and protection against an account change during a
request. Keep manual refresh available. Verify a zero snapshot followed by usage,
reopening settings, and account switching.

### P2: Missing token totals can silently become a measured zero

`server/app/main.py:560–582` accepts `total_tokens`, or sums `input_tokens` and
`output_tokens`. It ignores `prompt_tokens` and `completion_tokens` when a total
is absent. If a response reports cost but no recognized token fields, settlement
succeeds with zero tokens; the account API does not distinguish unknown from zero.

Direct local reproduction with a cost of 0.001 and 20 input / 10 output tokens:

| Usage fields | Recorded tokens |
| --- | ---: |
| total_tokens = 30 | 30 |
| input_tokens = 20, output_tokens = 10 | 30 |
| prompt_tokens = 20, completion_tokens = 10 | 0 |
| cost only, no token counts | 0 |

This confirms a parser/reporting gap, not that live responses currently omit
their totals. Proposed repair: explicitly validate supported count shapes and
preserve unknown/incomplete usage separately from measured zero. Add route-level
coverage proving the account endpoint reflects those distinctions.

### P2: The account display does not explain its daily scope or reset

`server/app/accounting/quota.py:82–84,162–171` reads the current UTC-date document.
`server/app/main.py:499–508` returns daily counts and a `00:00 UTC` reset label.
The native account model retains that reset value, but
`ui/src/features/settings/access/SettingsAccess.tsx:221` displays only USD,
tokens, and requests. It omits both “today” and the reset time.

This is not a lifetime counter. At midnight UTC the account endpoint reads the
next day's bucket, initially zero. In America/New_York that is 8 p.m. during
daylight saving time and 7 p.m. during standard time. Requests settling after
midnight remain charged to their admission day.

Proposed repair: label this as daily service usage and show the reset time.

### P3: Small nonzero spending is rounded to zero before reaching the UI

`server/app/main.py:495–497` rounds dollar balances to four decimal places.
The native account model retains the rounded dollars but not the exact integer
micro-dollar fields. The settings UI again formats to four decimal places.
A confirmed 35-micro-dollar charge becomes `0.0000` while the ledger remains 35.

Proposed repair: retain exact integer amounts through the account contract and
show a below-display-precision amount explicitly. This affects the money display,
not an independently supplied token count.

## Implemented accounting and reset behavior

- Limits are monetary daily allowances; tokens are supplementary reporting.
- Admission atomically increments requests and reserves estimated money.
  Settlement replaces the estimate with reported cost and adds token counts.
  Consequently displayed spending can decrease when a reservation settles.
- Duplicate identical settlement is ignored; conflicting settlement fails.
  Unknown cost retains the reservation pending reconciliation.
- Signing in updates the account profile with a merge and does not clear its
  usage subcollection (`server/app/accounting/quota.py:275–339`). Native sign-out
  removes the local connection/credential, not the service's accounting records.
- Administrative allowance reset grants credit; it preserves raw usage and tokens
  (`server/app/accounting/admin_controls.py:110–120`).
- Speech synthesis and transcription settle with zero tokens and estimated money
  (`server/app/inference/audio_service.py:47–99`). Audio activity therefore does
  not imply that the token count will increase. Those zeros are not a complete
  measure of all service activity.
- Custom-server requests belong to that server's ledger. Hosted account refresh
  explicitly reads the hosted origin, not the selected custom server.
- The local development server uses an in-memory database recreated on restart
  (`server/development/launcher.py:75–79`,
  `server/development/memory_store.py:121–124,155–162`). Its counters really do reset
  on restart. Hosted storage uses persistent daily documents with 90-day retention.
- Native profile statistics summarize retained local activity, separately from
  the hosted daily account balance (`native/src/statistics/mod.rs`). They should
  not be expected to equal daily hosted counts.

## Verification and limits

Ran the existing environment's Python executable with pytest against:
`server/tests/accounting`, `server/tests/inference/test_proxy.py`,
`test_grouped.py`, `test_grouped_deltas.py`, `test_audio_service.py`, and
`server/tests/development/test_usage_limits.py`.

Result: **140 passed**. Coverage includes concurrent admission, rollback,
duplicate settlement, midnight settlement, unknown-cost reconciliation,
administrative reset preservation, and controlled request accounting. A pytest
cache write produced a permission warning; test execution completed successfully.
The preferred dependency runner could not access its cache, so these tests used
the existing virtual environment without revalidating its lockfile installation.

Also executed the usage parser directly for the four shapes above and reproduced
the 35-micro-dollar display rounding. UI refresh findings are source-traced, not
a running desktop reproduction. No live requests, resets, deployment, or commits
were performed. Determining which finding explains the observed account requires
the affected screen, selected route, time of activity, and its actual daily ledger.
