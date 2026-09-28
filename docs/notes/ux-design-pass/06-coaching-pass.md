# Coaching pass

Status: design agreed and built 2026-09-28, except where "Not built" below says otherwise. Part of the [UX design pass](README.md).
Mockups: the "Coaching pass" Design canvas (Chat + coach panel, Fixing a message,
Message footer options, Appearance, simplified).

## Why

The coach's feedback, the XP and the edit flow all look like the chat. The feedback
line under a message is a row of labels, XP reads as a link, the correction repeats
two chat bubbles, and editing a message looks like normal typing. Fixing your own
message is the workflow we most want to encourage, so it has to be obvious.

## Decisions

1. **Coach green is the coach's colour.** The coach pane is tinted and outlined in the
   `coach-*` family (`coach-tint` ground, `coach-line` borders). Chat and its coach
   already share this green (design-system README).
2. **Message footer: option A.** Under a reviewed learner message: a `coach-*` pill with
   a verdict and two small score rings, a "Fix it" button, and the XP amount.
   - Verdict: "Sounds natural" when there is nothing to fix; "Almost there · N fix"
     when the coach shows a correction. The rings replace the "Grammar 6/10
     Conversation fit 6/10" text; their names move to the pill's accessible name.
   - Good messages use the success family; messages with a fix use the coach family.
   - Built wording is plain, per AGENTS.md: "1 fix to try" and "No fix needed".
   - The words the coach quotes get a wavy `warning-line` underline in the bubble.
3. **XP is quiet.** An outline star in `progress-mark` with the amount in `progress-ink`,
   no filled coin, no tinted card, in the footer, the header chip and the coach pane.
4. **One correction line, not two bubbles.** In the coach pane and the edit panel the
   correction is one line of reading text: the removed words in `danger-tint` with a
   1px `danger-line` strikethrough (thin, so the words stay legible), the replacement in
   `success-tint` / `success-ink`. Play and Translate stay as a quiet row under it
   (the existing message tools, not a second bubble). Other phrasings appear as chips.
   "Fix and resend" is the primary action; "Keep going" is secondary.
5. **Editing is a coach mode.** While editing, the message being fixed gets a dashed
   `coach-mark` outline and a "Fixing this message" tag; the messages around it fade.
   The composer gets a `coach-*` frame with a header ("Fix your message", Cancel), a
   compact "Coach suggests" strip with "Use this" and the other phrasings, and a
   "N changes from your original" line. The send button stays the blue primary
   ("Send fix"): blue remains the only action colour.
6. **Appearance keeps:** theme (Light / Dark / Match system), palette (Cool / Warm),
   reading text size and interface text size (`textSize`). **Removed:** control
   density, layout spacing, surface depth and coloured glow. The app uses the current
   defaults: standard density, tight spacing, subtle depth, no glow.

## Scope: UI only

These reuse existing data and components. They are CSS and component changes.

- Coach pane tint and borders (`coaching-dock.css`, `coach.css`).
- Footer pill and rings (`MessageFeedback.tsx`, `ScoreBar` in
  `ConversationFeedbackCard.tsx`, `messages.css`). The verdict comes from the saved
  `ConversationFeedback` scores and `CoachDecision.shown`.
- XP styling (`MessageXpButton.tsx`, `XpChip.tsx`, `reward-presentation.css`).
- The correction line (`CoachEntry.tsx`, `coach.css`): `Correction.quote` struck out,
  `Correction.text` inserted. Built on the existing target-text components.
- Edit-mode frame, header and faded context (`EditFeedback.tsx`, `composer.css`,
  `TurnView.tsx`).
- "Fix it" in the footer calls the existing `onEdit`.

## Scope: needs logic or contract changes

1. **Alternatives as a list.** `Correction.text` is one string; the coach puts several
   phrasings in it joined by " / ". Chips need `alternatives: string[]` (or one `text`
   plus `alternatives`). This touches the native contract, the coach prompt and output
   validation, and regenerated `contracts.ts`. Until then, show `text` alone and no chips.
2. **The underline in the bubble.** It needs the quote's position in the message.
   `Correction.quote` is not guaranteed to be verbatim. Either the coach returns
   character ranges, or the UI underlines only an exact match and nothing otherwise.
