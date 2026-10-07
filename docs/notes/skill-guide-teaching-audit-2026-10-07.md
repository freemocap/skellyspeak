# Skill guide teaching audit and pilot plan

Status: accepted pilot implemented; full English/Spanish/Arabic content expansion
authorized and in progress, 2026-10-07. Latest checkpoints below supersede the
initial audit and proposed implementation details. Skill identities, assessment
policy and learner evidence remain unchanged.

The skill guides need to teach learners how to understand, construct and adapt
language. Much of the sampled prose instead explains why a sentence qualifies
as an instance of a skill. Keep the useful examples and functional skill map,
but make each card a small, self-contained lesson that works without asking AI
for its missing explanation.

## Audit scope

The current English-explanation inventory contains 168 guide files across 21
target languages: eight groups per language, 882 sections and 930 examples.
These are file inventory counts, not quality scores or certification of coverage
in other explanation languages. Each language has 42 teaching subskills.

The qualitative sample covers all five Possibilities and constraints sections
in English, Spanish and Arabic; additional sections from Information exchange,
Managing conversation and Time and events in those languages; and ability and
permission in French, Mandarin and Japanese. This is a quick cross-section,
not a sentence-by-sentence audit of all 882 sections or a linguistic correctness
review. The two supplied screenshots establish the visible reading experience;
source inspection establishes composition behavior.

Source owners:

- [Shared skill concepts](../../content/skills/possibilities-constraints/possibilities-constraints-explained-in-english.yaml).
- [English guide](../../content/languages/english/skills/possibilities-constraints/english-possibilities-constraints-explained-in-english.yaml),
  [Spanish guide](../../content/languages/spanish/skills/possibilities-constraints/spanish-possibilities-constraints-explained-in-english.yaml)
  and [Arabic guide](../../content/languages/arabic/skills/possibilities-constraints/arabic-possibilities-constraints-explained-in-english.yaml).
- [Native guide composition](../../native/src/configuration/communication_guides.rs),
  [guide renderer](../../ui/src/components/learning/GuideDocument.tsx) and
  [inline reading renderer](../../ui/src/components/reading/Markdown.tsx).
- [Content ownership](../../content/CONTENT_README.md) and
  [eight-group implementation checkpoint](eight-group-learning/content-implementation.md).
  Earlier twelve-skill proposals are historical context, not this audit's inventory.

## Findings

| Finding | Concrete evidence | Teaching consequence |
| --- | --- | --- |
| Meaning and note often repeat the example | English ability paraphrases carrying two bags, then says it concerns ability. English possibility says arrival is possible, then says *might* leaves it uncertain. | The learner gains little help producing a new sentence. |
| Some explanations name a construction without unpacking it | Arabic ability says “A capability predicate can introduce the action the speaker can perform.” | No anchor to the actual Arabic words, their forms or how they combine. |
| Assessment boundaries leak into teaching prose | Spanish past-events notes that an unrelated article mistake would not change the temporal construction; its farewell note distinguishes an encounter from a vocabulary exercise. | These explain evidence classification more directly than language use. Keep evaluator rules with assessment; translate useful distinctions into communicative consequences. |
| Useful teaching exists but is uneven | English questions explain that *does* carries the construction while *work* stays in the base form. Spanish obligation identifies *que* between *tengo* and the infinitive. Japanese permission identifies the relationship between its example verb forms. | Use these as starting points; add an explained contrast or adaptation. Their presence means a blanket deletion would lose useful work. |
| Alternatives are named without enough help choosing or forming them | Spanish ability distinguishes *poder* and *saber*, but supplies only *Sé nadar*. English future lists several options around one example. | Show a carefully chosen contrast rather than a list of unexplained options. |
| Register and variety information is distant from the learning decision | Arabic cards repeat MSA and Levantine examples and generic regional caveats. | The learner must infer which expression to learn for the selected variety. |
| Shared introductions read like technical taxonomy | “Epistemic limits” and “a participant's capability or practical capacity.” | Rewrite learner-facing concepts in plain functional language; retain technical precision in domain definitions. |

The French and Mandarin ability samples contain useful semantic distinctions;
the Japanese permission sample includes a concrete form relationship. This audit
supports uneven teaching depth across languages, not the claim that every guide
is equally weak. None of these observations certifies the examples' correctness.

## What the current structure permits

The native composer emits the shared title and introduction, then for each
subskill: heading, shared concept, language explanation, and each example's text,
meaning and note. A selected variety's supplement is appended after all sections.
It does not select or filter individual examples by variety. Both Arabic variants
therefore appear in each card even when Levantine is selected.

The existing explanation and note strings can hold paragraphs, bold labels,
bullets and inline target forms. GuideDocument enables interactive target text
for inline code spans; blockquotes become example passages. This provides enough
room for a first editorial pilot without choosing a new storage model.

There are constraints to inspect in the pilot:

- Example actions currently sit between the target passage and its meaning/note,
  interrupting the worked explanation. Subskill actions appear again at the end.
