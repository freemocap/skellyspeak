# Test suite inventory — 2026-09-15

Status: static inventory accompanying [the audit](test-suite-audit-2026-09-15.md). Includes the current working tree; excludes `old/`, build output and dependencies. File inclusion uses test filename conventions and Rust test attributes. This is discovery evidence, not a per-file quality score. The screening and playback-DOM test links follow their subsequent renames; labels retain the inventoried names. Runtime counts are in the audit; parameterization and loops mean declaration counts do not equal executed cases. Rust line counts include colocated production code.

Source inspection covered runner/CI configuration and cross-suite patterns; detailed assertion review concentrated on product workflows, trust boundaries, failures and identified debt. No claim is made that every assertion received an individual semantic review.

## ui

107 test-bearing files.

| File | Lines | Structural signals |
| --- | ---: | --- |
| [ui/src/app/App.navigation.test.tsx](../../ui/src/app/App.navigation.test.tsx) | 80 | jsdom; module mocks |
| [ui/src/app/navigation/usePracticeSwipe.test.tsx](../../ui/src/app/navigation/usePracticeSwipe.test.tsx) | 61 | jsdom |
| [ui/src/app/shortcuts/shortcuts.test.ts](../../ui/src/app/shortcuts/shortcuts.test.ts) | 84 | jsdom |
| [ui/src/components/controls/InfoTip.test.tsx](../../ui/src/components/controls/InfoTip.test.tsx) | 25 | jsdom |
| [ui/src/components/dialogs/DetailDialog.test.tsx](../../ui/src/components/dialogs/DetailDialog.test.tsx) | 18 | jsdom |
| [ui/src/components/feedback/ErrorDetails.test.tsx](../../ui/src/components/feedback/ErrorDetails.test.tsx) | 27 | jsdom |
| [ui/src/components/learning/DomainEvidenceTree.test.tsx](../../ui/src/components/learning/DomainEvidenceTree.test.tsx) | 24 | jsdom |
| [ui/src/components/learning/EvidenceMappingNotice.test.tsx](../../ui/src/components/learning/EvidenceMappingNotice.test.tsx) | 19 | jsdom |
| [ui/src/components/media/WaveformStrip.test.tsx](../../ui/src/components/media/WaveformStrip.test.tsx) | 95 | jsdom |
| [ui/src/components/persistence/YamlExport.test.tsx](../../ui/src/components/persistence/YamlExport.test.tsx) | 38 | jsdom; DOM/class selectors |
| [ui/src/components/reading/Markdown.test.tsx](../../ui/src/components/reading/Markdown.test.tsx) | 142 | jsdom; DOM/class selectors |
| [ui/src/components/reading/TargetText.test.tsx](../../ui/src/components/reading/TargetText.test.tsx) | 50 | jsdom; module mocks; DOM/class selectors |
| [ui/src/domain/access/providers.test.ts](../../ui/src/domain/access/providers.test.ts) | 31 | Node |
| [ui/src/domain/conversation/conversation-view.test.ts](../../ui/src/domain/conversation/conversation-view.test.ts) | 133 | Node |
| [ui/src/domain/conversation/turns.test.ts](../../ui/src/domain/conversation/turns.test.ts) | 112 | Node |
| [ui/src/domain/input/back.test.ts](../../ui/src/domain/input/back.test.ts) | 16 | jsdom |
| [ui/src/domain/input/font-size.test.ts](../../ui/src/domain/input/font-size.test.ts) | 25 | Node |
| [ui/src/domain/input/reload.test.ts](../../ui/src/domain/input/reload.test.ts) | 20 | Node |
| [ui/src/domain/learning/catalog/contrast.test.ts](../../ui/src/domain/learning/catalog/contrast.test.ts) | 86 | Node; reads files |
| [ui/src/domain/learning/catalog/skill-index.test.ts](../../ui/src/domain/learning/catalog/skill-index.test.ts) | 44 | Node |
| [ui/src/domain/learning/evidence/message-evidence.test.ts](../../ui/src/domain/learning/evidence/message-evidence.test.ts) | 65 | Node |
| [ui/src/domain/learning/rewards/skill-rewards.test.ts](../../ui/src/domain/learning/rewards/skill-rewards.test.ts) | 81 | Node |
| [ui/src/domain/learning/statistics/practice-statistics.test.ts](../../ui/src/domain/learning/statistics/practice-statistics.test.ts) | 54 | Node |
| [ui/src/domain/localization/i18n.test.ts](../../ui/src/domain/localization/i18n.test.ts) | 44 | Node |
| [ui/src/domain/reading/gloss-display.test.ts](../../ui/src/domain/reading/gloss-display.test.ts) | 20 | Node |
| [ui/src/domain/reading/sentences.test.ts](../../ui/src/domain/reading/sentences.test.ts) | 72 | Node |
| [ui/src/domain/reading/source-token.test.ts](../../ui/src/domain/reading/source-token.test.ts) | 11 | Node |
| [ui/src/domain/reading/token-spacing.test.ts](../../ui/src/domain/reading/token-spacing.test.ts) | 24 | Node |
| [ui/src/domain/rewards/reward-anchors.test.ts](../../ui/src/domain/rewards/reward-anchors.test.ts) | 24 | jsdom |
| [ui/src/domain/rewards/reward-trails.test.ts](../../ui/src/domain/rewards/reward-trails.test.ts) | 41 | jsdom; DOM/class selectors |
| [ui/src/domain/update/semver.test.ts](../../ui/src/domain/update/semver.test.ts) | 50 | Node |
| [ui/src/features/activity/GenerationActivity.test.tsx](../../ui/src/features/activity/GenerationActivity.test.tsx) | 100 | jsdom; module mocks; DOM/class selectors |
| [ui/src/features/activity/LiveActivity.test.tsx](../../ui/src/features/activity/LiveActivity.test.tsx) | 93 | jsdom; module mocks |
| [ui/src/features/conversation/ConversationPage.conversation.test.tsx](../../ui/src/features/conversation/ConversationPage.conversation.test.tsx) | 553 | jsdom; module mocks; DOM/class selectors |
| [ui/src/features/conversation/coaching/CoachAnalysisPanel.test.tsx](../../ui/src/features/conversation/coaching/CoachAnalysisPanel.test.tsx) | 86 | jsdom; module mocks |
| [ui/src/features/conversation/coaching/CoachEntry.test.tsx](../../ui/src/features/conversation/coaching/CoachEntry.test.tsx) | 20 | jsdom; DOM/class selectors |
| [ui/src/features/conversation/coaching/EditFeedback.test.tsx](../../ui/src/features/conversation/coaching/EditFeedback.test.tsx) | 15 | jsdom; DOM/class selectors |
| [ui/src/features/conversation/coaching/LiveCoachReview.test.tsx](../../ui/src/features/conversation/coaching/LiveCoachReview.test.tsx) | 25 | jsdom |
| [ui/src/features/conversation/coaching/MessageFeedback.test.tsx](../../ui/src/features/conversation/coaching/MessageFeedback.test.tsx) | 136 | jsdom; module mocks |
| [ui/src/features/conversation/composer/ComposerHelp.test.tsx](../../ui/src/features/conversation/composer/ComposerHelp.test.tsx) | 88 | jsdom; module mocks; DOM/class selectors |
| [ui/src/features/conversation/lessons/LessonDialog.test.tsx](../../ui/src/features/conversation/lessons/LessonDialog.test.tsx) | 137 | jsdom; module mocks |
| [ui/src/features/conversation/messages/PracticeDivider.test.tsx](../../ui/src/features/conversation/messages/PracticeDivider.test.tsx) | 22 | jsdom |
| [ui/src/features/conversation/messages/ReplyStatus.test.tsx](../../ui/src/features/conversation/messages/ReplyStatus.test.tsx) | 46 | jsdom |
| [ui/src/features/conversation/messages/TurnView.test.tsx](../../ui/src/features/conversation/messages/TurnView.test.tsx) | 195 | jsdom; DOM/class selectors |
| [ui/src/features/conversation/messages/useConversationScroll.test.ts](../../ui/src/features/conversation/messages/useConversationScroll.test.ts) | 25 | jsdom |
| [ui/src/features/conversation/partners/MysteryPartnerPanel.test.tsx](../../ui/src/features/conversation/partners/MysteryPartnerPanel.test.tsx) | 46 | jsdom; module mocks |
| [ui/src/features/conversation/partners/NewPersonaDialog.test.tsx](../../ui/src/features/conversation/partners/NewPersonaDialog.test.tsx) | 209 | jsdom; module mocks |
| [ui/src/features/conversation/partners/PersonaPicker.test.tsx](../../ui/src/features/conversation/partners/PersonaPicker.test.tsx) | 59 | jsdom; DOM/class selectors |
| [ui/src/features/conversation/partners/PersonaProfile.test.tsx](../../ui/src/features/conversation/partners/PersonaProfile.test.tsx) | 79 | jsdom |
| [ui/src/features/conversation/partners/PersonaProfileDialog.test.tsx](../../ui/src/features/conversation/partners/PersonaProfileDialog.test.tsx) | 208 | jsdom |
| [ui/src/features/conversation/partners/PersonaReaction.test.tsx](../../ui/src/features/conversation/partners/PersonaReaction.test.tsx) | 60 | jsdom; module mocks; DOM/class selectors |
| [ui/src/features/conversation/partners/personaLimits.test.ts](../../ui/src/features/conversation/partners/personaLimits.test.ts) | 7 | Node |
| [ui/src/features/conversation/progress/ConversationMap.test.tsx](../../ui/src/features/conversation/progress/ConversationMap.test.tsx) | 34 | jsdom; DOM/class selectors |
| [ui/src/features/conversation/progress/InlineXpBadge.test.tsx](../../ui/src/features/conversation/progress/InlineXpBadge.test.tsx) | 35 | jsdom; module mocks; DOM/class selectors |
| [ui/src/features/conversation/progress/ProgressSummary.test.tsx](../../ui/src/features/conversation/progress/ProgressSummary.test.tsx) | 37 | jsdom; module mocks |
| [ui/src/features/conversation/progress/RewardBadge.test.tsx](../../ui/src/features/conversation/progress/RewardBadge.test.tsx) | 24 | jsdom; module mocks |
| [ui/src/features/conversation/progress/RewardFlow.test.tsx](../../ui/src/features/conversation/progress/RewardFlow.test.tsx) | 63 | jsdom; DOM/class selectors |
| [ui/src/features/conversation/progress/RewardPresentation.test.tsx](../../ui/src/features/conversation/progress/RewardPresentation.test.tsx) | 196 | jsdom; module mocks; DOM/class selectors |
| [ui/src/features/conversation/progress/RewardProgress.test.tsx](../../ui/src/features/conversation/progress/RewardProgress.test.tsx) | 30 | jsdom |
| [ui/src/features/conversation/progress/SkillRewards.test.tsx](../../ui/src/features/conversation/progress/SkillRewards.test.tsx) | 77 | jsdom; module mocks |
| [ui/src/features/conversation/reading/AnalysisSentence.test.tsx](../../ui/src/features/conversation/reading/AnalysisSentence.test.tsx) | 15 | jsdom; DOM/class selectors |
| [ui/src/features/conversation/reading/LanguageLocalization.test.tsx](../../ui/src/features/conversation/reading/LanguageLocalization.test.tsx) | 28 | jsdom |
| [ui/src/features/conversation/reading/SavedGlossText.test.tsx](../../ui/src/features/conversation/reading/SavedGlossText.test.tsx) | 181 | jsdom; module mocks; DOM/class selectors |
| [ui/src/features/conversation/session/ChatHistory.test.tsx](../../ui/src/features/conversation/session/ChatHistory.test.tsx) | 149 | jsdom; DOM/class selectors |
| [ui/src/features/conversation/session/ConversationExport.test.tsx](../../ui/src/features/conversation/session/ConversationExport.test.tsx) | 25 | jsdom; module mocks |
| [ui/src/features/conversation/session/ConversationStart.test.tsx](../../ui/src/features/conversation/session/ConversationStart.test.tsx) | 39 | jsdom |
| [ui/src/features/conversation/session/DifficultySelect.test.tsx](../../ui/src/features/conversation/session/DifficultySelect.test.tsx) | 26 | jsdom; DOM/class selectors |
| [ui/src/features/conversation/session/useConversationDetails.test.tsx](../../ui/src/features/conversation/session/useConversationDetails.test.tsx) | 34 | jsdom; module mocks |
| [ui/src/features/conversation/session/useConversationSnapshot.test.ts](../../ui/src/features/conversation/session/useConversationSnapshot.test.ts) | 106 | jsdom; module mocks |
| [ui/src/features/conversation/speech/TranscriptionInspector.test.tsx](../../ui/src/features/conversation/speech/TranscriptionInspector.test.tsx) | 99 | jsdom; DOM/class selectors |
| [ui/src/features/conversation/speech/speech-player.test.ts](../../ui/src/features/conversation/speech/speech-player.test.ts) | 113 | jsdom |
| [ui/src/features/conversation/speech/useMessageSpeech.test.tsx](../../ui/src/features/conversation/speech/useMessageSpeech.test.tsx) | 125 | jsdom; module mocks |
| [ui/src/features/conversation/speech/useMicRecorder.test.ts](../../ui/src/features/conversation/speech/useMicRecorder.test.ts) | 129 | jsdom; module mocks |
| [ui/src/features/settings/SettingsDialog.test.tsx](../../ui/src/features/settings/SettingsDialog.test.tsx) | 36 | jsdom |
| [ui/src/features/settings/SettingsModal.test.tsx](../../ui/src/features/settings/SettingsModal.test.tsx) | 200 | jsdom; module mocks; DOM/class selectors |
| [ui/src/features/settings/access/SettingsAccess.test.tsx](../../ui/src/features/settings/access/SettingsAccess.test.tsx) | 241 | jsdom; module mocks |
| [ui/src/features/settings/language/VarietyField.test.tsx](../../ui/src/features/settings/language/VarietyField.test.tsx) | 34 | jsdom |
| [ui/src/features/settings/workspace/FactoryReset.test.tsx](../../ui/src/features/settings/workspace/FactoryReset.test.tsx) | 32 | jsdom; module mocks |
| [ui/src/features/skills/SkillsPage.test.tsx](../../ui/src/features/skills/SkillsPage.test.tsx) | 115 | jsdom; module mocks; DOM/class selectors |
| [ui/src/features/skills/learner/LearnerModel.test.tsx](../../ui/src/features/skills/learner/LearnerModel.test.tsx) | 179 | jsdom; module mocks |
| [ui/src/features/skills/overview/TreeCamera.test.tsx](../../ui/src/features/skills/overview/TreeCamera.test.tsx) | 27 | jsdom; module mocks |
| [ui/src/features/startup/ConfigurationRefusal.test.tsx](../../ui/src/features/startup/ConfigurationRefusal.test.tsx) | 11 | jsdom |
| [ui/src/features/startup/CredentialCleanup.test.tsx](../../ui/src/features/startup/CredentialCleanup.test.tsx) | 30 | jsdom; module mocks |
| [ui/src/features/startup/StartupRefusal.test.tsx](../../ui/src/features/startup/StartupRefusal.test.tsx) | 59 | jsdom; module mocks |
| [ui/src/platform/appearance/useAppearance.test.tsx](../../ui/src/platform/appearance/useAppearance.test.tsx) | 31 | jsdom |
| [ui/src/platform/audio/browser-recording.test.ts](../../ui/src/platform/audio/browser-recording.test.ts) | 17 | Node |
| [ui/src/platform/audio/playback-lifecycle.browser.test.ts](../../ui/src/platform/audio/playback-lifecycle.dom.test.ts) | 41 | jsdom; module mocks |
| [ui/src/platform/audio/playback-lifecycle.test.ts](../../ui/src/platform/audio/playback-lifecycle.test.ts) | 44 | Node; module mocks; reads files |
| [ui/src/platform/audio/reward-sounds.test.ts](../../ui/src/platform/audio/reward-sounds.test.ts) | 181 | jsdom |
| [ui/src/platform/diagnostics/faults.test.ts](../../ui/src/platform/diagnostics/faults.test.ts) | 49 | Node; module mocks |
| [ui/src/platform/diagnostics/log.test.ts](../../ui/src/platform/diagnostics/log.test.ts) | 72 | jsdom; module mocks |
| [ui/src/platform/ipc/native.test.ts](../../ui/src/platform/ipc/native.test.ts) | 18 | Node; module mocks |
| [ui/src/platform/ipc/persona-generation.test.ts](../../ui/src/platform/ipc/persona-generation.test.ts) | 29 | Node; module mocks |
| [ui/src/platform/ipc/settings-contract.test.ts](../../ui/src/platform/ipc/settings-contract.test.ts) | 232 | jsdom; module mocks |
| [ui/src/platform/ipc/tauri-logging.test.ts](../../ui/src/platform/ipc/tauri-logging.test.ts) | 16 | jsdom; module mocks |
| [ui/src/platform/updates/updater.test.ts](../../ui/src/platform/updates/updater.test.ts) | 69 | Node; module mocks |
| [ui/src/state/learning/useSkillEvidence.test.ts](../../ui/src/state/learning/useSkillEvidence.test.ts) | 133 | jsdom; module mocks |
| [ui/src/state/navigation/navigation.test.ts](../../ui/src/state/navigation/navigation.test.ts) | 98 | Node |
| [ui/src/state/navigation/skill-navigation.test.ts](../../ui/src/state/navigation/skill-navigation.test.ts) | 11 | Node |
| [ui/src/state/session/session.test.ts](../../ui/src/state/session/session.test.ts) | 87 | Node; module mocks |
| [ui/src/state/settings/settings.test.ts](../../ui/src/state/settings/settings.test.ts) | 143 | jsdom; module mocks |
| [ui/tests/architecture/LogsOverlay.boundary.test.tsx](../../ui/tests/architecture/LogsOverlay.boundary.test.tsx) | 29 | jsdom; module mocks; DOM/class selectors |
| [ui/tests/architecture/boundaries.test.ts](../../ui/tests/architecture/boundaries.test.ts) | 117 | Node |
| [ui/tests/architecture/dead-code.test.ts](../../ui/tests/architecture/dead-code.test.ts) | 66 | Node |
| [ui/tests/architecture/ipc-commands.test.ts](../../ui/tests/architecture/ipc-commands.test.ts) | 36 | Node; reads files |
| [ui/tests/architecture/style-pruner.test.ts](../../ui/tests/architecture/style-pruner.test.ts) | 39 | Node; reads files |
| [ui/tests/architecture/window-close.test.ts](../../ui/tests/architecture/window-close.test.ts) | 18 | Node; reads files |

