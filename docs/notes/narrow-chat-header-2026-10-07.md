# Narrow chat header: one row — 2026-10-07

Status: implemented and verified in the layout fixture (`ui/tools/conversation-preview.html`)
at 360, 412 and 463px with touch emulation. Not yet checked in the phone build.
Desktop widths (above 860px) are unchanged.

## Problem

Below 860px the conversation header stacked the partner name over the difficulty
select. The row grew to roughly twice the top bar's height, the Conversations
button stretched with it, and the counters and action buttons floated mid-row
(phone screenshots, 2026-10-07). The
[narrow-layout note](narrow-layout-overlaps-2026-09-26.md) had already named the
next step: a deliberate narrow header, not a smaller squeeze.

## Decision (implemented)

- **860px and below the header is one row** of 44px controls: Conversations,
  partner, this conversation's counters, settings, new conversation. The partner
  name is what gives up room, by shortening; the identity never wraps.
- **Difficulty moves into the Conversation settings sheet** at that width, as the
  sheet's first group. Before a conversation starts, the start screen's Options
  bar still carries Difficulty, so nothing is lost there. Above 860px the select
  stays beside the partner as before.
- The row takes the top bar's inline padding, so the Conversations button shares
  the logo's edge and New shares the More button's edge.
- **480px and below the counters tighten:** the points button keeps its number
  and drops its shape glyph (the Progress tab draws the shape large), and the XP
  chip loses its extra padding. **400px and below XP loses its unit**, as the top
  bar's pill already does there.

## Implementation

- `ui/src/features/conversation/ConversationPage.tsx` builds the select once and
  hands it to the header or to `ConversationSettings` by the shared width tier
  (`useWidthTier`, the same 860px the stylesheets use).
- `ui/src/features/conversation/session/ConversationSettings.tsx` gains an optional
  `difficulty` slot rendered as the leading group.
- `ui/src/styles/features/conversation/header.css`: narrow row, no wrap, top-bar padding.
- `ui/src/styles/features/conversation/reward-presentation.css`: counter tightening
  at 480px and 400px.
- `ui/tools/conversation-preview.tsx` now renders the counters (sample effort data)
  and mirrors the placement; `?opening` and `?theme=dark` select the first view.

## Measurements

Layout fixture, touch emulation, partner "Uxía Castro" (needs 80px).

| Width | Top bar | Header | Name room | Points glyph | XP unit |
|------:|--------:|-------:|----------:|:------------:|:-------:|
| 463px | 49px | 48px | 80px, whole | hidden | shown |
| 412px | 49px | 48px | 77px, whole | hidden | shown |
| 360px | 49px | 48px | 57px, shortened | hidden | hidden |

Before the change at 412px the row was one line only because the identity
wrapped: the name had 39px and showed "Uxía C…" under the difficulty select.

## Verification

- `ConversationSettings.test.tsx`: the sheet leads with a given difficulty control
  and has no Difficulty group otherwise.
- `ConversationPage.conversation.test.tsx`: at full width the header holds the
  select and the sheet does not; at 860px the header has none and the sheet leads
  with it.
- Fixture at 412px: header is one row, Difficulty is the sheet's first group.
  A headless render at a true 412px viewport (dark theme) shows the top bar and
  the header as two matched rows with the whole partner name.
- At 1280px the select is still in the header and the counters keep their glyph
  and unit; the sheet has no Difficulty group.
- `npm run check:fast`, the six header-adjacent suites (91 tests), the full UI
  suite (1899 tests) and `npm run build` all pass on this state.

## Open

- Check on the phone build. The 480px and 400px thresholds are CSS-only and easy
  to retune if the glyph is missed at the larger phone widths.
- `npm run previews:check` fails on `skill-levels-preview.tsx` and
  `xp-payout-preview.tsx` (XpChip `onOpen`, SkillRewards `languageName`); these
  predate this change and are unrelated to it.
