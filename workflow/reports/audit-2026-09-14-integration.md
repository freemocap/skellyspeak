# SkellySpeak codebase audit

**Baseline:** `91856a0` (`aaa`), September 14, 2026. The tracked working tree was clean at the start. Four independent agents reviewed the server, native Rust, React/TypeScript, and styles/shared UI. Integration reviewed their evidence, checked deployment/tooling/documentation boundaries, and measured representative controls in an isolated browser fixture.

**Outcome:** 18 actionable findings: **3 P1**, **13 P2**, **2 P3**. These include reproducible bugs, source-confirmed failure paths, and explicitly identified verification/documentation gaps. This is an audit and repair backlog, not an implementation or deployment. Only audit reports were added to tracked source paths.

## What to fix first

1. **Close the Cloud Build source-upload inclusion hole.** A supported local build can include server credentials/session files in uploaded source even though the final Docker image excludes them. Harmless-file reproduction confirms the selection behavior; no upload or existing secret exposure was established.
2. **Contain expected native operation errors.** A valid long lesson exchange can make a normal prompt-size rejection stop the entire scheduler. Keep errors local to the operation and make startup keychain cleanup recoverable.
3. **Represent failed work accurately.** The screenshot's endless spinner is still a frontend defect. Preserve native operation state and error through projection, and provide recovery for failed snapshot subscriptions.
4. **Then fix accounting, navigation/history, and the measured accessibility defects.** These are narrow corrections, not reasons to replace frameworks or rewrite the application.

The existing architecture has useful foundations: durable operation identities, explicit state transitions, strict source/output validation, independent assistance operations, bounded inputs, generated contracts, semantic style tokens, and substantial automated coverage. The most consequential defects are at the boundaries between those pieces.

## Priority definitions

- **P1:** address before another release/deployment or before expanding normal use; a concrete privacy, whole-app availability, or core failure-recovery problem.
- **P2:** fix in the next stabilization cycle; incorrect state, accounting, access, visibility, or missing guardrail under a specific trigger.
- **P3:** maintenance/documentation debt with a concrete correction and limited immediate runtime impact.

No finding claims an observed production exploit, device crash, measured CPU regression, or universal provider failure unless explicitly supported below.

## Prioritized findings

