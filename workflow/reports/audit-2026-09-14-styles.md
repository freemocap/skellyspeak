# Styles and shared UI audit — 2026-09-14

Scope: source audit of `src/styles/`, shared UI primitives and Settings modal, against `notes/ui-guidelines.md`; baseline `91856a0`. No application code changed. This report distinguishes deterministic source/cascade evidence from native visual verification, which was not performed by this reviewer.

## Findings

### ST-01 — P2: Settings declares modal semantics without modal keyboard behavior

- **Locations:** `src/features/settings/SettingsModal.tsx:601` (also loading/error branch at 280), `src/app/AppShell.tsx:70`.
- **Trigger:** Open Settings using the keyboard and press Tab/Shift+Tab.
- **Evidence:** Settings renders an ordinary `div` with `role="dialog" aria-modal="true"`. Neither this component nor AppShell moves focus into it, contains focus, or makes the underlying application inert. The component's keyboard listener at 257 only handles Escape; `onFocusCapture` at 602 only scrolls controls into view. `openOverlay` registers back navigation, not DOM modality. The only inert subtree is Settings' own saving form at 649.
- **Impact:** Focus can remain on and reach controls obscured by the modal backdrop. Keyboard users can operate the underlying application while assistive technology is told it is unavailable. The loading/error branch has the same problem.
- **Fix:** Use native `dialog.showModal()` with the existing close/busy policy, or the same modality infrastructure as `src/ui/DetailDialog.tsx:13`; establish initial focus and restore the opener after close. Verify Tab/Shift+Tab containment including loading, save errors and nested dialogs.
- **Confidence/limits:** High, source-confirmed missing browser modality; no native UI reproduction claimed.

### ST-02 — P2: Start-conversation hover loses readable contrast in dark theme

- **Location:** `src/styles/conversation.css:997`.
- **Trigger:** Dark appearance, hover the enabled Start conversation action.
- **Evidence:** Resting style at 984–995 uses `--accent-strong` fill and `--ink-on-fill` white text. Hover swaps the fill to `--accent-ink`, which resolves to dark-theme `--interaction-ink: #6fa3ea`, while retaining `#ffffff` text. Relative-luminance calculation gives **2.592:1**, below the 4.5:1 threshold for its 15px text (and below 3:1 even for large text). Light theme does not reveal the defect because its ink and fill aliases happen to share a value.
- **Impact:** The label becomes harder to read precisely when the user points at the primary initial action.
- **Fix:** Define/use a fill-hover token paired with white foreground rather than a readable-on-dark text token. Include hover/focus states in contrast checks; `src/domain/skills/contrast.test.ts` currently checks only the resting `ink-on-fill` / `accent-strong` pair.
- **Confidence/limits:** High; exact opaque CSS colors and calculated contrast. Parent independently verified the original hover in a browser fixture loading actual app CSS (`.local/audit/design-controls.html`, ignored): computed resting fill rgb(31,71,133), hovered fill rgb(111,163,234), white 15px text, and `:hover` true. This was a synthetic browser fixture, not native app QA.

### ST-03 — P2: Chat's generic focus ring uses a low-contrast border token

- **Location:** `src/styles/reset.css:23`; aliases at `src/styles/tokens.css:238–243`.
- **Trigger:** Keyboard-focus a chat control that has no component-specific outline override, such as Send or the initial Start conversation button.
- **Evidence:** The shell default uses strong text as outline color. The `.chat` override replaces it with `--brand-line`, aliasing the neutral `--line` border token. On the chat sheet, resolved contrast is **2.289:1** in light theme (`#b4a991` on `#fffdf8`) and **1.721:1** in dark theme (`#454b53` on `#24262a`). The outline has a 3px offset, so the surrounding sheet rather than the button fill is its adjacent surface. Some controls individually override this, making focus quality inconsistent.
- **Impact:** The primary keyboard location marker is difficult to see, especially in dark appearance. The style comments explicitly describe focus as independent of selection, but use a quiet border rather than the available focus token.
- **Fix:** Use `--focus-accent` or a dedicated contrast-tested focus-ring role across chat surfaces, including learner and partner backgrounds. Add representative focus-state checks rather than relying on text-color tests alone.
- **Confidence/limits:** High for cascade/token contrast; parent independently verified keyboard Tab in that same browser fixture: a chat gear had `:focus-visible` true, 2px rgb(69,75,83) outline with 3px offset on rgb(36,38,42) sheet. This was a synthetic browser fixture, not native app QA.

## Follow-up design debt (not additional confirmed defects)

- Coarse-pointer sizing supplies `min-height: 44px` globally (`reset.css:29–30`) but no minimum width. Explicit widths remain 30px for coach Send and toolbar actions, 22px for help insertion, and 24px for error dismissal. These should be checked as real touch hit rectangles with adjacent control spacing. Do not equate a 44px height alone with a 44×44 target; no native touch usability claim is made here.
- Source organization generally has clear ownership and explicit state rules, but alias proliferation allows text roles to be used as fills (ST-02) and quiet line roles as focus indicators (ST-03). Prefer checks for role pairs and actual component states over expanding the token inventory or mechanically consolidating files.
- Do not treat all `styles:dead` candidates as removable CSS: comments, font URLs and dynamic classes require manual validation. No deletion recommendations are based on that output alone.

## Verification performed

- Read current UI guidelines, import order, token tables, reset/primitives, key conversation/coach/settings/layout rules, shared text/popover/dialog code, and existing contrast tests.
- Calculated WCAG relative-luminance ratios directly for the exact hex pairs above using a small Node script.
- Searched Settings/AppShell for focus movement, focus containment, native modal calls and background inertness; compared the existing native shared DetailDialog implementation.
- Parent audit owns full build/tests/style-check results and the isolated browser layout review. This reviewer did not rerun those checks or inspect/mutate live application data.

### Integration browser verification

Integration loaded an isolated sample-control fixture using the actual application
stylesheet import at `.local/audit/design-controls.html`, with no IPC or application
data. Browser computed styles confirmed:

- Start conversation: resting white 15px text on `rgb(31,71,133)`; hovered white
  15px text on `rgb(111,163,234)`, with `:hover` true (ST-02).
- Keyboard Tab to a `.chat .gear` button: `:focus-visible` true, outline
  `rgb(69,75,83)`, 2px width, 3px offset, surrounding sheet `rgb(36,38,42)` (ST-03).

This establishes representative CSS behavior in the browser fixture, not a full
native, mobile, or accessibility-device review. The temporary browser and fixture
server were closed after inspection.
