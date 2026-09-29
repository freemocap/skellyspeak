# XP and effort display redesign

Status: agreed with the learner on 2026-09-29 and implemented in source on
`effort-xp`. It is uncommitted and has not been checked on a device. It changes
how progress is presented. XP rules, effort qualification and the award ledger
are unchanged.

This supersedes the "Visible presentation" section of
[multidimensional-progress-plan.md](multidimensional-progress-plan.md): effort
counters no longer sit permanently beside XP.

## Problem observed

On mobile, the top bar and the chat header each showed XP plus the same four
lifetime effort counters. That was ten numbers side by side, mostly zeros, with
small unlabelled icons. The chat header mixed conversation XP with lifetime
language effort. Labels such as "No issues flagged" described the ledger rule,
not what the learner did.

## Agreed behavior (implemented)

- **Progress buttons.**
  - The top bar is gold. It shows a globe with total XP across languages, then
    the active language's code (the primary subtag of its declared
    `language_tag`, e.g. `ES`) with that language's XP.
  - The chat header is coach green, with a speech-bubble icon and this
    conversation's XP. Gold is reserved for the learner overall.
- **Effort stays behind the button.** When an effort unit rises, a brief
  "+N icon" drops below the button for about 1.6 s, one per unit. XP gains keep
  their existing "+N" and glow. Reduced motion and the XP effects preference
  still apply.
- **Hover or tap for the card.**
  - With a mouse, hovering shows the card and a click opens the full view.
  - On touch, the first tap shows the card and a second tap, or the card's link,
    opens the full view.
  - The top-bar card is a compact sortable table of the learner's languages:
    XP and the four effort units, sorted by XP with the active language
    highlighted. Any column header re-sorts; pressing it again reverses.
  - The full view for the top bar is the existing language profile report. It
    now includes the same table with full labels and a conversations column;
    choosing a row opens that language's tab. For
    the chat header it is the conversation XP ledger, shown as a dialog.
  - The conversation card shows only Understood, Clean and Fixes for that
    conversation (Understood, Clean and Fixes). Practice never appears in the chat window. Below them is a
    short list of the conversation's credited skills: the top five by credited
    messages, then by XP, with a count of any further skills.
  - The conversation dialog shows contributing messages, XP per contributing
    message, skills with credit and the three chat units. It adds a per-skill
    table (credited messages, XP, share of XP) above the existing award list.
- **Look.**
  - XP has the progress-gold identity with a filled star. The top-bar button is
    a filled gold pill; the chat-header chip stays unfilled until hovered, so
    the two never read as duplicates.
  - The card is compact: a gold XP strip, a line of unboxed coloured units and
    a small link.
  - Each unit takes the colour of the place it comes from: Understood is
    partner orange, Clean is the coach badge's teal, Fixes is coach green and
    Practice is Practice-tab purple. Gains pop in as pills in those colours.
- **Units, icons and labels.** They are never summed.

  | Unit | Icon | Ledger dimension |
  | --- | --- | --- |
  | Understood | Lucide `smile` | `partner_understood` |
  | Clean | Lucide `circle-check` | `no_issues_flagged` |
  | Fixes | custom `fixes`: Lucide `hammer` plus a sparkle | `revisions_sent` |
  | Practice | Lucide `biceps-flexed` (kept after review) | `practice_attempts` |

- **Coach badge.** The "clear" verdict shows the check mark and "Clean",
  replacing thumbs-up and "Good job". A gem was tried for Clean and rejected in
  favour of the check mark.
- **Fixes framing.** Revisions are counted as a reward, not a tally of mistakes.
  The hammer with a sparkle marks the fix as an achievement. The "Fix it" action keeps the plain pencil, so the action and the
  reward stay visually distinct.
- **Partner reaction chip.** It uses icons instead of emoji, in both the chip
  and its dialog heading:
  - understood: `smile`
  - misunderstood: a custom `confused` icon
  - unavailable: `triangle-alert`

  Lucide has no confused face, so `confused` is drawn in the same stroke style:
  the smile's face with a wavering mouth and a question mark.
