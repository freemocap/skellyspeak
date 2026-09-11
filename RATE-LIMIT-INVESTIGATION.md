# Incident report: hosted allowance refusals — 2026-09-10

Status: root cause confirmed; fixes implemented and locally verified; production
deployment and installed-client verification pending. Incident window:
September 10, 8:24–8:44 PM EDT (September 11, 00:24–00:44 UTC).

## Impact

Two affected accounts were investigated after conversation assistance stopped
with allowance errors despite substantial remaining funds. Twelve chat requests
received HTTP 429; the client paused AI access and cancelled queued work. Tokens
shown in Settings were usage statistics, not the enforced allowance. No data loss
was established by this investigation.

## Finding

The exported logs contain 12 HTTP 429 chat responses, all classified as
`PERSONAL_ALLOWANCE_EXHAUSTED`. They do not show an ingress-rate rejection or a
rapid sustained rejection/retry loop. Requests arrive from two source addresses;
addresses alone do not establish account identities.

Read-only production Firestore inspection confirms that the account in the
screenshot had substantial actual allowance left. Large concurrent reservations
and a retained timeout reservation temporarily left too little available for
another worker request. The client then paused the endpoint and cancelled queued
work. Subsequent settlement restored available allowance without clearing that
client pause.

## Screenshot account: exact ledger match

The UTC usage day is 2026-09-11, beginning at 8 PM EDT on September 10.
The account uses the default $0.50 daily limit.

| At the screenshot's final ledger state | USD |
| --- | ---: |
| Confirmed cost of 70 completed requests | 0.061608 |
| One unresolved timeout reservation | 0.100907 |
| Total counted against allowance | 0.162515 |
| Available allowance | 0.337485 |

The ledger contains exactly 71 requests and 85,290 tokens, matching the screenshot.
The timed-out request was reserved at 00:40:32.658 UTC and recorded as unknown at
00:43:32.759 UTC. It has no provider generation ID, so the existing receipt-based
reconciliation command cannot establish its real charge. Do not assume zero cost.

At 00:43:40.300 UTC, within the final 429's request interval, the ledger was:

| Component | USD |
| --- | ---: |
| Confirmed spending | 0.056639 |
| Unresolved timeout | 0.100907 |
| Three pending reservations | 0.303429 |
| Total committed | 0.460975 |
| Available for another reservation | 0.039025 |

Those three pending requests settled by 00:43:44.060 UTC for a combined $0.004969,
releasing $0.298460. This exactly produces the screenshot's final balance.
The rejected request's body and proposed reservation were not logged; its exact
required amount cannot be reconstructed from these records.

## Second timeout account

A different account's unknown reservation was settled into unknown status during
the other logged 180-second failure at 00:28:42 UTC. Its daily ledger contains 138
reservations, $0.125579 confirmed cost and $0.098757 unresolved cost, against the
same $0.50 default limit. At 00:25:34.300 UTC, around another rejection, it had
$0.100053 confirmed spending and $0.298602 pending, leaving $0.101345 available.
A worker requiring more than that can be rejected even without a timeout hold.
Not every rejection can be assigned to an exact account/transaction snapshot:
the request logs intentionally omit account identity and reservation amounts.

## Incident mechanism, before the repair

- `src-tauri/src/ai.rs`: structured workers default to a 32,000-token output
  ceiling. This is a maximum, not typical output size. Some operations override it.
- `server/contracts.py`: reserves UTF-8 input bytes plus framing overhead at the
  configured input price ceiling, plus the full requested output token ceiling.
  For ordinary workers, output alone reserves 96,000 micro-dollars ($0.096).
- `server/budget.py`: pending and unknown reservations count against the same
  daily balance as settled spending. Settlement releases unused reservation.
- `src-tauri/src/request_admission.rs`: allows four concurrent requests, and
  pauses the endpoint after any 401/402/403/429. Queued calls are cancelled.
- `src-tauri/src/network.rs`: converts every 429 to a generic request/spending
  message, discarding the service's specific reason.
- `server/main.py`: the 180-second provider deadline leaves unknown cost reserved.
  `_settle` raises a RuntimeError for unknown cost, which can obscure the original
  timeout. The account display reports committed money as used; its remaining
  request count is an average-based estimate, not an admission guarantee.

These were inspected local-source mechanisms consistent with production ledger
evidence; this investigation did not verify a byte-identical deployed source tree.

## Verification

`server/test_budget.py` includes an incident regression using the exact screenshot
account amounts. A representative $0.10 reservation is rejected with only $0.039025
available. After the three pending requests settle, the same reservation succeeds,
even while the unknown timeout amount remains held.

Command: `uv run --project server --frozen --group dev pytest server/test_budget.py -q`

Result: **6 passed**. Tests use a fake transactional ledger; no production writes.

## Repair implementation

