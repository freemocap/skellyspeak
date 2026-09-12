# Working agreement

## Current stage

Implementation is authorized following review of `BUILD-PLAN.md`. Proceed through
its phases, starting with the durable local foundation. Keep implemented behavior,
verification results and future work distinct. Deployment and Git writes are not
authorized by local implementation approval.

The active design lives in `DESIGN.md`. Keep proposals, decisions and unresolved
questions distinct. Discuss ownership and user behavior before choosing storage,
frameworks, IPC or provider contracts. Do not present plans as working features.

## Reference boundary

Everything in `old/` is deprecated reference material. It is not the active
application, documentation or a specification. Read it for concrete design
questions and intentionally evaluate useful architectural ideas. Record adopted
principles in `DESIGN.md`; reference material does not become authoritative by
association. Do not copy code, configuration, tests or documentation wholesale.
Any implementation reuse requires explicit review against the approved design
after implementation is authorized. Do not run or maintain the reference
application as part of design work.

The rebuild starts from empty application data. No compatibility layers, imports,
backups or data-conversion work.

## Collaboration

Keep communication concrete and concise. Product UI uses plain functional labels:
no marketing copy, slogans, saccharine encouragement or filler. This rule governs
text. Reward presentation (tiered sound, animation and haptics defined in the
coaching plan's game layer) is required product behaviour, not decoration to strip. Settings must be
compact, with related inputs grouped and secondary details collapsed. Continue authorized design work and flag
meaningful decisions. Ask for user checks only when there is a specific artifact
to review. Distinguish design review, source implementation, automated verification
and a running application. Explain exactly what is ready to inspect.

Keep product design finite and specific to SkellySpeak. Do not reopen settled
platform, AI access or on-device/no-sync decisions through generic questionnaires.
Defer nonblocking details to focused design passes. Learning feedback and rich local
statistics deserve focused review before technical contracts; avoid repeated approval
questions for routine details.

Statistics are dense, mechanical scientific reports: numeric tables, distributions
and time series, organized by global usage, selected language and conversation
partner. No conversational or motivational statistical summaries. Performance-based
guidance belongs only in the language assessment area or separate coaching.

Keep domain records and metrics independent of visualization metaphors. Gardens,
flowers and alternative views render the same underlying data; renderer geometry,
styling and random seeds belong to presentation configuration. Evaluate geometric
Vibe matching through reusable embeddings and emoji references without presuming
a generative LLM call per observation.

## Coaching plan and research

Coaching, learner-model, new-chat and game-layer work follows
`skellyspeak-docs/docs/coaching-plan.md`, executed per
`skellyspeak-docs/docs/coaching-work-plan.md`, with the seams between work areas in
`skellyspeak-docs/docs/coaching-contracts.md`. Cite research through
`references.bib` keys at the repo root (`sources: [key]` in YAML, `// [@key]` in
code, `[@key]` in docs). When research informs a change, add its entry with `url`,
`review` and `claim` in the same change.

## Git

Git is read-only for agents. Never commit, push, tag, branch, stage, reset,
checkout, stash or change Git configuration. The user performs all Git writes.

## Quality

Fail on errors; do not substitute warnings or silent fallbacks. Keep documentation
about the active design and actionable questions. Read `ui-guidelines.md` for UI
work. Use TypeScript for frontend tooling. Run the relevant checks in README.md;
do not run archived application workflows.
