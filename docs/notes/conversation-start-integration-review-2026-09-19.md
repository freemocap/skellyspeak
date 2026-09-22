# Conversation start: integration review and implementation handoff

Status: **reviewed against current source; proposed behavior for user review, not implemented or approved for implementation.** 19 September 2026.

This reviews the supplied “Conversation start: authored per-language content” proposal. It retains authored, bundled starter content and adds the missing workspace, interaction, coaching and lifecycle specification. Where they differ, this note recommends replacing the original proposal's behavior. No application or content source changed during this review.

## Assessment

The content direction is useful, but the original note is not a complete UI handoff. It specifies topic strings before defining what the learner is doing, refers to an undefined “three-zone surface,” and leaves the first recording's relationship to turn admission unresolved. Its proposed persona expansion and learning-token changes also cross into separate responsibilities.

Recommended placement: replace the **empty conversation stream inside the existing conversation workspace**. Keep the global shell, conversation header, normal composer, Coach/Evidence panel, history and settings. Opening a conversation and sending its first turn are distinct events: an empty conversation already has an identity before any recording or AI request.

## Verified current integration

Paths below are relative to the repository root.

| Owner | Current behavior relevant to this work |
| --- | --- |
| `ui/src/features/conversation/ConversationPage.tsx` | Composes header, stream, composer and coach. Renders `ConversationStart` inside `.stream` when no turns/opening exist, subject to access/error conditions. Owns input, start draft, recording and submission. |
| `session/ConversationStart.tsx`, `session/ConversationChoices.tsx` under that feature | Show partner identity, three topic choices, difficulty, time preference, custom topic, Customize and “Let {name} start.” Topic selection changes the draft without generation. |
| `ConversationPage.submitText` | An initial real message uses `startConversation` with configuration, text and input provenance. Later messages use normal message submission. |
| `ConversationPage.startConversation` | The separate partner-first action sends `message: null`, creating a real partner opening. |
| `speech/useMicRecorder.ts`, `composer/ComposerInput.tsx` | Capture is bound to a conversation. Stop transcribes; Discard cancels. Transcript goes to the composer or auto-send according to the learner's existing setting. |
| `coaching/CoachAnalysisPanel.tsx`, `coaching/LiveCoachReview.tsx` | Private coach questions have a separate input and `askCoach` action. Turn feedback renders only when a turn supplies it; no turn means no live review card. |
| `native/src/conversations/openers.rs` | Start admission saves reviewed settings and creates the learner-first or partner-first turn atomically. Rejects occupied/already-started conversations. |
| `native/src/conversations/execution/snapshots.rs` | Currently resolves topic labels from interface locale. Must instead project authored content for the selected conversation's target/explanation context. |

