# XP presentation cleanup

Implemented following the September 21, 2026 request to reduce obstruction and
make effects optional. This changes presentation, not XP rules or learner evidence.

## Audit findings

- Automatic rewards reused full evidence dialogs, including quotations, rationale
  and navigation, in fixed overlays over the conversation.
- The separate progress receipt also used a fixed overlay and grew vertically
  with each credited skill.
- Inline XP buttons inserted extra width into reading text. Word taps could also
  open reward dialogs while revealing reading assistance.
- Effects volume defaulted to 100%. Sound could be muted separately, but there was
  no single saved switch for visual and audio XP effects.

## Implemented behavior

- Automatic cards contain the skill label and earned XP. They and progress meters
  occupy a wrapping row below the chat header, outside the message stream. The row
  is bounded to 80px (96px with coarse pointers); overflow scrolls inside the row.
  Long labels truncate. Close controls retain 44px coarse-pointer targets.
- Automatic cards fade locally instead of flying across messages. Fast mode and
  reduced-motion behavior remain; explicit evidence inspection remains available
  from the evidence surface.
- Progress uses thin bars in a horizontal group and closes 1.6 seconds after all
  associated arrivals. Credit totals and per-skill accounting remain intact.
- Conversation text contains no inserted XP buttons. Word interactions no longer
  open reward dialogs; ordinary reading assistance remains available.
- Settings → Reading → XP effects disables cards, temporary bars, reward sounds
  and XP announcements. Active presentations clear; disabled arrivals still consume
  display claims and do not replay when enabled. XP continues accumulating.
- The new native effects-volume default is 20%; voice/master defaults are unchanged.
  Existing saved volume choices remain intact. Sound effects can still be muted
  independently under Voice → Volume.

## Verification

- Full UI suite: 157 files / 1,061 tests passed before the final reading-tap and
  announcement changes; targeted reading, settings, persistence and reward suites
  passed after those changes.
- Native reward preference test passed, covering the 20% default and persisted off
  switch across reopening, revision conflicts and invalid volume rejection.
- Production build, generated-contract check, style validation, preview type check
  and generated design-system check passed. Build reports its existing bundle-size
  warning.
- Browser inspection of the production-component reward preview at desktop and
  390px width verified cards/bars remain outside message text and turning effects
  off clears them and suppresses subsequent arrivals. This used synthetic data,
  not native application/device testing or live AI calls.

Changes are uncommitted; nothing was deployed.

## Follow-up: inspectable XP

Implemented after the request to make XP navigable rather than a collection of
meters:

- Each learner message has an XP total button beside Edit in a compact action row,
  outside its reading text. It opens a scrollable report of that exact message's
  credited skills, criteria, saved source wording, evidence quotations and rationale.
  Provider/model and award provenance are available under Evidence details.
  Zero-credit messages show an explicit empty state. Multiple quotations do not
  multiply the awarded XP; message identity includes conversation, message ID and
  exact source wording, rather than assuming a turn ID equals a message ID.
- Clicking an Experience skill bar opens its credited examples in this conversation.
  Clicking an App activity skill bar opens that skill's language-wide examples.
  Both use the same report. Explicit reports work with automatic effects disabled.
  Temporary receipt labels and bars also open the language-wide skill report;
  closing a transient receipt does not close its explicitly opened report.
- The entire Experience list now belongs to its scroll container, which has a
  keyboard-focusable region. Previously the long skill list sat outside that
  container and was clipped by the dock. App activity uses the shared wide dialog.
- Skill-list presentation pauses only sorting during reward animations; XP values
  stay current. Previously it froze the displayed values as well as their order.
- The old evidence-section XP shortcuts now use the message report, avoiding the
  automatic-effects gate and using the correct message ID.

Verification: full UI suite passed 159 files / 1,065 tests before the final receipt
interaction addition. Targeted report, message, activity, skill-list and receipt
checks cover dialog opening, empty states, conversation/source isolation, excluded
and superseded evidence, quoted/whole-message evidence, unique credit counting,
effects-off inspection and live meter values during animations. Production build,
style validation and preview type checking passed; generated design CSS refreshed.
Browser checks at desktop and 390px width opened message and skill reports from
production components and confirmed the Experience region has a bounded 320px
viewport over its longer scrollable content. These are synthetic preview checks,
not a claim of native-device verification. Work remains uncommitted.

Localization audit: removed the obsolete XP tooltip key introduced by the previous
cleanup. `localization:audit -- --check` still fails on four unrelated existing
candidates: `Segment confidence`, `Token IDs`, `Confidence unavailable.`, and
`The {model} transcription model has no language code for {language}; output may be unreliable.`
Those entries were left for their source owners; catalog parity and rendered-text
validation pass.

## Conversation settings regression

The shortened Fast mode description was stored in a dynamic settings tuple without
its matching locale entry. Opening Conversation settings threw
`Missing UI message: english.Automatically dismiss new XP cards` (and the analogous
error in every other locale). Static rendered-text checking did not catch that
indirect lookup. Added the entry to all seven catalogs and marked the tuple text
with `messageKey` for static checking. A new interaction test reproduced seven
failures before the fix and passes in all seven locales afterward; the production
build also passes.

## Conversation-settings XP switch

Added XP effects under Conversation settings → Rewards, above Fast mode. It edits
the same device-local saved preference exposed by the main Settings dialog;
opening it from a conversation does not create a per-conversation override.
The shared preference writer handles enabled, disabled and omitted/default-enabled
values consistently. New helper text is translated in all seven locales and marked
for static checking. The conversation panel and settings-store suites pass all
22 tests, including toggle dispatch, adopted saved state and disabled-during-save
behavior; the production build passes.
