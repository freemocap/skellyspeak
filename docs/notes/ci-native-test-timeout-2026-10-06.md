# Native CI test timeout — October 6, 2026

The single-job organization below is superseded by the
[domain workflow split](ci-domain-workflows-2026-10-07.md). This note retains the
original failure evidence and verification of the timeout fix.

## Observed failure

CI runs [37539631597](https://github.com/freemocap/skellyspeak/actions/runs/37539631597)
on `e99e4460` (v3.1.0) and
[37539622443](https://github.com/freemocap/skellyspeak/actions/runs/37539622443)
on `1eeb0bc7` both exceeded the native library test step's 15-minute deadline.
Neither log reported a failed assertion. In the current run, compilation used
65 seconds before 850 tests started; passing workspace tests were still arriving
when GitHub terminated the step. The updater verification test was then skipped.
Every other job on the current CI run passed. The separate Release and iOS
distribution workflows completed successfully; those outcomes do not make this
CI run green.

## Implemented workflow change

- Separate native library test compilation (`--no-run`, 15 minutes) from execution.
- Allow the complete native library suite 30 minutes with four test threads.
  Explicit concurrency also makes local reproduction independent of CPU count.
- Allow the Rust job 60 minutes for preceding checks, compilation, execution and
  updater verification. All checks retain normal failure propagation; no test,
  assertion, validation dependency or release gate is removed.

This changes workflow scheduling only, not application behavior or release versions.
The existing failed runs used the old workflow and are not repaired retroactively.

## Verification

- Native test compilation: passed (75 seconds locally).
- Complete library suite with four threads: 845 passed, five ignored, no failures
  (208.69 seconds locally). Hosted runner performance is different; this does not
  establish its next run's duration.
- Previously skipped updater verifier: one test passed.
- Fast gate, workflow parsing/gate regression, documentation links and diff
  whitespace: passed.

Hosted verification requires committing and pushing the corrected workflow.
No commit, push, version bump, tag change or deployment was performed.
