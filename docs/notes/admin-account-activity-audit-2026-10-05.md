# Admin account activity and allowance audit

Status: source implementation and local verification; no production deployment,
account mutations or provider-billing reconciliation.

## Finding

The screenshot's Last active column read users/<id>.last_seen. The only hosted
account writer for that field is quota.upsert_user during Google sign-in.
Bearer-session use does not refresh it; installation last_seen is a separate
record. Thus an October 1 sign-in and October 5 allowance use are compatible.
This identifies a misleading label, not evidence that $0.407191 is miscalculated.
The particular production account and its provider receipts were not inspected.

## Implemented report behavior

- Label the existing timestamp Last sign-in and add Last inference request,
  derived by descending created_at from the newest retained reservation (one
  bounded query per loaded account). Do not substitute settlement updated_at.
- Request timestamps include pending and failed attempts with reserved allowance;
  they do not measure human presence or successful responses. Expired/missing
  reservation history yields unknown, not an inferred timestamp from money.
- Show the existing Google subject-based user ID by default, with the provider
  prefix, first three and last six characters. Fully conceal subjects of nine
  or fewer characters. Reuse email's click-to-reveal/hide and live-update guard.
- Name money columns Allowance used, disclose holds/estimates, and preserve the
  original ledger values, personal credits and identities without writes.
- Fix a separate midnight boundary: overview previously sampled the clock for
  each user's daily, history and admission reads. Capture one report UTC date
  and use it for all these reads, shared counters and the report timestamp.

## Calculation audit

Daily use reads the matching UTC document's integer micros (one million per USD).
The 90-day sum includes today through day minus 89, excluding older retained
rows and future rows. Personal credit is separate from usage, never subtracted
from gross consumption. budget.reserve atomically increments personal/shared
ledgers and creates a reservation. budget.settle applies the actual-minus-held
correction to the reservation's original day, even across midnight. Repeated
settlement is idempotent; unknown cost keeps its hold. Audio estimates remain
estimates, not actual provider charges. Request admissions and reserved provider
attempts are different counters and need not match.

Overview still uses sequential live reads rather than a transactionally atomic
snapshot. Concurrent traffic can change totals between reads; this limitation
remains visible. Missing history can reflect expiry rather than zero lifetime
use. No reconstruction, backfill or ledger mutation is performed.

## Verification

Regression coverage adds stale sign-in versus newer inference, late settlement
that must not become activity, absent request timestamps, and a report spanning
UTC midnight. Existing coverage checks the exact 90-day boundary, separate
credits, settlement across midnight, idempotency, unknown holds and rollback.
UI tests exercise masked ID reveal/hide, independent email disclosure, both date
columns and account inspection. Generated assets include the current shared CSS
tokens, which were stale in the checked-in bundle before this change.

Passed: server suite (579 passed, 7 Firestore emulator tests skipped), admin UI
suite (10 tests), root check:fast, root build, standalone admin TypeScript check,
and generated-asset freshness check. Browser review used the synthetic loopback
preview and confirmed readable date/ID columns and horizontal table scrolling.
The build retains its existing large-chunk warning. Server tests initially hit
Windows permissions on the shared pytest temp directory; the successful rerun
used a dedicated .local/admin-audit-pytest-20261005 directory. No hosted CI,
Firestore emulator or live provider reconciliation was run.