- The renderer associates blockquotes with examples by order and exact text.
  Do not insert extra quoted demonstrations into prose and assume action mapping
  still works. Keep principal examples in the authored example list.
- Use bold labels inside a card; `###` opens a new subskill section. Arbitrary
  tables and nested lesson headings are not a supported content design here.
- Inline code is treated as target-language text, so use it for actual forms,
  not English metalinguistic labels or abstract formula notation.

Variety-specific teaching selection and action placement are separate product
decisions to review against concrete pilot cards. Longer prose alone does not
resolve those issues.

## Proposed teaching standard

Each card should let a learner answer: What can I do with this? How does the
example work? What can I change? When would I choose another expression?

1. **Purpose.** One plain sentence connecting the subskill to communication.
2. **How it works.** A productive pattern or conversational move, with unfamiliar
   terms defined on first use. Identify the actual target words and explain what
   they contribute. Explain relevant endings, word order, particles or agreement;
   avoid a word-by-word vocabulary dump unrelated to the skill.
3. **Worked example.** A natural sentence or short exchange, a direct meaning where
   needed, and an explanation anchored to its forms. In a same-language guide,
   avoid merely paraphrasing a sentence the learner can already read.
4. **Useful contrast.** Change one meaningful feature and explain the consequence:
   meaning, grammar, politeness, register or response. Include a common error only
   when it clarifies the rule; label incorrect text explicitly.
5. **Try it.** One small adaptation or choice with an answer or model response that
   explains why it works. AI coaching and conversation actions extend the lesson;
   the static teaching must stand on its own.

These are editorial responsibilities, not five mandatory boxes or proposed schema
fields. Start around 120–200 explanatory words with one or two principal examples,
then adjust to the actual card. This is a pilot budget, not a minimum word count.
Additional detail must earn its screen space.

Grammar-oriented cards should teach form and choice. Conversation-management cards
should show the preceding turn, the learner's response and what that response
accomplishes. Do not force every communicative skill into a grammar formula.
For example, clarification should teach how to identify the unclear part and ask
about it; a two-turn exchange is more useful than a definition of “repair.”

Retain the eight functional groups and 42 subskills as navigation. Language guides
explain how a particular language realizes those functions. A form may support
several functions, and a function may have several forms. Card examples neither
define the entire skill nor establish mastery. Evidence and XP remain separate.

## English ability specimen

Original review specimen for the ability card. The implemented source uses a
slightly shorter version with the same teaching points. See the implementation
checkpoint for renderer review and remaining native-app checks.

**Ability**

Talk about what someone is able to do.

**Build the sentence.** Put `can` before the action verb. Use the verb's base form:
the plain form such as `carry` or `swim`, without `to` or an added `-s`. The pattern
is the same with different people: `I can carry`, `she can carry`, `they can carry`.

> I can carry both bags.

**How it works.** `Can` expresses ability here; `carry` names the action. `Both bags`
means the two bags together. Changing the action gives you another sentence with
the same structure: `I can lift this box`.

