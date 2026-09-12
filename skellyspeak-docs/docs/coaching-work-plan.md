---
sidebar_position: 7.6
title: Coaching work plan
---

# Coaching work plan

How the [coaching plan](./coaching-plan) gets built. The seams between work areas are in [coaching contracts](./coaching-contracts). Section references (§n) point into the coaching plan.

## Team

One integration agent plans, writes reports, reviews and verifies. Three domain agents build. The user carries reports between them; agents never talk to each other directly.

| Agent | Domain | Owns (edits only these) | Consumes |
|---|---|---|---|
| **A · Language & Config** | What the app *knows*: languages, scripts, romanization, traits, constructs, starters, policies, bibliography, and the YAML loader | `config/**`, `schemas/**`, `references.bib`, `src-tauri/src/languages.rs` (becoming `src-tauri/src/languages/**`), `src-tauri/src/config/**`, `src-tauri/src/linguistics/adapter.rs` (prompt text), `src/domain/language/**` | nothing upstream |
| **B · Coach & Learner Core** | What the app *does*: turn plans, coach and persona operations, feedback policy, learner model, persistence, native actions | `src-tauri/src/{coaching,progression,execution,turn_plan,model,store,conversation_prompt}.rs`, `src-tauri/src/schema.sql`, new `src-tauri/src/{learner_state,openers,policy,fluency}.rs`, `src-tauri/src/bin/export-contracts.rs`, `server/audio_input.py` | A's resolver API |
| **C · Experience & Game** | What the learner *sees and feels*: chat surfaces, coach card, start panel, profile, reward presentation, sound, motion | `src/features/**`, `src/state/**`, `src/styles/**`, `src/ui/**`, `src/platform/audio/**`, `src/assets/**` (not config), frontend tests | generated `src/contracts.ts`; fixtures |
| **I · Integration** | Plan, contracts, sequencing, reviews, docs | `skellyspeak-docs/docs/coaching-*.md`, `AGENTS.md`, `DESIGN.md`, `DATA-MODEL.md`, `BUILD-PLAN.md`, `workflow/reports/coaching-*` | everything |

**Shared-file rules:**

- `src/contracts.ts` is generated only, by B's `export-contracts`. C never edits it.
- An agent that needs a change outside its area writes a **change request** in its hand-back instead of making the edit.
- A owns *language* guidance text and exposes it through functions. B owns *task* prompts and calls those functions. Neither edits the other's prompt text.

## Cycle

For each wave:

1. The integration agent writes one report per agent: brief, contract excerpt, acceptance checks.
2. The user pastes each report into its agent.
3. The agents work in parallel, each only in its own files.
4. Each agent ends with a hand-back report, which the user copies to the integration agent.
5. The integration agent reviews the diffs on disk, runs the gate, and reconciles contract drift.
6. The user commits (agents never touch git), and the next wave begins.

**Verification gate** (every agent, before hand-back):

```
npm test
npm run build
cd src-tauri && cargo clippy --lib -- -D warnings && cargo test --lib
cargo run --bin export-contracts -- --check
```

Plus the citation test (from wave 1) and any snapshot tests the wave adds.

**Paid inference:** allowed for live QA and evaluation, bounded. Before a run, state the request count, the model (the Fast binding where possible) and the purpose. Stop at the stated count, and report the actual usage. No open-ended or looping runs.

**Hand-back template:**

```
## Hand-back: <agent> · wave <n>
Done:             plan item → files changed → test that proves it
Not done / why:
Verification:     gate output summary; name any failing command
Paid inference:   requests, model, purpose (or "none")
Contract drift:   anything that differs from coaching-contracts.md, and why
Change requests:  edits needed outside my area
Discovered:       defects or facts found in passing, with file:line
Inferred vs read: label any file:line not read during this wave
```

**House rules** (repeated in every report):

- No git writes.
- No fallbacks, and every error reaches the UI.
- No fake UI.
- No backwards compatibility. The schema is one file; bump `user_version` and `SCHEMA_VERSION` together, with no upgrade path (fresh data).
- Never listen for Tauri close requests.
- Cite research by `references.bib` key.
- Linguistic content starts at `review: needs_review`.

