# Lesson module split

Status: implemented, 2026-09-15. Fourth original file in the size-review backlog.

Replaced the 1,437-line learning/lessons.rs with lessons/:

- types.rs: lesson categories, plans, quiz records, evidence, recaps and requests.
- repository.rs: saved lesson projections, ownership lookup and exposure tracking.
- lifecycle.rs: request checks, generation, lesson controls and choice selection.
- quiz.rs: grading and saved quiz-credit lookup.
- prompts.rs: output schemas, lesson/review prompts, source selection and coach context.
- results.rs: prose/evidence validation and publication of plans or completed recaps.
- mod.rs: the lesson interface and common validation error helper.
- tests/: shared fixtures and generation, lifecycle, review, quiz and prompt suites.

There are 14 files; the largest is lifecycle.rs at 263 lines. Related helpers stay
together instead of creating a file for each function. Size bands remain guidance.

## Preservation

All 45 functions and 13 tests remain. Function comparison found no changes beyond
whitespace, trailing commas and visibility. Public lesson types retain their
serialized definitions. Existing cross-module callers still use the lesson
interface; the exposure predicate is now an internal repository helper, also
available to the existing tests. Review-source selection and evidence checks are
shared across prompt/result modules with lesson-scoped visibility.

No changes to lesson prompts, quiz credit, durable turn ownership, revision/deletion
handling, SQL, schemas or transaction ownership. The content index now links
directly to prompt construction and result validation.

## Verification

- Clippy with warnings denied passed.
- Existing function/test inventories preserved.
- Current documentation links passed.
- Full native suite: 354 passed, 1 ignored, no failures.
- Generated-contract check, desktop build and all 18 UI architecture tests passed.
- Rust formatting and diff whitespace checks passed.

Updated AGENTS.md, the native guide and size inventory. No manual app launch,
mobile build, live provider call, commit, push or deployment was performed.
Next candidate by current line count: UI conversation.css (1,052 lines).