## native/src

71 test-bearing files.

| File | Lines | Structural signals |
| --- | ---: | --- |
| [native/src/ai/connections/access.rs](../../native/src/ai/connections/access.rs) | 984 | native/utility tests; 10 declarations |
| [native/src/ai/connections/model_routing.rs](../../native/src/ai/connections/model_routing.rs) | 70 | native/utility tests; 1 declarations |
| [native/src/ai/hosted/mod.rs](../../native/src/ai/hosted/mod.rs) | 713 | native/utility tests; 10 declarations |
| [native/src/ai/policy/admission.rs](../../native/src/ai/policy/admission.rs) | 268 | native/utility tests; 5 declarations |
| [native/src/ai/policy/holds.rs](../../native/src/ai/policy/holds.rs) | 289 | native/utility tests; 4 declarations |
| [native/src/ai/policy/refusal.rs](../../native/src/ai/policy/refusal.rs) | 97 | native/utility tests; 1 declarations |
| [native/src/ai/transport/grouped.rs](../../native/src/ai/transport/grouped.rs) | 672 | native/utility tests; 6 declarations |
| [native/src/ai/transport/provider/tests/keys.rs](../../native/src/ai/transport/provider/tests/keys.rs) | 41 | native/utility tests; 3 declarations |
| [native/src/ai/transport/provider/tests/payload.rs](../../native/src/ai/transport/provider/tests/payload.rs) | 215 | native/utility tests; 4 declarations |
| [native/src/ai/transport/provider/tests/request.rs](../../native/src/ai/transport/provider/tests/request.rs) | 197 | native/utility tests; 5 declarations |
| [native/src/ai/transport/provider/tests/response.rs](../../native/src/ai/transport/provider/tests/response.rs) | 32 | native/utility tests; 2 declarations |
| [native/src/ai/transport/speech_provider.rs](../../native/src/ai/transport/speech_provider.rs) | 886 | native/utility tests; 11 declarations |
| [native/src/application/tests/credential_io.rs](../../native/src/application/tests/credential_io.rs) | 210 | native/utility tests; 4 declarations |
| [native/src/application/tests/generation.rs](../../native/src/application/tests/generation.rs) | 221 | native/utility tests; 7 declarations |
| [native/src/configuration/appearance.rs](../../native/src/configuration/appearance.rs) | 118 | native/utility tests; 1 declarations |
| [native/src/configuration/tests.rs](../../native/src/configuration/tests.rs) | 509 | native/utility tests; 17 declarations; reads files |
| [native/src/conversations/conversation_export.rs](../../native/src/conversations/conversation_export.rs) | 324 | native/utility tests; 3 declarations; reads files |
| [native/src/conversations/conversation_prompt.rs](../../native/src/conversations/conversation_prompt.rs) | 283 | native/utility tests; 4 declarations |
| [native/src/conversations/execution/tests/coaching.rs](../../native/src/conversations/execution/tests/coaching.rs) | 247 | native/utility tests; 6 declarations |
| [native/src/conversations/execution/tests/connections.rs](../../native/src/conversations/execution/tests/connections.rs) | 199 | native/utility tests; 5 declarations |
| [native/src/conversations/execution/tests/grouped_transport.rs](../../native/src/conversations/execution/tests/grouped_transport.rs) | 142 | native/utility tests; 2 declarations |
| [native/src/conversations/execution/tests/language_context.rs](../../native/src/conversations/execution/tests/language_context.rs) | 300 | native/utility tests; 4 declarations |
| [native/src/conversations/execution/tests/lesson_context.rs](../../native/src/conversations/execution/tests/lesson_context.rs) | 107 | native/utility tests; 2 declarations |
| [native/src/conversations/execution/tests/live_provider.rs](../../native/src/conversations/execution/tests/live_provider.rs) | 85 | native/utility tests; 1 declarations; reads files; skip/ignore syntax; inspect condition |
| [native/src/conversations/execution/tests/partner_feedback.rs](../../native/src/conversations/execution/tests/partner_feedback.rs) | 94 | native/utility tests; 2 declarations |
| [native/src/conversations/execution/tests/practice_feedback.rs](../../native/src/conversations/execution/tests/practice_feedback.rs) | 333 | native/utility tests; 6 declarations; reads files |
| [native/src/conversations/execution/tests/practice_openings.rs](../../native/src/conversations/execution/tests/practice_openings.rs) | 162 | native/utility tests; 2 declarations |
| [native/src/conversations/execution/tests/reading_gloss.rs](../../native/src/conversations/execution/tests/reading_gloss.rs) | 432 | native/utility tests; 10 declarations |
| [native/src/conversations/execution/tests/refusal_holds.rs](../../native/src/conversations/execution/tests/refusal_holds.rs) | 285 | native/utility tests; 4 declarations |
| [native/src/conversations/execution/tests/revision_history.rs](../../native/src/conversations/execution/tests/revision_history.rs) | 376 | native/utility tests; 5 declarations |
| [native/src/conversations/execution/tests/revision_publication.rs](../../native/src/conversations/execution/tests/revision_publication.rs) | 178 | native/utility tests; 3 declarations |
| [native/src/conversations/execution/tests/rewards.rs](../../native/src/conversations/execution/tests/rewards.rs) | 119 | native/utility tests; 3 declarations |
| [native/src/conversations/execution/tests/snapshots.rs](../../native/src/conversations/execution/tests/snapshots.rs) | 158 | native/utility tests; 4 declarations |
| [native/src/conversations/execution/tests/speech_publication.rs](../../native/src/conversations/execution/tests/speech_publication.rs) | 249 | native/utility tests; 5 declarations |
| [native/src/conversations/execution/tests/speech_requests.rs](../../native/src/conversations/execution/tests/speech_requests.rs) | 357 | native/utility tests; 7 declarations |
| [native/src/conversations/execution/tests/translation.rs](../../native/src/conversations/execution/tests/translation.rs) | 418 | native/utility tests; 12 declarations |
| [native/src/conversations/execution/tests/turn_lifecycle.rs](../../native/src/conversations/execution/tests/turn_lifecycle.rs) | 243 | native/utility tests; 8 declarations |
| [native/src/conversations/execution/tests/work_budgets.rs](../../native/src/conversations/execution/tests/work_budgets.rs) | 251 | native/utility tests; 3 declarations; skip/ignore syntax; inspect condition |
| [native/src/conversations/gloss.rs](../../native/src/conversations/gloss.rs) | 199 | native/utility tests; 3 declarations |
| [native/src/diagnostics/mod.rs](../../native/src/diagnostics/mod.rs) | 601 | native/utility tests; 5 declarations; reads files |
| [native/src/language/emoji.rs](../../native/src/language/emoji.rs) | 135 | native/utility tests; 4 declarations |
| [native/src/language/languages.rs](../../native/src/language/languages.rs) | 128 | native/utility tests; 1 declarations |
| [native/src/language/languages_citation_tests.rs](../../native/src/language/languages_citation_tests.rs) | 135 | native/utility tests; 3 declarations |
| [native/src/language/linguistics/adapter_tests.rs](../../native/src/language/linguistics/adapter_tests.rs) | 739 | native/utility tests; 21 declarations |
| [native/src/language/linguistics/tests.rs](../../native/src/language/linguistics/tests.rs) | 532 | native/utility tests; 21 declarations |
| [native/src/learning/coaching/coach_observation.rs](../../native/src/learning/coaching/coach_observation.rs) | 233 | native/utility tests; 3 declarations |
| [native/src/learning/coaching/mod.rs](../../native/src/learning/coaching/mod.rs) | 541 | native/utility tests; 5 declarations |
| [native/src/learning/learner/learner_state.rs](../../native/src/learning/learner/learner_state.rs) | 596 | native/utility tests; 9 declarations; reads files |
| [native/src/learning/lessons/tests/generation.rs](../../native/src/learning/lessons/tests/generation.rs) | 110 | native/utility tests; 3 declarations |
| [native/src/learning/lessons/tests/lifecycle.rs](../../native/src/learning/lessons/tests/lifecycle.rs) | 174 | native/utility tests; 4 declarations |
| [native/src/learning/lessons/tests/prompts.rs](../../native/src/learning/lessons/tests/prompts.rs) | 82 | native/utility tests; 2 declarations |
| [native/src/learning/lessons/tests/quiz.rs](../../native/src/learning/lessons/tests/quiz.rs) | 85 | native/utility tests; 2 declarations |
| [native/src/learning/lessons/tests/review.rs](../../native/src/learning/lessons/tests/review.rs) | 147 | native/utility tests; 2 declarations |
| [native/src/learning/rewards/reward_settings.rs](../../native/src/learning/rewards/reward_settings.rs) | 122 | native/utility tests; 1 declarations |
| [native/src/model.rs](../../native/src/model.rs) | 1019 | native/utility tests; 2 declarations |
| [native/src/partners/generation/generation_receipts.rs](../../native/src/partners/generation/generation_receipts.rs) | 444 | native/utility tests; 6 declarations |
| [native/src/partners/generation/mod.rs](../../native/src/partners/generation/mod.rs) | 519 | native/utility tests; 7 declarations |
| [native/src/partners/mystery.rs](../../native/src/partners/mystery.rs) | 441 | native/utility tests; 2 declarations |
| [native/src/partners/persona/mod.rs](../../native/src/partners/persona/mod.rs) | 336 | native/utility tests; 4 declarations |
| [native/src/partners/persona/persona_prompt.rs](../../native/src/partners/persona/persona_prompt.rs) | 92 | native/utility tests; 3 declarations |
| [native/src/speech/analysis/audio_inspection.rs](../../native/src/speech/analysis/audio_inspection.rs) | 461 | native/utility tests; 4 declarations |
| [native/src/speech/analysis/fluency.rs](../../native/src/speech/analysis/fluency.rs) | 541 | native/utility tests; 6 declarations |
| [native/src/speech/cache.rs](../../native/src/speech/cache.rs) | 106 | native/utility tests; 2 declarations |
| [native/src/speech/recording/audio.rs](../../native/src/speech/recording/audio.rs) | 344 | native/utility tests; 2 declarations |
| [native/src/speech/recording/transcription.rs](../../native/src/speech/recording/transcription.rs) | 308 | native/utility tests; 4 declarations |
| [native/src/storage/factory_reset.rs](../../native/src/storage/factory_reset.rs) | 635 | native/utility tests; 11 declarations; reads files |
| [native/src/storage/store/tests/lifecycle.rs](../../native/src/storage/store/tests/lifecycle.rs) | 211 | native/utility tests; 6 declarations |
| [native/src/storage/store/tests/preferences.rs](../../native/src/storage/store/tests/preferences.rs) | 219 | native/utility tests; 7 declarations |
| [native/src/storage/store/tests/schema.rs](../../native/src/storage/store/tests/schema.rs) | 169 | native/utility tests; 5 declarations |
| [native/src/storage/store/tests/transactions.rs](../../native/src/storage/store/tests/transactions.rs) | 140 | native/utility tests; 3 declarations |
| [native/src/storage/store/tests/workspace.rs](../../native/src/storage/store/tests/workspace.rs) | 36 | native/utility tests; 2 declarations |

