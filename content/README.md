# Editable content and AI behavior

Start here to inspect or tune the language-learning behavior. These are bundled
source defaults, not build settings, API keys, or live application data.

## Editable data

| Area | Location | Purpose |
| --- | --- | --- |
| Languages | [config/languages/](config/languages/) | Language definitions, writing systems, pronunciation and guidance |
| Constructs | [config/constructs/](config/constructs/) | Learning constructs and their relationships |
| Policies | [config/policy/](config/policy/) | Coaching feedback, learner estimation, navigation and game policies |
| Starters | [config/starters/](config/starters/) | Conversation starters and selection reasons |
| Schemas | [schemas/](schemas/) | Generated JSON schemas for the configuration types |

See [configuration authoring](config/README.md). Rust bundles `config/` through
[native/build.rs](../native/build.rs). It seeds the user's editable configuration
when initializing a new workspace; changing these source files does not overwrite
an existing workspace's configuration. Do not edit generated schemas by hand.

## AI behavior still implemented in code

Prompt extraction and internal module organization have not happened in this pass.
The following is a navigation index, not a claim that prompts are declarative YAML.

| Responsibility | Current owner |
| --- | --- |
| Conversation instructions | [conversation_prompt.rs](../native/src/conversations/conversation_prompt.rs) |
| Persona generation instructions | [persona_prompt.rs](../native/src/partners/persona/persona_prompt.rs) |
| Coaching requests, evidence and deterministic help policy | [coaching.rs](../native/src/learning/coaching/mod.rs), [coach_observation.rs](../native/src/learning/coaching/coach_observation.rs), [coach_policy.rs](../native/src/learning/coaching/coach_policy.rs) |
| Lesson requests and validation | [lessons.rs](../native/src/learning/lessons.rs) |
| Turn capture, dispatch and result publication | [execution/](../native/src/conversations/execution/), [turn_plan.rs](../native/src/conversations/turn_plan.rs) |
| Native access and model selection | [access.rs](../native/src/ai/connections/access.rs), [model_routing.rs](../native/src/ai/connections/model_routing.rs) |
| Hosted model routing | [server/app/inference/model_routing.py](../server/app/inference/model_routing.py) |
| Configuration types and validation | [native/src/configuration/](../native/src/configuration/) |
| Research citations | [references.bib](../references.bib) |

From the repository root, run `npm run languages:check` and
`npm run contracts:check` after editing content. Rust configuration tests also
verify schema output. The [coaching plan](../docs/website/docs/coaching-plan.md)
records design intent; it does not establish implemented behavior.
