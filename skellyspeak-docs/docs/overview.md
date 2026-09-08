---
sidebar_position: 2
title: Overview
---

# SkellySpeak — Overview

**SkellySpeak is a multilingual language tutor for desktop and mobile.**
Use Google sign-in for the hosted service, your own provider keys, or your
own AI server. Conversation files stay on your device.

**Status: pre-alpha, in active development.** You’re welcome to try it, but expect
things to break. Hosted login is limited to known parties at this time. Use the
hosted login or enter your own OpenRouter and Groq API keys
(G-R-O-Q, not G-R-O-K) in Settings. The guided-conversation loop is
implemented across the Tauri desktop/mobile codebase. See [Status](./status)
for current capabilities and verification boundaries; the application version
comes from `src-tauri/Cargo.toml`.

Start with the [download page](/download). It detects your operating system,
lets you select or correct the processor, and recommends a matching installer
from the latest published GitHub release. Other formats and installation steps
are on the same page, using FreeMoCap’s compact download rows with collapsible
system help and other platforms. Revisit the page on an Android phone to download
the APK. iPhone testing is limited to known parties at this time and uses the
TestFlight setup described under [Platforms](./platforms#ios).

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
| **Skill tree** | Meaning-domain graph, local language profile, evidence and practice progression. | `src/pages/SkillsPage.tsx` |

Choose the language you are learning from the **Learning** dropdown at the upper right beside your language profile. On Guided conversation, **My native language** is also available at the bottom. Both save automatically and switch to the conversations for that language pair. Changing the learning language resets its regional variety to the default; use Settings to choose another variety. The selectors support desktop and mobile layouts.

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

Settings fold beside the composer; reply ideas expand inside practice cards. Controls use tighter desktop spacing and larger touch targets on touch devices. Level, topic, persona and voice controls live in settings. The persona checkbox, picker, dice and pencil share one row; uncheck the checkbox to disable characterization. The pencil opens the active character’s details. Level, topic and the template preference for future chats remain persisted in device localStorage
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

Partner prompts require every reply, including openings and topic changes, to
offer one easy question, choice, or concrete invitation to respond. At Absolute
zero, a one-word or yes/no answer should be possible. The invitation shares the
existing length and complexity limits; personal detail is shortened to make room.
The learner's subject and lesson context still guide the exchange.

Lesson leads with skill cards and a compact jewel-toned map at the upper-left edge of the lesson panel, in its own row above the controls.
The map starts collapsed; click it to expand the seven-domain overview, then
collapse it again without losing the selected branch. Cards preserve domain identity, with the current practice focus first in its branch. Browsing a domain
does not change the saved practice focus. Selecting a branch highlights and expands its matching card. Cards expand with a level-appropriate explanation, example
and translation from the lesson service. Double-click or the explicit explanation
button opens a dialog showing the skill criterion and reviewed replies from this
conversation, including their credited XP. Escape, Close and backdrop clicks
dismiss the dialog and restore focus.

Recent message reviews and topic explanations sit behind disclosures. Review
failures remain visible even when the reviews are collapsed. Chat and lesson
content retain separate scrolling regions. Topic help uses the selected skill,
language and difficulty; it does not yet use the current conversation transcript.
Credit is derived from saved evidence: repeated wording earns credit once per
skill, and unassisted evidence takes precedence over assisted wording. Edits or
exclusions can reassign or remove credit; the total includes other conversations.

There is no global assist slider. Help is revealed per word and per
sentence, in place:

On mobile, tapping a word keeps Chat visible while showing its gloss. Tap the
surrounding partner message to open Analysis.

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

## Conversation and practice

The practice board starts with the saved or recommended focus and two core skills
with less recorded XP. **All areas** offers one skill per domain; **List/Grid** is a
saved layout preference. Browsing a card or map arm selects that skill across the
application without changing saved focus. A card expands in place; its explicit
detail action or double-click opens the explanation and reviewed replies.

The seven-domain map heads the lesson panel, with branch selectors and star progress. It starts expanded on desktop and collapsed on phones; its toggle can collapse it to a slim row on either layout. Lesson/Analysis tabs sit above the map. Cards follow directly below it; a small card display menu holds All areas and List/Grid. The selected skill moves to the first card, with other cards retaining their relative order. Its arms
and bars fill immediately from credited XP, including assisted practice, up to
30 XP per skill. XP totals continue growing after a bar fills; stars remain a
separate milestone requiring three unassisted successes.
Domain colors identify the same areas in cards, message evidence and Skills.
Selection is a neutral outline. On phones, lesson content follows the conversation
through separate Chat and Lesson views. Chat keeps its messages scrolling above the input and the optional coach-help tray, so help does not overlay the latest exchange. Long messages may still require scrolling. Reply ideas are available directly above the input as well as in lesson cards. The permanent XP/focus strip is removed; the profile button opens progress on demand. Headers compact further when typing on a short mobile viewport.
Coach Enter sends, Shift+Enter adds a newline, and composition Enter does not send.

Explanations load only when disclosed. The card and detail share an
in-flight request and bounded cache, scoped to settings/language pair, chat, level
and topic. Retry refreshes every mounted subscriber. These are general skill hints,
not claims about the latest sentence. Reply ideas, frames and starters come from
the partner reply's analysis; they are general conversation options. Inserting help
appends to the current draft and records assistance without sending automatically.

Word help offers its gloss and an explicit **Explain this word** action. Credited
words also offer **XP details**. Punctuation can reveal a sentence translation;
each message has its own full-translation button once that data arrives. Learner
translations begin hidden; partner auto-translation can be collapsed locally.
**Analysis** is a separate message action. On phones it opens a dismissible message dialog over the conversation; Close, tapping outside, Escape, or Back returns to the same chat position. Desktop analysis stays in the learning panel. Audio and translation controls do not
navigate. Learner and partner token reveals have separate identities.

Credited phrases carry domain-colored underlines. Overlapping domains share an
underline; repeated wording is marked at each possible occurrence and explained as
ambiguous. XP details retain all quotes for a skill with one stored-credit total.
New-credit badges show only the net increase: an assisted-to-direct replacement can
show +8 while the record has 10 XP. Animations use visible anchors inside the active
conversation, account for clipping, and stop moving when the layout scrolls or
resizes. Reduced motion uses a static badge. History never replays as new rewards.

Feedback, XP and skill details use the same dialog host; word help uses the same
layer lifecycle. Outside click, Escape and the overlay back stack dismiss them.
Changing surfaces closes transient learner overlays. Understanding/grammar feedback
describes the message separately from skill XP. Editing retains a collapsible copy
of the original feedback until the edit is sent or cancelled.

**Preferences & coach memory** discloses lesson choices, observations and learner
memory. Changing topic keeps the conversation and gets new suggestions from the
new reply. **+** starts a separate chat while retaining the current one in history.
Record/Stop and Send stay in place during voice capture; Discard appears alongside.
Stop transcribes to the draft unless Auto-send voice is enabled.

## Skills and language profile

**My language profile** opens a summary of XP, stars and focus. **Skill tree** starts
with expandable domain cards. **Map** opens the graph with horizontal, radial and
top-down layouts, breadcrumbs, Back and Whole tree. Horizontal direction follows
the application. All skills, including extensions, are reachable from domain cards,
related skills and Inspect. A selection opens the shared detail beside the map or
cards; **Open full details** opens a dialog. Exploration keeps the conversation
mounted, preserving draft and position. Only **Practise this in conversation** saves
a new focus; **Follow recommendations** releases it.

The shared catalog covers entities/reference, properties/comparison,
events/participants, time/event structure, space/movement,
negation/questions/possibility and connections between ideas. New learner messages
receive independent background assessments through the existing provider routing.
Distinct successful wording earns 10 XP per skill without recorded in-app help,
or 2 XP with suggestions, scaffolds or revision. Three unassisted successes earn
a star. External assistance is unknown. These milestones are not certified
proficiency and never change conversation difficulty.

Only current saved source versions and current-catalog judgments contribute.
Editing, deleting, truncating or excluding attempts recomputes totals. Excluded,
superseded, pending, failed and historical evidence remains explicitly classified;
it cannot display current credit through a different UI filter. Source records,
exclusion/restore controls, assessment activity and old-rubric evidence remain
available through disclosure. Progress is separate per target language and shared
across native-language contexts. Browser Skills uses clearly labeled sample data;
the native app does not substitute sample data on a failed load.

Skill assessment prompts require native-language explanations of the quoted
construction, linguistic function and specific criterion. A topic paraphrase is
insufficient. Existing saved explanations are not rewritten. Semantic calibration
across languages and uncertain-phrase coaching markers remain separate planned
work; missing XP is never treated as proof of a mistake.

## Personas and voice

Persona backstory guides manner and stays mostly unspoken. Built-in sketches
include formative books; existing chats retain their saved sketch. Prompts ask for
natural conversational openings within the current difficulty and lesson choices,
and distinguish partner identity from learner identity. These instructions do not
guarantee every generated reply's quality.

Saved personas have stable cloud voice casts. Custom personas are cast by ID;
explicit age, gender and manner guide delivery. **Cloud voice without a persona**
applies only to no-persona chats. OS voices are selected by target language and
stable identity; their metadata does not reliably describe age or gender. Audio
cache ownership includes settings scope, language pair, chat, requested voice and
text. Changing settings or leaving conversation cancels current playback.

## AI inspection

The **AI** panel exposes the live execution graph, recorded and running calls,
timing, models and responses. Prompts, attempts and provenance are available through
the request reader. **How it works** provides context; **Debug** discloses controls,
logs and comparisons. Reply streaming and independently hydrated analysis, skill
review and coach work retain their existing Rust owners. Topic explanations are
tracked requests; cloud speech uses its specialized audio path and playback status,
not identical Runner telemetry.

## Factory reset

Settings → **Clear all data…** requires typing `DELETE` and choosing **Erase all data
and close**. Reopening completes removal of local conversations, lesson/coach
memory, evidence, progress, settings, credentials, app-managed logs/caches and
webview preferences. **Reset settings** only resets preferences. Cloud accounts,
billing/usage records and external exports remain. Factory reset cannot be undone.

The conversation partner continues the existing exchange after its opening, without repeating greetings or introductions on ordinary replies or practice preference changes.

New XP flags pop above visible credited wording, shrink into the visible matching map arm, and brighten both that arm and its branch progress bar on arrival. Branch XP totals and thicker bars update as soon as credit arrives, before the animation completes. With the map collapsed, flags fade at the phrase; offscreen evidence is announced without an invented animation origin. Reduced motion keeps the flag stationary.

Inline activity indicators distinguish reply generation, pending reply analysis, skill review, and voice transcription. Analysis stays marked while its data is pending even after reply streaming finishes. Transcription is indicated beside the composer and disables a second recording until it completes. The large, red-outlined **Record** button fills red and reads **Stop** while recording. The same compact indicators are used on phones; reduced motion retains labels without spinning.

Credited phrases have skill-colored +N superscripts. Unopened markers get a three-second grace period, then fade on the next scroll or click elsewhere. Clicking one opens its XP card and removes the marker for the mounted conversation; it does not award XP again. Reading or scrolling inside an XP explanation does not dismiss markers. The card grows from its evidence into a floating position at the top of the conversation, above the composer. Selecting another score opens it while the previous card departs. Tapping outside, Close, Escape, or Back sends the card into its visible skill arm; both the arm and branch bar flash on arrival. A compact skill indicator provides a visible destination when the map is collapsed or offscreen. Reduced motion switches states without travel. Clicking the underlined phrase opens its saved XP explanation even after its marker disappears. Uncredited word taps retain their gloss; credited words retain word help through long press. Active reply, analysis, and transcription status also appears beside the composer so it stays visible when the relevant message is scrolled away.

Tagged iOS releases automatically upload their verified IPA to App Store Connect once upload credentials are configured. Internal TestFlight groups can distribute processed builds automatically; external beta review is separate. See [TestFlight setup](./platforms#automatic-testflight-uploads).

The right-aligned **Coach** button shares the composer settings row. Background suggestions include a short explanation, translation, reply choices, romanization for non-Latin text, and expandable approximate phonetic pronunciation. Opening the tray makes no model request; advice appears as its background pass completes. Selecting a phrase inserts only its target-language text. The private coach chat stays in Lesson.

The Coach tray’s refresh button requests different advice using the previous advice and recent conversation as context. Existing advice stays visible while loading; a successful refresh replaces and saves it. Opening the tray still makes no request.

The composer header shows a compact summary of language, level, topic, voice/reading toggles, and playback speed on the left. Click the summary to expand settings; its left disclosure arrow shows whether they are open. Coach sits on the right with its own disclosure arrow. Small Translate and Analysis buttons follow the message text inline. An active persona appears after the language as “Persona: name”; no persona entry appears when disabled. The summary stays within two lines, with full setting names and a horizontally scrollable status line on narrow screens. Persona controls remain inside the expandable settings; a pencil opens persona details and the Custom persona option opens the editor. Persona choices label current and new conversations in parentheses.
