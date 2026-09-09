# SkellySpeak

A convivial tool for learning languages through welcoming conversations,
useful assistance and understandable progress.

**Stage: product and architecture design. There is no active application or build
pipeline in this workspace.** Implementation begins after explicit design review
and authorization.

Start with [the design brief](./DESIGN.md). It separates agreed product intent
from questions we still need to resolve. [The working agreement](./AGENTS.md)
defines how we collaborate.

[The data-model proposal](./DATA-MODEL.md) defines candidate records, ownership,
source references and deletion rules, with a worked multi-conversation example.
It is an architecture proposal, not implemented application behavior.

[The execution contract](./EXECUTION.md) proposes operation scheduling, partial
results, pause/step controls, retries and publication rules.
[The AI strategy](./AI-STRATEGY.md) covers hosted sign-in, API keys, custom endpoints,
model selection, context assembly and capability validation. Read these together;
their review points precede implementation authorization.

[State and storage](./STATE-AND-STORAGE.md) proposes transaction boundaries, typed
UI/backend commands, scoped snapshots, recovery and source-aware cache invalidation.

[Provider selection and evaluation](./AI-EVALUATION.md) names the initial Gemini
Standard/Fast candidates, adapter scope, embedding candidates and evaluation gates.
It records research and a test plan, not benchmark results.

[The consolidated build plan](./BUILD-PLAN.md) is the implementation review entry
point: proposed decisions, complete phases, exit criteria and user checkpoints.

`old/skellyspeak-app/` contains the fully deprecated application, documentation,
configuration and local build materials. It is reference-only and supplies no
requirements or implementation for the rebuild.
