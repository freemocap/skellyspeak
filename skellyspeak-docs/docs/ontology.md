---
sidebar_position: 4
title: Ontology
---

# Domain model

The persisted entities are settings, language pairings, conversations, tutor
memory, custom personas and the private coach thread. Model-call traces describe
execution. Type definitions live in Rust and `src/types.ts`; the graph is built
from `src-tauri/src/ontology.rs` and `turn_plan.rs`.

## Settings

Public preferences live in `settings.json`: provider mode/model, language pair,
dialect, microphone selection, automatic speech/send behavior, display choices,
voice engine/name/rate and keyboard shortcuts. Keys and hosted session tokens
live in the native credential vault. IPC masks provider keys and omits the
session token and installation ID.

Provider modes are `hosted`, `cloud` and `custom`. Hosted mode uses Google
sign-in and the metered proxy. Cloud mode uses the user's OpenRouter key. Custom
mode sends chat to the configured OpenAI-compatible server; speech services have
separate endpoints. Routing lives in `Settings`, not in individual UI controls.

## Language pairing and conversation

A pairing identifies target and native languages. Dialect is a preference within
the pairing. Each pairing has a current-chat pointer and several independently
saved conversations. A conversation has an ID, ordered turns, a title and update
time. Soft deletion adds a timestamp and excludes it from the active list.

The frontend owns the stored turn shape and saves settled turns. A turn contains
the learner message, the assistant reply and its analysis: tokens, translations,
mechanics, scaffolds and errors. Streaming text and active playback are transient
UI state. Late events carry conversation ownership and cannot update another
chat.

## Tutor memory

`TeachingPlan` describes immediate practice focus, recurring errors, vocabulary
to recycle, interests, correction budget and a taught ledger. `Profile` holds
longer-term learner notes, strengths, weaknesses, interests and error patterns.
Both have validated size bounds and persist together in `memory.json` per pairing.

The observer updates those documents after the first learner turn and every
fourth learner turn thereafter, without overlapping another observer pass.
Observations advise the partner; they do not override the learner's chosen
language, level or current topic.

## Persona and coach

A persona has an ID, label and character sketch. Built-ins cannot be edited;
custom personas are validated and stored in `personas.json`. Selection is stable
within a conversation, including the deterministic surprise selection.

The coach's feedback and interactive thread are private to the learner. The
partner does not receive that thread. Each chat's `coach.json` retains up to
40 messages. Interactive questions are single-flight; context changes invalidate
late answers.

## Operation and run

An operation is a declared task such as replying, tokenizing, explaining,
suggesting, coaching or reflecting. `turn_plan.rs` describes expected dependencies
and UI emissions. The Rust guided command executes the work.

A run records one operation's model, timing, attempts, result and reported usage.
Retry usage is summed across attempts. Missing provider usage cannot be inferred
from a successful reply; the hosted reservation ledger retains unverified cost.
Trace reconciliation compares observed operations/timing against the declaration.

## Hosted account and reservation

A hosted account has a verified Google identity, revocation version and daily
allowance. A reservation identifies one admitted provider request, its UTC date,
reserved cost, settlement state and provider generation ID. Token/request counts
are reporting fields; money controls admission. See [Hosted API](./hosted-api)
for settlement and retention rules.