3. **"Use this".** It replaces the quote with the suggestion in the draft. This needs
   the same verbatim match as item 2. With no exact match, it hands the suggestion to
   the composer without splicing.
4. **"N changes from your original".** A word diff of the draft against the original,
   computed in the UI. Add it as one small domain function (`domain/conversation/`)
   with tests, not inside the component.
5. **Removing appearance options.** Remove `controlDensity`, `layoutSpacing`, `depth`,
   `glowEnabled`, `glowColor` and `glowStrength` from native `AppearancePreferences`,
   its defaults and validation, and the generated contract. Delete the matching
   `data-density`, `data-spacing`, `data-depth` rules and `--appearance-glow*` from
   `tokens.css` and `useAppearance.ts`, and fold the defaults into the base tokens.
   Check how native deserialisation treats saved settings that still hold the removed
   fields: it must either ignore them or fail with a clear error, never silently.
6. **Verdict wording.** Deciding "Sounds natural" versus "Almost there" from the
   scores alone would claim more than the data supports. Base it on whether
   `CoachDecision.shown` exists, and show the scores only as rings.

## Design system

The published SkellySpeak design system was re-synced from `docs/design-system/` on
2026-09-28 (cool default, identity colour families, current component cards). The
`edit` and `waveform` icons are not yet uploaded to it. Before the next sync, run
`node ui/tools/design-system/build.ts --check` so the published copy never lags the
generated one.

## Build order

1. Appearance removal (item 5): it removes the variables the other steps would
   otherwise have to test against.
2. Coach pane colour, correction line, quiet XP (UI only).
3. Footer pill and "Fix it" (UI only), then the underline (item 2).
4. Edit mode (UI), then the diff (item 4) and "Use this" (item 3).
5. Alternatives contract (item 1).

## Built

- Appearance: `AppearancePreferences` is `{ palette }` only. Theme and palette use
  `SegmentedChoice`. `SCHEMA_VERSION` is 42: a workspace saved at 41 holds the
  removed fields and is refused with the Factory Reset message.
- Coach pane: `--coach-surface` is the recessed grey with a faint green cast;
  cards, the pane edge and the coach composer border are outlined in `coach-line`.
- Correction line (`CoachEntry`): `<del class="cor-removed">` with a 1px
  strikethrough, then the replacement as a `TargetPassage` on `success-tint`.
- Footer (`MessageFeedback`): the number of flagged phrases ("1 error", "2 errors"),
  or "Good job" with a thumbs-up when there are none and the coach fully
  understood the message; "Fix it" (calls `onEdit`) when anything is flagged.
  The scores stay in the coach panel only. The pencil in the bubble shows only when nothing is flagged.
- Squiggles (`domain/conversation/coach-marks.ts`): the shown correction, other
  corrections and `not_demonstrated` observations are red; `partial` observations
  are yellow. Each quote is placed at its first exact match in the message; a
  quote with no exact match still counts but has no squiggle. They replace the
  skill-evidence (XP) underlines in the learner bubble.
- Coach pane "Fix and resend" (`LiveCoachReview.onEdit`, from `startEdit` in
  `ConversationPage`).
- XP: outline star in `progress-mark`, amount in `progress-ink`, in the footer and header chip.
- Edit mode: coach-green composer frame and header with the change count
  (`domain/conversation/revision-changes.ts`), "Coach suggests" above the draft,
  the edited message outlined and tagged, the rest of the thread faded.

## Not built

- "Use this" (item 3); it waits for item 1, because `Correction.text` can hold
  several phrasings joined by " / ".
- Alternatives as a list (item 1).

## Follow-ups built

- Coach controls (open card, show answer, keep going) carry no revision: they
  act on the turn's decision as it is when they run. The workspace revision
  moves with every background result, so a check against it refused controls
  for no reason ("Coaching changed. Review the current advice.").
- Coach observations and reply explanations keep quotes that are not verbatim
  from the message; the display marks only exact matches. An observation item
  for a skill that was not asked about, or with unusable text, is dropped and
  the rest of the coaching is kept. An error on an item judged demonstrated is
  dropped and the judgment kept.
- The top bar has one theme control when it is wider than 860px
  (`app/shell/ThemeControls.tsx`): the sun/moon switches light and dark, and a
  small arrow joined to it opens Cool/Warm. Settings › Appearance keeps both.

