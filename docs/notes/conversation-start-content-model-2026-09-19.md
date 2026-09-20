# Conversation start: authored per-language content

Status: **implemented in source on 2026-09-19**, after review. The sections below
record the design reasoning; where this note and the
[integration review](conversation-start-integration-review-2026-09-19.md) differ,
**the review governs** and the built behavior follows it. Departures from this
note as written are listed in §10.

The design preview this note originally referenced has been deleted: the real
component now renders in `ui/tools/conversation-preview.html`, so a hand-fixture
duplicate of it would only rot.

Not implemented here, and still open: the first-run welcome screen and the tour.

Related: [conversation prompt streamlining](conversation-prompt-streamlining-proposal-2026-09-18.md)
established the current start controls; this proposal replaces their presentation
and changes what the native layer sends them.

---

## 1. Goal

The conversation start surface should let a learner begin speaking with the
fewest possible actions, in **any** target language, with explanations in **any**
other language, under **any** of the seven interface locales — and every starter
card should carry its name in the target language, its romanization where the
language has one, and its translation.

The driving constraint from the user:

> every language has a predefined set of the names, translations and
> romanizations of the starter cards, and a defined persona to go along with it

That is, this content is **authored and bundled**, never model-generated at
runtime. The start surface must render fully before any AI call exists.

---

## 2. Verified current state

Every claim in this section was read from source on 2026-09-19.

### 2.1 Content shape

| Fact | Location |
| --- | --- |
| 12 languages | `content/languages/*.yaml` |
| 16 varieties total | 2 each for arabic, english, french, spanish; 1 each for the other 8 |
| 6 conversation topics | `content/shared/conversation-topics.yaml` |
| `ConversationTopic { id, labels: BTreeMap<String,String>, subject }` | `native/src/configuration/documents.rs:136` |
| `labels` already carries **all 12 languages** for all 6 topics (72 strings) | `content/shared/conversation-topics.yaml` |
| `subject` is English-only and is a **model-facing stage direction** | e.g. `"You are serving at a café. Greet the learner…"` |
| `GoalMaterial { tokens: Vec<String> }`, keyed by goal id | `documents.rs:122-123` |
| Only `courtesy` (thank-you) material exists, in all 12 languages | `content/languages/*.yaml` |
| A `greeting` goal ("Greet and say goodbye", band A1) already exists | `content/shared/learning-goals.yaml:34` |
| `default_partner` is **one persona per language**, not per variety | `documents.rs:124`, `ConversationContent` |
| All 12 personas exist and are richly specified (occupation, quirks, opinions, `vibe` emoji array) | `content/languages/*.yaml` |
| `romanizedName` is populated for arabic (`Nūr`) and mandarin (`Xiǎo Lín`), null elsewhere | same |

### 2.2 Romanization

| Language | mode | scheme |
| --- | --- | --- |
| arabic | `scheme` | `ala-lc-arabic` (local) |
| hindi | `scheme` | `ala-lc-hindi` (local) |
| malayalam | `scheme` | `ala-lc-malayalam` (local) |
| mandarin | `scheme` | `pinyin` (local) |
| the other 8 | `disabled` | — |

- `romanization_schemes` in `content/shared/language-foundations.yaml` is `{}`.
  **Every scheme is language-local.** There are no shared schemes today.
- `supported_romanizations` is a **list**, so a language may declare more than
  one scheme. Today every scheme language declares exactly one.
- No variety overrides romanization; all 16 varieties have `overrides: {}`.
- Romanization is **authored or model-produced, never computed**. There is no
  local transliterator; `native/src/language/linguistics/adapter.rs:442` feeds the
  scheme's instructions and examples to the model for word glosses.

### 2.3 The topic-label bug this proposal fixes

`TopicCard` is `{ id, label }` (`native/src/conversations/direction.rs:56`).
`openers::choices(registry, locale)` resolves `label` from
`labels[locale]` (`native/src/conversations/openers.rs:25`), and
`snapshots.rs:211` passes **`preferences.interface_locale`**.

