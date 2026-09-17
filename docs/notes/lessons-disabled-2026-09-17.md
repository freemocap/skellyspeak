# Lessons temporarily disabled

Implemented decision, 2026-09-17: focus the active product on conversation,
coaching and skill XP while lesson design is frozen.

- Removed the mounted lesson workspace, lesson launcher and lesson recap from chat.
- Requests to navigate to Learn return to chat. Coaching stays accessible.
- Native lesson commands reject explicitly before creating work or granting quiz XP.
- New conversations and revisions do not capture active lesson context or lesson exposure.
- Lesson choices and saved lessons are omitted from the active conversation snapshot.
- Queued lesson generation, reviews, lesson questions and lesson handoffs are cancelled
  at dispatch/command boundaries; late completions cannot publish lesson results.
- Lesson-only XP rows are hidden. Existing stored lessons and earned rewards are retained.

The native `learning::lessons::ENABLED` switch is false. Re-enabling lessons requires
an intentional product change, restored UI entry points and re-running the retained
lesson lifecycle suites; those suites describe the suspended feature and are explicitly
marked ignored while it is disabled. The disablement tests remain active.

Verification: TypeScript check and the focused navigation/coaching UI tests pass
(17 tests). Both native disablement tests pass and cover rejected commands and cancellation without
blocking chat. This does not establish live voice verification of the broader coaching refactor.
