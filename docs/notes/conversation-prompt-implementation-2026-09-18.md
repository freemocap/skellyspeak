# Conversation prompt implementation

Status: implemented in source, 18 September 2026. Follows the user-approved
[proposal](conversation-prompt-streamlining-proposal-2026-09-18.md). This report
covers source and automated verification, not deployment or a live-provider trial.

## Implemented behavior

- Empty conversations expose topic buttons, no preference/past/future buttons,
  all five difficulty levels, a partner-first start button and the normal composer.
  Selections change a pending draft without inference.
- Customize opens the shared Conversation Prompt Creator. Form, editable YAML and
  prompt/request inspection use one draft. Native YAML validation rejects unknown
  fields, duplicate keys and invalid values. Invalid YAML stays visible and cannot
  be applied. Cancel discards changes; Apply does not start a turn.
- Persona background can be omitted entirely. When included, the prompt treats it
  as background and mentions details only when relevant. Form exposes all five
  exact difficulty instructions and the persona schema data.
- Custom topics can be selected without saving, or saved locally for reuse across
  languages. Creator additions/deletions are staged until Apply. A native save
  failure keeps the draft. The direct custom-topic dialog applies to the main
  draft without starting a conversation. Saved-topic deletion leaves copied
  conversation topics intact.
- Conversation settings reopen the creator after starting. Settings and saved-topic
  changes commit together, with revision checks. Accepted/queued turns retain their
  captured context. A new conversation resets topic/time selection.

## Ownership and execution

`content/shared/conversation-topics.yaml` contains subjects and localized labels,
not authored dialogue, skill prerequisites, difficulty eligibility, variety
coverage or ranking inputs. Main choices use the interface locale. Every target
and explanation variety has access to the same catalog.

`content/prompts/conversation/instructions.yaml` owns conversation prose.
`native/src/conversations/conversation_prompt.rs` composes the selected language
writing guidance, optional persona, named difficulty, optional subject and time
reference. The preview and accepted turn use the same composer. The conversation
model sees the final instruction; it receives no explanation of selection or
prompt-building machinery. Coaching still has its own evidence/focus context.

`direction.rs` owns the closed configuration and custom-topic validation.
`saved_topics.rs` owns local persistence, borrowing the command transaction.
`StartConversation` captures configuration and admits a partner opening or a real
learner message atomically. A partner opening has a system-only request and creates
no learner message or assessment evidence. A learner-first start requires actual
input provenance; selecting a topic or tense does not mark it scaffold-assisted.
The dispatcher validates these two request shapes separately.

Lesson generation, review, practice handoff, quiz credit, commands, contracts,
components and lesson-only styling are removed. Shared compact coaching/reading
controls now have component-owned styles. Coaching, evidence, conversation rewards,
speech and execution diagnostics remain. The subsequent user-approved cleanup
also removes mystery personas, discovery XP, hidden-field UI, commands and storage.

The development database schema is **23**. Older databases require the existing
explicit reset flow; no migration or silent application-data deletion was added.

## Verification

- Complete native library suite: **391 passed, 1 ignored**, including local mock
  HTTP transports. The ignored test is the existing live-provider test.
- Regression coverage verifies preview/captured-prompt equality, partner openings
  without learner evidence, cancellation, admission rollback, real-message input,
  atomic saved-topic/settings edits and replay, every language variety, all named
  difficulties, persona omission, Unicode custom topics and closed YAML parsing.
- UI interaction coverage verifies independent topic/time/difficulty selection,
  no automatic generation, Form/YAML synchronization, invalid-YAML preservation,
  staged saves/deletes, Cancel and failed Apply behavior.
- Full frontend suite: **118 files / 744 tests passed** with two workers. The final
  changed-file rerun passed **40 tests**, including two added regression cases for
  first-message configuration capture and retaining staged changes after failed Apply.
- Production frontend build passed (the existing large-bundle warning remains).
- Seven interface locales / 973 messages, style/token checks and current documentation
  link checks passed. Final native Clippy (`--lib --tests -- -D warnings`), Rust
  formatting, generated-contract freshness and whitespace checks passed. Content
  inspection loaded all 12 languages. The final opening-flow rerun passed all five
  tests after grouping the optional learner message and input evidence together.

Initial checks encountered sandbox-blocked loopback fixtures and frontend test
timeouts under concurrent compilation. Native tests passed with loopback access;
the frontend rerun uses two workers and a 20-second per-test limit. The existing
persona fixture test also assumed every valid persona had exactly three vibe
symbols; it now checks the declared 2–4 range. The queue-budget fixture fills most
capacity with real multi-operation chat turns before using single-operation coach
turns, retaining the admission/restart/cancellation assertions without creating
hundreds of unnecessary conversations.

No deployment, release, push, or application-data reset was performed. LLM adherence
to the authored difficulty/tense prose still requires live conversation review;
automated tests establish composition and capture behavior, not model quality.

The subsequent [patch readiness audit](patch-readiness-audit-2026-09-18.md)
records unresolved findings for a user decision; passing checks do not mean those
findings have been fixed.