So today the starter buttons are labelled in the *interface* language, not the
target language. A learner studying Mandarin with an English interface sees
"Food and drink", never 饮食. This is not a rendering bug — it is what the
contract provides.

Two further consequences:

- `interface_locale` is **per learner**; `explanation_language` is **per
  conversation** (`PracticeSettings.explanation_language`). Any design that shows
  a translation must resolve it at conversation scope, not learner scope.
- There are 7 interface locales (`native/src/configuration/mod.rs:371`: english,
  spanish, arabic, mandarin, french, german, portuguese) but 12 languages.
  Five languages (hindi, irish, italian, malayalam, scottish-gaelic) can be a
  target or an explanation language but never an interface locale.

### 2.4 Validation gates that will fail on a partial change

- `document!` derives `#[serde(deny_unknown_fields)]` (`documents.rs:9-13`).
  Adding a **required** field breaks deserialization of every existing YAML file
  until every instance supplies it. There is no `#[serde(default)]` in the macro.
- `native/src/configuration/schemas.rs` generates `content/schemas/*.json` from
  the Rust types via `schemars`. Schemas are **generated, not hand-edited**.
- `language_audit_tests.rs:11` iterates every target variety × every explanation
  variety × every interface locale and asserts topic count and non-empty labels.
  It currently calls `choices(&registry, locale)` and will need rewriting.
- `language_audit_tests.rs:5` asserts `Registry::bundled().hash() ==
  Registry::load(disk).hash()`, so bundled content must be rebuilt with disk content.
- `npm run languages:check` runs `tools/check-languages.ts`, `inspect-content --check`,
  and `cargo test --lib configuration::`.

---

## 3. Proposed content model

### 3.1 `ConversationTopic` gains two fields

```rust
document!(ConversationTopic {
    id: String,
    /// One emoji identifying the scene. Language-independent: a café is a café.
    glyph: String,
    /// The scene name in every language. Read TWICE per card: once at the
    /// target language, once at the learner's explanation language.
    labels: BTreeMap<String, String>,
    /// The label transliterated, for languages whose romanization mode is a
    /// scheme. Keyed by language id. Absent for Latin-script languages.
    romanizations: BTreeMap<String, String>,
    subject: String
});
```

`subject` is unchanged and stays English-only — it is a model instruction, not
learner-facing text. `registry.topic(id).subject` (`direction.rs:75`) is untouched.

### 3.2 `TopicCard` becomes a rendering contract

```rust
pub struct TopicCard {
    pub id: String,
    pub glyph: String,
    /// labels[target_language]
    pub target: String,
    /// romanizations[target_language], when the language declares a scheme
    pub romanized: Option<String>,
    /// labels[explanation_language]
    pub translation: String,
}
```

`label` is **removed**, not deprecated — per the repository's zero-backwards-
compatibility rule, every caller is updated in the same change.

### 3.3 `choices` takes languages, not a locale

```rust
pub(crate) fn choices(
    registry: &Registry,
    target: &str,
    explanation: &str,
) -> Result<Vec<TopicCard>>
```

At `snapshots.rs:211` both values are already in scope: the workspace `snapshot`
is read at line 208 and carries `conversations`, from which the conversation's
`languageId` and `settings.explanation_language` are available.

`romanized` is `Some` only when the target language's `defaults.romanization.mode`
is `scheme` **and** `romanizations` contains that language. Absence where a scheme
is declared is a content error, not a runtime `None` — see §6.

### 3.4 Greeting material

Add to each of the 12 `content/languages/*.yaml`:

```yaml
learning:
  goal_material:
    courtesy:
      tokens: [...]        # unchanged
    greeting:
      tokens:
        - hola
```

No schema change: `goal_material` is `BTreeMap<String, GoalMaterial>` keyed by
goal id, and `greeting` is already a defined goal. This is **data only**.

The start surface's voice hero reads `goal_material.greeting.tokens[0]` for its
label ("Say hola"). The same material becomes available to the skill/evidence
system for the `greeting` goal, which currently has no per-language tokens in any
language — so this fixes a real gap beyond the start screen.

