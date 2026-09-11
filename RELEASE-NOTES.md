# Release notes

## Unreleased — hosted allowance and concurrency fix

- Preserve four concurrent AI calls. When a reservation cannot fit, the server
  briefly rechecks allowance before dispatch while existing calls continue.
  Waiting is bounded and does not resend provider requests.
- Use task-specific output limits: 2,000 tokens for word insight/topic notes,
  4,000 for translation/mechanics/coach feedback, and 8,000 for suggestions.
  Long word annotations retain 32,000 tokens. Models are unchanged.
- Pause queued AI work for refusal codes inside streamed responses as well as
  HTTP refusals. Display safe hosted error reasons and request IDs.
- Label the account total as spent or reserved, including pending and unresolved
  holds. Remaining-request estimates are not guaranteed capacity.

The [incident report](RATE-LIMIT-INVESTIGATION.md) records the two investigated
accounts, exact reservation arithmetic, retry-loop checks and verification.
The cause was reservation pressure, compounded by timeout holds and persistent
client pause; these logs do not establish recurrence of the earlier retry storm.

Local checks: 193 native tests, 58 UI tests, 35 focused server tests, and the
frontend production build passed. Full server testing identified one unchanged
Windows/POSIX permissions-test failure; seven Firestore emulator tests were skipped.

Release requires server deployment and an updated client, Linux/emulator CI,
and a hosted smoke test. No production deployment or balance adjustment has been
performed. Model routing and automated billing reconciliation are deferred.
