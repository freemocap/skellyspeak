# Audit remediation plan

- [x] Transactional budget admission, dated idempotent settlement, unknown-cost reconciliation.
- [x] Validated chat/audio contracts, bounded cost reservations and concurrency.
- [x] Atomic OAuth consumption, PKCE validation and stale sign-in rejection.
- [x] Native credential storage and atomic, error-reporting persistence.
- [x] Conversation-owned background work, serialized saves and safe deletion.
- [x] Byte-safe SSE parsing and retry usage accounting.
- [x] Explicit prompt precedence, bounded observer documents and reduced cadence.
- [x] Playback speed controls, pitch preservation and cached replay.
- [x] Word highlighting/timestamps removed from scope as requested.
- [x] Scoped cloud permissions; candidate build, startup and auth guard verified.
- [x] Automated regression checks and updated architecture/operations documentation.
- [ ] User: native-device smoke test and coordinated client/server release.

Git operations that change state are prohibited. No commits, branches or pushes
were made. The tested Cloud Run candidate has zero production traffic until the
coordinated release. See AUDIT_REMEDIATION.md for evidence and handoff details.