---

## 4. Open questions — these need the user's decision

These are the reason this note exists. Each changes the authoring burden
materially, and I do not think any of them should be decided by an implementer.

### Q1. Is a starter-card label per **language** or per **variety**?

`labels` is keyed by language today. But four languages have two varieties each,
and the pairs are not always interchangeable:

- spanish-spain / spanish-mexico
- arabic-levantine / arabic-modern-standard — **diglossia**, the sharpest case
- english-united-states / english-united-kingdom
- french-france / french-canada

"Weekend plans" in Levantine Arabic and in MSA are not obviously the same string,
and the learner explicitly chose a variety during onboarding.

**Recommendation: keep it keyed by language for now**, and add a narrow
`variety_overrides: BTreeMap<String, BTreeMap<String,String>>` only if review
finds a case where the language-level string is actually wrong. Going
per-variety immediately multiplies the authoring set by 16/12 with no evidence
yet that it is needed. **But this is a linguistic judgement, not an engineering
one, and I should not make it.**

If the answer is per-variety, the burden in §5 rises by 24 labels and 6
romanizations, and `choices` must take the variety id instead of the language id.

### Q2. Is a romanization keyed by **language** or by **scheme**?

`supported_romanizations` is a list; a language may declare several schemes.
Keying `romanizations` by language id silently assumes one scheme per language —
true today, but the model already allows otherwise, and a second Arabic or
Mandarin scheme would make the authored string wrong rather than missing.

**Recommendation: key by scheme id** (`romanizations: { "pinyin": "yǐnshí" }`),
resolving through the variety's active scheme. Same authoring burden today (24
strings), but it does not encode an assumption the data model contradicts.
This is the single most consequential structural choice in the proposal.

### Q3. How many greeting tokens per language, and which register?

`courtesy` carries 1–2 tokens per language (arabic has 2, hindi 2, irish 2,
portuguese 2 for gendered forms). Greetings have more variation:

- Arabic: `مرحبا` / `أهلا` / `السلام عليكم` — and the register differs between
  Levantine and MSA, which reopens Q1.
- Mandarin: `你好` vs `您好` (formal).
- Irish / Scottish Gaelic: greetings inflect for number (`dia duit` / `dia daoibh`),
  exactly as the existing courtesy tokens already do.

**Recommendation: author every token that a learner might plausibly say**, as
`courtesy` already does, and have the UI display `tokens[0]` as the canonical
one. The evidence system benefits from the full list; the button only needs one.
**Which token is canonical per language is a decision for someone who speaks it.**

### Q4. One persona per language, or one per variety?

`default_partner` is per language. A learner who selects spanish-**mexico** in
onboarding is currently given Lucía, a veterinary nurse in **Valencia**. That is
a visible mismatch, and the new start surface makes it much more prominent — the
persona becomes the largest element on the screen.

**Recommendation: add a per-variety persona for the four multi-variety languages**
(4 new personas: spanish-mexico, arabic-modern-standard, english-united-kingdom,
french-canada), keeping the language-level `default_partner` as the default for
single-variety languages. This is the one place I would spend new authoring
effort without waiting for evidence, because the mismatch is already wrong today.

**Counter-argument the reviewer should weigh:** this changes
`ConversationContent` from a single persona to a map and touches persona
creation, `createContact`, and the existing conversations of every current user.
It may deserve its own separate change rather than riding along with this one.

### Q5. Are glyphs really language-independent?

I assumed yes — a café is ☕ everywhere. A reviewer should confirm no proposed
glyph carries a culturally specific reading, particularly 👪 for "family" and
🗓️ for "weekend" (the weekend is not Sat–Sun in every locale the app supports;
Arabic-speaking regions vary).

**Recommendation: keep glyphs language-independent, but choose neutral ones.**
Consider ⏳ or ☀️ over 🗓️ for "weekend" if the calendar reading is a problem.

### Q6. Does "Say {greeting}" open the microphone immediately?

