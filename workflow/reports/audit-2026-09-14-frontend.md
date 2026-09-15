# Frontend code audit — 2026-09-14

Baseline: `91856a0`, initially clean working tree. Audit only; no source fixes, commits, native launch, application-data writes, or provider requests. Reviewed current `src/` React/TypeScript and native snapshot boundaries; `old/` excluded. Read working agreement, workflow guidance, README, and active design at `notes/DESIGN.md` (the root path mentioned in older instructions no longer exists).

## Findings

### FE-1 — P1: failed partner requests remain indistinguishable from work in progress

- **Location:** `src/features/guided/TurnView.tsx:365–366`; projection at `src/domain/language/conversation-view.ts:17–23`.
- **Trigger:** a saved user turn has no assistant message because its reply operation failed, was cancelled, was held, or ended unknown. This includes the reported rejected-model requests.
- **Evidence:** the projection builds turns from messages and drops the native turn/reply-operation state; the renderer unconditionally displays “Thinking…” whenever `assistant === null`. The only thing that removes this indicator is a reply appearing. There is no reply-specific failure or recovery control in that branch.
- **Impact:** a terminal failure looks like an indefinitely running request, including after reopening the conversation. Coaching/gloss failures may appear nearby, but do not explain the missing reply reliably.
- **Fix:** carry the native reply operation and hold/outcome into the projected turn; render progress only for active states, and render terminal error/cancel/unknown/hold states with appropriately scoped explicit actions. Preserve independent assistance results.
- **Regression checks:** pending → failed/unknown/cancelled/held snapshots, reopening a failed conversation, and explicit retry returning to progress then success. Assert no progress indicator for terminal reply states.

### FE-2 — P2: the selected partner can disagree with the displayed conversation

- **Location:** `src/features/guided/GuidedPage.tsx:208`, `219–220`, `230–234`.
- **Trigger:** select an existing contact B, then create contact C, switch target language, or delete/open a conversation through another path.
- **Evidence:** `selectedContactId` is set when choosing an existing contact and always takes priority over `details.contact.id`. Its only occurrences are declaration, this preferred read, and that setter; it is never reset by conversation/language changes. Creating a contact opens its conversation without updating this override.
- **Impact:** the partner selector and history filter remain attached to B while messages belong to C. Clicking B can then do nothing because `chooseContact` returns early for the stale “active” ID. On a language switch, history can appear empty because the previous-language contact is still used to filter it.
- **Fix:** derive committed selection from the current conversation/contact. If optimistic selection is necessary, scope it to one navigation request and clear it on completion, failure, and scope change.
- **Regression checks:** existing B → create C → choose B; B → another language; deletion of the selected conversation and automatic opening of another contact.

### FE-3 — P2: older messages silently disappear from the conversation UI

- **Location:** `src/features/guided/useConversation.ts:71–78`; `src/platform/ipc/workspace.ts:42–43`; native bound at `src-tauri/src/execution.rs:837`.
- **Trigger:** a conversation exceeds 100 stored chat messages (normally about 50 completed exchanges; revisions can consume this window too).
- **Evidence:** the native snapshot selects only the latest 100 messages and accepts a `before` cursor. The frontend bridge exposes that cursor, but every production caller omits it. The chat controller replaces its displayed turns with each latest snapshot and has no older-page loader. The “All conversations” drawer lists conversations, not older pages within one.
- **Impact:** scrolling cannot reach earlier conversation content despite its continued presence in the database/export. There is no truncation notice or loading action, so this resembles history loss.
- **Fix:** expose/load older pages explicitly and merge them by durable message identity while keeping the live tail subscribed. Show the bounded-history state until pagination is available; do not simply remove the backend limit.
- **Regression checks:** more than 100 messages, page boundaries splitting exchanges, revisions, deduplication while a new live reply arrives, and switching scope during page loading.

### FE-4 — P2: one snapshot-read failure permanently stops updates for that open conversation

- **Location:** `src/features/guided/useConversation.ts:68–83`; same pattern in `src/features/guided/CoachAnalysisPanel.tsx:37–49`.
- **Trigger:** any `watch_conversation` invocation rejects once after the observer mounts.
- **Evidence:** the catch is outside the observation loop, so rejection ends it. The effect depends only on conversation identity; dismissing the fault, receiving another operation completion, or sending another message does not restart observation. There is no retry-observation action.
- **Impact:** the page retains stale messages/state, or an empty initial snapshot, while native operations can continue. A pending snapshot can keep send controls disabled indefinitely. Navigation away to another conversation and back or a reload is required to reconstruct the observer.
- **Fix:** show an explicit disconnected/read-error state with a retry-read action that restarts observation. If bounded reconnect is desired, restrict it to read-only transport failures and keep persistent errors visible; never retry inference as a consequence.
- **Regression checks:** reject the initial watch and a subsequent watch, invoke read retry, and verify that no send/inference command is issued. Ensure an obsolete scope cannot reconnect after navigation.

### FE-5 — P2: lesson coach submission can erase newly typed text

- **Location:** `src/features/guided/LessonDialog.tsx:128–136`.
- **Trigger:** submit a lesson question, then continue typing in the textarea before the native command receipt resolves.
- **Evidence:** the submit button is disabled while pending but the textarea remains editable. Successful completion unconditionally calls `setQuestion('')` if mounted, regardless of intervening edits.
- **Impact:** the learner's next draft is silently erased. This differs from the main chat composer, which checks a draft revision before clearing.
- **Fix:** capture the submitted draft revision and clear only if unchanged, or deliberately disable the editor during admission. Retain typed text on failure and scope changes.
- **Regression checks:** delay `executeAction`, edit the draft, resolve success, and assert the later draft remains; also cover rejection and unmount.

## Verification and limits

- With Node **24.15.0**, `npm test`: **100 test files, 629 tests passed**.
- With Node **24.15.0**, `npm run build`: **passed**, including language validation, TypeScript and Vite. Vite reports a **988.21 kB** minified main chunk (**321.18 kB gzip**); this alone is not evidence of a runtime performance defect.
- Initial attempts used the shell's Node **22.8.0**: Vitest reported 70 environment errors (`ERR_REQUIRE_ESM`) and build precheck rejected a `.ts` extension. These were environment failures; the supported-runtime reruns above passed.
- Findings above are supported by source-path tracing; their proposed regression cases were not added or executed. Existing passing suites do not cover these conclusions away.
- Reviewed main conversation/controller, lesson and coach flows, settings store/autosave/IPC write path, session store, microphone and speech lifecycle, shell navigation, and shared dialog behavior. This is not an assertion that every source file was exhaustively audited.
- No live UI, accessibility-device, microphone, WebView lifecycle, real multiwindow, provider, mobile-device, or performance profiling was run. Detailed CSS/design-system review belongs to integration's separate pass.
- Ordinary settings revision conflicts already re-read/rebase in `saveSettings`; unsupported shortcut/microphone controls are visibly disabled. Neither is reported as a defect based on initial suspicions.

## Suggested order

Repair FE-1 first because it directly obscures the current failure mode. Then FE-2 and FE-4, which can make navigation or a recovered backend appear broken. Address FE-3 with a bounded history design and FE-5 as a focused draft-preservation fix.
