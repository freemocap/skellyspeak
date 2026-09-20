# Local usage limits — 2026-09-20

## Agreed behavior and implementation

Local development servers do not enforce daily usage limits by default. The
launcher explicitly disables daily allowance and request enforcement on its
process-local database. `--enforce-usage-limits` opts into quota testing; normal
Firestore clients and other database instances continue enforcing limits.
The switch cannot be set through HTTP, editable admin policy or an environment
variable. Reservations, costs, tokens and request counts remain recorded.
Provider refusals, explicit spending pauses, request validation and transient
rate/concurrency controls remain active.

Admin overview and account rows label daily limits as disabled. The diagnostics
response exposes `usage_limits_enforced` and does not report disabled limits as
exhausted. Numeric policy values remain available for quota-testing configuration.
The native diagnostics formatter still displays those numeric policy values;
it does not yet display the new enforcement flag.

## Observed incident and runtime recovery

The local launcher previously imposed a $0.50 daily allowance. Live counters
showed $0.496785 charged/reserved, and server logs identified rejection of a
$0.023042 reservation as `PERSONAL_ALLOWANCE_EXHAUSTED`. The native app retained
a daily-limit hold until midnight UTC, independently of server state.

Read all JSONL streams in the available local run directories and correlated
the rejection with the persisted native hold and live admin counters. Restarted
the verified local development server with the new default (discarding its
process-local counters), verified `usage_limits_enforced: false` through its
admin endpoint, and removed only the matching saved custom-route daily-limit
hold from this incident. No native holds remained afterward. Conversations were
not changed. No provider inference was initiated to verify recovery.

## Verification

- Server development/accounting/admission/diagnostics suites: 152 passed.
- Admin UI tests: 5 passed, including disabled-limit labels with retained usage.
- UI TypeScript check, generated admin-asset check and `git diff --check`: passed.
- The first UI test invocation used the wrong working directory; rerunning from
  `ui/` passed. The sandboxed server suite was interrupted and rerun with loopback
  access required by existing local HTTP tests.
- No commit or deployment. The updated local server is running.
