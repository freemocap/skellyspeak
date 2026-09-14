# Explicit lessons — implementation and verification

Date: 2026-09-14

## Source implementation

- New-chat and coach entry points open a lesson chooser with practical, grammar and language-background categories, contextual/topic
  suggestions, a custom topic field and saved conversation-owned lessons.
- Suggestions reuse the native starter catalog and its localized labels, current
  difficulty, focus and contact matching, with a due-skill option when eligible.
  A selected choice carries its native construct/function and situation guidance
  into generation; custom topics do not claim catalog provenance.
- A validated lesson contains one focused objective, explanation, exactly
  two examples, translations, optional romanization/pronunciation, an optional
  exercise, private feedback guidance and a concrete chat task. Each also contains
  two validated multiple-choice questions with three distinct options and explanations.
- Quiz answers are graded locally, persisted once and award 1 XP correct or 0 wrong.
  Repeated submissions cannot multiply credit. The quiz is optional; it has no pass
  threshold and never blocks chat. Bonus XP is included in language/conversation
  totals through a separate ledger, without skill credit or proficiency evidence.
- Lesson questions and optional exercise attempts use the private coach thread.
  **Try it in chat** creates a real assistant-only contact turn and returns mobile
  users to Chat. Reopening a lesson does not regenerate or repeat the handoff.
- The existing scheduler handles lesson generation and task review with durable
  attempts, provider accounting, pause, failure and explicit retry. A completed
  recap needs exact learner quotes; private coach text and contact text cannot
  serve as learner evidence. End/replacement cancels outstanding reviews.
- Opening a lesson marks the next learner send as assisted. Active lesson practice
  marks its learner sends as assisted until it ends. The accepted turn retains
  contributing lesson IDs. Lesson reading and private exercise attempts create no
  proficiency or XP evidence.
- Saved content survives restart and exchange revision. Dependent coach questions
  and practice follow the chat revision rule; unavailable/revised recap evidence
  suppresses the recap. Deleting a conversation deletes its lessons. Storage uses
  existing turn context, so no schema bump, reset or migration was required.
- Updated the active design, coaching plan/work plan/contracts, surface inventory,
  README and bibliography. Added UI text for all seven installed locales.

## Automated verification

Passed before the Reading-category follow-up:

- `npm run build` (including language validation: 7 locales, 732 messages each).
- `npm test`: 613 tests, 98 files.
- `npm run styles:check`.
- `npm run contracts:check`.
- `npm run ios:check` and `npm run ios:test`: 2 tests.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --tests -- -D warnings`.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib --quiet`: 337 passed,
  1 existing ignored test. The initial sandbox run could not open loopback test
  servers; the authorized run outside the sandbox passed.
- `git diff --check`.

Twelve native lesson tests cover persistence/idempotency, rejected generation and
explicit retry, assistant-only handoff, stale settings/ownership, quoted evidence,
late completion after ending, full review publication/replay/revision, preserving
lessons across earlier edits, conversation deletion, bounded exposure accounting,
selected-choice provenance, category capture, quiz validation and durable once-only grading. Seven frontend lesson tests cover chooser generation,
custom-input failure, saved content and optional handoff, exposure before first
reveal, private questions with retained drafts on rejection, category choice and quiz feedback.
A statistics regression checks bonus XP reconciliation, conversation scope, absence
of invented evidence and rejection of duplicate quiz credits.

Vite continues to report its existing large JavaScript chunk advisory; the build
succeeds. These are fixture-based checks, not live-provider language-quality tests.

## Remaining verification

The Mac remained locked on the category/quiz visual-check attempt (and the earlier lesson checks). Visual inspection and native
app interaction could not run; no screenshot or device-layout correctness is
claimed. The user was asked to unlock it while automated work continued.

After unlocking, inspect the new-chat chooser and mid-chat coach access at desktop
and narrow widths, keyboard focus/backdrop dismissal, enlarged text, Arabic RTL,
and light/dark contrast. Exercise a live generated lesson at Absolute zero,
Beginner and a higher level in representative languages; inspect correctness,
length, contact handoff, private feedback and the completion recap. Verify
romanization/pronunciation against the selected variety and reading preferences.
No live provider lesson was generated in this task.

No commits, version changes, pushes or deployments were performed. Pre-existing
uncommitted language/localization work was preserved.

## Reading category follow-up

Added Reading with Letters and sounds, Reading words, Pronunciation and stress,
and custom topics. Prompt `lesson-3` explicitly uses the captured Native language
for sound/spelling comparisons and articulatory guidance; no assumed English or
Latin literacy. The existing optional quiz and chat practice apply. Added a UI
category/custom-topic regression and native prompt checks for French and Arabic
speakers learning Spanish. Running-app/provider review remains pending.

Reading follow-up verification: build and all 614 frontend tests pass; all 13 native
lesson tests pass, including captured Native language checks. Generated contracts,
style checks, Clippy with warnings denied and diff whitespace checks pass. The
previous full native suite result above predates this follow-up; no visual or
live-provider validation is claimed.
