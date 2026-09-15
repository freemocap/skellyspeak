# U1 — voice-first frontend handoff

Source complete/frozen for integration native voice QA. Preserved reference prominent Record/Stop, Discard, supporting text Send, and reply Speak/Stop controls. Integrated only approved generated speech actions/state and OperationView.sourceMessageId; no native/server/Git writes or paid/native calls.

## Implemented

- useConversation exposes its scoped read-only snapshot. conversationTurns preserves the native assistant message ID in the presentation projection for replay ownership.
- useMessageSpeech baselines loaded history, then reads newly arriving source-bound partner_speech operations through read_speech_audio with snapshot sessionId. Observation never requests generation. Tracks operation IDs and handles delayed source binding on pre-created operations. Preference changes and reopen do not replay history.
- Explicit replay delegates requestMessageSpeech for the selected message and consumes the returned operation ID, allowing native cache reuse. Duplicate activation while pending stops/cancels instead of admitting duplicate requests. Root owns actual cache/provider accounting.
- Pending speech is cancelled on Stop, mic activation, navigation/unmount and new turn. Generation guards suppress late admission/audio; even an operation ID returned after stop is cancelled. Active Audio is paused and its blob URL revoked exactly once on stop/end/error. No old speak_text, partner lookup or OS fallback.
- Reply Speak control becomes Stop while preparing/playing. Playback failures, unavailable audio and source mismatch surface as dismissible speech error details on that reply.
- Existing microphone transcript branch now uses enabled auto_send preference. One transcript sends once; a transcript arriving while a reply is pending is retained as draft instead of dropped. Failed Send preserves a newer transcript draft.
- Enabled existing auto_send/auto_speak autosaving settings and quick controls. Root preference bridge owns approved true defaults. Fixed cloud engine/voice/rate and other unsupported controls remain disabled. No UI redesign or stylesheet changes in this round.

## Verification

Full frontend suite: 78 files / 370 tests passed. Build and style checks pass (stylesheet unchanged from access-tab handoff).

New hook tests cover silent history mount/preference/reopen, new reply playback once without generation, delayed operation source binding, manual native-operation replay, duplicate activation cancellation, late admission/audio cancellation on navigation, microphone suspension, and visible playback rejection without fallback. Blob helper test verifies Audio play and one-time pause/resource revocation. Full-page microphone test verifies single autosend plus later transcript retention through rejection. Existing composer/reading/settings tests remain green.

## Native QA readiness and limits

Integration owns native process and CSP media-src blob enablement. Source tests mock native and Audio, so they do not prove microphone hardware, hosted synthesis, audible output or WebKit autoplay permission. Run the primary loop: Record → Stop → one transcript Send → saved reply → automatic spoken reply. Then Stop/replay the same reply, start recording during pending/playing speech, navigate while pending, reopen saved history (silent), and test autosend/read-aloud opt-outs. Verify native cache/accounting separately; frontend tests only establish consuming the returned stable operation.

No browser-speech/OS fallback is present. If Audio.play rejects under device autoplay policy, the reply shows an error and explicit replay remains available; permission behavior requires native QA. Local server runtime was not changed by U1. Integration can choose its configured Hosted route for voice QA.

Files: new pages/guided/useMessageSpeech.ts and speech-player.ts with tests; GuidedPage.tsx, useConversation.ts, conversation-view.ts, optional messageId in frontend types.ts, TurnView.tsx, AudioVoice preference enablement in SettingsModal.tsx, and full-page transcript test. Preserve root's concurrent preference bridge/contracts/native work.
