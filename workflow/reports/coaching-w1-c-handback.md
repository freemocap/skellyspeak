## Hand-back: C · wave 1

Done:
- Self-repair now reaches native `reviseTurn` from GuidedPage's real edit handler, carrying durable turn identity and the reviewed global snapshot revision. The composer retains rejected drafts. Earlier edits confirm native exchange/private-coach removal counts; pending work disables editing. Generated `Outcome` is the skill outcome type.
- Message projection groups by native identity and carries both revision links. Active conversation, suggestions, analysis selection and automatic speech exclude replaced exchanges. Earlier version retains exact learner/partner wording in a collapsed disclosure, traverses repeated revisions and explicitly retrieves one older native page per click. Raw messages merge before projection so split predecessors remain complete.
- Delayed admission cannot clear or restore another conversation's draft. Native Conflict/pending-turn messages surface without automatic retry.
- Tests: actual GuidedPage edit/analysis/edit-send pipeline and resulting snapshot; native suffix confirmation; stale/pending rejection; disabled controls; late success/failure after conversation switch; interleaved identities/repeated links; split-page predecessor retrieval. Removed the mock-only editing assertion from TurnView.

Learner agency: the learner chooses when to repair; their own exact prior wording remains inspectable; destructive removal names native scope before acceptance. No unsolicited coaching or reward inventions were added.

Reward completion:
- B verified native 2-XP assisted revision credit, wording deduplication and exclusions; the blanket replacement exclusion is now removed. Reward tests cover positive net increase, zero-net removal, exclusion, native no-credit deduplication, refresh and reopening without replay. Fixtures and demo catalog use the generated SKILL_CATALOG_VERSION (2742549041).

Not done / why:
- Full native page/device QA remains pending. C initially found Chrome/in-app browser unavailable, then inspected expanded wording/banner in Safari after a delayed CUA response. Integration subsequently verified the test-only fixture at desktop 1180×820 and narrow 360×740 (innerWidth and scrollWidth both 360), exact predecessor wording, scope dialog and Escape restoring focus to Review removal. No issue was observed in these new surfaces. The screenshot API had stale scaling under the viewport override; integration also checked DOM dimensions. `.local/coaching-w1-qa/index.html` is an isolated fixture with simplified surrounding controls, no production fake mode and no provider calls; this does not establish full native GuidedPage, device or enlarged-text correctness.

Verification:
- Final frontend suite: 84 files / 528 tests passed, including revised credit, pending-race, split predecessor and superseded-playback regressions.
- `npm run styles:check` passed.
- `npm run build` passed; existing Vite large-chunk advisory remains.
- Native/clippy/export gate belongs to integration after B finishes the shared source; not claimed here.

Paid inference: none. No native application launch, data reset or Git write. C stopped its Vite fixture server (session 52441) after root's visual checks; port 1420 is released.

Contract drift: none. Consumes `expectedRevision` from ConversationSnapshot, not Conversation. Added the integration-assigned optional `before` parameter to workspace's existing watchConversation wrapper.

Change requests: integration should update UI-SURFACES.md with revision source behavior and keep native/visual verification pending until performed. Reward source and verification are complete. Integration owns the remaining native/device gate.

Discovered: retained versions must not feed current suggestions or automatic speech. Both frontend consumers now filter replaced exchanges. Paginated ancestors require raw-message merging and an explicit partial-predecessor load control; implemented and tested.

Inferred vs read: behavior above was read/changed in source and tested with local snapshots. No live provider, native runtime, linguistic validity or device correctness is inferred from these tests.
