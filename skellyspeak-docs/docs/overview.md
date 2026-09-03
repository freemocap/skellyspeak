---
sidebar_position: 2
title: Overview
---

# SkellySpeak — Overview

**SkellySpeak is a standalone, no-login, multilingual language tutor.** A desktop
(Tauri v2) app today, with mobile ambitions. No accounts, no server, no
database: everything is local except the AI calls, which go to OpenRouter
(chat) and Groq (speech-to-text) with keys the user supplies themselves.

**Status: working Proof of Concept (v0.1.0).** The guided-conversation loop is
end-to-end functional on Windows desktop and on Android (debug APK sideloads
and runs). See [Status](./status) for the full inventory.

## The product idea

You talk to a tutor in the language you're learning. The tutor talks back in
that language — always — and adjusts how much help it gives you with a single
dial. Behind the scenes, a slow "observer" model watches the conversation and
keeps two small documents (a session **Teaching Plan** and a cross-session
**Profile**) that steer the fast tutor model: what to practice, which errors
to gently recast, what not to re-teach.



## The two surfaces

| Surface | What it is | Where |
|---|---|---|
| **Guided** | The conversation: streamed tutor reply + a right-hand panel with Coach and Analysis tabs (per-word glosses, POS, romanization, explainer cards, reply scaffolds), tap-to-reveal glossing in the bubbles, voice in/out, learner-visible teaching plan. | `src/pages/GuidedPage.tsx` |
| **Stories** | Level-matched short stories (beginner / intermediate / advanced) with tap-to-translate word glosses. | `src/pages/StoriesPage.tsx` |

## The steer row (the core UX primitive)

Two controls above the composer, persisted in `localStorage`
(`skellyspeak_level`, `skellyspeak_topic`), defined in `hooks/useSteering.ts`:

| Control | Values | What it does |
|---|---|---|
| **Level** | Absolute zero (PRE-A1) · Beginner (A2) · Intermediate (B1) · Advanced (C1) | Maps to the CEFR string injected into **every** prompt (`commands/guided/mod.rs::guided_turn`). PRE-A1 additionally switches `persona_block` into true-beginner survival mode. |
| **Topic** | 16 presets + free text + shuffle | Appended to the reply/mechanics/scaffolds directives as `TOPIC STEERING`, and surfaced to the coach. |

Changing either one fires a **steering turn**: the partner acknowledges the
new setting and re-opens the conversation with a fitting question, and the
scaffolds are regenerated (`generate_scaffolds`). The greeting is itself a
steered message, so the first turn already respects level and topic.

### Help is on-demand, not dialed

There is no global assist slider. Help is revealed per word and per
sentence, in place:

| Gesture | Result |
|---|---|
| Tap a token | Its gloss (+ romanization for non-Latin scripts) pops in a `GlossPopup` |
| Tap a punctuation token | That sentence's translation |
| Drag / press-and-hold across tokens | Reveals a run of glosses |
| Double-click / right-click a token | Full `word_insight` card (lemma, POS, form, role in this sentence, usage) |
| Reveal-all toggle on a bubble | Every gloss in that bubble at once |

This applies to **both** the tutor's words and the learner's own words —
your messages are tokenized and translated too. Scaffolds (replies, frames,
starters) are always generated and always offered in the composer; the
learner picks the level of crutch they want per turn rather than declaring
it up front.

## The agent architecture in one paragraph

Every turn triggers up to four kinds of LLM work, all OpenRouter
(OpenAI-compatible), none talking to each other directly:

1. **Reply worker** (fast, reasoning disabled, streamed) — writes the actual
   tutor reply. The turn resolves as soon as it finishes.
2. **Five analysis workers** (parallel one-shots, reasoning disabled) —
   tokenize + gloss the reply, translate it, tokenize + translate the
   *learner's* message, write 1–2 grammar mechanic cards, and build the
   next-turn scaffolds. Delivered asynchronously; per-section degradation
   (a failed sub-call costs its section only).
3. **Coach** (parallel one-shot, skipped on greeting turns) — the private
   Cyrano side-channel: grades comprehensibility + grammar, offers 0–3
   corrections, and answers questions the learner embedded in their message.
   Never seen by the reply worker. See [The Coach](./coach).
4. **Observer** (reasoning model, background, never overlaps itself) —
   rewrites the TeachingPlan and Profile from the transcript. Learner-visible
   via the "Plan" drawer.

Full detail in [Architecture](./architecture); the data contracts are nailed
down in [Ontology](./ontology).




## Document map

- [Architecture](./architecture) — components, IPC surface, turn pipeline, agent roles, persistence.
- [Ontology](./ontology) — every domain entity, field-by-field, with lifecycle and ownership.
- [Status](./status) — what works, what's partial, what's missing, tech-debt inventory.
- [Platforms & Build](./platforms) — desktop today; the concrete path to Android/iOS.
- [The Coach](./coach) — the sidebar tutor: a second, private conversation that grades and corrects you.
- [Observability](./observability) — the agent ontology, and the app rendering its own inner workings for developer and learner alike.
- [Future Work](./future-work) — the mechanical analysis layer (dictionaries instead of LLMs) and the language ladder.
