# AI strategy and provider contract proposal

Status: approved direction. Hosted desktop authentication and partner/coach replies
through Hosted, API-key and Custom URL routes are implemented;
[architecture.md](./architecture.md) describes its concrete contracts and
[README.md](./README.md) records verification limits. Broader operation families,
assistance and evaluation-dependent behavior below remain planned. Chat and desktop
transcription share native network capacity; submitted chat turns have scoped
refusal holds. Shared admission now also guards fresh submissions and audio;
durable audio receipts now record outcomes without storing recordings or transcript text.

[AI-EVALUATION.md](./AI-EVALUATION.md) names the initial provider/model candidates,
conformance checks and bounded evaluation gates. Candidate selection is distinct
from measured acceptance and release configuration.

## Separate the task from its fulfillment

An operation requests a capability and output contract, not a vendor-specific
request body. Rust assembles authorized inputs, resolves an explicit execution
profile, invokes its adapter and validates the result. Hosted services own hosted
authentication, access checks, metering and provider proxying; the device owns
learner records and result acceptance.

An `ExecutionProfile` is device configuration: route ID and revision, adapter
protocol/version, standard and fast model bindings, per-operation routing rules,
generation limits and capability declarations. A `RouteConfiguration` identifies
endpoint/provider and a credential
reference. Secrets are held by Rust through platform credential storage, never
in React state, domain records, prompts or diagnostic payloads. The exact secure
storage APIs and IPC fields belong to the next architecture pass.

Conversation difficulty remains conversation state. Switching a model does not
change the learner's difficulty or proficiency. Record the resolved profile and
actual model identity on attempts; never infer model identity from a friendly label.

## Three connection routes

| Route | Request path | Configuration and responsibility |
| --- | --- | --- |
| Hosted sign-in | Rust → hosted service → approved provider | Session credential; server-authorized models, quota and metering; upstream provider secret stays server-side |
| Own API key | Rust → selected provider | Provider adapter, model assignments and device-held key; direct provider usage is reported locally when available |
| Custom URL | Rust → self-hosted SkellySpeak server → configured providers | User supplies the location of an instance of our server; same versioned SkellySpeak protocol as hosted access |

Hosted sign-in provides access to inference, not storage or synchronization of
conversations. Local identity survives sign-out. Sign-out revokes undispatched
hosted work and attempts to cancel in-flight hosted requests; late results cannot
publish under the revoked session. It does not select a different route.

Custom URL means a self-hosted instance of our server code, locally or remotely.
It is not an arbitrary OpenAI-compatible service, provider dialect or endpoint adapter.
Hosted and self-hosted access share the SkellySpeak protocol, including any future
grouped submission and independent-result contract. Provider integration belongs
inside that server. Validate server protocol identity/version explicitly; do not
probe unrelated APIs or infer compatibility from a model list.

Self-hosted authentication/bootstrap must be specified against our server's actual
authorization contract; neither hosted-login reuse nor unauthenticated operation
is assumed. Transport policy protects secrets:
permit HTTP only on loopback and require HTTPS elsewhere.
LAN HTTP support, if wanted, needs a deliberate visible configuration decision.
Adapters must not forward authorization across origins on redirects.

Exactly one route is selected explicitly by activating its AI access tab in Settings.
Each tab includes a radio indicator reflecting the persisted route. Saving
credentials, signing in and signing out never select a route. There is no priority list or automatic route fallback.
Custom-server model fields start with the supported Gemini chat defaults; enabling
voice selects whisper-large-v3. Advanced model fields remain editable.

An unavailable selected route fails affected work visibly. Never silently switch
from local to hosted, from the learner's key to hosted billing, or between models.
An explicit configuration change can re-plan blocked work without resending messages.

## Models by task class

Use two explicit generation roles as the normal execution strategy:

- **Standard:** the learner's established Gemini choice is the starting candidate
  for conversation and demanding linguistic work. The reference default resolves
  to `google/gemini-2.5-flash`; confirm the intended configured model and current
  route availability when selecting concrete bindings. This does not establish
  current pricing or comparative model quality.
- **Fast:** a smaller, cheaper, lower-latency model for bounded tasks that pass
  task-specific quality checks. Its exact model ID remains to be evaluated.

These are relative workload roles, not vendor size labels. A model called “Flash”
can be our standard model. Embeddings have a separate encoder binding; deterministic
computation needs neither generation role. Advanced overrides remain possible,
but routine small-task routing is part of the default architecture.

Select per operation, not per conversation or whole turn. The same learner message
can trigger a standard-model reply, fast-model title update and local Vibe matching.
Each model receives only its operation's permitted context and output contract.

### Proposed task assignments

Fast assignments are evaluation candidates, not established capabilities. Short
input, small output and valid JSON alone do not make a task easy.

