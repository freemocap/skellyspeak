# Conversation starter cleanup

Status: implemented in source; not committed or deployed.

The partner panel now uses a compact identity/action header, smaller avatar and
reduced padding. Removed the detached greeting/topic inspection buttons and the
standalone greeting romanization and composer hint. Topic labels retain authored
romanization and translation. Removed the Partner chooses tile; clicking a
selected built-in topic clears the selection, retaining the existing no-topic
start behavior. Difficulty and grammar controls align by their labels. Start
errors appear beside the start actions rather than below the configuration.

Verification: 42 targeted ConversationStart, ConversationPage and prompt-creator
tests pass; production build, style checks and preview type checks pass. Browser
review of the production-component sample fixture confirmed compact layout,
topic selection/deselection and transition from starter to conversation.

Unresolved: the screenshot reports a broken start button. Mocked integration
checks and the offline preview do not reproduce it and cannot establish live
native/provider success. No speculative native behavior change was made. A live
failure and its retained diagnostic details are still needed to identify its
cause. Existing unrelated working-tree changes were preserved.

## Follow-up: direct topic start and removal of selection popup

Implemented after user correction: built-in topic buttons immediately submit a
partner-first start with the exact chosen topic and current difficulty/grammar.
This supersedes the deselection behavior above. The detailed prompt editor still
edits its draft. Confirming a custom topic also starts the conversation. Topic
starts share the pending-action guard and are disabled while a learner draft,
recording or transcription is in progress.

Removed the application-wide pointer/key selection listeners and their floating
Inspect selected text popup. Explicit word-help/inspection actions remain.

The subsequent user screenshot shows the actual start refusal: the server daily
request or allowance limit was reached. This is a live admission refusal rather
than a missing click handler. This UI change does not alter server limits.

Verification: 53 targeted tests pass, including direct topic-to-native-command
configuration and no popup on text selection/control clicks. Production build,
style checks, preview type checks and diff whitespace checks pass. Live provider
success remains unverified while the reported server limit applies.
