# AI connection status UI

Implemented September 16, 2026.

The shell now shows a keyboard-accessible AI Connected / AI Not Connected button
on desktop and mobile. Clicking it opens Settings, whose initial section is AI
Access. A saved key alone never establishes a connected state. (Superseded on
September 30, 2026: the button moved from the top bar into the chat composer; see
[the composer AI status line](#superseding-follow-up-the-ai-status-moves-into-the-chat-composer).)

Shared, revision-scoped check results drive the shell and Custom URL tab. Custom
URL shows unchecked/checking/connected/disconnected state, last check time,
session-token acceptance (or authentication disabled), and failures. Checks verify
the authenticated SkellySpeak protocol endpoint. They do not prove downstream
provider credentials or model access; the settings UI states this distinction.
Direct OpenRouter uses key verification; hosted access uses the account endpoint.
Checks make no inference requests and do not automatically retry failed work.

The shell checks on initial configuration, revision changes, online events and
return to the visible app. Same-revision focus checks reuse results for one minute;
there is no continuous polling or idle heartbeat. The settings check button can
refresh the result manually. Offline events invalidate results. In-flight checks
cannot overwrite results for a newer revision or an offline event. Results are
last-checked observations, not continuous monitoring of server uptime.

Verification: 73 focused UI/store/localization/architecture tests passed, styles
passed, and TypeScript/production UI build passed. Nine app navigation/session tests
also passed. Live native/provider connectivity and visual inspection in the
running app remain separate from these automated checks. Existing unrelated
working-tree changes were preserved.

## Superseding follow-up: internal provider credentials and visual controls

Custom URL checks now request `/v1/protocol?verify_providers=true`. After the
normal session authentication and diagnostic admission, the server independently
probes OpenRouter `/key` and Groq `/models` with its own saved credentials. The
server performs the probes concurrently with ten-second deadlines, bounded bodies
and redirects disabled. It returns only provider name, fixed result category,
HTTP status and duration. Raw errors follow the redacted provider-error log path;
keys and provider account details never reach the app.

These are credential checks, not inference/model/billing smoke tests. Sources:
[OpenRouter current-key endpoint](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key)
and [Groq API reference](https://console.groq.com/docs/api-reference).

A Rust-generated AccessCheck contract carries the individual results to shared UI
state. Older servers lacking results fail explicitly with an upgrade instruction.
Any failed provider prevents aggregate AI Connected. The previous paragraph saying
that checks cannot establish provider credential acceptance is superseded.

The settings control now has four compact rows: server, session token, OpenRouter
and Groq. Rows use check/cross icons, colored borders and result badges; HTTP
failures retain their code. A visible Check connection button rechecks the set.
The Custom URL tab and shell status are pill controls. Edited settings invalidate
previous results, and loss of connectivity hides prior green check results.

Verification for this follow-up:
- Server: 306 passed, seven Firestore-emulator tests skipped.
- UI/store/localization/architecture: 61 passed.
- Native connection tests: 11 passed, socket-based tests excluded.
- Production UI build and style checks passed.
- Isolated component renders inspected at 820px and 390px; no horizontal overflow.
- Live, read-only checks with the server's configured keys: OpenRouter accepted
  (200), Groq rejected (403). No inference request or user content was sent.

The running server and native app were not restarted. Restart the server and
rebuild/relaunch the app to load the endpoint and updated IPC response contract.

## Superseding follow-up: the AI status moves into the chat composer

Implemented September 30, 2026. Requested in design review; the placement and
wording are awaiting review in the running app.

The AI pill left the top bar. It now leads the composer's status line, above the
recording panel (`features/conversation/composer/AiStatus.tsx`): on its own row at
full width, and at the start of the reply-help and coach row in compact and narrow
layouts. The status line never takes more than half the row, so reply help and the
coach keep their full size. Outside Chat, AI activity stays under More.

- At rest the pill is a grey chip (`--chip`, `--ink-2`, grey dot), connected or not
  yet checked. While AI work runs it takes the accent tint with a moving conic edge
  (`activity-border-orbit`, static under reduced motion). Not connected, it takes
  the danger family; checking stays grey.
- Clicking it behaves as the top-bar button did: AI access when not connected, the
  popped-out AI window when there is one, otherwise the docked AI View.
- Beside it, one line names the step under way, from
  `domain/activity/ai-status.ts`: learner steps first (transcribing, scheduling
  the turn), then the newest turn's running work (the prose reply while it runs, as
  "generating" before tokens stream and "streaming" after; otherwise the operation
  that started most recently), then queued dispatch, replayed speech synthesis and
  the connection. Held and failed work keeps the existing activity link.
- Every step has three catalog wordings, at most three words, then two, then one.
  The line measures hidden copies and shows the longest that fits; below the
  shortest it shows only the pill. Wordings name the machinery (recorded audio,
  reply turn, dispatch, tokens, glosses, synthesis) so the stream teaches how a turn
  is made. An operation kind without a wording is shown by its scheduler name.
- Each step stays at least 800 ms before the next replaces it; from rest a step
  shows at once. Hovering the line shows the scheduler kind and requested model.
  Only learner-started steps are announced to assistive technology.

The unused `state/session/ai-busy.ts` store was removed: busy is now derived from
the same turns as the line. The tour's AI stop targets the composer pill, and
`ui/tools/conversation-preview.html` has an AI status scene picker and a
"Play a turn" sequence for review without AI calls.

Verification: status domain and component tests (24, including a width re-fit
test with a stubbed ResizeObserver), the related app, session, message and
conversation suites, TypeScript, styles and localization checks passed. The
preview was inspected at 375, 400, 480, 700, 960 and 1400px in light and dark
themes. The running desktop app showed the pill in the composer after hot reload;
its states were not exercised there.

### Follow-up: Practice's pill, the connected mark and resizable sheets

Decided and implemented September 30, 2026, in answer to the open questions above.

- **Practice carries the pill.** Its row sits between the recording panel's divider
  and the panel (`features/drill/PracticeAiStatus.tsx`), at most half the stage's
  width. It reports attempts on their way through the speech service (a manual take,
  or a listening session's processing and queued takes) and a card's audio request
  until the audio arrives. That line says "fetching", not "synthesizing": the
  reading result does not say whether native answered from its speech cache.
- **Connected idle shows a green mark.** The pill stays a grey chip; its dot takes
  `--connected-mark`, a green status token added for this, since the design
  system's success family is cyan. Not connected stays red, and says so in words.
- **One pill, three owners.** The presentation is the store-free
  `components/feedback/AiStatusPill.tsx`; the checked connection is
  `state/session/ai-access.ts`; opening the AI View is
  `state/navigation/ai-activity.ts`. Chat and Practice adapt their own activity
  to it, as the module boundaries require. Its styles moved to
  `styles/components/activity.css`.
- **Hover names the models.** Transcription and speech steps name the configured
  transcription and speech models beside the scheduler kind.
- **The coach sheet and opened reply help are resizable** where they cover the
  conversation (compact and narrow). Each has a grip on its top edge: drag it, or
  focus it and use the arrow keys; a double click returns the default. The heights
  persist per browser profile (`coach-sheet`, `reply-help` pane sizes) and are
  written to `--coach-sheet-height` (default 85%) and `--reply-help-height` (default
  `min(320px, 38dvh)`, now a maximum the learner sets). At full width the coach
  panel was already resizable by width and by its coach chat height.

Verification: domain, pill, Practice and conversation tests, including resize tests
that fail with their handles disabled; TypeScript, styles, localization, the fast
gate and the design-system check passed. In the preview, real pointer drags resized
the coach sheet (504 to 545 px, capped to leave 48 px of conversation, then down to
281 px) and reply help (357 to 232 px), and the Practice page showed the green
connected mark above its recorder. The running desktop app was not exercised.

### Follow-up: the coach popover, visible arrivals, the phone AI sheet and the first-click bug

Implemented September 30, 2026, from review of the running app. Supersedes the
coach "sheet" above; its grip and stored height carry over. The coach popover and
the phone AI sheet are in turn superseded by the next follow-up.

- **The coach is a popover** where the docked panel does not fit. It floats over
  the conversation, just above the recorder and the Coach button, inset from the
  edges with its own shadow and coach-green edge, and grows out of that button
  (`popover-arrive`). Its scrim covers only the conversation; the recorder stays
  usable. Default height is 72% of the conversation area, still draggable.
- **Opening the coach no longer shifts the layout.** It focused the coach input
  one frame after opening, while the sheet was still off-screen, and `focus()`
  scrolled overflow-hidden ancestors to reveal it (and would raise a phone's
  keyboard). Phones no longer move focus on open; desktop focuses with
  `preventScroll`.
- **Panels arrive visibly.** Dialogs rise and settle over a fading scrim, bottom
  sheets slide up, drawers slide in from their edge, the docked AI panel slides up,
  reply help rises from its row. All are off under reduced motion.
- **The phone AI sheet leads with the live graph.** The graph was unreadable because a
  wide layout shrank to fit a narrow screen, and the dialog's floated close button
  took a full-height column beside the view. The sheet now stacks the same live
  graph down the screen as a tree (`layoutOperationsDown`: each operation under its
  deepest prerequisite, indented by depth, every dependency still an edge) and gives
  it the first screen. The close control sits in the view's header
  (`DetailDialog closeControl="content"`), the header wraps compactly, graph
  definitions stay on desktop, and the tapped operation's details follow below.
  The sheet has a grip and a stored height (default 80dvh).
- **The first click after returning to the app opened AI access.** Focusing the
  window starts a connection re-check; the check replaced the stored result with
  "checking", which the pill treated as not connected, and the click that focused
  the window landed during it. The health store now keeps the last finished result
  at the same revision while a re-check runs (`settled`), and the pill goes to AI
  access only when AI is known to be disconnected; while a first check runs it
  opens the AI View.

Verification: layout, AI view, panel, dialog, pill and conversation tests (the
first-click tests reproduced the bug before the fix); TypeScript, styles, the fast
gate and the design-system check passed. Previews at 390 px showed the coach
popover above the recorder with focus left in place, and the phone AI sheet's
stacked graph (`ui/tools/ai-view-preview.html?sheet`, since removed, mounted the
production panel over a mocked conversation). The running desktop app was not
exercised.

### Follow-up: the AI tray above the recorder, the full-screen coach and the fix count

Implemented September 30, 2026, from review of the running app. Supersedes the
coach popover and the phone AI sheet above.

- **On phones the AI View opens as a tray above the recording panel**, so it stays
  in view while the learner records or sends. Chat gives it a place between reply
  help and the row holding the AI pill; Practice between its stage and its pill.
  A page with a recording panel registers that element through a ref callback
  (`state/navigation/ai-tray.ts`) and the app-level panel portals the tray into
  it, since features cannot import each other. The tray rises like reply help,
  keeps one header line (the title, what is running cut short, expand and close),
  and has a grip with a stored height (`ai-tray`, `--ai-tray-height`, default
  `min(260px, 34dvh)`). Back closes it; the AI pill toggles it.
- **The tray's graph follows the running work.** Fitting all twelve operations into
  a tray shrank them to about 40% and made every label unreadable. The tray keeps
  the running operations in view at 80–100% (`ActivityGraph follow`), panning as
  they change (instantly under reduced motion), and fits the whole graph once
  nothing runs. The full screen still shows the whole graph.
- **Expand fills the screen; restore returns to the tray.** The full screen is a
  `DetailDialog` with a new `full` placement (the whole screen at every width,
  sliding up), and adds the running summary and the exchanges under its title
  line. Back, Escape and close close it rather than restoring, because a restored
  tray could sit hidden under the coach. Desktop keeps restoring first.
- **Where no tray can show, the view opens full screen**: on pages without a
  recording panel (the More menu), and for an inspection of a named operation (from
  an error, reply help or an explanation), which is reading and can start inside
  the coach. Leaving the page closes an open tray rather than jumping to the full
  screen. Chat withdraws its place while the coach covers the recorder, so opening
  the coach closes the tray.
- **The coach is a full-screen modal** where the docked panel does not fit. It has a
  chat box of its own, so it covers the whole window, recorder included, sliding up
  over a fading scrim; the conversation stays in place underneath. Back, Escape,
  the scrim and its close control return to it. The popover's grip, stored height,
  `--coach-sheet-height` and `popover-arrive` are gone.
- **Practice's recording-panel grip moved onto the panel**, below the AI pill as in
  Chat, so an open tray never sits between the grip and what it resizes.
  `DrillLayout` no longer takes a separate `dockResize`.
- **A message's fixes are counted under its bubble.** The "Fixed" tag above a
  revised message became a hammer and a count in the line under the bubble,
  between Fix it and the message's XP, which stays at the end; assistive
  technology hears "1 fix", "2 fixes". The count walks the `replacesTurnId` chain
  of the loaded turns (`domain/conversation/fixes.ts`), so every revision counts
  instead of a message being marked fixed once; a replaced turn older than the
  loaded ones counts and ends the chain.

Catalog: "Restore above the recording panel" and the "Fix count" plural were added
in all seven locales; "Fixed" and "Resize the coach panel" were removed. The AI
View preview's fixture moved to `ui/tools/ai-view-fixture.ts`; the phone views are
reviewed in context in `ui/tools/conversation-preview.html` and
`ui/tools/practice-empty-preview.html?ai`.

Verification: new tests for the tray (in its page's place, expand and restore, full
screen with nothing to restore to, inspections, closing with its recording panel
without a full-screen flash, Back), the tray's one-line view, graph following, the
full-screen dialog placement, both pages' places, the full-screen coach and the fix
count, each seen failing first. A Practice test asserted that no "Transcribing…"
remained anywhere on the page once a take arrived; since Practice's AI pill keeps
measuring copies of its wordings and can hold a step a moment longer, that raced
the pill under load. Its take assertions now ask for the take's own status line.
The full UI suite (1,617 of 1,618) passed except `TargetText.test.tsx`'s Spanish
romanization test, which belongs to separate reading work in the tree; TypeScript,
styles, previews, the fast gate and the design-system check passed.

In the previews at 375 × 812: the pill opened a 260 px tray between Chat's stream
and its pill row, with the recorder below it; the graph panned to the three
running operations at 88% with readable labels; expand filled 375 × 812 with the
whole tree, the summary and the exchanges; restore returned the tray; the pill
toggled it; opening the coach closed it and left nothing hidden; the grip resized
it from the keyboard and kept the height. Practice showed the tray between its
stage and pill, with the recorder's grip on the recorder. The fix count showed a
hammer and "2" after Fix it; its spoken label first rendered on screen too
("22 fixes"), because this component had no `.sr-only` rule of its own, and was
fixed. At 1280 px the pill still opened the docked panel. The browser pane drew
frames only while capturing screenshots, so animations and media-query changes
were checked by measurement and reload. The running desktop app was not
exercised.

