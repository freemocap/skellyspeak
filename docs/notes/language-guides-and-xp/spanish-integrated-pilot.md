# Spanish integrated pilot

Status: automated native integration verified; interactive native trial pending,
2026-09-24. No commit, model request or data reset performed.

## Automated scenario

`spanish_pilot_connects_retry_profile_guides_and_next_practice` runs through the
real native command, dispatch, completion, durable credit and profile paths in a
disposable Spanish workspace. Provider answers are fixtures, not live Jev output.

1. Submit `¿Dónde está Ana?`. Fixture presence: questions/answers and identification.
2. Revise to `¿Dónde estaba Ana ayer?`. Retain those skills and introduce past reference.
3. Verify 3 experience + 2 effort = 5 XP in the published profile.
4. Verify the selected variety's past-reference guide is exactly the production
   Markdown composition of the authored shared and variety content.
5. Project recommendation candidates from that same ledger. Explore selects a
   zero-experience skill; Continue practicing selects one of the two retried skills.
6. Close and reopen the store; the profile is unchanged.

Existing integration tests additionally cover unchanged resends, duplicate/late
completion, failed assessment and coach target capture. This scenario does not
claim that Jev will label exactly those skills for these sentences.

## Interactive trial

Use Spanish and explicitly select Spain or Mexico; both have all twelve compact
pilot guides. The guides are still marked needs_review.

1. Start a persona-led conversation and submit a short Spanish message, for
   example `¿Dónde está Ana?`.
2. Inspect the completed skill assessment and awarded XP. Compare the presence
   labels and credit ledger, rather than requiring a predetermined number of skills.
3. Edit the message to `¿Dónde estaba Ana ayer?` and resubmit. Previously encountered
   retained skills should receive effort; new skills should receive experience.
4. Resend the same revision unchanged. There must be no additional credit.
5. Open Skills: verify the selected variety's experience/effort/XP totals and open
   a skill's evidence and Skill guide. The profile requires no Refresh button.
6. Exclude and restore an attempt; verify the open profile totals follow the
   eligible ledger. Reopen the app and check the same totals.
7. Start a new conversation with Explore, then another with Continue practicing.
   Inspect the captured recommendation basis and focus. Partner-generated text
   must not itself award learner XP. Existing conversations keep their captured focus.

Do not reset unrelated data to obtain an empty profile. Existing records may
increase totals, so compare deltas and exact-variety evidence. If incompatible
records prevent the trial, inspect ownership before scoped development cleanup.

## Environment and verification

The initial signed launcher found port 1420 occupied. Inspection confirmed it is
this checkout's UI server; a native SkellySpeak process is also already running.
No second process was launched and no existing process was terminated. Its loaded
native build has not been confirmed current. The computer-use tool reported that
the Mac is locked, so interactive inspection requires the user to unlock it.

65 focused UI tests pass; app and preview TypeScript checks pass. The full native
suite's sandbox run passed 573 tests but blocked 29 local HTTP-fixture tests with
PermissionDenied (1 ignored). A loopback-enabled rerun is recorded below.

Loopback-enabled native rerun: **602 passed, 0 failed, 1 intentionally ignored**.
The sandbox failures were environmental; no source change was needed for them.

## Source follow-up — 2026-09-25

The learning-evidence overlay now uses live counts instead of old rating estimates.
Partner/variety filtering, exclusion/restoration, guide scope and native evidence
exports have regression coverage. Native: 603 passed, one ignored. Focused UI:
54 passed; architecture: 26 passed. The interactive steps above remain outstanding;
no unlocked-Mac trial or live model result is claimed by this follow-up.

## Profile opening fix — 2026-09-25

User testing found the profile overlay's “not connected” fallback. Code inspection
showed it was triggered by any null shared evidence snapshot, including loading or
settings-scope transitions; the exact cause of the user's missing snapshot was
not observed. The overview now loads independently of that prerequisite. Its
empty-language branch no longer substitutes a paragraph for the skill UI: all
skills and zero counts render, with zero-credit rows included by default.

Regression tests cover opening without a shared snapshot, no-history languages,
and explicit read errors without fabricated zero data. Three focused tests and
app/preview type checks pass. This is a source fix, not confirmation of the build
currently running on the user's Mac.


## Native profile verification — 2026-09-25

This supersedes the locked-Mac limitation above for profile browsing. Rebuilt and
signed the current native executable, connected it to this checkout's Vite server,
and controlled its actual native window through computer use. A temporary copy at
`/private/tmp/SkellySpeak Pilot.app` avoided a stale app-control bundle identity.

The JSON failure was 12 incompatible reward events across four stored turns,
missing the current experience/effort fields. With the app stopped and the workspace
lock held, deleted those reward entries in one transaction. No conversion,
compatibility decoder or automatic reset was introduced. Conversations were not
removed. Current native profile loading succeeds.

Observed in the running native app:
- Arabic and Spanish each expose all 12 skill cards with 0 XP.
- Opening a skill shows its criterion and zero-credit evidence state.
- Levantine and Spanish/Mexico composed guides render in the skill inspector.
- The main profile has its normal close control; a nested skill dialog has its own.
  A persistent read error no longer adds another dismissal control.

Read failures use the existing error surface and keep the static current catalog
browsable. Unknown XP is shown as a dash; successful empty history returns zero.
No-guide text is shown only for a selected variety, not before choosing one.
Six focused UI tests, app TypeScript and stylesheet checks pass. No new live Jev
conversation or retry-credit test was performed in this UI verification.

Older app copies reported to the user for their removal:
- `/Applications/SkellySpeak.app`
- `old/skellyspeak-app/src-tauri/target/debug/bundle/macos/SkellySpeak.app`