| Operation | Starting assignment | Reason or boundary |
| --- | --- | --- |
| Partner reply | Standard | Conversational nuance, persona consistency and difficulty control |
| Private coaching and explanations | Standard | Teaching errors directly affect learning |
| Skill judgments and CEFR assessment | Standard | Rubric reasoning, attribution and uncertainty; background execution does not justify a weaker model |
| Context-sensitive translation and expression help | Standard | Ambiguity, idiom, code-switching and learner errors require linguistic judgment |
| Draft replies and sentence starters | Standard initially | Must fit the exchange, difficulty and intended meaning; bounded variants can be evaluated for Fast later |
| Two-to-three-word conversation title | Fast candidate | Bounded descriptive output; evaluate relevance and language |
| Literal language/span labeling and lexical lookup disambiguation | Fast candidate after local resources | Bounded labels with source checks; test names and mixed-language fragments explicitly |
| Partner reaction labels | Fast candidate | Fixed vocabulary with uncertainty/abstention; nuanced emotion is not guaranteed by a small schema |
| Explicit memory candidate extraction | Fast candidate | Directly stated facts with supporting spans; no inferred biography or conflict resolution |
| Memory conflict resolution or context summarization | Standard initially | Omission, negation and mistaken attribution can corrupt future context |
| Text embeddings | Separate encoder | Must match the emoji/reference vector space |
| Emoji nearest neighbors, counting, XP projections, validation and formatting | Deterministic/local | No generative inference needed |

Memory candidates remain subject to domain validation regardless of model tier.
Low-cost extraction cannot overwrite user-corrected memory. Pronunciation and
grammatical explanations are language-quality work, not merely formatting.

### Routing rules and target identity

A versioned routing table maps operation kind, contract version, supported language
and input scope to Standard, Fast, an explicit model override or a local resolver.
Resolve the role into a route, adapter and concrete model before dispatch. Both
roles normally use the selected access route; hosted access must authorize both
IDs, and direct/custom adapters must support their requirements. Cross-route
automatic routing is not part of this proposal.

Use deterministic rules, not another LLM call to select an LLM. Begin with task
assignments. Add input-based rules only where evaluable, such as a bounded literal
extraction contract versus a separately declared conflict-analysis contract.
Model self-confidence is not a trustworthy routing threshold.

Record requested role, routing-policy version, matched rule and resolved binding.
Graph inspection and numerical reports expose operation → role → actual model,
with latency, usage and outcome. Different calls analyzing the same message can
therefore use different targets without duplicating the source message.

Declared routing is automatic; failure-driven substitution is not. If Fast fails
validation, expose that failure. An explicit retry with Standard creates a recorded
attempt under the same logical output identity, with no doubled evidence credit.
No hidden second paid call or silent semantic repair. Any future automatic
escalation policy needs explicit rules, a budget and separate review.

### Proving a task belongs on Fast

Evaluate both tiers on identical task/language cases against independent expected
outcomes or reviewed judgments; Standard's answer is not ground truth. Set task
acceptance criteria before comparing cost. Include semantic accuracy, source
attribution, negation, ambiguity, abstention and downstream consequences alongside
schema validity. Measure latency distributions and total cost per accepted result,
including retries and explicitly requested escalation.

Assign Fast only to task/language scopes that pass. Unsupported scopes are declared
Standard in the routing table before dispatch; runtime failures remain visible.
Model, template or contract changes require relevant re-evaluation. Exact candidate
IDs and numerical thresholds belong to the model-selection pass; the two-role
architecture and initial task candidates are explicit now.

### Capability requirements

| Task class | Required result | Selection/evaluation emphasis |
| --- | --- | --- |
| Partner conversation | Emoji-free target-language prose | Natural interaction, difficulty adherence, multilingual quality, latency |
| Private coaching | Emoji-free explanatory prose or validated assistance | Useful teaching, privacy boundary, explanation-language quality |
| Passage/expression assistance | Source-anchored structured language data | Span accuracy, language/variety support, reusable results |
| Evidence, reaction, memory and title analysis | Distinct structured output contracts | Rubric adherence, abstention, attribution, source validity |
| Text embedding | Compatible numerical vectors | Multilingual semantic quality, dimensions, resource identity and device cost |
| Vibe matching and report projections | Deterministic computation | Versioned algorithms and evidence coverage; no generative model |
| Speech work, when specified | Explicit audio input/output contracts | Actual modality support; transcript processing alone proves no audio skill |

A capability description includes supported task/modality, structured-output
mechanism, streaming behavior, input/output limits, usage reporting and cancellation
support. A declared capability must be verified by adapter conformance checks;
an endpoint's model name alone is insufficient. Required missing capabilities block
the operation. Prompting for JSON does not by itself establish schema compliance.

Do not choose named models from reputation alone. Before selecting defaults,
evaluate candidate models against a fixed multilingual corpus covering conversation,
native-language assistance fragments, grammatical analysis, rubric judgments,
unsupported evidence, privacy boundaries and emoji-free prose. Compare measured
quality, latency distributions, failure rates and cost per accepted result,
including repair attempts. Record model/provider and evaluation versions.
Current availability and pricing must be checked against primary provider sources
at that selection step. This proposal assumes no particular vendor capability.