Unresolved from the earlier design discussion. The greased-rail answer is that
one press starts the conversation *and* begins recording — `Action::startConversation`
already accepts `message: Option<String>`, so a learner-first opening is
supported by the existing contract. The cost is that a brand-new learner's first
interaction is an OS microphone permission prompt.

**Recommendation: press starts the conversation and opens the mic.** The
onboarding gate already warns that "Microphone permission is requested when you
record" (`OnboardingSetup.tsx:32`).

---

## 5. Authoring burden, exactly

Assuming the recommendations above (language-keyed labels, scheme-keyed
romanizations, per-variety personas):

| Item | New strings | Notes |
| --- | --- | --- |
| Topic labels | **0** | All 72 already exist |
| Topic glyphs | **6** | One per topic, language-independent |
| Topic romanizations | **24** | 6 topics × 4 scheme languages |
| Greeting tokens | **12–30** | 1–3 per language × 12 |
| Personas | **4** | Only if Q4 is answered "per variety" |
| Topic `subject` | **0** | Unchanged, model-facing |

**Total: ~42–64 authored strings, plus 4 personas.** That is a small, bounded,
reviewable set — which is the point of authoring it rather than generating it.

If Q1 comes back "per variety": **+24 labels and +6 romanizations**.

None of this can be machine-generated and accepted blindly. The romanizations in
particular must follow the declared scheme (ALA-LC for Arabic, Hindi and
Malayalam; Pinyin with tone marks for Mandarin) and should be checked by someone
who reads the script. **The preview's current romanizations are mine and are
placeholders.**

---

## 6. Failure behavior

Per the repository's no-fallback rule, none of these degrade silently:

- A topic missing a `glyph` or any `labels` entry fails YAML deserialization at
  registry load (`deny_unknown_fields` plus required fields), which fails app
  startup with a `StartupRefusal`.
- A language whose `romanization.mode` is `scheme` but which has no entry in a
  topic's `romanizations` must **fail the content audit test**, not render a card
  without a romanization line. Add this assertion to `language_audit_tests.rs`.
- A language with no `goal_material.greeting` must fail the same audit.
- `choices` returning a card whose `translation` is empty must be an error, not
  an empty line.

---

## 7. Work order

Each step is independently verifiable. Steps 1–4 are content and native; step 5
is the UI rebuild and depends on the regenerated contracts.

1. **Decide Q1–Q6.** Nothing below is safe to start first; Q2 in particular
   changes the YAML shape that steps 2 and 3 both write.
2. **Extend the documents.** `ConversationTopic` gains `glyph` and
   `romanizations`. Run `cargo run --bin export-contracts` and
   regenerate `content/schemas/` — do not hand-edit the JSON schemas.
   Expect every content load to fail until step 3 lands.
3. **Author the content.** `content/shared/conversation-topics.yaml` gains
   glyphs and romanizations; all 12 `content/languages/*.yaml` gain
   `goal_material.greeting`. Verify with `npm run languages:check`.
4. **Rewrite `TopicCard` and `choices`.** `direction.rs:56`, `openers.rs:25`,
   `snapshots.rs:211`. Update `language_audit_tests.rs:26` — it currently loops
   interface locales and must loop target × explanation pairs instead, and gain
   the romanization and greeting assertions from §6.
   Run `npm run contracts` and `cargo test --lib configuration::`.
5. **Rebuild the UI.** `ConversationStart.tsx` becomes the three-zone surface;
   `ConversationChoices.tsx` is absorbed or deleted; `ConversationDirectionSettings.tsx:16`
   and `ConversationPromptCreator.tsx` are updated for the new `TopicCard`.
   New styles belong in the existing `features/conversation/start.css` owner
   (`ui/README.md` folder map). Update `ConversationStart.test.tsx`.
6. **Verify.** `npm test`, `npm run styles:check`, `npm run languages:check`,
   `npm run contracts:check`, `npm run previews:check`, and the running app in
   at least Arabic (RTL), Mandarin (romanized), and Irish (Latin, no scheme).

---

## 8. Known UI hazards for step 5