## Waves

### Wave 0 · Foundation (integration) — done

- The coaching plan, this work plan, contracts, `references.bib`, a static reading view (`skellyspeak-docs/static/coaching-plan.html`), and pointers in `AGENTS.md`, `DESIGN.md` and `BUILD-PLAN.md`.
- The wave 1 reports are in `workflow/reports/coaching-w1-*.md`.

### Wave 1 · Fix what's broken (§14 wave 1)

| A | B | C |
|---|---|---|
| Romanization scheme registry + guidance function; inject it into the gloss adapter; guard test "every declared scheme reaches a prompt"; add `؟` to `TERMINAL_PUNCT`; assessment-guidance function holding the Arabic rule; citation-key test over `references.bib` | Use A's romanization and assessment functions in `coaching.rs`; 5 outcomes in the Rust contract; catalog codes match hierarchy; real or removed catalog version; focus into persona and coach prompts; **schema v12** `turns.replaces_turn_id` + `ReviseTurn` action + `replaces_message_id` populated + `revision` recorded | Wire Edit & try again to `ReviseTurn`; remove the `requestTurn` rejection; the collapsed "Earlier version" view; replace mock-only `TurnView` tests with GuidedPage integration tests |

**Order:** A's two functions and B's `ReviseTurn` contract land first. C builds rendering and test scaffolding against fixtures, then wires to the real action.

**Exit checks:**

- An Arabic gloss prompt snapshot contains the ALA-LC rules.
- Revising the latest turn creates a new turn with `replaces_turn_id`, and the persona reply regenerates.
- `revision = true` reaches the evidence records.
- Focus text appears in the persona prompt snapshot.

### Wave 2 · Config as data; coach contract; conversation starts (§4–6, §10)

| A | B | C |
|---|---|---|
| YAML loader + `schemars` schemas + startup load-error event; `config/languages/**`; `config/constructs/**` from the current catalog (lens, nav, requires, opportunity); `config/starters/*.yaml`; `config/policy/feedback.yaml`; resolver + hashing | `CoachObservation` / `CoachDecision` + policy; candidate constructs; hint-first; `coach_retry_check`; `candidates_sent` / `items_returned`; `StartConversation` + `persona_opening`; mechanical starter selection | `ConversationStart` panel (starters, Surprise me, Describe it, live composer, beginner tray); message chip + coach card; "Fixed" note; startup config-error screen |

A delivers a loader API stub (types plus a hardcoded implementation) at the start of the wave, so B can code against it while A builds the real loader.

### Wave 3 · Learner model, fluency, game layer (§5.1, §7, §9, §11)

| A | B | C |
|---|---|---|
| `estimator.yaml`, `game.yaml`; test of the three reward rules; content pass for es/ar/zh (validated by the project lead) | Observation → `ConstructState` fold; XP from evidence; reward events; `LearnerState` YAML export; fluency pipeline (`verbose_json` timestamps, local silence detection, alignment, hallucination gate, server accepts the fields); `coach_openers` (when proactivity is standard or higher), `session_review` | Profile / open learner model; session goal and review; reward tiers, sound, motion, juice levels, reduced motion; stars and flower from XP; partner milestones; "Removed … no speech detected" notice |

### Wave 4 · Measure

- **Integration:** harness design and labelling guide.
- **A:** fixture sets per language.
- **B:** bounded opt-in harness runner (the `bench.rs` pattern, `--ignored`).
- **C:** toggles for hint-first vs explicit and for game surfaces on vs off.
- **User:** a labelled coach set for es/ar/zh.

## Risks

| Risk | Mitigation |
|---|---|
| B carries the most work | Starters and policies go to A; presentation goes to C; B computes. If B slips, `coach_openers` moves to wave 4. |
| Prompt text edited by two agents | A owns language guidance behind functions; B owns task prompts. |
| Rust/TS drift | `export-contracts --check` in every gate; C uses only generated types and fixtures. |
| `execution.rs` size | Only B touches it; new behaviour goes in new modules. |
| Other in-flight work | Each wave starts from a committed tree. |
| Unverified claims | Hand-backs separate what was read from what was inferred; integration re-runs the gate. |
