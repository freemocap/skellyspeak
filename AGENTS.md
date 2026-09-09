# Working agreement

## Current stage

SkellySpeak is in architecture and product design. Do not implement application
code, scaffold a framework, install dependencies or activate build/deployment
workflows until the user explicitly authorizes implementation after design review.
Ordinary agreement with a design idea is not authorization to implement it.

The active design lives in `DESIGN.md`. Keep proposals, decisions and unresolved
questions distinct. Discuss ownership and user behavior before choosing storage,
frameworks, IPC or provider contracts. Do not present plans as working features.

## Reference boundary

Everything in `old/` is deprecated reference material. It is not the active
application, documentation or a specification. Read it only for a concrete design
question. Do not copy its code, configuration, tests or documentation into the
active project. Do not run or maintain it as part of the rebuild.

The rebuild starts from empty application data. No compatibility layers, imports,
backups or data-conversion work. The user handles application data deletion.

## Collaboration

Keep communication concrete and concise. Continue authorized design work and flag
meaningful decisions. Ask for user checks only when there is a specific artifact
to review. Distinguish design review, source implementation, automated verification
and a running application. Explain exactly what is ready to inspect.

## Git

Git is read-only for agents. Never commit, push, tag, branch, stage, reset,
checkout, stash or change Git configuration. The user performs all Git writes.

## Quality

Fail on errors; do not substitute warnings or silent fallbacks. Keep documentation
about the active design and actionable questions. Verify local links and document
consistency during planning. Implementation checks will be defined with the
implementation architecture, not borrowed from the reference application.