The September 18 section of [coaching contracts](../website/docs/coaching-contracts.md#conversation-direction-and-lesson-removal-18-september-2026) is the current start contract. Older notes describing topic clicks that immediately start, lesson handoffs, or mandatory hint ladders are historical. Preserve current restored coaching; see [restoration contract](v0-conversation-assistance-restoration.md).

## Proposed placement and layout

Desktop composition, from top to bottom:

| Existing region | Proposed content in an empty conversation |
| --- | --- |
| Global shell | Existing language selection, navigation, history and app controls. |
| Conversation header | Existing selected partner picker, conversation settings and New action. |
| Message stream | Compact partner introduction; authored greeting with Record action; optional topic choices; compact direction/customization controls. |
| Composer below stream | The existing editable message field, Record/Stop/Discard, Send and waveform. Always the learner-message input. |
| Adjacent Coach panel | Existing Coaching/Evidence tabs and private coach input, respecting the learner's collapsed/open state. |

The starter content scrolls inside the stream. It must not push the composer off the viewport, overlay the coach, introduce a new route, or reset the split-pane width. Partner identity comes from the **currently selected contact**, including custom partners; never substitute a bundled persona just for this surface.

On narrow screens, preserve the existing Chat/Coach navigation and single composer placement. Starter content appears in Chat. Opening Coach retains the conversation, topic selection and learner draft. It does not become a separate onboarding step. Appearance, script scaling, reading preferences and control minimums retain their existing owners.

Use these three groups within the empty stream (the replacement for the original undefined zones):

1. **Partner and first message:** compact avatar/name, authored greeting with its reading help, “Record” and “Let {name} start.” A short instruction points to the ordinary field for typing. Avoid a generic “Start” label with ambiguous behavior.
2. **Optional topic:** six compact selectable cards, “Partner chooses” and Custom topic. Selecting a card does not record, send, populate the input or change partners. Use a wrapping layout rather than a second scrolling carousel. Selecting another topic replaces the previous choice.
3. **Conversation controls:** compact difficulty and time preference, plus the existing Customize dialog for background, saved topics, YAML and request preview. Keep one shared draft; no competing settings state. Omit the proposed tour entry until a working tour exists.

The greeting is an example the learner may use, not a required script or a topic. Topic names remain navigation labels, not phrases to send to the partner.

## Exact action contract

| Learner action | Result | First partner turn? |
| --- | --- | --- |
| Open New conversation | Existing native creation/selection path opens an empty conversation for the current contact. | No |
| Select topic/difficulty/time preference | Update the conversation-scoped start draft; preserve typed text. | No |
| Customize → Apply | Stage the chosen configuration through the existing editor; saved-topic writes keep their existing explicit semantics. | No |
| Record beside the greeting | Activate the **same recording controller** used by the composer; move attention to its waveform and Stop/Discard controls. Do not call `startConversation` yet. | No |
| Stop, auto-send off | Transcribe into the existing composer, preserving its current append behavior. Learner can edit and Send. | Only when sent |
| Stop, auto-send on | Use the existing transcription-to-send path and its explicit Stop-and-send affordance. Show that behavior before recording. | On accepted transcript submission |
| Type → Send | Use existing `send`/`submitText` with the current start configuration and real text. | Yes, in response to learner |
| Let {name} start | Use existing partner-first action with null message/input and reviewed start configuration. | Yes, without learner message |
| Open Coach | Open/focus existing Coach panel; do not submit an automatic question. | No |

The original Q6 recommendation to “start the conversation and open the mic” is rejected as an admission sequence: a null-message start schedules a partner opening. Recording needs the existing conversation identity, not a prior partner-start action.

No new recorder, transcript buffer, send endpoint or durable opening type is needed. The greeting action is a presentation shortcut to the existing recording owner. While recording or transcribing, disable this shortcut and partner-first start; the composer remains the sole Stop/Discard owner. Lock start configuration during capture/transcription so one recorded attempt cannot acquire different settings midway. Preserve keyboard microphone access through the same guard.

Disable partner-first start while the composer contains non-whitespace text, with a concise explanation to send or clear that draft. This avoids starting over an unsent first message. Use a shared immediate guard for rapid clicks, permission acquisition and admission, not only asynchronously updated React `busy` state. The existing page has send guards, but its start button does not currently share all microphone-state guards; implementation must add and test that seam.

## Lifecycle and recovery

- **Loading:** do not briefly display another conversation's partner/cards. Resolve identity, settings and authored content for the same selected conversation.
- **No AI access:** keep authored content visible and locally selectable; show the existing access-setup actions and disable inference/recording actions with a reason. This is an intentional change from the current branch that replaces the starter with the access panel. Preserve onboarding itself.
- **Permission denied, cancelled recording or empty transcript:** retain the empty conversation, configuration and typed draft. Show useful errors where applicable. Do not manufacture an opening, retry permission automatically or award learning credit.
- **Accepted first turn:** replace the starter with real conversation content or existing opening status. Do not wait for a completed partner response before leaving starter state. A pending private coach request alone is not a partner conversation opening.
- **Admission failure:** retain the editable start configuration and message. Provide the existing diagnostic/error path, without hiding the only controls needed to recover.
- **Accepted work that later fails/pauses/has unknown outcome:** retain its durable opening/turn and use existing activity/recovery UI. Do not redisplay an actionable fresh-start form that can duplicate the request.
- **Switch conversation/partner/target or create New:** cancel/invalidate old recording callbacks, bind the displayed draft and greeting to the new identity, and prevent typed text or assistance flags leaking across conversations. Preserve drafts per conversation if retained; otherwise clear them explicitly. Audit this boundary: the current page owns input separately from its conversation-keyed start draft.
- **Restart:** retain existing persistence semantics. Do not introduce draft persistence or resume a microphone automatically as part of this change.

## Coach, assistance and rewards

The coach is a separate private conversation aid throughout. Before the first partner exchange it may answer an explicit learner question through existing `askCoach`; it must not automatically generate a welcome message, select a curriculum, choose a topic or gate starting. A short localized empty-state explanation can describe the coach's role. The greeting shortcut must never call the existing auto-submitting `askCoach(question)` helper merely to open the panel.

After a learner message, existing feedback, explanations, suggestions, disclosure and reward behavior continue unchanged. Partner-first starts and topic selection create no learner evidence. Existing rewards remain in their current presentation owners; do not invent greeting achievements or remove animations/sounds.

Unlike topic labels, an authored greeting is actual answer support. An explicitly used greeting aid must preserve assisted-input provenance through the existing evidence contract (proposed mapping: `scaffold: true`, with `speech_transcript` modality for recording). Passive visibility is not proof that the learner used it. If a future Insert action is added, it must also mark assistance. Do not create unassisted greeting credit merely because a learner repeated the displayed phrase. Verify this mapping against the existing evidence policy before implementing; do not add an unrelated scoring redesign.

## Content decisions recommended for this scope

| Original question | Recommendation |
| --- | --- |
| Q1: language or variety labels | Language defaults with narrowly authored variety overrides only where linguistic review requires them. Resolve with both target and explanation varieties from the outset. Do not claim all language-default labels are reviewed for all varieties. |
| Q2: romanization keys | Store romanization under the relevant language/variety text record, keyed by scheme ID; resolve the active scheme through existing variety resolution. Do not inspect only `defaults.romanization`. |
| Q3: greeting tokens | Give presentation its own explicit canonical greeting record. Keep `goal_material` as learning/retrieval data. Token ordering must not decide the UI's recommended wording. |
| Q4: per-variety partners | Display the selected real persona. Treat correcting locale/persona mismatches as a separate content and partner-creation pass; do not change contact identity or overwrite custom/existing personas during this UI work. |
| Q5: glyphs | Shared decorative glyphs plus readable labels; they must not carry the only meaning. Use linguistic/cultural review for final choices, not a universal-suitability claim. |
| Q6: microphone | One explicit Record press starts capture only. First-turn admission happens through normal Send or the existing enabled auto-send setting. |

The greeting record needs target text, scheme-specific romanizations, and translations in every supported explanation language, with reviewed variety overrides when necessary. Translation of a greeting's meaning is not automatically the canonical greeting chosen for the explanation language. The original token list supplies neither translation nor romanization; the proposed authoring estimate is consequently incomplete. Default-persona romanized names are another separate content gap; do not fabricate romanization for custom names at runtime.

Keep all this authored and bundled. Project resolved display data natively into the conversation snapshot (or a narrowly owned native projection), rather than having React import raw YAML or index learning material. Include enough language-tag/direction context for target text, explanation text and romanization. Topic IDs and model-facing `subject` remain unchanged. Final Rust document/type names follow the agreed product ownership above; generate schemas/contracts from Rust.

## Corrections to original technical claims

- `deny_unknown_fields` rejects unknown struct fields; a required map field does **not** enforce every required map key, nonempty string or glyph. Current runtime topic validation checks seven interface locales. Add explicit load-time validation for all supported target/explanation content, required schemes and greeting records, plus audit tests. CI alone is insufficient for editable invalid content.
- Retain target-variety × explanation-variety coverage. Add interface-locale independence and UI-localization checks; replacing the loop with only language pairs loses meaningful coverage.
- Language-keyed romanizations in the original code example contradict its own scheme-keyed recommendation. Settle one coherent source shape before writing YAML.
- A schema/required-field change and complete authored data must land together as a runnable implementation unit; do not hand off a state where every content load fails as a completed step.
- Removing `TopicCard.label` requires updating Customize, post-start direction settings, previews and fixtures as well as cards. No compatibility alias is needed, but audit every consumer.
- Keep interface chrome direction independent of target/explanation runs. Use explicit language/direction and isolate inserted names. Romanization uses `dir="ltr"`. Inspect mixed-script output rather than relying on the original note's unverified character-level explanation.
- The attachment's `ui/tools/start-preview.{html,tsx,css}` files are **absent in this checkout**. Its three-zone design and placeholder romanizations could not be inspected and must not be treated as available implementation assets.

## Implementation handoff and acceptance

Implement only after this proposed interaction contract is accepted. Start with an integrated fixture using the real shell/composer/coach composition; demonstrate empty, recording, pending and first-reply states at desktop and phone widths. An isolated starter-card gallery is insufficient to review placement. Use sample data explicitly labeled as such; fixture actions do not prove native behavior.

Then implement a complete content/native projection unit, followed by UI wiring in existing owners. Keep source changes scoped: `ConversationStart` handles display and callbacks, `ConversationPage` coordinates draft/recording/submission, the recorder owns capture, and Coach retains private coaching. Preserve `ConversationChoices` if it remains cohesive; deletion is not a requirement. Styles belong in `ui/src/styles/features/conversation/start.css` and existing composer/coaching owners as appropriate. No server work or deployment is expected.

Required behavioral acceptance cases:

1. Topic/difficulty/time selection and opening Customize make no inference request. All six topics remain reachable. Both first-message paths capture the same reviewed draft.
2. Greeting Record and composer Record share exactly one recording. Stop, Discard, auto-send on/off, typed-draft preservation, denial, silence and transcription failure behave as specified.
3. Rapid clicks, pending coach work, conversation switching, delayed transcription and stale workspace revisions cannot create duplicate or cross-conversation starts.
4. Partner-first creates no fake learner message/evidence; greeting assistance provenance survives submission; normal coaching/rewards still work after a real learner turn.
5. Opening/focusing Coach before starting makes no AI call. Explicit coach submission stays private and does not count as a partner opening. Mobile return to Chat preserves draft/configuration.
6. Selected custom partner identity is preserved. Conversation-specific explanation language controls translations. Same target/explanation language may suppress an identical duplicate line without discarding the data.
7. Arabic, Mandarin and Irish exercise RTL, romanization and no-romanization cases; also test Arabic interface with a Latin target and explanation language differing from interface locale. Check wrapping, keyboard focus, accessible card selection and enlarged text with a reachable composer.
8. Missing required labels, schemes, greeting content and invalid overrides fail registry loading with actionable paths. Bundled/disk parity and generated contracts stay consistent.

Run relevant colocated tests and the documented full gates: `npm test`, `npm run build`, `npm run styles:check`, `npm run languages:check`, `npm run contracts:check`, `npm run previews:check`, plus native opener/execution tests covering touched behavior. Record fixture review separately from real native microphone, transcription and first-turn verification. No paid/live AI verification was performed in this design review.

## Review evidence and remaining decisions

Working tree was clean at review start. Source inspection covered the workspace, start controls, composer, recording hook, coach panel, native admission/snapshot and registry validation/audit paths. The running SkellySpeak Dev app was inspected read-only and was at AI-access setup (step 2 of 2); setup was not changed. The existing `/tools/conversation-preview.html` was opened on the local development server but rendered a blank surface, so no successful visual layout verification is claimed. No implementation tests were run for this documentation-only review.

Ready for user review: the placement, action table and coach relationship in this note. Remaining content work is linguistic review of canonical greetings, translations, schemes and any necessary variety overrides. It does not require reopening shell architecture or choosing new storage/IPC/provider systems. Per-variety persona creation remains a separate proposed task. This handoff has not been sent to another agent; no commit or deployment was made.