## Context and prompt construction

Use versioned task templates with typed input sections. Assemble context on device
from explicitly permitted records, preserving references and selection provenance.

| Consumer | Allowed context |
| --- | --- |
| Partner reply | Conversation messages, conversation settings, partner description/authored Vibe and relevant active relationship memories |
| Private coach | Its private thread plus selected conversation material and eligible analysis |
| Memory extraction | Eligible relationship conversation sources and extraction exclusions; no private coaching |
| Skill assessment | Scoped learner sources, known assistance and rubric; only the context its judgment requires |
| Vibe encoder | Exact declared source span or collection snapshot, with explicit speaker/chunking policy |

System/task rules are separate from quoted conversation material and editable
persona fields. A partner biography cannot override privacy or output contracts.
The model never receives unrestricted database access or authority to mutate
settings, memory, XP or other records directly.

Proposed memory selection starts with explicit relationship scope, active-support
checks, then bounded relevance selection. Retrieval ranking may be lexical or
embedding-based after evaluation; it cannot broaden permissions. Capture selected
memory IDs/revisions so removal can invalidate unpublished dependent work.

Set an explicit context budget per resolved model, reserving output capacity.
Keep task rules, the initiating source and required settings; choose recent turns
and relevant memories through a documented policy. A summary, if used, is sourced
derived analysis with its own invalidation rules and cost. No silent truncation of
required input. If required material does not fit, fail with a precise reason or
use a separately declared chunking operation with an aggregation contract.

Record template version, input references, selection policy, resolved parameters
and actual provider/model. Avoid retaining raw prompt copies in normal diagnostics.
Detailed content inspection, if introduced, is local, explicit and source-deletable.

## Embeddings and geometric Vibe

Use the [data-model candidate](./DATA-MODEL.md#geometric-vibe-extraction-candidate):
source vectors and a compatible precomputed emoji descriptor table, with cosine
ranking and no per-observation generative explanation. Clustering is separate.

The local-versus-endpoint encoder decision remains open. Evaluate local deployment
on desktop and mobile for resource size, memory, latency and language quality.
Endpoint embeddings use an explicitly configured route and disclose the text
destination; a custom chat endpoint is not assumed to provide embeddings.
No automatic generative-Vibe substitution if an encoder is unavailable.
Encoder changes require a matching reference table and explicit recomputation;
incompatible vector spaces are never combined in reports or searches.

## Failure, cost and validation boundaries

Adapters normalize transport/authentication, quota, capability, timeout, invalid
output and cancellation outcomes while retaining useful provider error codes.
Errors stop affected operations and their required dependents; independent valid
work remains available. Retries and publication follow the execution contract.

Hosted service validates authenticated access, allowed models and request limits
before dispatch. Provider usage is reconciled by attempt identity to avoid duplicate
metering. Client token estimates cannot authorize usage or replace reported usage.
Direct/custom routes do not require sending conversation statistics to the host.
Unknown tokens/cost remain unknown; estimates, if displayed, are labeled estimates.

Set bounded output and repair budgets per operation, plus explicit concurrency
limits. Optional automatic work has a visible policy and can be disabled; it does
not compete without limit with the partner reply. Numeric defaults follow measured
workloads. No silent failover, infinite repair loop or hidden analysis rerun.

## Decisions and next steps

Agreed: all three routes, on-device domain ownership, conversation-owned difficulty,
emoji-free generated prose, independent partial results, deliberate reuse, and
operation-level routing between a standard Gemini candidate and a faster/cheaper
generation model.

Proposed defaults to review: the task assignments above and their evaluation gates,
explicit capability-based adapters, no automatic route/model substitution, and
complete-prose validation before display.

The initial access adapters and configuration are implemented: Hosted, OpenRouter
chat plus Groq transcription, and explicitly configured SkellySpeak-server Custom URL
capabilities. Credential and target rules are recorded in `architecture.md` and
`SECURITY.md`; live checks remain route/platform-specific in README.

The next implementation and selection work is:

1. Complete shared request admission and refusal holds in the
   [resilience checkpoint](./BUILD-PLAN.md#next-checkpoint-request-load-resilience)
   before expanding automatic analysis. Route/model selection never grants an
   additional concurrency pool, retry allowance or graph budget.
2. Evaluate the standard Gemini binding and fast-model candidates per operation
   and language, then select routing rules, overrides and capability requirements.
3. Evaluate local versus endpoint embeddings and select the compatible emoji resource.
4. Set finite graph-expansion, context and attempt budgets from measured workloads;
   smaller/cheaper models do not justify unlimited work.
5. Extend adapter conformance tests to typed refusal scope, no dispatch while held,
   and shared admission across chat/audio and route changes. Hosted protocol gating
   requires its own explicit contract; it is not required for direct/custom services.

The [execution contract](./EXECUTION.md#shared-admission-contract--next-implementation-slice)
owns scheduling and recovery behavior. Provider adapters supply normalized facts;
UI components do not independently decide to retry, fail over or fan out work.