**Change the sentence.** To say you are unable to do it, use `can't`: `I can't carry
both bags`. To ask about someone's ability, put `can` first: `Can you carry both
bags?` Keep `carry` unchanged in each version.

**Context matters.** If a friend is struggling with luggage, the original sentence
can also offer help. The grammar stays the same; the situation adds that purpose.

**Try it.** Change `She carries this box` into a statement about ability.
Answer: `She can carry this box`. After `can`, use `carry`, not `carries`.

Editorial sourcing: the existing modal reference supports the range of communicative
functions [@bc_modals2026]. The British Council ability, questions and offers
sections support those aspects of this specimen [@bcCanCouldTeaching20261007].
Examples and exercise are original editorial copy; this is not independent
linguistic sign-off. The prose structure is a proposed product standard, not a
claim of measured learning effectiveness.

## Staged pilot

| Stage | Finite deliverable | Review gate |
| --- | --- | --- |
| English | Rewrite the five Possibilities and constraints cards, plus Asking for information and Clarification. | Seven cards demonstrate form teaching, semantic contrast and a conversational exchange. Inspect them in the real guide panel before expanding. |
| Spanish | Author the same seven cards from Spanish forms and usage, explained in English. | Test whether the organization supports conjugation, infinitives and meaningful construction choices. Work through the existing *saber/poder* distinction with paired examples; do not translate English rules. |
| Arabic | Author the same seven cards for Levantine and Modern Standard, with explicit regional scope where needed. | Review selected-variety-first reading, word/form explanation, vocalization and mixed-direction text. Obtain variety-competent linguistic review; generic regional caveats cannot substitute for it. |
| Remaining pilot content | Complete the other 35 subskills in each of these three languages using the revised standard. | Check every skill group, especially discourse and social interaction, before declaring the standard general. |
| Other languages | Proceed one target language at a time, grouping related cards for consistency. | Review linguistic claims, examples, variety applicability and rendered teaching before the next batch. Translate approved explanations into other explanation languages with target forms preserved. |

Start Spanish only after reviewing the English specimen in the app, and Arabic
only after incorporating the Spanish findings. Return to earlier cards when a
later language exposes a weakness in the shared editorial policy. Avoid a bulk
regeneration before those gates.

For Arabic, propose that the selected variety supplies the main lesson, with a
clearly labeled optional comparison to the other variety. This would change the
current display behavior and requires agreement before implementation. Its
representation must work for any language's varieties; no Arabic-specific UI
branch. Clarify content ownership and reading order first, then decide whether
the current guide contract needs an extension.

## Acceptance and implementation boundaries

A card passes editorial review when its explanation adds a usable rule or
conversational strategy, anchors that teaching to real forms, explains its
contrast and enables a new utterance. Reject a card whose notes merely rename the
skill or paraphrase its meaning. Require sources tied to specific linguistic
claims, accurate review status and explicit uncertainty rather than blanket
claims of validation. A second AI pass is not independent linguistic review.

In the rendered pilot, inspect narrow and wide panels, enlarged reading text,
RTL target text inside English explanations, inline word help, example audio and
practice actions. Check that translations and breakdowns stay with their examples
and that every action carries the correct subskill, exact example and variety.
Check self-contained reading without requesting generated help.

Begin with the existing language-guide fields and learner-facing shared concepts.
Keep assessment rules, domain identities, evidence and credit policies outside the
editorial rewrite. Review downstream conversation/coach consumers of guide prose
when implementing; source changes are not isolated to visible cards. Preserve
authored explanation-language parity and distinguish bundled translations from
generated translations; prevent stale cached prose after revision changes.

For an implementation pass, run the repository's content validation, coverage and
readiness commands, `languages:check`, `contracts:check` and final `check:fast`.
UI changes additionally require affected regression tests and `npm run build`;
native changes require the README's native tests and Clippy. These checks verify
structure and behavior, not pedagogical quality or linguistic correctness.

## Verification of this audit

Inventory counts were obtained by parsing the 168 English-explanation YAML files,
excluding authoring templates. Qualitative findings were checked against the
sampled source text and renderer. Only this note and a bibliography entry were
added. Existing unrelated UI and translation changes were preserved. No running
application review or production content rewrite was performed.

Passed: `npm run docs:links`, a direct check of this note's local links and
bibliography keys, `git diff --check`, and `npm run check:fast` (16 validation
regression tests). Documentation-site tests and application builds were not
required for this notes-and-bibliography change. No commit was created.

## English pilot implementation checkpoint

Implemented after the user's approval on 2026-10-07:

- Rewrote Ability, Permission, Obligation and necessity, Possibility, Certainty
  and uncertainty, Asking for information, and Asking for clarification for the
  English target language. Explanatory text is 144–173 whitespace-delimited words
  per card, excluding the shared purpose and principal example.
- Added form explanations, exact inline target forms, meaningful contrasts and
  short exercises with explained answers. Clarification includes the preceding
  turn and a possible partner response. No new runtime content fields were needed.
- Updated the same seven cards in the bundled Cantonese explanation edition;
  retained direct Cantonese sentence meanings with their fuller teaching in notes.
  English same-language meanings now explain the construction rather than repeat
  the sentence. Both editions retain `needs_review` provenance.
- Simplified the seven shared English purpose sentences and the possibilities
  introduction; updated Cantonese source provenance and its corresponding
  introduction. Shared purpose wording also appears for other target languages
  using those explanation editions. Their language-specific lessons were not
  rewritten. Existing Spanish shared concepts remain semantically aligned.
- Preserved every principal example byte-for-byte, section order, variety
  applicability, domain definition, assessment file and XP policy. Compared the
  three English source guides against Git HEAD to confirm exactly seven sections
  changed and principal examples did not drift.

Source editions use revision `english-teaching-pilot-2026-10-07`; bundled
Cantonese editions record that source revision. Existing edition fingerprints
cover guide and shared content. Authored editions return directly rather than
using generated translations. Configuration tests include fingerprint and
translation/source preservation coverage. No translation cache was cleared or
workspace history modified.

Claim support is recorded in `references.bib` and guide provenance:
modal forms [@cambridgeModalFormsTeaching20261007], ability and contextual offers
[@bcCanCouldTeaching20261007], permission and negative obligation
[@bcPermissionObligationTeaching20261007], questions and embedded statement order
[@bc_questions2026], unresolved alternatives [@bbcWhetherTeaching20261007], and
conversational clarification choices [@bcCheckingUnderstandingTeaching20261007].
The new examples and exercises are original. Source review is not independent
linguistic approval of either explanation edition.

### Verification

Passed on the implemented source:

- `npm run languages:check`: configuration load and 71 configuration tests.
- `npm run content:check`, `content:coverage`, `content:ready`: valid authored
  content and no missing required source files. Coverage reports 336 unbundled
  optional target/explanation combinations; these are not new pilot omissions.
- `npm run contracts:check`: generated contracts remain current.
- `npm test -- src/components/learning/GuideActions.test.tsx src/components/learning/SkillGuide.test.tsx`:
  eight UI regression tests, including exact example selection and subskill actions.
- `cargo test --manifest-path native/Cargo.toml --lib guide_actions`: five tests,
  including stale references, exact quotations and bounded coach context.
- Fast gate, local documentation links and whitespace checks.

The first content load found an invalid bibliography review-state value from the
audit; it was corrected to the supported `full-text` value with scope retained in
`claim`, then the content checks passed. Vite's first sandboxed test invocation
could not read parent directories; the authorized unsandboxed rerun passed.

The offline browser preview uses learner Markdown extracted from the native
`inspect-content --communication-guide` output and the real `GuideDocument`
component/CSS. Checked 1100px and 760px panels, 360px panels, English at 150% reading
size, and Cantonese at 100%. The inspected cards had no horizontal overflow.
Checked all seven English lessons' rendered text and the example/subskill action
payloads. The three source guides' explanation text totals 1177, 534 and 737 bytes
respectively, comfortably below the 16 KB conversation-focus limit even with the
small shared purpose and definition material.

Local preview: `http://127.0.0.1:1431/tools/.layout-harness/skill-guide-pilot/index.html`.
The temporary exporter, fixture and preview are in the ignored UI layout harness;
the screenshot is [English guide preview](skill-guide-pilot-2026-10-07/english-wide.png).
These local review artifacts are not production files or durable checked-in tools.

