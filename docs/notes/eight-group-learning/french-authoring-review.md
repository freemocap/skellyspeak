# French source-authoring checkpoint

Status: implemented, AI-authored, needs independent linguistic review. English is
the explanation language. The 16 source files under
`content/languages/french/skills/` cover eight groups and all 42 ordered subskills.
Both `french-france` and `french-canada` use the core neutral written constructions.
This is not a claim that all regional vocabulary, register or spoken syntax is
interchangeable. No variety-specific executable behavior was added.

## How the files are used

- `<skill>/french-<skill>-assessment.yaml` contributes compact guidance to the
  corresponding question in the single ten-question assessment request.
- `<skill>/french-<skill>-explained-in-english.yaml` supplies French explanations
  and original examples. It joins
  `content/skills/<skill>/<skill>-explained-in-english.yaml` by ordered subskill ID.
  Its English prose can be translated on demand; French example text stays intact.
- `native/src/configuration/skill_conversation.rs` selects the authored section
  explanations for skill-focused conversation starts. It excludes example lists
  and assessment instructions.
- `native/src/storage/store/commands/guide_actions.rs` resolves guide references
  for coach context and exact-phrase conversation starts.

The [assessment specimen](french-assessment-specimen.json) was generated offline
with `audit-content --request french french-france`. It includes the complete
current learner message, preceding exchange, ten questions and hashed source paths.
It is an inspection snapshot, not runtime configuration or a model response.
Regenerate it if inspecting a later source revision; do not edit the JSON by hand.

## Editorial cases

These are authored expectations for future evaluation, **not measured Jev results**.
They concern only the named main skill, not other skills the same message might use.
No probabilities, XP or performance claims were obtained from these examples.

| Group | Context and successful use | Counterexample or boundary |
| --- | --- | --- |
| People, things, and places | Identifying a neighbour: “C’est ma voisine. Elle est médecin.” | “Plus meilleur” is not an ordinary comparative; other correctly expressed relations still count independently. |
| Time and events | Asked about yesterday: “Il pleuvait quand nous sommes sortis.” gives background and an event. | “Hier nous aller au marché” attempts past reference without a correctly formed ordinary past clause. A time word alone does not rescue it. |
| Information exchange | Asked when a shop closes: “À dix-huit heures.” is contextual correct answering. | The same isolated phrase without an established question does not demonstrate successful answering. |
| Feelings and viewpoints | “J’ai peur du chien.” expresses fear. | “Je suis peur du chien” does not correctly form that emotional expression. |
| Possibilities and constraints | “Je sais réparer une roue.” expresses know-how. | “Je dois de partir” does not correctly form devoir + infinitive. Pouvoir elsewhere must be interpreted in context. |
| Reasons and connections | “Si la bibliothèque est ouverte, nous y travaillerons.” expresses a condition. | “Puis nous partons” alone orders events; it does not establish causation or a condition. |
| Coordinating action | In arranging supplies: “D’accord, j’apporterai les assiettes.” commits a contribution. | “Il pleuvra demain” predicts an event; future tense alone is not a commitment to action. |
| Managing conversation | After a mistaken day: “Je voulais dire mardi, pas jeudi.” repairs the misunderstanding. | A memorized “autrement dit” without an intelligible reformulation does not demonstrate repair. |

Review also the modal ambiguity between obligation and inference, short contextual
answers, register-appropriate questions without inversion, negation in conversational
usage, and genuine variety differences. Do not change thresholds to make these
paper expectations pass a future model evaluation.

## Sources and limitations

Identification/possession use [@tex_identity2026; @tex_possessives2026]; temporal
viewpoint/duration use [@tex_past_aspect2026; @tex_depuis2026]; questions use
[@oqlf_questions2026]; modal/conditional distinctions use
[@tex_modals2026; @tex_conditional2026; @tex_si2026]. Shared functional boundaries
use the existing functional and communication-repair bibliography keys. Each file
identifies its own sources. The bibliography records the reviewed scope; no source
is represented as having checked the app’s original examples.

Structural completeness, exact example preservation and bounded prompt assembly
are verified automatically. Native/provider behavior in a running French session,
translation quality and independent language review remain unverified.

## Verification

- `npm run content:check`: passed; 24 assessments and 32 learner guides now exist.
- Required source backlog: 288 → 272 files; bundled translation-target gap: 608 → 592.
- Full native library suite: 822 passed, five ignored.
- Clippy with warnings denied: passed.
- Final fast validation: passed.
- French integration regression: both varieties; ten-question request independent
  of explanation-language choice; all 42 sections; literal examples; no assessment
  instructions in learner guides or skill-start teaching context; 16 KB focus cap.
- No paid provider calls, UI code changes, commit or deployment.

Continue with the [bulk-authoring handoff](bulk-authoring-handoff.md).