| ID | Priority | Area | Finding and trigger | Recommended repair | Evidence |
| --- | --- | --- | --- | --- | --- |
| A01 / S5 | P1 | Build/privacy | Root `.gcloudignore` re-includes all `server/` descendants. Local Cloud Build submission can upload `local.env`, session tokens and `.venv` files if present. | Correct source selection; test the actual gcloud upload manifest with private-file sentinels as well as the Docker context. | Actual CLI manifest from harmless temporary fixture. [Server report](audit-2026-09-14-server.md#s5--p1-cloud-upload-allowlist-includes-private-server-files-and-the-entire-virtual-environment). |
| A02 / R1 | P1 | Native scheduler | Oversized lesson-review context propagates Validation out of dispatch into global service shutdown. | Fail/persist the affected operation; budget review history before dispatch; reserve global shutdown for broken invariants/storage. | Offline accepted-message/completion reproduction plus direct scheduler call chain. [Rust report](audit-2026-09-14-rust.md#r1--p1-a-lesson-input-budget-rejection-stops-the-entire-native-application-service). |
| A03 / FE-1 | P1 | Chat recovery | Any terminal reply without an assistant message renders “Thinking…” forever, including reopened failed chats. | Carry reply state/error/hold into the UI and render terminal states with explicit scoped actions. | Projection and render condition; matches the reported symptom. [Frontend report](audit-2026-09-14-frontend.md#fe-1--p1-failed-partner-requests-remain-indistinguishable-from-work-in-progress). |
| A04 / S1 | P2 | Accounting | Groq schema adaptation marks usage unknown before any HTTP submission; a local adapter exception charges full allowance and retains a lease. | Adapt/serialize before marking submission uncertain; scope gloss adaptation to its actual schema. Pre-submission failure settles zero. | HTTP/ledger reproduction: zero outbound calls, 19,863 microdollars reserved/charged. [Server report](audit-2026-09-14-server.md). |
| A05 / R3 | P2 | Native startup | A retained stale-credential cleanup obligation plus OS keychain deletion failure aborts Tauri startup. | Retain cleanup obligation and expose explicit startup retry/recovery; do not silently discard it. | Direct setup/error propagation; no real keychain-denial test. [Rust report](audit-2026-09-14-rust.md). |
| A06 / FE-2 | P2 | Navigation | Optimistic selected-contact override survives contact/language/conversation changes and can disagree with the visible chat. | Derive committed selection from current conversation; scope/clear optimistic selection. | Setter/read/reset tracing. [Frontend report](audit-2026-09-14-frontend.md). |
| A07 / FE-4 | P2 | Frontend reads | One rejected snapshot watch exits its observation loop permanently for that mounted conversation. | Visible disconnected/read-error state with explicit read retry; never replay inference as reconnect behavior. | Effect/loop control flow. [Frontend report](audit-2026-09-14-frontend.md). |
| A08 / R2 | P2 | Native performance | Idle long polls hydrate snapshots and repeatedly fold language-wide evidence under the global Store mutex before checking revision. | Read revision first; hydrate only on change/deadline and share/caches projections by revision. | Confirmed repeated algorithm, not measured user latency. [Rust report](audit-2026-09-14-rust.md). |
| A09 / FE-3 | P2 | History | UI never requests the available older-message cursor; more than 100 stored messages cannot be reached in chat. | Bounded page loading and identity-based merge with live tail; display truncation until implemented. | Backend bound plus all production callers. Data remains stored. [Frontend report](audit-2026-09-14-frontend.md). |
| A10 / FE-5 | P2 | Draft safety | A lesson question receipt unconditionally clears text typed after submission. | Clear only the submitted draft revision, matching main-composer behavior. | Editable textarea and async success path. [Frontend report](audit-2026-09-14-frontend.md). |
| A11 / S2 | P2 | Diagnostics | Grouped item failures lack the generated request ID/item correlation; simultaneous failures cannot be joined to their envelope logs. | Correlated terminal records with bounded index and reviewed provider/code/category; no raw bodies or credentials. | Controlled streamed-error/log reproduction. [Server report](audit-2026-09-14-server.md). |
| A12 / S3 | P2 | Accounting retention | Unknown reservations never expire, but their daily ledgers expire after 90 days and are required for reconciliation. | Retain necessary accounting dependencies or add verified historical finalization without recreating daily balances. | TTL-deletion simulation; latent future defect. [Server report](audit-2026-09-14-server.md). |
| A13 / ST-01 | P2 | Accessibility | Settings claims modal semantics but neither moves/contains focus nor makes the app behind it inert. | Use shared/native modal infrastructure with initial focus, containment and restoration, including loading/error branches. | Source-confirmed missing modality. [Styles report](audit-2026-09-14-styles.md). |
| A14 / ST-02 | P2 | Design tokens | Dark Start conversation hover keeps white 15px text on `#6fa3ea`: **2.592:1** contrast. | Use a paired fill-hover/foreground role and test interaction states. | Exact colors plus isolated browser hover measurement. [Styles report](audit-2026-09-14-styles.md). |
| A15 / ST-03 | P2 | Keyboard focus | Chat generic outline uses a quiet border token: **2.289:1 light / 1.721:1 dark** against the sheet. | Contrast-tested focus role across the actual adjacent surfaces. | CSS/token calculation; browser confirmed dark 2px outline with 3px offset. [Styles report](audit-2026-09-14-styles.md). |
| A16 / T1 | P2 | CI boundary | CI does not run the existing generated Rust→TypeScript contract/catalog drift check. | Add `npm run contracts:check` (or its Cargo equivalent) to a job with the required toolchains. | Workflow scan and exporter behavior; current contracts do pass locally. Details below. |
| A17 / S4 | P3 | Operational docs | README's limits, lease counts and model support contradict implementation and newer sections. | Consolidate current contract; reference/generate constants and label historical verification. | Direct source/document comparison. [Server report](audit-2026-09-14-server.md). |
| A18 / D1 | P3 | Design/docs | Moved active docs leave broken navigation and contradictory current guidance. | Repair paths and collapse obsolete instructions into explicitly historical notes; add local-link validation. | 27 broken local targets in three key docs; details below. |

## Integration findings in detail

### T1 — Generated contracts are checked locally but not enforced in CI

**Locations:** `.github/workflows/ci.yml:25–33,78–84`; `src-tauri/src/bin/export-contracts.rs:1–24`; `package.json:18`; `README.md:246`.

The main frontend build type-checks the committed TypeScript declarations, while Rust CI tests the Rust library separately. Neither compares the declarations or bundled skill catalog against their Rust source. The exporter has a read-only `--check` mode which rejects both kinds of drift, but no workflow invokes it. Consequently a future native field/catalog change can leave CI green with a stale frontend wire contract. This is a **verification gap**, not a claim that the current generated files are stale: the audit ran `npm run contracts:check` successfully.

Add the existing check to CI and prove the gate by changing a generated artifact in an isolated fixture/check workflow. Keep Rust/TypeScript generation centralized; no second hand-authored schema should be introduced.

### D1 — Active design documentation was moved without repairing its consumers

**Locations:** `README.md:7–8,239,295,311–321,354`; `notes/BUILD-PLAN.md:8,16,27,52,334,446,449`; `notes/DESIGN.md:5,268–269,885,965`; `workflow/README.md:12–30`; `notes/ui-guidelines.md:6–7,33,120–122`.

A local Markdown target check found **15 broken targets in README**, **7 in notes/BUILD-PLAN**, and **5 in notes/DESIGN**. Root README architecture links still address files now in `notes/`; moved plans still address root-relative sibling directories without `../`. This breaks the primary onboarding/design path, not just old reports.

Several documents also present obsolete instructions as current. `workflow/README.md` says Git is read-only and no new agents are assigned, contrary to the supplied current working agreement and this audit request. `ui-guidelines.md` asks for Coaching/Evidence and visible compact selects near the top, then ends with hidden selectors and XP/Persona tabs in an unlabelled “Compact conversation surfaces” section. These are documentation conflicts, not permission requirements or reasons to reverse the latest design.

Repair links relative to their new location; make one current rule per responsibility and label superseded sections as historical. A local-link check should target maintained documents and distinguish active guidance from archives.

## Repair sequence and acceptance checks

### 1. Before deploying or releasing

- **A01:** use the real `gcloud meta list-files-for-upload` selection in a sentinel-only fixture. Assert private file paths are absent and every runtime/build module is present. Verify both upload and image boundaries.
- **A02:** promote the offline reproduction into a durable regression. Oversized review must fail only its operation, keep other conversations usable, and retain an inspectable error after reopening.
- **A03:** cover pending, failed, cancelled, held, unknown, and retry states in frontend projection/render tests. A terminal operation must never appear as active progress.
- Retain the recent server-before-client rollout requirement. Older released clients have a stricter grouped error-code decoder; the current source handles the new provider/status codes. That known rebuild requirement is not counted as an additional baseline bug.

### 2. Restore predictable state and accounting

- **A04/A05:** distinguish pre-submission preparation from uncertain provider work; distinguish keychain cleanup obligations from fatal database errors.
- **A06/A07/A10:** delayed receipts, navigation races, and interrupted read subscriptions need focused tests. Preserve drafts and scope reads; do not add automatic AI retries.
- **A11:** prove that two simultaneous grouped requests can be distinguished in redacted terminal logs.

### 3. Stabilize long-lived use

- **A08/A09:** test an idle populated language and more than 100 messages. Measure hydration/queries per unchanged revision and verify older pages coexist with live updates. Keep bounds rather than replacing them with unbounded loads.
- **A12:** define accounting closure after retention expiry and test it against the emulator/retention model.
- **A13–A15:** keyboard-only Settings journey; light/dark control interaction states; desktop/narrow layout and touch-target measurement in the real application.

### 4. Reduce repeat churn

- **A16–A18:** enforce generated contracts, reconcile documentation, and add deployment-context/link checks.
- Then extract native dispatch preparation, snapshot projections, and publication along existing seams. File size and broad refactoring are not the first fix.
- Keep one shared draft-clear convention, one read-subscription recovery convention, and shared modal behavior. Extend semantic token tests to foreground/background/state combinations rather than merely token existence.

## Verification evidence

| Check | Result | What it establishes |
| --- | --- | --- |
| Frontend `npm test`, Node 24.15.0 | 629 tests / 100 files passed | Existing mocked frontend regressions. |
| Frontend `npm run build` | Passed | Language precheck, TypeScript and Vite build. |
| Server pytest | 259 passed, 7 emulator cases skipped | Existing local server regressions. |
| Server targeted audit reproductions | 3 passed | Local preparation accounting, missing log correlation, expired-ledger reconciliation. |
| Cloud upload manifest fixture | Private sentinel paths included | Concrete source-selection defect; no upload performed. |
| Rust audit reproduction | 1 passed | Expected lesson-budget Validation escapes `Store::dispatch`; global-stop call chain traced in source. |
| Full native suite / Clippy from preceding repair | 348 passed, 1 ignored; Clippy passed | Prior source verification, not a new full audit run. |
| `npm run contracts:check` | Passed | Current Rust/TypeScript/catalog artifacts agree. |
| `npm run styles:check` | Passed | Declared tokens, stylesheet manifest and syntactic ownership rules. |
| `npm run graph:check` | Passed | Type-check of import/refactor/style analysis tooling. |
| Logging scripts | Type-check passed; 4 tests passed | Launcher logging and redaction regressions. |
| iOS release scripts | Type-check passed; 2 tests passed | Local release-helper verification, not a device/archive build. |
| Isolated browser control fixture | Hover/focus colors confirmed | Actual CSS cascade on representative dark controls, without IPC/app data. |

The default shell resolved Node 22.8.0, which caused `.ts` script failures and frontend test-environment errors. Rerunning with the documented Node 24.15.0 passed. Those initial failures are an environment mismatch, not application findings.

`styles:dead` reported ten candidates, but the scanner includes comments and font URL suffixes; these are **not ten verified dead selectors**. The Vite main bundle is 988.21 kB minified / 321.18 kB gzip. That warrants measured startup work if startup is slow, but does not by itself prove a performance defect.

## Coverage limits

This is a broad risk-focused audit, not an assertion that every line or platform path is correct. The agents reviewed active source and concrete caller/callee paths; `old/` was excluded as deprecated reference. No production database, credentials, billing state, native session or provider account was mutated.

Not exercised: real Cloud Build upload/deployment, Docker image startup, live OAuth/provider inference, real Firestore TTL timing/concurrency, OS keychain-denial behavior, device microphone/TTS, mobile keyboard/layout/accessibility services, full native interactive desktop/narrow journeys, or production-history performance profiling. These are explicit next verification steps, not silently passing gates.

An early hypothesis that Settings revision conflicts retry a stale baseline was **rejected**: `saveSettings` already refreshes/rebases. A suspected missing Cloud Build module was also **rejected** after checking the actual upload manifest; the opposite inclusion defect is A01. These corrections are why the report distinguishes source tracing, reproductions, and runtime claims.

## Domain reports

- [Server and deployment](audit-2026-09-14-server.md)
- [Rust backend](audit-2026-09-14-rust.md)
- [React/TypeScript frontend](audit-2026-09-14-frontend.md)
- [Styles and shared UI](audit-2026-09-14-styles.md)