The native application was not rebuilt/launched for manual testing. Preview
actions record selections without creating conversations. Live audio, generated
word help and coach calls were not exercised; the offline view has fewer reading
toolbar controls. No UI/native implementation source changed, so application
build and full native Clippy/test runs were not required for this content pass.
The updated bundled lessons require a native app rebuild to appear in the app.
No commit, release or deployment was performed.

### Review before the Spanish pilot

Review the seven English cards for teaching depth and density. The current action
row still interrupts the example and its explanation, and exercise answers remain
visible; neither presentation behavior was changed in this content pass. Decide
whether those warrant a small shared presentation pass after reviewing the actual
cards. Spanish teaching should be authored from Spanish forms after this review,
followed by Arabic with explicit variety ownership. Independent linguistic review
remains outstanding.

Preview follow-up: the user reported that ordinary scrolling was blocked. The
temporary preview inherited the app body's `overflow: hidden`; the full-page
screenshot and action-induced scrolling had not tested wheel input. Gave the
preview main a viewport-height scroll area and keyboard focus. After reload,
mouse-wheel input moved its scrollTop from 0 to about 677px (812px viewport,
3467px content). The fast gate passed again. Production CSS was not changed.

## Inline reading and action presentation proposal

Status: the user accepted this direction, including hover or tap on mobile. The
proposal below records the design; the implementation checkpoint following it
distinguishes completed behavior from remaining work.

### Existing inline reading mechanism

`GuideDocument` renders prose through `Markdown` with `targetCode` enabled.
Authored inline code spans become `TargetText` inside a bidi-isolated inline span.
`TargetText` selects saved gloss text or `UnannotatedText`; the latter already
segments words and opens `WordHoverHelp` after a 300 ms mouse hover. Click/tap or
Enter/Space pins help, Escape dismisses it, and selecting source text remains
possible. A separate positioned helper leaves the sentence layout intact.

The main app and detached app window supply `ReadingTools`, which injects
`ReadingHelp`, saved lookups, reading services and speech. The local pilot supplied
only `ReadingProvider` preferences/scope, so `UnannotatedText` intentionally fell
back to noninteractive text without reading actions. This preview omission is not
evidence that inline text requires a new renderer or message bubble.

Reuse the existing mechanism, retaining inline text and adding only a subtle
hover/focus indication. The helper should offer meaning, available reading aids,
read-aloud and an explicit route to more detail. Keep the source text unboxed.
Hover should reuse saved information first; a deliberate opening may request
missing information through the existing service. Rendering and incidental pointer
passes must not generate requests.

One existing behavior needs deliberate review: `GlossHelpParts` displays
romanization when available and pronunciation as a fallback, not both together.
Propose keeping the compact default and exposing separately labeled romanization
and pronunciation in expanded details when both are actually returned. Do not
invent an absent field or equate romanization with pronunciation. Any change to
this policy belongs to shared reading components, not a guide-only implementation.

Word-help context is currently the inline target span, not automatically the card's
principal example. A full inline sentence therefore carries useful local context;
isolated `can`, `to` and `-s` do not. Preserve this distinction and label fragments
as forms being discussed. For the pilot, review helper results for such fragments
and incorrect-form contrasts explicitly. Do not silently attach them to a nearby
example or let generated help rewrite authored source. If contextual anchors are
needed, design an explicit source association before extending the content contract.

### Proposed visible actions

Use one footer per subskill card:

| Label | Scope and outcome |
| --- | --- |
| Start conversation | Start conversation practice focused on this card's subskill; preserve its selected language and variety. |
| Ask coach | Ask about this whole card, including its explanation and examples. |