- **Practice takes.** A take that earned a practice unit ends its collapsed
  attempt row with a purple "+ biceps" mark, and shows the same mark beside the
  score in the expanded attempt. The native attempt view carries
  `countedAsPractice`. It is read from the award keyed by the take's recording
  receipt, so the mark reflects the ledger, not a UI re-derivation.
- **Fixed marker.** A resent edit shows a quiet "Fixed" label with the
  hammer-and-sparkle icon above the replacement message. It is not shown while the message is being fixed.

The design canvas also reviewed dumbbell, barbell, kettlebell, mouth and other
Lucide alternatives for Practice; the learner kept the biceps.

## Implementation

- **Native.** `get_language_totals` (`learning/learner/progression.rs`) returns
  one row per catalog language with XP, saved conversations, language tag and
  lifetime effort counts. It avoids sending every evidence snapshot to a hover
  card. A test covers per-language separation.
- **Native.** `get_effort_progress` takes an optional `conversation` and narrows
  counts and recent awards to it (`native/src/learning/effort/mod.rs`). It is a
  read only; awards and claims are unchanged. A test covers the scoped counts.
- **Shared components.**
  - `components/learning/ProgressCounters.tsx` renders the XP number and the
    effort gains.
  - `components/learning/ProgressCard.tsx` renders the card.
  - `components/learning/LanguageTable.tsx` renders the sortable language
    table; `state/learning/useLanguageTotals.ts` reads it.
  - `components/learning/useHoverCard.ts` owns the hover and tap behavior for
    both buttons.
  - `effort-dimensions.ts` holds the new labels, icons and order.
- **Owners.**
  - `app/shell/TopBar.tsx` owns the language card.
  - `features/conversation/progress/XpChip.tsx` owns the conversation card and
    ledger dialog.
  - `state/learning/useEffortProgress.ts` adds `useConversationEffort`. It is
    read-only and refreshes when the shell's claimed read changes.
- **Other UI.** `PersonaReaction.tsx`, `MessageFeedback.tsx`, `TurnView.tsx`
  and `ToolbarIcon.tsx`, which gains `clean`, `alert`, `fixes` and `confused` and drops
  the unused `tools` and `thumbs-up`.
- **Styles.** `progress-counters.css`, `persona.css`, `messages.css`,
  `reward-presentation.css` and `layout.css`.
- **Locales.** New labels in all seven locales; retired keys removed.

## Verification (2026-09-29)

- **UI suite:** 229 files, 1,462 tests passed. New tests cover:
  - the XP-only face and per-unit gains
  - the card contents
  - the two-step top-bar and conversation-chip behavior
  - mouse hover opening the card, and touch ignoring hover
  - the conversation skill table and chat-only units
  - the practice mark on counted attempt rows only
  - the Fixed marker
  - the icon-based reaction chip
- **Static checks:** UI `tsc`, `previews:check`, `check:fast` (localization,
  styles, formatting) and `contracts:check` passed.
- **Native tests:** 17 effort tests passed, including the scoped read and the
  practice-counted lookup. All 59 drill tests passed.
- **Native library suite:** 704 passed, 1 failed. The failure is the existing
  `language_context::focus_is_frozen_for_coaching_without_directing_partner`,
  recorded in the multidimensional plan and unrelated to this change.
- **Browser fixture:** `ui/tools/progress-preview.html`, at a 375 px viewport
  and with desktop hover, showed:
  - the XP-only buttons
  - the effort gains below the top-bar button
  - both cards
  - both second-press views
  - the confused icon at 18, 24 and 64 px

  This is a fixture with sample data, not a live app or device run.

## Not done

- **Serif digits.** Numbers in the mono font stack render in the reading font's
  digits, because "Skelly Arabic Reading" comes first in the stack. This affects
  all existing XP chips and is a separate font-stack question.
