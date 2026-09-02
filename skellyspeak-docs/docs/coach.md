---
sidebar_position: 8
title: The Coach
---

# The Coach — a second conversation on your shoulder

Status: **bite 1 SHIPPED** (per-message auto-feedback, Coach tab) and
**bite 3 SHIPPED** — the coach is now an interactive thread: ask it questions
directly from the Coach pane; the thread persists to `coach_thread.json`
(40-message cap, corrupt-file protection) and is **private forever** — the
native-speaker agent never sees it (Cyrano principle). The Analysis pane has
its own Q&A input (session-scoped, auto-context from the pinned turn).

## The Cyrano principle

The learner has one conversation with a native-speaker agent (existing), and
a *parallel, private* conversation with a coach agent (new). The coach sees
everything, explains everything, and never talks to the native agent. The
learner chooses whether to use a correction — the native agent just sees
gradually-better Spanish. **The illusion stays intact:** the coach never
feeds the reply agent anything.

## The two agents

| | Native-speaker agent | Coach agent |
|---|---|---|
| Language | target only, always | **predominantly native** — the pane is the learner's refuge from the target-language conversation; target language appears only in quoted corrections and example phrases. A remark that reads like more target-language practice is a prompt-level failure. |
| Job | conversation partner | make the learner operate above their level |
| Sees | the chat (learner + its own replies) | the chat + learner profile + teaching plan + its own coaching history |
| Never | breaks character, learns the coach exists | talks to the native agent |

## Coach output (per learner message)

Schema-constrained (`CoachFeedback`):

| Field | Meaning |
|---|---|
| `remark` | 1–3 warm sentences to the learner; mostly native language, target-language phrases where instructive. Answers questions the learner embedded in their message ("how do I say X in past tense?"). |
| `used_target` / `used_native` | verbatim language-split of the learner's message — mid-message switching is expected and handled inline, no separate detection call |
| `corrections[]` | 0–3: `said` (verbatim) → `corrected` (fluent version) → `explanation` (native language) + `kind` (grammar/vocab/word-choice/spelling/other) |
| `comprehensibility` | 1–5: would a native speaker understand the message? (1 baffling · 3 with effort · 5 effortless) |
| `grammar` | 1–5: grammatical correctness, same scale |

Scores are **honest** — a 5 must be earned. A perfect message gets zero
corrections and a remark that says so. Explanations in the learner's native
language; corrected phrases in the target.

## Call flow (per turn)

1. **Reply worker** (streamed) — unchanged, never sees the coach.
2. **Coach pass** — skipped on greeting turns; runs alongside analysis.
3. **Analysis ×4** — unchanged (dictionary migration per
   [Future Work](./future-work) will shrink this).
4. **Observer** — keeps long-horizon planning; its error-tracking duty is
   superseded: coach corrections feed `plan.recurring_errors` **mechanically
   (no LLM)**. Observer may later shrink into a session-summary mode of the
   coach.

Model: the worker model (currently gemini-2.5-flash) — error detection in
learner-Spanish is the one task where a smarter model may earn its keep;
assignable in Settings as the agent roster evolves.

## UI

The breakdown panel grows tabs: **Coach** (default) and **Analysis**
(word-by-word + mechanics, kept). The coach tab shows the latest learner
message's feedback — remark, score meters, correction cards, language-split
chips — plus visible errors when the coach call fails (fail loudly).
Interactive coach thread (learner asks the coach questions directly from the
tab) is bite 3.

## Agent roster (future)

The app now runs four AI roles with different profiles — fast/cheap
workers, a reasoning observer, a judgment coach. Expected evolution: an
explicit agent-registry (role → model/prompt/limits) instead of hardcoded
defaults, so roles can be re-assigned per device tier and cost preference.
`settings.rs` defaults + the bench harness are the embryonic version.

## Bites

1. ✅ Coach pass + `CoachFeedback` + Coach tab (per-message auto-feedback).
2. Coach corrections → `plan.recurring_errors` (mechanical feed).
3. Interactive coach thread (own input + history, streamed replies).
4. Observer slim-down / merge into coach session-summary mode.