Remove the repeated standalone action rows immediately after every example.
Retain exact sentence starts as a secondary example action, labeled **Start with
this sentence**, in that example's existing action menu. Keep sentence-specific
coach help there as **Explain this sentence**. These retain the existing exact
example index/fingerprint contracts and are distinct from the card footer.
Keep Add to Practice as the existing drill action; do not call conversation
navigation simply “Practice.” Avoid another indistinguishable whole-guide coach
button below these cards; group-level help can remain where a whole group is the
explicit selection on other surfaces.

The footer follows all teaching and practice text, so no navigation row separates
an example from its explanation. Multiple-example cards retain per-example actions
in their own menus, not an ambiguous card-wide “use example” button. Inline words
continue to use contextual word help; they do not acquire extra visible action rows.

### Implementation sequence and review

1. Make the local preview faithful with `ReadingHelp` and deterministic local
   gloss/reading-aid fixtures, clearly labeled as fixtures. Demonstrate inline
   hover, pinning, keyboard access and scroll-safe popover positioning without
   paid inference. Reuse production reading components.
2. Consolidate guide actions through `GuideDocument`, `GuideActions` and the
   existing passage action composition. Shared passage components receive actions
   from their owner; they must not import guide or app state. Preserve typed
   references, cancellation, duplicate-click protection and error details.
3. Test exact sentence versus subskill routing, selected variety and explanation
   language, saved-first help, missing aids, fragment context and switching cards.
   Include RTL and mixed-direction inline text before the Arabic content stage.
4. Run affected UI regression tests, application build and final fast gate. Review
   the updated English pilot in the real app with word help and speech, then begin
   Spanish content. Native changes, if needed for explicit contextual anchors,
   require their own contract/migration review and native checks.

No new storage or provider path is proposed. This pass records the mechanism and
proposed presentation only; it does not yet enable help in the preview or alter
production buttons.


## Shared interaction implementation checkpoint

Implemented in source on 2026-10-07; no commit or deployment:

- Inline target spans reuse the existing word-help renderer, including mouse hover,
  tap-to-pin, Enter/Space and outside-tap/Escape dismissal. The local pilot now
  supplies ReadingHelp with clearly labeled deterministic fixtures. No live lookup
  or speech request is made by the preview. An Analysis action now opens the
  existing reading inspector from unannotated word help as well as blank help.
- Each card has Start conversation and Ask coach. Each exact authored sentence
  exposes Start with this sentence and Explain this sentence through its existing
  More actions menu. The repeated example rows and redundant whole-guide footer
  are removed. Add to Practice retains its separate drill meaning.
- Shared passage/tool components accept owner-supplied menu content. They do not
  import guide navigation. Guide action state stays mounted outside the menu so
  dismissing it preserves duplicate-click protection and eventual errors.
- Toolbar width calculation reserves room for an always-present owner menu.
  The skill-detail grid now allows its minimum card width to shrink to its
  container; browser inspection caught clipping in the old fixed minimum.
- All four new labels have translations in the eight interface catalogs. The two
  retired labels were removed after source search found no live/dynamic callers.

Verification: final fast gate passed; 84 affected UI tests passed across seven
files; production UI build passed (existing bundle-size advisory); git diff check
passed. Tests cover touch opening without touch-hover lookup, pinning, outside
 dismissal, keyboard reopening, saved-first help, Arabic source preservation,
exact example identity, and pending/error preservation across menu dismissal.

Browser review used the actual shared components. The requested 390px viewport
was reported by this browser at 325 CSS px due to its scaling; at that narrower
width the corrected document/card scroll widths matched their client widths.
The word helper remained inside the viewport. Sentence coach selection retained
example index 0, variety and source fingerprint. The temporary viewport override
was reset. Local screenshots: [mobile word help](skill-guide-pilot-2026-10-07/mobile-word-help.png)
and [sentence menu](skill-guide-pilot-2026-10-07/sentence-menu.png).

Limits and next work: this was browser/automated verification, not a physical
phone or rebuilt native-app walkthrough. Live word lookup, speech and navigation
still need the real-app check. Compact romanization/pronunciation fallback policy
is unchanged; separately labeled simultaneous fields in expanded help remain a
proposal. Fragment context is still exactly the authored inline span. No new
storage, normalization, language override or provider contract was introduced.

Next content pass: author the same seven pilot subskills for Spanish using Spanish
forms and constructions, then Arabic with explicit variety ownership. Retain the
small pilot review before broad language expansion and independent linguistic
review before treating drafts as approved educational content.


## Spanish and Arabic teaching pilots

Implemented content checkpoint, 2026-10-07. The user authorized continuing after
the shared interaction pass. Seven subskills per language now use teaching prose:
ability, permission, obligation, possibility, certainty, asking_information and
clarification. Updated English and Cantonese explanation editions for each,
covering twelve existing guide files. This is a pilot, not a whole-language rewrite.

Spanish cards teach person-marked verbs followed by infinitives, learned ability
versus circumstantial possibility, permission questions, tener que, puede que with
subjunctive, adjective agreement, location questions and clarification versus
repetition. English explanations contain roughly 145–153 words per card.

