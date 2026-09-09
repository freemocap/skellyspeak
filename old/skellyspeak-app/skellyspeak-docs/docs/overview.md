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

Settings → Updates shows the installed app version above the update controls, without requiring an update check.

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

Choose the language you are learning from the language dropdown at the upper left of the chat, which displays the currently selected language. **Native** sits beside the learning language in the chat header. Both save automatically and switch to the conversations for that language pair. Changing the learning language resets its regional variety to the default; use Settings to choose another variety. The selectors support desktop and mobile layouts.

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

Settings fold beside the composer; reply ideas expand inside practice cards. Controls use tighter desktop spacing and larger touch targets on touch devices. Level, topic, persona and voice controls live in settings. The persona checkbox, picker, dice and pencil share one row; uncheck the checkbox to disable characterization. The pencil opens the active character’s details. Practice level belongs to the persistent conversation, stored by Rust in `practice.json`. Each conversation starts at Beginner and saves its own selection. Reopening it restores that difficulty; another conversation in the same language has an independent setting. The controls wait for conversation settings to load or save, and failures are visible. Topic and the template preference for future chats are stored in device localStorage
(`skellyspeak_topic`, `skellyspeak_persona`). Each chat separately saves its character sketch and first introduction in Rust-owned `partner.json`. The picker shows that saved partner, including surprise selections, independently of the future-chat preference. Change level, topic and partner through these controls;
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
   Cyrano side-channel: grades conversational fit + grammar, offers 0–3
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
each message has its own full-translation button once that data arrives. The Translation preference shows both learner and partner translations inline; either can be toggled locally.
**Analysis** is a separate message action. On phones it opens a dismissible message dialog over the conversation; Close, tapping outside, Escape, or Back returns to the same chat position. Desktop analysis stays in the learning panel. Audio and translation controls do not
navigate. Learner and partner token reveals have separate identities.

Credited phrases carry domain-colored underlines. Overlapping domains share an
underline; repeated wording is marked at each possible occurrence and explained as
ambiguous. XP details retain all quotes for a skill with one stored-credit total.
New-credit badges show only the net increase: an assisted-to-direct replacement can
show +8 while the record has 10 XP. Animations use visible anchors inside the active
conversation and account for clipping. Floating cards remain within the visible
viewport. Reduced motion removes card travel. History never replays as new rewards.

Feedback, XP and skill details use the same dialog host; word help uses the same
layer lifecycle. Outside click, Escape and the overlay back stack dismiss them.
Changing surfaces closes transient learner overlays. Conversational-fit/grammar feedback
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
text. Changing settings or leaving the conversation cancels current playback. Hiding, minimizing, backgrounding, or closing the app also stops cloud and OS speech. Returning does not resume an interrupted utterance; a new playback request is required. Delayed speech results cannot restart playback after departure.

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

New XP cards appear when new credit reaches the profile, including credit that arrives after its review completes. Cards use visible evidence anchors when available and remain bounded by the visible viewport, even when the keyboard or composer crowds the message stream. Their animations do not control when XP is saved.

Inline activity indicators distinguish reply generation, pending reply analysis, skill review, and voice transcription. Analysis stays marked while its data is pending even after reply streaming finishes. Transcription is indicated beside the composer and disables a second recording until it completes. The large, red-outlined **Record** button fills red and reads **Stop** while recording. The same compact indicators are used on phones; reduced motion retains labels without spinning.

Credited phrases have skill-colored +N point tokens. Clicking a token pops it away and opens its saved XP card without awarding XP again. Each opened card replaces the previous inspection. It dismisses after four seconds of inactivity, pauses while hovered or keyboard-focused, and closes on outside interaction. Tap the underlined phrase to restore its tokens for another inspection; word help remains available.