No repository-wide historical-source deletion is claimed by this fix.

## Human-facing teaching guides — 2026-09-25

Implemented: expanded all 12 Spanish and 12 Levantine skill guides in language
YAML. Spanish shared explanations cover Mexico and Spain; Levantine teaching sits
under the Arabic core with explicit regional coverage. Explanations now introduce
usable constructions and contrasts, with translated original examples and short
notes about what to notice. These remain AI-authored drafts awaiting speaker
review, not certified teaching material.

The compact assessment fields were compared against HEAD and are unchanged for
every Spanish and Arabic skill/variety. Teaching prose and examples remain outside
the assessment projection. No new Jev calls or experiments were run.

The production Markdown composer omits assessor boundary text from the lesson,
uses learner-facing section headings and places provenance under Editorial notes.
The guide-specific renderer uses semantic headings and the existing surface tokens.
Blockquotes represent target-language examples; inline code spans identify target
forms inside explanatory prose. Both use TargetText within the inspected language
and variety's ReadingLanguageScope, with English explanation scope matching this
authored content. Ordinary coach Markdown retains its existing code-span behavior.
No separate word-help implementation or language-name rendering branch was added.

Verification: 21 UI tests (including shared Markdown), four native content tests,
and the integrated Spanish retry/profile/guide test pass. TypeScript, locale,
stylesheet and whitespace checks pass. In the rebuilt signed native app, opened
the Arabic profile, inspected the expanded Levantine lesson, reviewed its layout,
and clicked an example word to open the existing Word help surface. The examples
are interactive; absent stored glosses still use normal on-demand word help.

## Phrase-level reading controls — 2026-09-25

Implemented: standalone target passages now expose whole-phrase playback and Add
to Drill through shared reading components. Existing message speech callbacks
remain authoritative when present. Inline quotations use a compact visible action
row; they do not split a phrase into separate playback requests. Guide examples
use the shared passage bubble with Translate and Word by word as well. Connected
coaching suggestions, reply starters, analysis passages, language examples, skill
records, reward evidence and conversation excerpts. Names in the conversation-start
heading now render as plain directional text, without token-learning controls.
Navigation labels and measured word-alignment tables remain their own controls.

Drill's selected phrase retains reference playback and its recording lock; it
explicitly disables the generic duplicate playback/save controls. Candidate phrases
retain their existing Keep action and gain phrase playback. Saving uses the displayed
phrase's reading scope; changing the source or scope resets the local saved indicator.
No action frame renders without a known reading scope. The profile now preserves
an open inspector during background refreshes triggered by saving a phrase.

Verification: full UI suite passed 1223 tests; subsequent inspector-refresh
regression passed. TypeScript, stylesheet, locale and whitespace checks pass.
Native-window inspection showed the Spanish example's phrase toolbar. Saving
“Ayer fui al mercado.” created a Drill item with language spanish, variety
spanish-mexico, explanation english while the conversation used Arabic.

Live playback remains blocked: the configured speech service returned HTTP 400
with a request-shape rejection. Its reported required fields omit language_tag,
whereas the current native sender and current server validator both include that
field. This indicates a deployed-service contract mismatch; no compatibility
request, retry or deployment was added. Do not claim successful live audio from
this pass. The local native speech-contract fixture was run separately.

## Inline source distinction — 2026-09-25

Inline target forms in Markdown and mixed explanatory prose now use TargetText,
without phrase-action frames. This is a presentation-context decision, not a
space-counting language heuristic: even a multiword form stays inline when part
of an explanation. Standalone guide examples retain their passage bubbles and
whole-phrase controls. Word help remains accessible on inline source tokens.

Shared source typography is bold, italic and theme-aware blue. Glosses and reading
aids retain regular weight and upright styling. Verified the possession guide in
the running native window: de, Mi, mis and Su have clear emphasis and no adjacent
boxes; the full example below remains a bubble. Reading/guide/reply-help tests
passed (102), followed by four phrase tests including the new inline regression.
TypeScript and style checks pass. No native or service change was needed.

## Unified passage bubbles — 2026-09-25

Standalone and compact passages now render the exact same bubble body, corner
playback button and contained action row as conversation messages. Layout variants
only choose outer spacing. Reading-service playback is adapted to the existing
speech callback interface rather than rendering a token-audio button as a second
kind of passage playback control. Owner-provided speech and Drill playback
restrictions remain intact. Removed the separate compact text styling.

Verified both possession examples in the native window: corner playback matches
chat and Add to Drill remains inside each bubble. Inline source terms remain free
of action boxes. Shared reading, guide, Drill and save tests passed (125), with
reading/reply-help tests rerun after compact-layout cleanup. Type and style checks
pass. This visual verification does not resolve the previously recorded remote
speech-service contract mismatch.

Inline emphasis correction: target-inline explicitly marks source forms within
explanatory Markdown and mixed prose. Bold/italic/blue styling is scoped to that
marker; ordinary target text and saved gloss source in bubbles use their normal
reading typography. Native chat screenshot confirms normal bubble source styling.
Focused reading tests, type and stylesheet checks passed.

## Included-language profile tabs — 2026-09-25

The XP report now shows only My languages, in their saved order, as rectangular
tabs joined to a bordered sheet. The adjacent plus opens the existing Languages
browser through the same navigation action as the main language picker. Global
activity totals still cover recorded activity across all languages.

Verified Spanish and Arabic tabs and the plus-to-Languages transition in the
running native window. No language preferences were changed during verification.
Five focused profile/progress tests passed, including included-language ordering,
excluded-language omission and shared navigation. TypeScript and stylesheet
checks passed.