Arabic cards explicitly label Modern Standard and Levantine worked examples and
explain their own forms: person marking, the connector an, dependent verbs without
the ordinary Levantine b-prefix, nominal negation, time questions and the different
verb/noun patterns used to ask about meaning. They contain roughly 180–218 words
per card across the two examples. Existing Southern/Northern applicability notes
are retained. These remain comparative cards: selecting a variety does not filter
out the other variety's example. No language-specific renderer behavior was added.

All principal example strings, section IDs, order and variety declarations were
preserved. A baseline comparison also verified all 32 nonpilot sections across the
twelve files were unchanged as parsed data. New inline variations are teaching
examples, not new assessment items. All provenance remains needs_review; original
exercise authorship and Cantonese translation are not certified by automated tests.

Sources reviewed for specific construction claims include [@yepesSaberTeaching20261007],
[@yepesQuestionsTeaching20261007], [@yepesSubjunctiveTeaching20261007],
[@raePoderTeaching20261007], [@madinahNegationTeaching20261007] and selected extracted
mood tables in [@madinahMoodsTeaching20261007], alongside the previously recorded
[@yepesObligation20260924] and [@levantongue_b_prefix2026]. Source scopes and the PDF
screenshot retrieval limitation are recorded in references.bib. Sources inform
particular grammar claims; they do not validate every original example or exercise.

The ignored preview now exports 30 native renderings: three groups, two explanation
languages and five target varieties (English US; Spanish Spain/Mexico; Arabic
Levantine/Modern Standard). It uses the existing production GuideDocument renderer.
Reviewed Spanish in English, Arabic in English, and Arabic in Cantonese at a 360px
panel width with 150% reading size. All five Arabic cards had equal client and
scroll widths in that narrow check. Screenshots are local review artifacts:
[Spanish pilot](skill-guide-pilot-2026-10-07/spanish-teaching.png) and
[Arabic pilot](skill-guide-pilot-2026-10-07/arabic-teaching.png).

Verification: languages:check passed, including 71 configuration tests; content:check
passed for all 344 guides; final fast gate passed; source-preservation comparisons
and git diff check passed. UI build result is recorded after completion below.
No native implementation or persisted contract was changed. No commit, release,
deployment or live provider request was performed.

Superseded by the selected-variety revision below: assess the longer comparative Arabic card before adopting this
structure everywhere. Independent linguistic review and real native-app lookup/
audio checks remain outstanding. Reading actions still inherit the selected variety;
printed labels do not give each inline span a distinct variety scope. If per-example
variety-aware lookup is required, that needs an explicit content association and
shared reading-scope design before wider Arabic expansion. The preview uses fixture
meanings and must not be treated as validation of generated word explanations.

Final UI build passed; only the existing bundle-size advisory was reported. Documentation links passed. Preview left on Spanish/Spain with English explanations at normal reading size.

## Authored explanation styling correction

User review identified that Cantonese explanatory prose appeared as blue bold italic
target text. Confirmed in the browser: inner target-text spans had weight 700,
italic style and the interaction color. Markdown's ordinary prose renderer used
MixedText script guessing even with explicit targetCode authoring enabled.

Fixed the shared explicit-authoring mode: only marked inline code spans become
TargetText; prose, bold headings and italic emphasis retain their ordinary Markdown
roles regardless of script. General coach Markdown retains its existing behavior.
No Cantonese-specific branch or CSS exception was added. This also avoids treating
explanation words as lookup targets in the selected target language.

Browser verification shows Cantonese prose at regular weight 400, normal style and
ordinary ink, while explicitly marked Arabic forms retain target styling. Added
regression cases for Cantonese, Arabic, Devanagari, Latin explanations and same-script
target/explanation text. Fast gate, 57 affected tests, production build and diff
check passed; build retains its existing chunk-size advisory. Local screenshot:
[Corrected Cantonese prose](skill-guide-pilot-2026-10-07/cantonese-prose-fixed.png).

## Subtle inline phrase boundary

Added a faint rounded border and 4% interaction-ink tint to the shared target-inline
wrapper at the user's request. It remains inline, with logical horizontal padding
and cloned box decoration across wrapped lines; no block div or unbreakable chip.
Verified the Arabic/Cantonese preview at a 360px panel width: all five cards retain
matching client/scroll widths. Target text remains separate from explanation prose.
Fast gate and production UI build passed (existing bundle-size advisory only).
Local screenshot: [Inline borders](skill-guide-pilot-2026-10-07/inline-border.png).

## Selected-variety lessons and explanatory openings

User direction: teach the variety selected by the learner; comparisons are secondary.
Introduce meaning and a plausible situation before instructions or grammar terminology.
This supersedes the comparative Arabic pilot structure and its cross-variety lookup
limitation for the three revised groups. Other groups still need their own content pass.