## server/tests

19 test-bearing files.

| File | Lines | Structural signals |
| --- | ---: | --- |
| [server/tests/accounting/test_budget.py](../../server/tests/accounting/test_budget.py) | 179 | 8 declarations; pytest parameterization may expand |
| [server/tests/accounting/test_quota.py](../../server/tests/accounting/test_quota.py) | 585 | 39 declarations; pytest parameterization may expand |
| [server/tests/admission/test_admission.py](../../server/tests/admission/test_admission.py) | 137 | 9 declarations; pytest parameterization may expand |
| [server/tests/admission/test_work_admission.py](../../server/tests/admission/test_work_admission.py) | 83 | 4 declarations; pytest parameterization may expand |
| [server/tests/deployment/test_deployment.py](../../server/tests/deployment/test_deployment.py) | 134 | 7 declarations; pytest parameterization may expand; reads files |
| [server/tests/deployment/test_retention.py](../../server/tests/deployment/test_retention.py) | 61 | 5 declarations; pytest parameterization may expand; reads files |
| [server/tests/development/test_launcher.py](../../server/tests/development/test_launcher.py) | 35 | 2 declarations; pytest parameterization may expand |
| [server/tests/development/test_logs.py](../../server/tests/development/test_logs.py) | 120 | 6 declarations; pytest parameterization may expand; reads files |
| [server/tests/diagnostics/test_observability.py](../../server/tests/diagnostics/test_observability.py) | 168 | 11 declarations; pytest parameterization may expand |
| [server/tests/identity/test_auth.py](../../server/tests/identity/test_auth.py) | 242 | 22 declarations; pytest parameterization may expand |
| [server/tests/inference/test_contracts.py](../../server/tests/inference/test_contracts.py) | 169 | 11 declarations; pytest parameterization may expand |
| [server/tests/inference/test_grouped.py](../../server/tests/inference/test_grouped.py) | 276 | 13 declarations; pytest parameterization may expand |
| [server/tests/inference/test_limits.py](../../server/tests/inference/test_limits.py) | 83 | 10 declarations; pytest parameterization may expand |
| [server/tests/inference/test_model_routing.py](../../server/tests/inference/test_model_routing.py) | 176 | 9 declarations; pytest parameterization may expand; reads files |
| [server/tests/inference/test_proxy.py](../../server/tests/inference/test_proxy.py) | 232 | 14 declarations; pytest parameterization may expand |
| [server/tests/inference/test_streaming.py](../../server/tests/inference/test_streaming.py) | 34 | 2 declarations; pytest parameterization may expand |
| [server/tests/integration/test_firestore.py](../../server/tests/integration/test_firestore.py) | 163 | 7 declarations; pytest parameterization may expand; skip/ignore syntax; inspect condition |
| [server/tests/integration/test_reservation_cancellation.py](../../server/tests/integration/test_reservation_cancellation.py) | 171 | 3 declarations; pytest parameterization may expand |
| [server/tests/operations/test_reconcile.py](../../server/tests/operations/test_reconcile.py) | 54 | 3 declarations; pytest parameterization may expand |

## tools

6 test-bearing files.

| File | Lines | Structural signals |
| --- | ---: | --- |
| [tools/benchmarks/model-routing.test.ts](../../tools/benchmarks/screening.test.ts) | 46 | Node; reads files |
| [tools/e2e/android.test.ts](../../tools/e2e/android.test.ts) | 10 | Node |
| [tools/ios-release.test.ts](../../tools/ios-release.test.ts) | 80 | Node; reads files; skip/ignore syntax; inspect condition |
| [tools/run-log.test.ts](../../tools/run-log.test.ts) | 57 | Node; reads files |
| [tools/verify-updater/src/main.rs](../../tools/verify-updater/src/main.rs) | 55 | native/utility tests; 1 declarations; reads files |
| [tools/version.test.ts](../../tools/version.test.ts) | 98 | Node |

## docs/website

2 test-bearing files.

| File | Lines | Structural signals |
| --- | ---: | --- |
| [docs/website/scripts/image-size-patch.test.mts](../docs-site/scripts/image-size-patch.test.mts) | 156 | Node; reads files |
| [docs/website/src/lib/downloads.test.ts](../docs-site/src/lib/downloads.test.ts) | 88 | Node |
