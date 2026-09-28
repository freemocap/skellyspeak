# Stage 4 — shell and modes

Status: **Chat and Practice tabs and three widths agreed, 2026-09-27; not
implemented;** step 3 of the [build plan](build-plan.md). The rest of Stage 4 is
not started. Part of the [UX design pass](README.md). Findings S1–S6 are in the
README. Review page sections W, 1c, Va and Vb:
`/tools/design-pass-preview.html#dp-tiers`. Practice was called Drill until the
sixth review; the findings and current-state notes use the code's names.

## Why now

Jon's review: switching between Chat and Drill replaces the whole work surface,
but the switch is a subtle grey pill (`app/shell/PracticeSwitch.tsx`, styled in
`styles/features/drill/drill.css:391-396`). On phones it shrinks to two unlabeled
icons. The change should look and feel like moving to another room, ideally as
tabs. Jon also liked the cleaned-up global row in the first proposal.

## Proposal

- **Tabs, not a switch.** Chat and Practice are labelled tabs in the global bar.
  The active tab opens into the surface below it: it covers the coloured edge under
  it, so tab and surface read as one object.
- **Each mode has a colour** (see [colour and depth](colour-and-depth.md)):
  apricot for Chat, violet for Practice. The active tab and a band along the top of
  the work surface share it; the surface itself stays neutral (the wash was removed
  in the sixth review). The inactive tab shows its colour as a small dot, so the
  colour is learned before the first visit.
- **Mode controls live in their mode.** Conversations and the partner move into
  the Chat surface header; cards stay in Practice. The global bar keeps the
  wordmark, language, the tabs, progress, AI status, Settings and More. The theme
  toggle moves to Settings.
- **Phones and narrow windows: tabs at the bottom.** A bottom tab bar holds Chat
  and Practice, with the same colours. The coach opens from the chat header instead
  of taking a bottom tab (today the bottom bar is Chat | Coach and Drill is a
  top-bar icon that hides it). See [Three widths](#three-widths).
- **Switching** uses a short cross-fade of the surface (existing motion tokens);
  reduced motion switches instantly.

Progress and Skills are not tabs yet; where they belong is the main Stage 4
question (S2), together with the six-field navigation state (A6).

## Implementation notes, for later

- `PracticeSwitch.tsx` becomes a tab list (`role="tablist"`, arrow-key movement)
  owned by the shell, and its styles move from `drill.css` to shell styles.
- `MobileNav.tsx` becomes Chat | Practice; the coach entry moves to the chat header.
- `TopBar.tsx` loses the Conversations button and theme toggle; the conversation
  header gains Conversations.
- Mode colour tokens come from the colour proposal; nothing here changes native
  code or the persisted practice view (`savePracticeView`).

## Review

2026-09-27, Jon: the desktop and phone arrangement makes sense, which settles
the tabs in the global bar, the phone bottom tab bar, and Coach from the chat
header on phones.

## Three widths

Proposed after Jon’s fifth review: large phones look right and standard phones do
not, because the app has one breakpoint (860px, `components/layout/useIsMobile.ts`).
Review page section W, with the Width control.

| Tier | Width the app has | Covers | Chat / Practice | Coach and cards |
| --- | --- | --- | --- | --- |
| Full | 860px and up | Monitors, laptops | Tabs at the top | Open beside the surface; each folds to its edge tab |
| Compact | 400 to 859px | Large phones, tablets, narrow windows | Tabs at the bottom | Edge tabs with a coloured edge; a drawer slides over the surface |
| Narrow | under 400px | Standard phones | Tabs at the bottom | A header button (coach) or chip (cards); a sheet from the bottom |

- The tier follows the width available to the app, not the device, so a desktop
  window dragged narrow behaves like a phone.
- The voice panel, toggle, arrow and words are identical in every tier; only the
  side panels change how they open.
- At Full the coach panel is open even on an empty conversation, showing its Ask
  box until there is coaching.
- Common phone widths: 360–393px (most Galaxy and standard iPhones) are Narrow;
  412–440px (Pixel XL-class and Plus/Pro Max iPhones) are Compact.
- Implementation: add 400px to the style checker’s allowed breakpoints and
  replace `useIsMobile` with a tier hook (A13).

The second tab is now **Practice** (decided in the sixth review; was Drill). Its
side panel holds **cards**. See the README's Vocabulary section.

In the build, the side panels are new containers for existing content: the
coach panel holds today's Coach and Experience tabs unchanged (their content is
Stage 2), and the cards panel holds today's phrase list with its delete action.
Previous, Next and Random stay on the Practice stage.