Carried from the design preview, where both were found by rendering, not by review:

- **Chrome direction follows the *interface* locale, never the target language.**
  Target-language text inside that chrome needs its own `lang`/`dir` in a `<bdi>`.
  Without it, "Let {name} start" around an Arabic name renders as "نور Let start".
- **`<bdi>` alone is not enough for romanization.** It defaults to `dir="auto"`,
  which infers from the first *strong* character. `ʿ` (U+02BF, as in `ʿāʾilatuk`)
  is not strong, so the romanization inherits the container's RTL and renders
  backwards. Romanization is Latin by definition and needs an explicit `dir="ltr"`.
  The same applies to `romanizedName` and the greeting's romanization.

---

## 9. Explicitly out of scope

- The onboarding gate (`ui/src/features/settings/onboarding/`), which already
  handles target / variety / explanation / interface selection and is not changed here.
- `ConversationHelp`, which already provides progressive in-conversation hints.
- The "take a tour" coach-mark machinery sketched in the preview's zone 3. It is
  a separate proposal; only the entry point is designed here.
- Adding new languages or new topics. This proposal fills in the 12 and 6 that exist.
- The `subject` field and anything else model-facing.

---

## 10. What the build does differently from §1–§9

Each of these follows the integration review rather than this note's first draft.

- **Q6 reversed.** "Say {greeting}" opens the recorder and does nothing else.
  It calls the page's existing `toggleMic`; the conversation is admitted when the
  learner sends the transcript, exactly as typing and sending would. The note's
  original "start the conversation and open the mic" is wrong: a null-message
  start schedules a partner opening, which would collide with the learner's own
  first turn. `Let {name} start` remains the separate partner-first action.
- **The greeting is its own record**, `conversation.greeting` in each language
  document, projected as `StarterGreeting`. `goal_material` is untouched: it is
  the learning system's retrieval data and its token order must not decide UI
  wording. The greeting carries no per-explanation-language translation — the
  button's own verb is localized ("Say" / "Di" / "قل"), so the meaning is in the
  chrome rather than in a gloss. **Revisit if review disagrees.**
- **Q2 settled scheme-keyed.** `romanizations` on both topics and greetings is
  keyed by romanization scheme key (`"mandarin:pinyin"`), resolved through the
  conversation's variety. A consequence, now covered by a test: moving a scheme
  from a language to the shared namespace renames its key and invalidates every
  authored romanization under the old one.
- **Load-time validation added**, per the review's correction. `deny_unknown_fields`
  rejects unknown fields but does not require a map to hold a given key, so
  `Registry::validate_starter_content` checks every topic label for every
  language, every romanization for every scheme any variety resolves to, and
  every greeting. Missing content refuses to load with the authoring path in the
  error, rather than reaching the surface as a blank line.
- **Audit coverage kept at variety × variety.** `choices` is now called per
  target variety and explanation language instead of per interface locale, and
  asserts that a card's romanization is present exactly when its variety declares
  a scheme.
- **Q4 deferred.** Per-variety personas are not in this change. The surface shows
  the selected contact, including custom partners.
- **`ConversationChoices` retained**, restructured into the scene cluster plus the
  visible difficulty and grammar controls. Difficulty and grammar practice are
  ordinary settings and stay on the surface.
- **`document!` extended** to accept struct- and field-level doc comments, which
  now flow into the generated JSON schemas as descriptions.

### Verified

`npm test` (822 passed), `cargo test --lib` (426 passed), `npm run build`,
`styles:check`, `languages:check`, `contracts:check`, `previews:check` all pass.
The surface was rendered in `conversation-preview` at phone width and confirmed
to have no horizontal overflow with the composer reachable.

`conversation-preview` rendered blank before this change — it throws
`language registry not loaded` because its `mockIPC` refuses every command
including the registry read. Fixed here by answering `get_snapshot` with sample
languages and awaiting `loadLanguages()` before render.

**Not verified:** real microphone capture, transcription, and first-turn
admission against the native layer. No live AI calls were made.
