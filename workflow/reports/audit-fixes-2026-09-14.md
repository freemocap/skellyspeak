# Audit fixes — 2026-09-14

## Scope and status

Implemented the 18 findings from [the integrated audit](audit-2026-09-14-integration.md). Changes are in the working tree. No application deployment, release, commit, push, live inference, or application-data reset was performed. The existing audit reports were preserved.

| ID | Implemented change |
| --- | --- |
| A01 | Default-deny Cloud Build source filter, checked with the real gcloud matcher and harmless forbidden-file sentinels. CI runs the check. |
| A02 | Prompt preparation failures fail their own operation; lesson review fits recent complete exchanges within the serialized prompt budget. |
| A03 | Missing replies display their actual failed, unknown, cancelled, held or paused state, with eligible explicit exchange recovery and activity access. |
| A04 | Local Groq preparation precedes reservation/submission; only the recognized gloss schema receives its adaptation. |
| A05 | Failed stale-credential cleanup preserves a usable startup and displays an explicit retry control; unsuccessful retries remain visible. |
| A06 | Partner selection follows the current conversation rather than an obsolete optimistic override. |
| A07 | Conversation observation exposes read failures and an explicit read-only reconnect. |
| A08 | Native long polling compares revisions before projection; lesson focus reuses evidence already computed. |
| A09 | Older messages load in bounded native pages; the UI merges by durable identity, preserves scroll position, refreshes revealed history, and includes older owning turn/error metadata. |
| A10 | A lesson question receipt clears only the submitted draft revision. |
| A11 | Grouped failure/completion logs carry safe request correlation and item metadata. |
| A12 | Receipt-verified historical reconciliation handles expired ledgers without recreating deleted balances. |
| A13 | Settings uses a native modal dialog for focus containment/background inertness; preserves shortcut capture, nested cancellation, busy-close guards and opener focus restoration. |
| A14 | Start-conversation hover uses a fill with readable foreground contrast in both themes. |
| A15 | Chat keyboard focus uses the high-contrast focus token. Contrast tests cover message surfaces. |
| A16 | CI checks generated Rust/TypeScript contracts and skill catalog drift. |
| A17 | Server documentation reflects current limits, routing, logging, uploads and reconciliation. |
| A18 | Repaired current entry-point links, marked historical workflow restrictions, aligned conversation guidance, and added a local-link check to CI. |

## Verification

Combined frontend suite: **654 tests passed across 105 files**. Documentation-site checks: **28 tests plus 7 dependency-patch security tests passed** after installing its locked dependencies. Domain handoffs:

- [Server implementation and tests](audit-fixes-server.md): **272 passed, 7 emulator-only tests skipped**. Positive and negative real-gcloud manifest checks passed.
- [Rust implementation and tests](audit-fixes-rust.md): **353 passed, 1 live-provider test ignored**. Binary/doc tests, Clippy, formatting and generated-contract check passed.
- [Frontend implementation and tests](audit-fixes-frontend-2026-09-14.md).
- Settings modal/startup targeted tests passed, including nested non-bubbling native cancellation, focus restoration, unsuccessful cleanup state and rejected retry recovery.
- Final production build and TypeScript checks passed. The last pagination regression passed in its focused seven-test suite.
- CSS token/style rules and contrast tests passed. Local links passed across six current documentation entry points.

## Remaining verification boundaries

Automated tests establish source behavior with local fixtures. Real OS keychain denial/recovery, native focus traversal, Android back behavior, native-window layout, Firestore emulator transactions, and deployed provider/billing behavior still require their respective environment checks. The browser fixture was not completed and is not claimed as visual verification. No hosted service has received these fixes yet.

The production bundle still exceeds Vite's 500 KB advisory threshold. Bundle splitting was not one of the confirmed audit defects and remains follow-up performance work. The local-link checker validates file targets in current entry points; it does not validate remote URLs, heading anchors or every historical report.

The docs dependency audit still recognizes the pinned upstream `image-size` version as vulnerable. Its two reported parser-loop advisories are the cases covered by the repository’s existing local patch; all seven patch/security checks passed. No dependency version or lockfile was changed in this repair pass.