Tagged iOS releases automatically upload their verified IPA to App Store Connect once upload credentials are configured. Internal TestFlight groups can distribute processed builds automatically; external beta review is separate. See [TestFlight setup](./platforms#automatic-testflight-uploads).

The **Coach** section sits above the input. Suggestions stay visible with preloaded word annotations; there is no collapsed preview or Coach header row. The tray leads with compact suggested replies and their meanings. Tap the trailing **↗** icon to insert a reply without sending or requesting analysis; the words retain their inspection gestures. Translation follows the chat preference; romanization and pronunciation render under individual words using the same token component as chat, with no sentence-level sound-guide block. **Understand the exchange** below the suggestions reveals explanation and the partner’s translation, without repeating the partner’s message. Advice appears as its background pass completes; displaying suggestions prepares missing word annotations. The private coach chat stays in Lesson.

Suggestions update with the conversation. The compact **Understand the exchange** disclosure has no refresh control.

Chat settings open from the **⚙** beside the language controls at the top of the chat. The compact panel starts closed and contains level, topic, persona, reading and voice controls. Close it with the gear, Escape, or a tap outside; changing a preference saves it immediately. Coach remains above the input, separate from settings. Compact Translate and Analysis buttons on each message toggle inline translation or open message analysis.

On phones, **Chat** and **Lesson** are the persistent bottom navigation. Chat is the starting view; Lesson contains the private coach conversation. The **More (•••)** menu opens Skill Tree and AI activity/tools. Either bottom button returns directly from Skill Tree without losing the conversation. AI tools open in a dismissible dialog. The app reserves space for status bars and display cutouts.

Desktop development builds keep credentials and app data in a separate `.dev`
profile. They require their own sign-in or API keys and do not install release
updates. Custom remote model servers require HTTPS; HTTP is allowed only for
loopback servers such as local Ollama or LM Studio.

**Pronunciation** joins Read aloud, Auto-send, Translation, and Romanization in the reading controls. Tapping a chat word reveals its meaning underneath that word, with romanization for non-Latin scripts. Approximate pronunciation appears only while Pronunciation is enabled; revealing meanings does not enable sound guides. There is no separate sentence pronunciation block or label in chat. Coach advice leads with suggested replies and meanings; pronunciation follows its setting and exchange explanations expand on demand. Phone controls wrap into compact rows. Word pronunciation is generated by the existing token analysis pass; older saved tokens without it still show their available information.

Swipe left from Chat to Lesson and right to return; the bottom buttons provide the same navigation. On phones, Fast-mode rewards take a short curved flight straight to the XP meter without the header hover. Inspected cards open near their source text and dismiss along the same short path. The meter flashes and fills when the card arrives, showing saved cumulative XP even when Lesson is off-screen. This is a presentation of existing credit, not an additional award. Reduced-motion settings disable the flight and fill motion.

Signing in or out refreshes the app’s provider settings immediately. Closing Settings saves pending edits before refreshing the chat’s settings. Stale provider-setup errors clear, and an empty chat retries its blocked greeting; existing messages and drafts stay in place. A failed retry displays its current error.

New XP cards appear automatically in a stack as credit arrives. **Fast mode** is on by default: cards arrive about half a second apart with slight timing variation, ease into view, on desktop pause for half a second, then accelerate toward progress without pausing the conversation or subsequent rewards. Turn it off in the chat controls or Settings to keep cards until dismissed. Point icons reopen a card for reading and hold it open even in Fast mode. Existing history does not replay arrival animations.

Moving XP cards have thin, empty white rectangular outlines tracing their past and upcoming positions. The outlines shrink and fade with distance, share the card’s path and easing, and never intercept clicks. Reduced motion disables both the travel and the trails.

Chat playback sits on the upper-right bubble edge. Translate and Analysis use short buttons at the bottom-right border, mirrored for RTL messages. Translate toggles the same inline translation used by the global preference; Analysis opens a dialog. Word inspection and chat-originated coach questions also open overlays without navigating away. Top-bar actions stay grouped together.

Android update offers open [the download page](https://docs.freemocap.org/skellyspeak/download). Installer titles name their format, including Windows EXE setup and MSI package. One matching installer for the selected system has a magenta border. Processor hints select the matching architecture automatically when available. If the browser does not expose the processor, all builds for that operating system are shown with processor labels and selection guidance, without a recommendation. If the operating system is unknown, all available packages are shown. A known processor filters out the other architecture; all packages also remain under All platforms & formats.

Click or tap outside a modal to dismiss it. Settings flushes pending edits when it closes; the lesson editor saves before dismissing. Clicking within a modal keeps it open.

The profile button shows XP for the selected target language and opens a practice-evidence dashboard: exact domain totals on a common bar scale, credited skills, stars, distinct contributing messages, and assisted/unassisted skill demonstrations. Filter by domain and open a skill to inspect the source text, model rationale, timestamp, and assessment provenance. Definitions and record-status counts are available inside the dashboard. These are descriptive, model-assessed app records—not validated proficiency, independent trials, or mastery estimates. Progress is keyed by target language; changing the native language does not transfer credit to another target language.

**Fluent**, above Advanced, is a normal difficulty setting using C2-style language. It shares the same conversation, coaching, evaluation, annotation, length-diagnostic, and XP pipeline as every other level. The choice requests fluent expression; it is not a measured CEFR certification. At every difficulty, the learner chooses the subject: complex historical or political topics remain available within provider safeguards, with simpler expression at lower levels rather than topic refusal. Prompt policies cannot guarantee an external model’s behavior.

The SkellySpeak logo and app name are a home button: select them to return to Chat without losing the conversation. The profile has global retained-activity counts above tabs for every supported language. Global XP is explicitly the sum of separate language accounts; each language tab retains its own XP, evidence, and milestones, including an empty state for unpracticed languages.

Reply prompts explicitly continue the prior exchange, including the opening message, preserve speaker facts, and avoid repeating greetings or questions the learner has already answered. This is a model instruction, not a guarantee of conversational quality.

A small emoji on each reviewed partner reply opens its interpretation and reaction, with an edit-and-resend action. The conversation partner self-reports confusion (🤔?), understanding (🙂), curiosity (🧐), surprise (😮), or concern (😟); confusion takes priority. This runs after the streamed reply using the same partner model and context, adding one background model request per learner message. The coach independently grades grammar and conversational fit (1–5), not understanding. Neither output is a validated proficiency measure. Historical understanding grades are never relabeled as conversational fit.

Speech playback is restricted to the active app window. Browser focus/visibility/page lifecycle and native window focus/close/mobile suspension events cancel active audio and block new background playback. Android pause and iOS resign-active events use Tauri’s suspension notification. Returning enables new playback without resuming cancelled speech. On desktop, the window close button and system close shortcuts close the window after playback cleanup.

**Play reward sounds** in Voice settings offers Yes, No, and Follow TTS (the default, following Read aloud). Brief, quiet synthesized coin tones accompany new XP cards; larger gains use higher, richer patterns at the same volume. XP-icon clicks use a more noticeable rising two-note bubble sound. New confused or understood reactions use short question-like or rising cues. Each sound briefly highlights its visible source. Sound is capped during bursts, never replays historical rewards automatically, and stops when muted or the app becomes inactive. Browser audio requires a user gesture; touch release enables reward audio on iOS, and subsequent gestures resume interrupted audio without replaying stopped rewards. These are interface cues, not claims about learning outcomes. The partner-interpretation dialog shows the referenced exchange with the same learner/partner bubble styling as Chat.

On phones, swipe left from Chat to Lesson and right from Lesson to Chat, including across lesson cards. Taps still operate the cards, vertical gestures scroll, and text inputs and dedicated horizontal scrollers retain their own gestures.

Settings → **Reading & display** separates reading aids from voice controls. **Text size** (75–150%) and **Text spacing** (0–12px of extra space between words) save independently. The default extra word spacing is 2px. Mobile settings use compact, collapsible sections; search also finds controls in closed sections.

Reading text in lessons, corrections, analysis and skill evidence uses the shared interactive word presentation. Coach suggestions preserve word inspection and use a trailing **↗** insertion icon. Tap for an inline meaning; hold or right-click for deeper word insight. Text without saved token annotations prepares complete word annotations when mounted, using the chat tokenization prompt and schema through the configured provider. Ordinary taps reveal prepared meanings without a model call. Saved phrase translations in Coach, lessons and analysis appear when Translation is enabled. Suggestion activation never requests word analysis.

The compact green suggestion tray starts directly with reply bubbles above the input. Only **Understand the exchange** expands; there is no separate Coach label, toggle or header spacer.

The +N tokens have faint circular borders and a brief, subtle floating highlight; hover and keyboard focus strengthen the cue. Dismissing a token preserves its inline space. Evidence underlines belong to the word itself so Spanish and Arabic text keep their baseline when tokens disappear. Reduced-motion preferences disable the floating invitation.

Partner messages use warm-white bubbles with darker olive borders and a left-facing corner; learner messages use blue fills, blue borders and a right-facing corner. Grammar/conversation feedback sits on the learner bubble’s lower edge beside Translate. Chat renders punctuation and whitespace from the saved message, preventing duplicate punctuation in token annotations from adding characters; Spanish opening ¡ and ¿ are preserved. XP token clicks use a soft rising pop, controlled by the existing reward-sound preference. Playback checks the visible token circle and continues after the clicked token disappears.

Audio & Voice settings provide Overall volume, Voice volume, and Sound effects volume (0–100%). Overall volume scales both channels; the two channel sliders set their relative levels. Sound effects can be switched off without changing their saved volume, or restricted to when Read aloud is enabled. Voice volume applies to both cloud and OS speech. Existing installations start at 100% on all three controls, preserving their current playback levels.

Settings reports missing or invalid audio fields and blocks editing incomplete preferences. Error messages identify the failed contract without assuming its cause.