Reviewed British Council's learner reference and classroom can/could lesson, Yepes's
Spanish grammar explanation, and TheLevanTongue's ability tutorial. Their meaning,
examples, explanation and practice sequences inform our editorial structure; they
are models of teaching prose, not experimental evidence for one mandatory layout.
See [@bcGuideSequence20261007], [@yepesGuideSequence20261007] and
[@levantongueAbilityTeaching20261007]. New prose is original, not copied.

Implemented: seven pilot openings in English, Spanish and both Arabic varieties,
with English and Cantonese explanations. Spanish ability now explains learned skill
versus situational ability before introducing saber and poder. Arabic examples and
explanations now compose as a selected-variety lesson rather than paired editions
inside each card. Original example strings are retained. Short relevant variation
notes remain; repeated Standard/Levantine cross-references are removed.

Shared implementation: optional `variety_sections` contains full, validated section
lists keyed by declared varieties. A single selector is used by rendering, inspection,
translation context/fields, conversation teaching focus, and guide action references.
Reference fingerprints are validated against the full source before materializing
the selected sections, so visible example indices remain consistent through focused
coaching. Empty maps are omitted in serialization. Assessment definitions and stored
workspace contracts are unchanged; no database migration is needed.

This is a general content capability, not an Arabic branch in application code.
The former shared-section-plus-appendix mechanism could not replace paired examples
and their explanations; the new field makes that selection declarative. Both Arabic
editions use it in the three pilot groups. Existing dispositions govern appendices,
not replacement selection. The authoring README documents these semantics.

Browser review confirmed distinct Levantine and Modern Standard lessons and the
Spanish explanatory opening. Local screenshot:
[Selected Levantine lesson](skill-guide-pilot-2026-10-07/levantine-selected-lesson.png).
Preview output is exported from the current native renderer, with fixture word help;
live native-app audio/provider lookup and independent linguistic review remain pending.

Final verification: 847 native library tests passed (5 intentionally ignored);
Clippy with warnings denied passed; fast gate and production UI build passed
(existing bundle-size advisory only); authored-content validation passed; documentation
links and diff whitespace checks passed. Selected-variety regression tests cover
rendering, translation fields, exact example preservation, action indices and stale
fingerprints. Validation rejects undeclared varieties and incomplete/reordered/empty
replacement sections. Cantonese explanations at 150% in the 360px preview panel
had equal client/scroll widths for all five cards. No commit or deployment performed.

## First complete-language batch: editorial brief and ownership

User authorized the proposed delegation workflow. Three GPT-6.1 Sol workers own
English, Spanish and Arabic target-language guide files respectively. The primary
agent owns shared concepts, bibliography integration, preview and quality review.
The initial batch covers all eight groups and 42 subskills in each language, including
all existing explanation editions. Wider expansion follows review of this batch.

User clarified during this batch that correct, useful content for each language
takes priority over uniform file structure or parallel explanations. Keep the shared
functional navigation, but choose constructions, depth and examples case by case.
Do not introduce language-family abstractions now; extract them later only where
finished, reviewed lessons justify them.

Each card should introduce the communicative meaning and a plausible situation,
explain a useful construction, unpack the principal example, then show an adaptation
or meaningful contrast and a short exercise with an explained answer. This is an
editorial standard rather than a compulsory sequence of identical labels. Avoid
paraphrase-only notes, assessment jargon and unnecessary metalinguistic commands.
Retain accepted pilot material when sound. Mark actual target forms with backticks;
never mark explanation-language terms or abstract formulas as target text. Preserve
principal strings unless a correction is documented. Teach the selected variety;
do not make routine lessons into comparisons of varieties.

Workers must research uncertain claims, identify source scope and leave linguistic
review pending. They do not change skill IDs, assessments, schemas or UI behavior.
The primary review checks section coverage, example parity across editions, source
preservation/corrections, usable explanations and exercises, selected-variety
composition, Markdown/action alignment and narrow-screen readability. Automated
checks establish structural and integration correctness, not linguistic certification.

### Batch implementation and review checkpoint

Completed the first three languages: all 42 subskills in each of eight groups,
across 56 target-language guide files. English has English/Cantonese explanations;
Spanish has English/Spanish/Cantonese; Arabic has English/Cantonese. Existing strong
pilot lessons were retained; remaining cards received contextual introductions,
worked constructions and usable practice. Simplified 22 shared concept documents
in the same explanation languages. No new language-family abstraction was added.

| Target | Content outcome | Detail report |
| --- | --- | --- |
| English | Shared lessons with selected US spelling replacements in two groups; original UK examples retained. | [English audit](english-guide-expansion-2026-10-07.md) |
| Spanish | Language-specific teaching shared where valid for Spain/Mexico; all three explanation editions completed. | [Spanish audit](spanish-guide-expansion-2026-10-07.md) |
| Arabic | All eight groups now have separate selected MSA and Levantine lessons. | [Arabic audit](arabic-guide-expansion-2026-10-07.md) |