The native client retains four concurrent inference calls and its bounded queue.
Word insight and topic notes use 2,000 output tokens; translation, mechanics and
coach feedback use 4,000; suggestions use 8,000. Long word-annotation tasks retain
32,000. Existing explicit limits for reactions, skill review and observer work
remain in force. Unknown default task schemas fail instead of receiving a large
generic output allowance. Models are unchanged.

The server rechecks unaffordable reservations before provider dispatch, within the
same incoming request, at most six times with 15.5 seconds total backoff. Sixteen
waiters per process bound this work; overflow receives 503. Affordable calls still
run concurrently. Provider failures are never replayed. Spending pauses and a
reservation larger than the entire allowance fail immediately. A refusal that
persists through the bounded wait still returns its allowance code.

Embedded stream refusals now pause shared admission for chat and TTS. Hosted HTTP
errors show allowlisted allowance reasons and validated request IDs. Account UI
labels the existing total as spent or reserved and explains unresolved holds;
separate numeric breakdowns and automated billing reconciliation are deferred.
Existing unknown charges remain reserved. No ledger schema or spending ceilings
are changed. Provider-timeout classification improvements remain separate work.

These are local source changes, not a deployed release. Git writes, production
balance adjustments and provider calls have not been performed by this work.

## Release and follow-up

1. Run Linux server CI, the Firestore emulator checks and container startup checks.
2. Deploy the server admission change and release the native/client changes;
   both are required for the complete fix. A server-only deployment does not
   change installed clients' output caps or streamed-refusal handling.
3. With the released client, verify a hosted conversation with overlapping
   analysis, coaching and audio work. Check final allowance and error reporting.
4. Inspect request outcomes for renewed 429 bursts and timeout holds. Retain
   uncertain charges until provider billing evidence supports reconciliation.
5. Evaluate smaller models separately after the incident fix is verified live.

Release acceptance: concurrent provider work remains possible; budget admission
is bounded; a waiting operation is dispatched once; spending limits remain intact;
and neither HTTP nor streamed refusals cause automatic provider retries.

## Local verification results

- 193 native tests passed; two hardware/provider tests ignored.
- 58 settings/conversation/reading UI tests passed; TypeScript and Vite build passed.
- 35 focused server admission, budget, proxy and grouped-work tests passed.
  The concurrent regression observes three provider calls simultaneously, confirms
  a fourth waits only at budget admission, then verifies four successful responses
  and exactly four provider dispatches. Cancellation, finite admission attempts,
  full waiter capacity and impossible reservations are covered.
- The full server suite run passed 205 tests and skipped seven emulator tests;
  `test_private_env_is_required_and_values_are_not_in_errors` failed because Windows
  `chmod(0o600)` does not implement its POSIX owner-only mode expectation. The
  local-server launcher and that test are unchanged by this fix. Linux/Firestore
  emulator CI and an installed-client hosted smoke test remain release checks.

## Follow-up: request amplification and retry-loop check

The supplied export's inference requests (chat plus transcription) were grouped by
source address and measured in rolling windows. The two sources with rejections
peaked at 32 and 56 requests per 60 seconds, respectively. Neither exceeded four
request starts per one-second window. The screenshot account's source sent no
further inference request after its final 429 within this export. The other source
resumed in separate bursts; logs cannot distinguish explicit Resume, app restart,
or another client sharing an address. The export does not contain request bodies
or operation identities, so it cannot prove that all successful requests were
unique or explain every user action.

Local source checks:

- HTTP failures return immediately from structured calls. Only parsing/validation
  failures receive corrective attempts, bounded to three total attempts.
- Four inference permits and 64 outstanding permits bound native work. Refusal
  invalidates queued requests; ordinary completion does not resume the endpoint.
- A native guard rejects concurrent turns for the same chat.
- Greeting/steering effects depend on values and explicit lifecycle changes,
  not changing callback identities. Request failure does not schedule a retry.
- Reading fragments render without automatic annotation requests. Topic-note
  resources share pending requests and retain failures until explicit retry
  while cached; cache eviction/recreation can permit another request.
- A normal learner turn can launch nine model operations before optional observer,
  speech or corrective work. This is substantial request amplification even
  without a feedback loop.

Verification: 58 tests passed across conversation lifecycle, reading fragments,
steering and topic-note resources; four native admission tests and the real-local-
HTTP refusal transport regression passed. All provider/backend calls were mocked
or directed at a local test listener; no hosted load test was performed.

Stream protection: the decoder retains the embedded provider status and chat/TTS
apply it to shared admission. A fragmented-stream regression covers embedded
401/402/403/429, verifies that subsequent audio/chat admission is blocked and that
private provider messages are not displayed. These twelve logged HTTP-429
rejections did not follow the embedded-error path.

Conclusion: no evidence of the earlier sustained rejection loop in this export,
and the inspected local safeguards pass. This is not a guarantee of zero duplicate
requests, nor verification that every installed client matches this checkout.
