---
sidebar_position: 7.5
title: Coaching plan
---

# SkellySpeak coaching plan

[Reading view](pathname:///coaching-plan.html) · [Work plan](./coaching-work-plan) · [Contracts](./coaching-contracts)

How language knowledge, the learner model, coaching, progress, the game layer and new-chat starts fit together, mapped onto the app as it currently exists on disk.

Status: **approved design plan, not implemented.** Execution is organised in the [coaching work plan](./coaching-work-plan) and the seams between agents in [coaching contracts](./coaching-contracts). Repo facts were checked on 2026-09-12 against the working tree. **Naming:** the conversation partner is called a *contact* in the UI and a *persona* in code (`persona_reply`, `persona_system`, `persona_word_gloss`); this plan says "partner" for the concept. Citations are listed at the end under their keys, e.g. `[lyster_saito2010]`. Items marked *needs review* are expert judgement or were checked only through abstracts.

---

## 1. What we're building

**SkellySpeak is a convivial tool for learning to speak with people in another language.**

Ivan Illich called a tool *convivial* when it enlarges what its user can do on their own terms. It serves the person's own purposes, it can be understood and reshaped by the person using it, and it doesn't make them dependent on the tool's owner. The opposite is the industrial tool, which past a certain point starts shaping its users around its own needs. `[illich1973]`

Most of the software that competes for people's attention is industrial in exactly that sense. It studies human reward systems and aims them at time-on-app, spending and data. **We're taking the same toolkit (reward, anticipation, sound, motion, the pull of "one more") and putting it in the learner's hands, aimed at their own growth.** That's the heart of the project, and it's worth being excited about.

### The three teachers behind the design

| Source | The idea | What it becomes in SkellySpeak |
|---|---|---|
| **Paulo Freire**, *Pedagogy of the Oppressed* `[freire1970]` | Reject the **"banking" model**, where knowledge is deposited into passive students. Instead, **problem-posing dialogue** built on the learner's own **generative themes**, with teacher and student learning from each other. | The core activity is **dialogue**, not drills. New chats start from **what the learner wants to talk about** (section 10). The coach **poses problems and hints** before it gives answers (section 6.4). The partner is a person to talk with, not an examiner. |
| **bell hooks**, *Teaching to Transgress* `[hooks1994]` | **Engaged pedagogy**: education as a practice of freedom, which treats the learner as a whole person and insists that **excitement belongs in learning**. | **Delight is legitimate.** The game layer's sound, motion and celebration are how we honour that excitement (section 11). Feedback addresses the work, never shames the person. Low-pressure starts and a private coach make it safe to speak up. |
| **Ivan Illich**, *Tools for Conviviality* `[illich1973]` | Tools should increase autonomy and creativity and stay under their users' control. Beware **radical monopoly** and the point where a tool starts working against its purpose. | The learner **owns and can read everything**: local-first data, a learner model that shows its evidence, progress that exports as YAML, language and rule configs anyone can read and edit, their own AI route or key. No lock-in, no dark patterns, and the app is fine with you putting it down. |

### What that means in practice

The learner's main activity is **talking with conversation partners**. Around those conversations sit:

- a **language layer** that tells every prompt how the target language works (script, romanization, structure), written as readable config anyone can extend,
- a **coach** that is a fellow investigator rather than an authority: it notices, poses problems, offers graduated help, and suggests where to start next,
- a **learner model** that turns observations into progress the learner can inspect and question,
- a **game layer** that makes effort feel good: truthful, evidence-caused rewards with real juice, working for the learner's growth rather than against their attention.

Everything the app knows about languages, skills, feedback rules and game rules is **schema-defined, YAML-hydrated and loaded at startup**. A learner's own progress exports as YAML in the same shapes. Every rule points back to its evidence in `references.bib`.

### The conviviality check

Every feature is checked against five questions before it ships:

1. **Whose purpose does it serve?** The learner's growth, not engagement metrics.
2. **Can the learner see how it works?** Rules are readable, and rewards name their cause.
3. **Can the learner change it?** Settings, intensity, goals and config are theirs.
4. **Does it build independence?** Help fades as skill grows; the support lens measures exactly that.
5. **Can they leave freely?** Nothing punishes stopping, and their data goes with them.

## 2. Where the repo stands

Checked against disk this session; the agent's latest verification agrees.

| Area | State on disk | Consequence |
|---|---|---|
| Ownership | Rust owns durable records, validation and projections. React stores are thin zustand projections (`src/state/session.ts`, `settings.ts`, `navigation.ts`, `skill-evidence.ts`). Typed `Action`s go through `model.rs`; turns are operation graphs from `turn_plan.rs`. | New features are **Rust actions + operations + snapshot fields**. React only renders and holds drafts. |
| Data model | `DATA-MODEL.md` already names `LanguageProfile` (explicit practice focus), `SkillObservation`, `AssessmentExclusion`, `ProficiencyAssessment`, `PartnerReaction`, `ExpressionHelp`, and `ConversationSettings` with **coach proactivity**. | This plan fills in those named records instead of inventing parallel ones. |
| Languages | Compiled `CONFIGS` table in `languages.rs`. The romanization label is never sent to prompts; generic "standard romanization" at `adapter.rs:320` and `coaching.rs:146`; Arabic-specific rule inside the generic coach prompt at `coaching.rs:144`. | Section 4. |
| Skill catalog | One `catalog.json` embedded at `coaching.rs:93`; `catalog_version: 4` hardcoded at `progression.rs:34,107` with no v4 file; codes `6.1–6.3` sit under three parents; dead `catalog-v1/v2.json` in `src/assets`. | Section 5. |
| Coach contract | `{correctness 1–5, understandability 1–5, explanation, correction, evidence[3 outcomes]}`; TS declares 5 outcomes; the whole catalog is sent every call. | Section 6. |
| Focus loop | `active_focus` is computed and displayed but never reaches the partner or coach prompts. | Section 7. |
| Edit & retry | **Five dead links**: `onEditUser={undefined}` (`GuidedPage.tsx`, ~line 541); `requestTurn` rejects `replacesMessageId` ("This action is not connected yet.", ~line 276); `editingTurnId` is only ever set to null, so `revision` is always false; `progression.rs:34` hardcodes `replaces_message_id: null`; the `skill-rewards.ts:12` filter therefore never fires. `TurnView.test.tsx` mocks the missing handler, so it passes anyway. | Section 8. |
| Schema | One `schema.sql` at `user_version=11`; `store.rs` `SCHEMA_VERSION` opens only that version (no upgrade path; fresh data). `operations UNIQUE(turn_id, kind)`, `messages UNIQUE(turn_id, role)`, one pending turn per conversation, no parent link on `turns`. | A revision is a **new turn** with `replaces_turn_id`; the schema moves to **v12**. |
| New chat | An empty stream shows "Say hello to start the conversation." (`GuidedPage.tsx:491`). `BUILD-PLAN.md:419` defers partner-initiated openings: it needs a real partner-start operation, **never a fabricated learner message**. | Section 10. |
| Fluency data | Timing is **requested away**: `access.rs:443` asks for `response_format: "json"` and reads only `text`; the hosted server allows only `json` (`audio_input.py:55`). Groq `whisper-large-v3` supports `verbose_json` with word and segment timestamps at no extra cost. Raw PCM is already in Rust (`audio.rs`). A real sample confirmed both sources (see §5.1). | Fluency lens is **buildable now** (§5.1). |
| `؟` | Missing from `TERMINAL_PUNCT` in `sentences.ts:6`. | Fix in phase 1a. |

## 3. Principles

1. **The model observes and the code decides.** LLM output is candidate data. Versioned policy code decides what to show, credit and reward. This is already the rule in `DATA-MODEL.md` ("A model does not directly write XP…"). `[llm_validity2026]`
2. **Help goes from implicit to explicit.** Ask for self-repair before giving the answer; the amount of help needed is itself the measurement. `[lyster_ranta1997] [lyster_saito2010] [aljaafreh_lantolf1994]`
3. **Feedback is about the task, the process or self-regulation, never about the person.** This matches the AGENTS.md ban on saccharine copy. `[hattie_timperley2007] [kluger_denisi1996]`
4. **Rewards are earned, truthful and juicy.** Pair effort with a felt reward, caused by real evidence and never punishing stopping; no leaderboards, engagement badges or loss-framed streaks. `[deci_koestner_ryan1999] [schultz1998] [kao_juiciness] [zagal2013]`
5. **Support autonomy, competence and relatedness.** `[ryan_rigby_przybylski2006] [sdt_andragogy]`
6. **Keep the pressure low so the learner keeps talking.** Private coach, learner-set correction intensity, easy ways into a conversation. `[dornyei_macintyre_wtc]`
7. **A self-regulation cycle each session**: plan → talk → review. `[zimmerman_srl] [locke_latham2002]`
8. **An open learner model.** Every number traces back to quotes. `[bull_kay_olm]`
9. **Fail loudly.** Unknown references, unmapped evidence and load failures surface in the UI (CLAUDE.md).
10. **Everything is cited.** Every rule, construct and prompt claim points at a key in `references.bib` (section 12).

## 4. Language layer (`LANGUAGE-CONFIG.md`)

Settled in earlier rounds; summarized here.

```
config/languages/
  scripts.yaml          ISO 15924: direction, cursive, shaping, case, word_spacing, font_scale
  orthographies.yaml    script + conventions (arabic-unvocalized, zh-hans)
  romanizations.yaml    one entry per published table: ala-lc-arabic, din-31635, pinyin
                        rules + several hard-case examples on the scheme itself
  traits.yaml           reusable structure modules, scoped notes, UD features
                        (root-pattern-morphology, broken-plurals, diglossia, classifiers, tones…)
  families.yaml         metadata only; no prose inheritance
  languages/ar.yaml     identity, scripts, orthography, schemes[default], traits[ordered], varieties
  universal.yaml        rules for every language ("quote learner text exactly")
```

**Resolution:** universal → traits (in list order) → language → variety, filtered by **scope**. The scopes are `target_writing`, `explanation_writing`, `segmentation`, `reading`, `romanization`, `assessment` and `pragmatics`. Scalar values resolve leaf-wins.

- The Arabic rule currently at `coaching.rs:144` moves to the `abjad-vowel-omission` trait and `universal.yaml`.
- The resolved `LanguageContext` is captured per turn and **hashed**. The hash goes into provenance, so manual template bumps are no longer needed.
- **Hotfix first:** a scheme registry, injection into `adapter.rs` and `coaching.rs`, and a guard test. This ships before the YAML loader exists.

## 5. Constructs and the skill map (`SKILL-MAP.md`)

One registry of trackable things, each tagged with a lens. The practical groupings and the functional/typological domains become **two navigation views over the same constructs**.

| Lens | Question | Grounding | Data source today |
|---|---|---|---|
| `function` | What did they do with language? | ACTFL FACT "F", CEFR activities incl. mediation `[actfl2024] [cefr2020]` | coach observation |
| `form` | Which constructions, and how accurate? | CAF, criterial features `[housen_kuiken2009] [egp2017]` | coach observation |
| `interaction` | Turn-taking, repair, topic management | Interactional competence `[galaczi_taylor2018]` | coach + `messages.created_at/sequence` |
| `pragmatics` | Register, politeness, speech-act fit | L2 pragmatics `[taguchi_pragmatics]`; Arabic register `[younes2015]` | coach observation |
| `support` | How much help was needed | Dynamic assessment `[aljaafreh_lantolf1994]` | `InputEvidence` + ladder step |
| `fluency` | Speed, pausing, self-repair | CAF `[housen_kuiken2009]` | local silence detection + Whisper word timestamps (§5.1) |

### 5.1 Fluency data: two sources, cross-checked

Tested on a real 30 s Spanish recording (`whisper-sample.json` fixture): local `silencedetect` at −35 dB / 0.25 s, compared with Groq `verbose_json` word timestamps.

| Finding | Evidence | Rule |
|---|---|---|
| Word times line up with local speech regions to within ~0.1 s | "Hola, ¿cómo estás?" 10.62–11.90 (Whisper) vs 10.64–11.95 (local) | Whisper words give *what*; local audio gives *exactly when* |
| Word ends stretch across pauses and can overlap the next word | "tal?" 17.08–**19.92** spans a 2.6 s silence and overlaps the next word at 19.52 | Clip every word to the local speech region it falls in; **pause lengths come from local audio only** |
| Invented text during silence | "Gracias." at 30.14–30.52, after the audio ends (30.23 s), `no_speech_prob` 0.75, no local speech after 24.8 s | A word with no overlapping local speech is **dropped from the message and shown to the learner** ("Removed 'Gracias.' — no speech detected"), never silently. Matches Whisper's known silence-triggered hallucinations `[koenecke2024]` |
| `avg_logprob` is the same for every segment in a 30 s window | segments 0–3 all −0.573 | Treat it as per-recording confidence, not per-word |
| Learner word order preserved | "¿Qué tú haces hoy?" kept as spoken | Good for coaching; transcripts are not normalized |

**Stored per learner message** (metadata only; no audio retained): speech regions, pause list (start, duration, position relative to words), clipped word times, words removed as hallucinated, `no_speech_prob`, `avg_logprob`, noise floor. The silence threshold adapts to each recording's noise floor rather than a fixed −35 dB.

**Measures:** speech rate (syllables per second of speaking time), mean length of run, pause count and length (mid-clause vs between clauses), response latency (partner reply to first speech, which also feeds the interaction lens). Fillers and restarts are *not* reliable from Whisper, since it tends to clean them up; that stays an open item.

**Work:** app requests `verbose_json` + both timestamp granularities and parses them with strict types; server `audio_input.py` accepts those fields; local silence detection in `audio.rs`; alignment, clipping and hallucination gate in Rust; custom endpoints declare whether they return timings, and the profile shows "no timing data" when they don't.

```yaml
# config/constructs/form.ar.yaml
- id: ar.idafa
  lens: form
  language: ar
  label: Possessive construct (iḍāfa)
  criterion: Joins possessed + possessor nouns, article only on the possessor.
  band: A2                       # display mapping only (CEFR 2020 incl. plus-levels)
  requires: [ar.definite_article, ar.noun_gender]   # teachability [pienemann_pt]
  ud_features: ["Definite=Cons"]
  traits: [construct-state]
  nav: { practical: describing_things, functional: reference }
  opportunity: Talk about whose things are whose — family, belongings, places.
  evidence_basis: expert         # corpus | framework | expert
  review: needs_review
  sources: [ud, ryding2005]
```

- **`opportunity`** is new this round. It's a one-line description of situations that naturally require the construct. The partner uses it to create practice moments, and the new-chat starters use it to pick topics (section 10).
- **Versioning:** the construct registry is hashed. Evidence stores the construct id plus the registry hash, and the learner state is recomputed on change. Unmapped evidence is shown in the UI, never dropped. This replaces the phantom `catalog_version: 4` and the silent filter at `message-evidence.ts:9`.

## 6. Coach contract

### 6.1 Operations (extend `turn_plan.rs` `COACH_PLAN`)

| Operation | Trigger | Input layers | Output | Notes |
|---|---|---|---|---|
| `coach_feedback` | learner turn | L0–L5 | `CoachObservation` | replaces today's `Feedback` |
| `coach_retry_check` | revision turn | previous item + move shown | `{repaired, items[]}` | new |
| `coach_suggestions` | partner reply | L2 target_writing, L3 band/focus | replies + tokens | exists; add focus |
| `coach_openers` | conversation created | L2, L3, contact latent interests | `OpenerSet` | new, section 10 |
| `session_review` | learner request / leaving | session evidence | ≤3 process-level notes | new |

### 6.2 Prompt layers

```
L0 role        prompts/layers/role.<task>.md
L1 universal   config/languages/universal.yaml (scoped)
L2 language    resolved LanguageContext for this task's scopes
L3 learner     band range per lens, active focus + reason, ≤3 due constructs, intensity
L4 task        instructions + candidate constructs (15–25) + JSON Schema
L5 data        conversation slice + learner text (JSON, untrusted)
```

**Candidate constructs** (replaces sending the whole catalog as `skillCriteria`): the focus and its prerequisites, the due constructs, band ±1 constructs whose traits or UD features match the learner text's tokens, plus all `function` and `interaction` constructs. The output schema's `construct` enum is exactly this list.

### 6.3 Types (Rust owns; `ts-rs` exports to `contracts.ts`; `schemars` for YAML)

```rust
pub struct CoachObservation {
    pub meaning_recovered: MeaningLevel,      // Full | Partial | None
    pub items: Vec<ObservedItem>,             // ≤ 6
}
pub struct ObservedItem {
    pub construct: String,                    // ∈ candidates
    pub quote: String,                        // exact substring
    pub outcome: Outcome,                     // Demonstrated | Partial | NotDemonstrated | Uncertain
    pub error: Option<ErrorTag>,
    pub rationale: String,
}
pub struct ErrorTag {
    pub op: Op,                               // Missing | Replace | Unnecessary   [errant2017]
    pub category: String,                     // UD feature or POS
    pub source: ErrorSource,                  // Transfer | Developmental | Slip | Unknown
    pub blocks_meaning: bool,
    pub target_hypothesis: String,            // hidden until policy allows
    pub hint: String,                         // cue without the answer
}
pub struct CoachDecision {                    // deterministic, from policy + state
    pub shown: Option<Correction>,
    pub retry_invited: bool,
    pub observations: Vec<SkillObservation>,  // DATA-MODEL record
}
```

- `correctness` and `understandability` are removed. Accuracy comes per construct from the `form` lens; `meaning_recovered` drives the partner's clarification move.
- `Uncertain` means **no update**. Absence of an item means no update.
- Each turn records `candidates_sent` and `items_returned`, so under-reporting by the model is measurable.

### 6.4 Feedback policy (`config/policy/feedback.yaml`)

```yaml
max_corrections_per_turn: 1
correct_only: focus_and_meaning_blocking
skip_sources: [developmental, slip]
ladder: [partner_clarify, hint, elicit, metalinguistic, explicit]
intensity:            # maps to ConversationSettings "coach proactivity"
  light:    { start_at: hint,   max_revisions: 1, show_logged: false }
  standard: { start_at: hint,   max_revisions: 2, show_logged: true  }
  thorough: { start_at: elicit, max_revisions: 3, show_logged: true  }
never: [praise_the_person, correct_in_partner_voice, block_continuing]
sources: [lyster_ranta1997, lyster_saito2010, aljaafreh_lantolf1994, hattie_timperley2007]
```

## 7. Learner model

- **Source records:** `SkillObservation` rows (append-only, source-referenced). They are durable analysis, as `DATA-MODEL.md` already specifies, not a separate event log.
- **Projection:** `ConstructState {rating, uncertainty, last_seen, half_life, n}` for each (learner, language, variety, construct). It's computed by folding observations through `config/policy/estimator.yaml`. The projection can be thrown away and recomputed; the observations can't.
- **Estimator:** Elo-style, with a support weight (the same success counts for less the more help it needed) and half-life decay for due reviews. `[pelanek2016] [settles_meeder2016]`
- **Bands:** a band range per lens with a confidence value. There is never one overall level. `ProficiencyAssessment` stays scoped and marks insufficient evidence.
- **Focus:** stored on `LanguageProfile`; the source is `learner` or `recommended`, and a reason is always shown. It goes into **L3 for the partner, the coach and the openers**:

```
Practice focus (do not mention or drill): {{label}}.
Create natural moments that need it — {{construct.opportunity}}.
If the learner's last message was not understood, ask one short natural clarification question.
```

- **Export:** `LearnerState` YAML contains the observations, the choices (focus, exclusions, intensity) and the derived state, plus the config hashes it was computed under.

## 8. Edit & retry

### 8.1 Persistence (schema v12)

- `turns.replaces_turn_id` is nullable. **A revision is a new turn.** This keeps `UNIQUE(turn_id, kind)`, `UNIQUE(turn_id, role)` and the one-pending-turn rule meaningful.
- The word `attempt` is already used for transport retries (`attempts` table). Use **`revision`**, which `InputEvidence.revision` already uses.
- `progression.rs` sets `replaces_message_id` from the replaced turn.
- A new native action, `ReviseTurn { turn_id, text, input }`, replaces the rejection in `requestTurn`. Revising the **latest** turn needs no confirmation. Revising an earlier turn removes the later turns under EXECUTION.md's edit rule, after a confirmation.
- The replaced partner reply is kept and shown collapsed as "Earlier version".

### 8.2 Flow

```
send (revision 0) ─► partner_reply (shown at once)
                  └► coach_feedback ─► policy ─► chip on message
chip ─► hint + [Edit & try again] [Show answer] [Keep going]
  Edit ─► composer prefilled, banner ─► send (revision 1, support=hint)
        ├► coach_retry_check ─► repaired → observation(support=hint) + "Fixed" note
        │                     └ not repaired → next ladder rung, up to max_revisions, then explicit
        └► partner_reply regenerated for the revised text
```

### 8.3 Credit

Revisions are **credited, weighted by support step**; they're not excluded. Fixing an error after a hint is the behaviour the research most wants to encourage. `[lyster_ranta1997]` A successful repair is also recorded as `ix.self_repair` on the interaction lens.

**Tests:** replace the `TurnView.test.tsx` mock-only assertion with a GuidedPage integration test that edits, sends and observes `replaces_turn_id`.

## 9. UI surfaces

| Surface | Content | Rules |
|---|---|---|
| **New-chat start** | starter cards, Surprise me, describe-a-topic, free composer | section 10 |
| **Message chip** | ✓ / • one suggestion / ↻ retry available | no numbers on messages |
| **Coach card** | hint, highlighted quote, Edit & try again / Show answer / Keep going, "also noticed" (if intensity allows) | task/process level only |
| **Fixed note** | "Fixed: *kitābu ṭ-ṭālibi*: article only on the second noun." | names the rule |
| **Session review** | table of constructs used (quotes), repairs, open items; ≤3 notes; "set next goal?" | dense, mechanical (AGENTS.md) |
| **Skills / profile** | per lens: construct, rating ± uncertainty, last seen, due, n; click → quotes and revisions; filter by language, variety, partner | open learner model |
| **Seven-domain map / flower** | reads the same `ConstructState` through the `functional` navigation view | a renderer never changes scores (UI-SURFACES.md) |

## 10. New-chat start

### 10.1 Problem

"Say hello to start" gives no way in, especially for an absolute beginner, and it puts pressure on the first move. Lowering that barrier matters for willingness to communicate. `[dornyei_macintyre_wtc]` Offering real choices, including the learner's own topic, supports autonomy. `[ryan_rigby_przybylski2006] [sdt_andragogy]` A short pre-task that frames what the conversation is about is standard task-based practice. *needs review: TBLT pre-task literature (Willis 1996; Ellis 2003) not yet checked this session.*

### 10.2 What the learner sees

A panel replaces the empty-stream note. The composer stays live the whole time.

```
┌──────────────────────────────────────────────────────────────┐
│  Start with Layla · Arabic (MSA) · Beginner                  │
│                                                              │
│  [ Ordering coffee ]      [ Your family ]      [ Weekend plans ] │
│    ☕ أريد قهوة…            practises: iḍāfa     practises: future  │
│    Suggested by coach       From your focus      Due for review   │
│                                                              │
│  [ Surprise me ]  Layla picks a topic; you find out what it is. │
│                                                              │
│  Or describe it:  [ I want to talk about my new job______ ] → │
│                                                              │
│  …or just type below and send.                               │
└──────────────────────────────────────────────────────────────┘
```

- Each card shows a **label in the explanation language**. Below Beginner it also shows a short **target-language preview** with translation, and a **reason line** ("From your focus", "Due for review", "Suggested by coach", "Layla likes football").
- **Surprise me** is always present.
- **Describe it** accepts explanation-language text (recorded as `ExpressionHelp`, not as a target-language demonstration).
- The **composer** works as it does today; sending from it skips the panel.

### 10.3 Where cards come from

**Mechanical cards** are instant and need no inference. The deterministic resolver in Rust picks from `config/starters/*.yaml`:

```yaml
# config/starters/everyday.yaml
- id: ordering_food
  label: Ordering food and drink
  functions: [fn.request, fn.express_preference]
  constructs_any: [form.polite_request, form.quantity]
  bands: [PreA1, A2]                # which difficulty levels it suits
  opener_kind: roleplay             # roleplay | chat | story | question
  partner_brief: >
    You are serving at a café. Greet the learner and ask what they would like.
  sources: [cefr2020]
- id: weekend_plans
  label: Weekend plans
  functions: [fn.plan_future]
  constructs_any: [form.future_reference]
  bands: [A2, B1]
  opener_kind: chat
  partner_brief: Ask what the learner is doing this weekend; share your own plans.
```

Selection is a pure function of `ConversationSettings.difficulty`, the language/variety, `LanguageProfile.focus`, the due constructs and the contact's tags. The rules:

- one card from the focus or a due construct (if any),
- one from the contact's interests,
- one general card for the band,
- no repeats of the last three starters in this relationship.

**Coach card(s):** `coach_openers` is a Fast operation added to the `CreateConversation` plan (creating a conversation is an explicit action, so it complies with the "rendering never generates" rule). Input is L2 + L3 plus the contact's latent interests and recent relationship memories, and recent session-review open items. It adds up to 2 cards to the panel when it completes; the mechanical cards never wait on it. On failure it shows an explicit error and the mechanical cards stay.

```rust
pub struct OpenerSet { pub openers: Vec<Opener> }   // ≤ 2
pub struct Opener {
    pub label: String,              // explanation language
    pub preview: Option<String>,    // target language, ≤ 12 words
    pub construct: Option<String>,  // ∈ candidates
    pub reason: String,             // one line, task-level, no praise
    pub partner_brief: String,      // private to the partner prompt
}
```

**Difficulty shapes everything:**

| Difficulty | Cards | Partner's first turn |
|---|---|---|
| PreA1 / Beginner | concrete roleplays, preview + translation, suggestion tray pre-filled | very short, one question, a yes/no or choice answer is possible |
| Intermediate | chat topics tied to focus/due | open question plus a personal detail |
| Advanced / Fluent | opinion, story, mediation ("explain X to…") | natural, may be indirect |

### 10.4 How the chosen start becomes a conversation (the partner-start operation)

A new native action, `StartConversation { conversation_id, opening }`:

```rust
pub enum Opening {
    Learner,                                   // learner sends first (today's behaviour)
    Starter { starter_id: String },            // mechanical card
    CoachOpener { opener_id: String },         // coach card (saved result)
    Surprise,                                  // partner chooses a topic from contact background
    Described { text: String },                // learner's explanation-language description
}
```

- Every option except `Learner` creates a **partner-first turn**: a turn with **no learner message** and a `persona_opening` operation. The turn records the opening kind and its brief as trusted settings data. **No learner message is ever fabricated** (BUILD-PLAN.md:419).
- `Surprise`: the partner picks a topic from its background and **does not name it**. Discovering the topic is the task. The brief says to keep hints available if the learner asks.
- `Described`: the partner responds to the learner's described topic with an opening question in the target language. The description is saved as `ExpressionHelp` provenance and gets no skill credit.
- The coach produces a **suggestion tray** for the first reply right away (`coach_suggestions`). This is the "prompt them in return" step, which matters most for beginners.
- Starter choice is saved on the conversation (so it isn't repeated) and appears in the session review.

## 11. Game layer (`config/policy/game.yaml`)

### 11.1 Purpose

The game layer exists to **pair effort with a felt reward**, so that working in the language produces a real sense of accomplishment. It uses everything games and mobile apps know about reward, anticipation, sound and motion.

That toolkit usually belongs to industrial software: gambling mechanics, predatory microtransactions, apps built to capture attention. Here the same machinery becomes part of a **convivial tool** `[illich1973]`. It serves the learner's own goals, is open about how it works, and is glad when they close the app having grown. It's also how we take bell hooks' insistence on **excitement in learning** seriously `[hooks1994]`: the joy is real, it's earned, and it belongs to the learner.

### 11.2 What the research supports

| Finding | Design consequence | Source |
|---|---|---|
| Dopamine signals **reward prediction error**: unexpected rewards drive it; fully predictable ones fade | Put rewards where the outcome is genuinely uncertain: did the retry work, did the partner understand, is this a new construction? | `[schultz1998] [schultz_rpe_review]` |
| Uncertainty in learning games raises engagement and arousal | Anticipation beats before reveals; variable timing tied to real events | `[howard_jones_demetriou2009]` |
| Effort is costly but also **adds value** | Reward size grows with effort: less help, harder level and newer construct mean a bigger payoff | `[inzlicht2018]` |
| Informational positive feedback **raises** intrinsic motivation (d≈0.33); expected contingent tangible rewards lower it | Every celebration says what the learner did; nothing pays for showing up | `[deci_koestner_ryan1999]` |
| **Moderate to high** "juice" beats none *and* extreme on motivation, play time and performance | Tuned intensity levels for sound, particles and motion, never maximal | `[kao_juiciness] [hicks_juicy2019]` |
| Challenge and meaningful goals drive gamification effects; points and status alone contribute little | XP drives visible progress (stars, flower, partner milestones), not a leaderboard | `[sailer_homner2020] [hanus_fox2015]` |
| Competence, autonomy and relatedness predict continued play | Discovery and mastery, learner-chosen goals, partner relationships | `[ryan_rigby_przybylski2006]` |
| Dark patterns are defined by designer intent, negative experience, the player's interest and consent | The three rules below | `[zagal2013]` |

### 11.3 The three rules

Every reward must be:

1. **Caused by evidence.** It fires only from a validated `SkillObservation`, a repair, a secured construct, or a learner-chosen goal being met. Nothing fires for time spent, logins or message counts.
2. **Truthful.** The reward names what caused it. There are no fake near-misses, no randomness unrelated to performance, and no inflated amounts.
3. **Never a punishment for stopping.** No loss-framed streaks, no "your partner misses you", no decay presented as loss (decay shows as "due"), no artificial waits or scarcity.

Anything that meets all three rules can be used freely: variable timing, anticipation, escalating celebrations, sound, collection and the "one more conversation" pull.

### 11.4 The loop

```
effort          learner sends something (harder = more)
  ↓
uncertainty     short anticipation beat while the coach analyses (real, not staged)
  ↓
reveal          partner understands · construct discovered · repair confirmed · construct secured
  ↓
payoff          XP scaled by effort × surprise; tiered sound + motion; meter fills (star, flower, partner)
  ↓
anticipation    "2 constructs almost secured" · review due tomorrow · partner's story continues
```

### 11.5 XP (decision resolved)

- **XP is the currency of effort.** It's earned only from evidence events and weighted by support step, difficulty and novelty. It **never decreases**.
- XP fills the visible meters: **domain stars and the flower** (existing `ConversationMap.tsx` behaviour, now evidence-driven) and **partner milestones**.
- Proficiency (`ConstructState`) stays separate and is shown on the profile. XP measures effort invested; ratings measure skill. They're shown side by side and never combined.

### 11.6 `game.yaml`

```yaml
version: 1
sources: [schultz1998, howard_jones_demetriou2009, inzlicht2018, deci_koestner_ryan1999,
          kao_juiciness, sailer_homner2020, zagal2013]
rules: [evidence_caused, truthful, never_punish_stopping]    # enforced by a test over all events below

xp:
  base:                      # per evidence event
    demonstrated: 10
    partial: 4
    repair: 12               # revision fixed an item shown as hint/elicit
  multipliers:
    support: { none: 1.5, partner_clarify: 1.3, hint: 1.2, elicit: 1.0, metalinguistic: 0.8, suggestion: 0.5, explicit: 0.3 }
    difficulty: { pre_a1: 1.0, beginner: 1.0, intermediate: 1.2, advanced: 1.4, fluent: 1.5 }
    novelty: { first_ever: 2.0, first_this_week: 1.2, routine: 1.0 }
  never_from: [time, message_count, login, coach_output]

events:                      # tier sets sound/animation intensity
  construct_discovered: { tier: 3, copy: "First use: {label} · “{quote}”" }
  construct_secured:     { tier: 3, copy: "Secured: {label}" }
  repair:                { tier: 2, copy: "Fixed: “{quote}” — {rule}" }
  partner_understood:    { tier: 1 }            # subtle, after a previously unclear message
  goal_met:              { tier: 2, copy: "Goal met: {goal}" }
  star_filled:           { tier: 3 }
  partner_milestone:     { tier: 2, copy: "{partner}: {n} conversations" }
  xp_tick:               { tier: 0 }            # meter fill only

juice:                       # [kao_juiciness]: moderate/high beats none/extreme
  levels: { quiet: 0, low: 1, standard: 2, high: 3 }   # learner setting; Fast mode = low
  default: standard
  tier_to_effects:
    0: { sound: none,  motion: meter_fill }
    1: { sound: soft_tick, motion: pulse }
    2: { sound: chime, motion: card_rise }
    3: { sound: fanfare_short, motion: card_rise_particles, haptic: light }
  max_tier3_per_minute: 2    # prevents the "extreme" end
  respects: [prefers_reduced_motion, system_mute, quiet_hours]

anticipation:
  analysis_beat_ms: [400, 900]   # only while real work is pending; never added delay
  surfaces: [almost_secured, due_reviews, partner_story_hooks]

consistency:
  kind: weekly_days
  target: learner_set
  grace_days: 2
  messages: factual_only        # "3 of 4 days this week"

excluded: [leaderboards, engagement_badges, loss_framed_streaks, near_miss_effects,
           random_rewards, purchasable_boosts, artificial_waits, push_guilt_notifications,
           person_praise]
```

### 11.7 Copy and AGENTS.md

AGENTS.md bans saccharine encouragement. The delight is carried by **sound and motion**, and the text stays factual ("First use: iḍāfa · *kitābu ṭ-ṭālibi*"). **AGENTS.md should be amended to say that reward presentation (sound, animation, tiers) is required product behaviour, and that the no-saccharine rule applies to text.** Otherwise a later agent could strip the celebrations out as a policy violation.

## 12. Bibliography (`references.bib`)

The research behind this plan is part of the codebase. One BibTeX file at the **repo root** is the single source of truth for every citation in configs, prompts, docs and code.

**Format:** standard BibTeX, so it opens in Zotero or JabRef and works with any citation tool. Every entry carries three custom fields:

```bibtex
@article{lyster_saito2010,
  author  = {Lyster, Roy and Saito, Kazuya},
  title   = {Oral Feedback in Classroom {SLA}: A Meta-Analysis},
  journal = {Studies in Second Language Acquisition},
  year    = {2010}, volume = {32}, number = {2}, pages = {265--302},
  url     = {https://eric.ed.gov/?id=EJ892626},
  review  = {abstract},            % abstract | full-text | reviewed
  claim   = {Prompts produce larger gains than recasts; oral CF effects are durable.},
  used-by = {policy/feedback.yaml; plan §6.4}
}
```

- `review`: how thoroughly the source has been checked. `abstract` means it was read only through abstracts or summaries (most entries now). `full-text` means someone read the paper. `reviewed` means a person confirmed that the specific claim holds.
- `claim`: the one sentence the codebase relies on. It is written down so an auditor can check the claim itself, not only that the paper exists.
- `used-by`: where it is cited (informational; the test below computes the real list).

**Citing it:**

| Where | Syntax |
|---|---|
| YAML (`config/**`) | `sources: [lyster_saito2010, aljaafreh_lantolf1994]` |
| Prompt fragments (`prompts/layers/*.md`) | front-matter `sources:` list |
| Rust / TS comments | `// [@lyster_saito2010]` |
| Markdown docs | `[@lyster_saito2010]` (pandoc-style) |

**Enforcement.** A test runs in the normal suite and fails the build if:

1. A cited key is missing from `references.bib`.
2. A `.bib` entry is missing `url`/`doi`, `review` or `claim`.
3. A config rule marked `review: reviewed` cites a source whose `review` is `abstract`. A rule can't be more trusted than its evidence.
4. There are duplicate keys.

At startup, the config loader resolves every `sources:` key against the bibliography it has loaded. An unknown key is a visible load error, like any other broken reference.

**Keeping it up:**

- Any research pass (by a person or an agent) that informs a decision adds its entries in the same change.
- `AGENTS.md` gains one line: *"Cite research through `references.bib` keys; add entries with `review` and `claim` when research informs a change."*
- A generated `docs/references.md` lists each entry with its `used-by` locations, for reading.

**Seeded:** `references.bib` at the repo root holds the ~55 sources from the planning research, all `review = {abstract}` until someone reads them in full.

## 13. Files and ownership

```
config/                          bundled, startup-loaded, schemars-validated, hashed
  (repo root) references.bib     bibliography; every `sources:` key resolves here (section 12)
  languages/…                    section 4
  constructs/{function,interaction,pragmatics}.yaml, form.<lang>.yaml
  starters/*.yaml                section 10
  policy/{feedback,estimator,game}.yaml
  prompts/layers/*.md, prompts/tasks/*.yaml
schemas/                         generated JSON Schema
src-tauri/src/
  languages/ (loader, resolver) constructs.rs  policy.rs  learner_state.rs  openers.rs
  coaching.rs (contract + decision)  turn_plan.rs (new ops)  store.rs (v9)
src/state/                       zustand projections only: start panel draft, chip/card UI state
src/features/guided/ConversationStart.tsx   CoachCard.tsx   SessionReview.tsx
docs: skellyspeak-docs/docs/ (coaching-plan.md, coaching-work-plan.md, coaching-contracts.md; language-config.md and skill-map.md added as those areas land)
```

Load failure is a blocking, visible startup error (STATE-AND-STORAGE.md). There's no silent default config.

## 14. Build order

Work is split across three domain agents and one integration agent in waves 0–4. See the [coaching work plan](./coaching-work-plan). Summary: wave 0 puts these documents and `references.bib` in place; wave 1 fixes what's broken (romanization, `؟`, 5 outcomes, focus into prompts, edit & retry); wave 2 turns config into YAML and ships the coach contract and new-chat start; wave 3 builds the learner model, fluency lens and game layer; wave 4 measures.

## 15. Decisions (all resolved)

1. **Revision shape:** a new turn plus `turns.replaces_turn_id`, schema v12.
2. **XP:** the evidence-caused currency of effort, driving stars, the flower and partner milestones; proficiency is shown separately (§11.5). Tuning of `game.yaml` numbers and sound/animation assets continues during wave 3.
3. **Surprise me:** the partner reveals the topic **only when the learner asks**; the coach card can offer a hint.
4. **Coach openers:** run only when coach proactivity is standard or higher.
5. **Fluency lens:** built from local silence detection plus Whisper word timestamps (§5.1). Filler and restart detection stays open.
6. **Paid inference:** allowed for live QA and evaluation, **bounded**: each run declares its request count and model up front, uses the Fast binding where possible, and stops at the declared budget. No open-ended loops.
7. **Language coverage:** model quality varies by language because of training data; that is expected and accepted. The config gives every language the best guidance we can write. Spanish, Arabic and Chinese content is validated by the project lead; other languages are used as-is for now. `review` status marks what has been checked.

## References

The canonical list is `references.bib` (section 12). This table is a reading copy.

| Key | Source |
|---|---|
| `koenecke2024` | Koenecke et al. (2024), Careless Whisper: speech-to-text hallucination harms. https://arxiv.org/abs/2402.08021 |
| `illich1973` | Illich (1973), Tools for Conviviality. https://arl.human.cornell.edu/linked%20docs/Illich_Tools_for_Conviviality.pdf · overview: https://en.wikipedia.org/wiki/Tools_for_Conviviality |
| `freire1970` | Freire (1970), Pedagogy of the Oppressed; banking vs problem-posing education. https://en.wikipedia.org/wiki/Problem-posing_education |
| `hooks1994` | hooks (1994), Teaching to Transgress; engaged pedagogy. https://infed.org/dir/welcome/bell-hooks-on-education/ |
| `schultz1998` | Schultz (1998), Predictive reward signal of dopamine neurons. https://journals.physiology.org/doi/full/10.1152/jn.1998.80.1.1 |
| `schultz_rpe_review` | Glimcher (2011), dopamine reward prediction error hypothesis. https://pmc.ncbi.nlm.nih.gov/articles/PMC3176615/ |
| `howard_jones_demetriou2009` | Uncertainty and engagement with learning games. https://link.springer.com/article/10.1007/s11251-008-9073-6 |
| `inzlicht2018` | The effort paradox. https://pubmed.ncbi.nlm.nih.gov/29477776/ |
| `kao_juiciness` | Kao, The effects of juiciness in an action RPG. https://www.sciencedirect.com/science/article/pii/S1875952118300879 |
| `hicks_juicy2019` | Hicks et al., Juicy game design. https://dl.acm.org/doi/10.1145/3311350.3347171 |
| `zagal2013` | Zagal, Björk & Lewis, Dark patterns in the design of games. https://www.diva-portal.org/smash/get/diva2:1043332/FULLTEXT01.pdf |
| `cefr2020` | Council of Europe (2020). CEFR Companion Volume. https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4 |
| `actfl2024` | ACTFL Proficiency Guidelines 2024. https://www.actfl.org/proficiency-guidelines-overview |
| `housen_kuiken2009` | Housen & Kuiken (2009), CAF in SLA. https://academic.oup.com/applij/article-abstract/30/4/461/225923 |
| `egp2017` | O'Keeffe & Mark (2017), English Grammar Profile. https://benjamins.com/catalog/ijcl.14086.oke |
| `pienemann_pt` | Processability / Teachability. https://en.wikipedia.org/wiki/Teachability_Hypothesis |
| `galaczi_taylor2018` | Interactional competence. https://www.researchgate.net/publication/324850184 |
| `taguchi_pragmatics` | Taguchi, Second Language Pragmatics. https://www.cambridge.org/core/books/second-language-pragmatics/6250B5EAF9E978903FD4903BF8AD3C69 |
| `younes2015` | Younes, The Integrated Approach to Arabic Instruction. https://www.routledge.com/The-Integrated-Approach-to-Arabic-Instruction/Younes/p/book/9781138822320 |
| `lyster_ranta1997` | Corrective feedback and learner uptake. https://www.semanticscholar.org/paper/eecbea6c9fdc3a79deb060123883a6de920c70fc |
| `lyster_saito2010` | Oral feedback in classroom SLA, meta-analysis. https://eric.ed.gov/?id=EJ892626 |
| `aljaafreh_lantolf1994` | Regulatory scale; dynamic assessment. https://journals.sagepub.com/doi/10.1191/1362168805lr166oa |
| `errant2017` | Bryant et al., ERRANT. https://aclanthology.org/2020.latechclfl-1.10.pdf |
| `ud` | Universal Dependencies. https://universaldependencies.org/ |
| `pelanek2016` | Elo in adaptive educational systems. https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf |
| `settles_meeder2016` | Half-life regression. https://research.duolingo.com/papers/settles.acl16.pdf |
| `hattie_timperley2007` | The power of feedback. https://journals.sagepub.com/doi/abs/10.3102/003465430298487 |
| `kluger_denisi1996` | Feedback intervention theory. https://mrbartonmaths.com/resourcesnew/8.%20Research/Marking%20and%20Feedback/The%20effects%20of%20feedback%20interventions.pdf |
| `deci_koestner_ryan1999` | Rewards and intrinsic motivation, meta-analysis. https://home.ubalt.edu/tmitch/642/articles%20syllabus/Deci%20Koestner%20Ryan%20meta%20IM%20psy%20bull%2099.pdf |
| `hanus_fox2015` | Gamification in the classroom. https://www.researchgate.net/publication/265644737 |
| `sailer_homner2020` | Gamification of learning, meta-analysis. https://eric.ed.gov/?id=EJ1245270 |
| `ryan_rigby_przybylski2006` | Motivational pull of video games (SDT). https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf |
| `sdt_andragogy` | SDT and andragogy. http://edpsycinteractive.org/articles/houde_andragogy.pdf |
| `zimmerman_srl` | Zimmerman's SRL cycle. https://www.researchgate.net/publication/260684981 |
| `locke_latham2002` | Goal-setting theory. https://www-2.rotman.utoronto.ca/facbios/file/09%20-%20Locke%20&%20Latham%202002%20AP.pdf |
| `elliot_goals` | Achievement goals. https://www.sas.rochester.edu/psy/people/faculty/elliot_andrew/assets/pdf/guoetal2023.pdf |
| `bull_kay_olm` | Open learner models. https://dl.acm.org/doi/10.1145/3170358.3170409 |
| `dornyei_macintyre_wtc` | L2 self, anxiety, WTC. https://link.springer.com/article/10.1007/s12144-023-04479-3 |
| `llm_validity2026` | Validity in LLM-mediated L2 assessment. https://www.frontiersin.org/journals/research-metrics-and-analytics/articles/10.3389/frma.2026.1908592/full |
| `ryding2005` | Ryding, A Reference Grammar of Modern Standard Arabic (2005). *needs review* |

Several sources were checked through abstracts and summaries only. Confirm against the full text before a rule is marked `reviewed`.

