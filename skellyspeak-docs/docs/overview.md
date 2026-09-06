---
sidebar_position: 2
title: Overview
---

# SkellySpeak — Overview

**SkellySpeak is a multilingual language tutor for desktop and mobile.**
Use Google sign-in for the hosted service, your own provider keys, or your
own AI server. Conversation files stay on your device.

**Status: working proof of concept.** The guided-conversation loop is
implemented across the Tauri desktop/mobile codebase. See [Status](./status)
for current capabilities and verification boundaries; the application version
comes from `src-tauri/Cargo.toml`.

For local macOS UI automation, run the app in dev mode and use
`npm run macos:dev-bundle` to package its executable for Computer Use.
See [macOS development bundle](./platforms#macos-development-bundle) for launch
and rebuild instructions.

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
| **Guided** | The conversation: streamed tutor reply + a right-hand panel with Lesson and Analysis tabs (per-word glosses, POS, romanization, explainer cards, reply scaffolds), tap-to-reveal glossing in the bubbles, voice in/out, learner-visible teaching plan. | `src/pages/GuidedPage.tsx` |
| **Stories** | Level-matched short stories (beginner / intermediate / advanced) with tap-to-translate word glosses. | `src/pages/StoriesPage.tsx` |

## Lesson and conversation setup

The Lesson tab is the default right panel. It shows the current learning goal,
conversation setup, explicit preferences, inferred observations, learner memory,
and a history of explicit changes. Scores beside each learner message open its
full coach feedback, with **Ask the coach** and **Edit & try again** actions.
Editing an older attempt asks before discarding later turns.

The private coach conversation stays beneath Lesson and Analysis. Explicit
requests change the goal, preferences, or correction budget for the next reply.
Unsolicited suggestions appear as proposals with an **Apply suggestion** action.
Learner choices are stored separately from inferred memory so background
observation cannot overwrite them. The same choices apply across conversations
in the current language pair. Memory corrections are explicit preferences that
take priority over the inferred profile; the original inference remains visible.

Suggestions and settings each have a compact heading directly above their content, with independent, persistent collapse toggles beside the chat composer. Controls use tighter desktop spacing and larger touch targets on touch devices. Level, topic, persona and voice controls live in settings. The persona checkbox, picker, dice and gear share one row; uncheck the checkbox to disable characterization. The gear opens the active character’s details. Level, topic and the template preference for future chats remain persisted in device localStorage
(`skellyspeak_level`, `skellyspeak_topic`, `skellyspeak_persona`). Each chat separately saves its character sketch and first introduction in Rust-owned `partner.json`. The picker shows that saved partner, including surprise selections, independently of the future-chat preference. Change level, topic and partner through these controls;
coach requests do not silently change their selector values.

| Control | Values | What it does |
|---|---|---|
| **Level** | Absolute zero (PRE-A1) · Beginner (A2) · Intermediate (B1) · Advanced (C1) | Replies and suggestions share explicit vocabulary, grammar and length guidance. Absolute zero requests at most two short sentences and ten words total. Coach and observer receive the selected practice level separately from inferred ability. Length checks are diagnostics, not a CEFR guarantee. |
| **Topic** | 16 presets + free text + shuffle | Its own section of the reply prompt, above private staging notes and phrased as a requirement rather than a hint. Mechanics, scaffolds, and the coach receive it as a `TOPIC STEERING` directive. |
| **Persona** | No persona + Surprise me + built-ins + anything the learner writes, served from the core by `list_personas` | Which person the learner is talking to (`src-tauri/src/personas.rs`). *Surprise me* is resolved once when the chat is created and saved with it. Changing it starts another conversation; the previous chat remains available. The ⚙ beside the picker opens the persona panel. |

Lesson choices open in a centered, dismissible editor and save automatically as you type. Closing waits for pending changes to save; errors keep the editor and unsaved text open. The coach conversation has a distinct background beneath the lesson and analysis.

Choose **No persona** or switch personas **Off** for conversation without a fictional character. Switch **On** to use Surprise me, or reroll to choose a different partner. Changing these controls starts a new conversation and preserves the previous chat.

#### The persona panel

`src/components/PersonaModal.tsx`, opened from the ⚙ beside the picker. The top shows **this chat’s saved character and first introduction**, the identity reference included in every reply prompt. Below it, the library lists reusable templates and their full descriptions. Editing a template affects future chats; it cannot change someone you are already talking to. Older chats recover their earliest saved introduction and explicitly show that the original template is unknown. Contradictory transcript entries are preserved, while the earliest introduction supplies the identity reference for future replies.

Built-ins are readable but never editable — *Duplicate & edit* forks one into
an unsaved copy — so there is always a working set to get back to. Custom
personas live in `<config>/personas.json` and survive restarts; a file that
cannot be read remains intact and blocks edits until repaired.

The core validates every write (`personas::validate`), not just the editor:
`personas.json` is a file a person can open. A description under 60 characters
is refused with the reason — vague adjectives are exactly what produced the
bland partner this replaces. The cap is 1200, because the sketch is sent on
**every turn**.

Deleting a template leaves existing chats and their saved character snapshots intact. A future-chat preference naming a deleted template produces an explicit error; choose another template to start a chat.

Changing the level or topic fires a **steering turn**: the partner acknowledges the
new setting and re-opens the conversation with a fitting question, and the
scaffolds are regenerated by `src-tauri/src/commands/scaffolds.rs`. The greeting is itself a
steered message, so the first turn already respects level and topic.

### Help is on-demand, not dialed

There is no global assist slider. Help is revealed per word and per
sentence, in place:

| Gesture | Result |
|---|---|
| Tap a token | Its gloss (+ romanization for non-Latin scripts) appears through `src/components/GlossPopup.tsx` |
| Tap a punctuation token | That sentence's translation |
| Drag / press-and-hold across tokens | Reveals a run of glosses |
| Double-click / right-click a token | Full word-insight card (lemma, POS, form, role in this sentence, usage) |
| Reveal-all toggle on a bubble | Every gloss in that bubble at once |

This applies to **both** the tutor's words and the learner's own words —
your messages are tokenized and translated too. Scaffolds (replies, frames,
starters) are always generated and always offered in the composer; the
learner picks the level of crutch they want per turn rather than declaring
it up front.

## The agent architecture in one paragraph

Every turn triggers up to four kinds of model work through the selected hosted,
cloud, or custom provider route. The agents do not talk to each other directly:

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
- [Platforms & Build](./platforms) — desktop and mobile build, signing, and update paths.
- [The Coach](./coach) — the sidebar tutor: a second, private conversation that grades and corrects you.
- [Observability](./observability) — the agent ontology, and the app rendering its own inner workings for developer and learner alike.
- [Future Work](./future-work) — the mechanical analysis layer (dictionaries instead of LLMs) and the language ladder.

Changing the topic keeps the chat and asks the partner to open the new subject without treating its previous reply as learner input. Suggestions come from that new reply’s analysis, rather than a parallel request using the old exchange.

The coach conversation starts as a compact dock with its message box visible. Drag its top border to resize it, or use the heading toggle to collapse the thread while keeping the composer available. Its height and collapsed state persist on this device across reloads. The divider also supports the Up/Down arrow keys and Enter.

Collapsed Suggestions shows up to two compact reply badges (one on narrow screens). Tap a badge to send the full suggestion; expand the section for all replies, frames and starters.

The **AI** panel opens directly on the live pipeline. A compact strip shows recorded and running model calls; select a call or graph node for its timing, model, response preview, and expandable prompts and raw responses. **How it works** explains the context; **Debug** expands execution controls, logs and the advanced comparison workspace without replacing the main graph. Filter retained activity by chat and exchange. The full-height request reader shows captured inputs, every attempt, effective parameters and prompt-block comparisons. Traces survive restarts within local retention limits and can be exported for an audit; see [Observability](./observability).

Selected graph nodes have a labeled outline and highlighted connections, synchronized with the selected call. Execution states include text labels. Shared text colors and keyboard focus indicators support readable dark and light surfaces.

Mobile keeps the interactive graph with a readable starting zoom, pan/zoom controls and a navigation map. Node details open over the graph with a dedicated close control.

The voice composer keeps Record/Stop and Send in the same positions while recording. **Discard** appears to their left. Stop transcribes into the draft, or sends the transcription when **Auto-send voice** is enabled.

Use **+** in the conversation header to start a new chat directly; the previous conversation remains in history.

Reply instructions explicitly separate the partner's identity from the learner's.
The saved introduction is labeled as an assistant message; the partner is told
to use a learner name only after the learner identifies themselves. The AI
request reader exposes this as the `participants` prompt block. These are model
instructions, not a guarantee that every generated reply follows them.

The lesson panel leads with the actual goal or suggested practice topics, each
with a short explanation, target-language example and translation. Compact
**Try an example** and **Why this?** links prepare a coach question without
sending it. **Preferences & coach memory** groups correction settings,
preferences, observations, learner memory and change history behind one disclosure.
Topic notes load through a read-only model call at the selected practice level;
errors are shown with Retry. Notes are held while the topic view remains mounted.

When retrying a message, the original attempt's corrections and coach remark
stay available in a collapsible, scrollable reference above the composer,
including during voice recording. The conversation remains accessible and the
full feedback modal is still available. Sending or cancelling the edit removes
the reference.
