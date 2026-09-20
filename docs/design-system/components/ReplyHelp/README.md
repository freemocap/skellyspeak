# ReplyHelp

Source-bound brief with independent grammar and reply disclosures.

Source: `ui/src/features/conversation/composer/ReplyHelp.tsx`.
Styles: `ui/src/styles/features/conversation/reply-help.css` and the compact
ReadingPassage variant in `reading-evidence.css`.

## Props the caller provides

- Saved brief, generated grammar cards and AssistedReply passages, frames/starters.
- Durable operation lanes, explicit request/retry callbacks and AI inspection.
- Draft insertion callback, send-busy flag, source-bound coach callback.
- `opened` sets fixture visibility only; it never generates help.

## Rules

Help starts collapsed, even when a saved brief is present or a new brief arrives.
Desktop places it in the Coach panel; mobile keeps the composer tray.
Opening saved help never regenerates it. Command acceptance is distinct from AI
completion. Insert controls append to a draft; word, translation and sound actions
use shared reading services and never insert. Sentence-level aids are not token
glosses. The native producer retains each help result independently.

The preview uses `ReplyHelp.fixtures.ts`, shared with the component tests. It is
static offline test data, with one resting instance and one grammar disclosure.
