# Skill structure specimens

Historical design specimens. Subsequent experiments are complete and baseline B
is adopted; see the [current decision](../baseline-assessment-decision.md). Statements below
about pending runs or strategy selection describe the earlier draft stage.


Drafts for review:

- [Possession and relationships](skills/possession-relationships.yaml)
- [Past reference](skills/past-reference.yaml)

See the [Markdown template and rendered previews](markdown-template.md) for the
proposed reading view. Previews are generated snapshots; edit the YAML source.

Each file contains a short skill definition, optional meaning notation, and
examples. The notation helps explain a meaning; it is not a rule that must fit
every use of the skill. These formulas are project shorthand, not a standard
language or a scoring system. Examples show useful distinctions and exceptions.

The [shared assessment draft and worked cases](assessment-review.md) are the next
review. Instructions are not repeated per skill. Connections are deferred. Progression and XP
remain separate. Language guides can add the language-specific explanations and
examples when we reach that step.

The examples here are in English to explain the shared meanings. The drafts are
AI-authored, need review, and are not loaded by the app or evaluated by Jev.

The [measurement experiment specimens](experiments/README.md) add two candidate
judgments and nine development fixtures. Their format is proposed, not a runtime
contract. No Jev calls have been run.

## Current composition and count review

[Full guides, assessor questions and worked revision counts](composition-and-counts.md)
are generated from draft YAML by
`node tools/content-workbench/composition/preview.ts` from the repository root.
The history uses authored presence labels, not model results. Changed retries
credit every retained skill; unchanged resends credit none. App integration is
pending. Edit the YAML sources rather than this generated preview.