Primary-agent review corrected scope gaps in Spanish explanation editions and sent
weak Arabic caveats back for meaningful adaptations and complete answers. An
additional read-only agent review covered all Spanish English-explanation cards
and both Arabic selected section sets. It found no confirmed blocking linguistic
defect; root incorporated its two Spanish clarity suggestions. This is model review,
not independent human linguistic certification. Levantine regional consistency and
vocalization, and Cantonese terminology/equivalence remain explicit review items.

Final checks passed: authored-content validation for all 344 guide files; all 73
configuration tests via languages:check; 55 affected UI regression tests; fast gate;
production UI build (existing bundle-size advisory); documentation links; diff
whitespace checks. The first content check rejected overly descriptive bibliography
review-state values; changed them to the existing allowed states and retained exact
review scope in the claim fields. UI tests required the existing Windows sandbox
exception for Vite startup and passed on rerun.

Parsed source comparison preserved every prior principal example. Added only three
US spelling variants (neighbor, harbor, practice), in both explanation editions.
Selected-variety examples agree across all editions. Verified Markdown boundaries
and balanced inline target markers. Assessment files and skill IDs are unchanged.

The local preview exports 112 exact native guide renderings across all groups,
both varieties of each target, and every existing explanation edition. Reviewed
English time/events, Spanish feelings/viewpoints explained in Spanish, and Levantine
requests. Phrase action selection retained the correct visible example index and
variety. All 42 Levantine/Cantonese cards had equal client/scroll widths at a 360px
panel and 150% reading size. Preview screenshot:
[Levantine requests](skill-guide-pilot-2026-10-07/full-batch-levantine-requests.png).
The preview uses fixture word help; no live speech/provider check is claimed.

The first batch is complete and uncommitted. The remaining 18 target languages have
not received this full content rewrite. No commit, release or deployment performed.

### Native startup follow-up

The running development executable still embedded a bibliography from before the
review-state correction. Cargo already tracks `references.bib`, but Tauri's outer
development watcher only watched native sources and `content/`. Added the repository
root to its watched directories, with `.taurignore` excluding frontend, tooling and
documentation work from native restarts. Rebuilt and relaunched the development app.

Verification: current content validation and the fast gate passed. Updating only
the bibliography timestamp triggered a native rebuild; updating a frontend component
timestamp triggered Vite HMR without a native rebuild. The rebuilt app's diagnostics
record successful startup and language-totals IPC. These checks do not constitute visual or
live-provider review of every lesson. The app can run while other languages await
their content rewrite.

### Continuing rollout and AI boundary audit

The user approved a rolling queue of three language authors with root integration
and cross-review. The current next batch is French, Italian and German, followed
by Vietnamese, Mandarin and Cantonese. Earlier queue assignments are superseded.
Completion of those batches is tracked separately from the first three languages.

The [AI boundary audit](skill-ai-boundary-audit-2026-10-07.md) records existing
assessment separation, live smoke results and unresolved generation/translation
risks. Assessment instructions and definitions remain unchanged during teaching
authoring. Contextual `section.explanation` is consumed by practice partners;
learner exercises belong in `examples.note`. Each author also compares the lesson
against the existing assessment for semantic contradictions without duplicating it.

New bibliography entries are registered and validated by the integration agent
before workers reference their keys. This avoids the invalid intermediate
bibliography state encountered in the first batch. Changes remain uncommitted.

### October 7 checkpoint: six-language rollout and Irish scope

French, Italian, German, Vietnamese, Mandarin and Cantonese now have revised
teaching for all 42 subskills in both existing English and Cantonese editions
(96 guide files). French also has complete selected Canadian replacements where
meal vocabulary changes the lesson. The integration audit confirms principal
example preservation, matching example/ID structure between editions, balanced
inline target markers and supported Markdown boundaries.

Cross-review covered all six languages and their existing assessment guidance.
Corrections included a Canadian French habitual-time example, Italian farewell
wording, explicit German practice answers and small Cantonese explanation edits.
No assessment contradiction was identified. These are AI editorial checks,
not independent native-speaker certification; authored provenance remains
`needs_review`. Individual language expansion reports record sources and limits.

The integrated French composition test previously assumed every variety uses
base sections. It now asserts the selected variety's explanations and examples,
including what reaches partner focus. An initial concurrent validation also
detected a bundled/disk fingerprint mismatch while content was being written;
final validation must run after authoring settles.

The user then narrowed the next checkpoint to Irish and Malayalam explained in
English only, followed by a stop for their own commit. Other explanation editions and
all remaining language queues are outside this checkpoint. No commit is
authorized for the agent. Final integrated verification is recorded below when
complete.

### Follow-up requested: learner-visible citations

The user wants language teaching to link to its supporting references, without
expanding this checkpoint into a bibliography UI project. Existing provenance
source keys and `references.bib` URLs are the starting point. A later design pass
should make relevant citations available near the claims they support and offer
a readable bibliography, distinguishing consulted source passages from original
AI-authored examples and unresolved linguistic review. Source-wide attribution
must not imply that every adaptation is independently attested. This is a
requested follow-up, not implemented learner-facing citation behavior.
