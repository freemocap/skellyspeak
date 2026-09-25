# Skill Markdown template

Draft presentation proposal. YAML is the authored source; Markdown is a composed
view. The previews are generated review snapshots, not separately maintained content.
No app renderer or assessor prompt integration is implemented here.

## Full view

The placeholders below describe field placement, not a chosen template engine.
Optional sections and absent example fields are omitted, including their headings.
Repeat the example block for each example, preserving source order.

````markdown
# {{skill.name}}

{{category}}

{{skill.overview}}

**Boundary:** {{skill.boundary}}

## Meaning

`{{meaning.template}}`

{{meaning.reading}}

- `{{role.name}}` — {{role.description}}

## Examples

### {{example.number}}. {{example.language}}

**Context:** {{example.context}}

> {{example.text}}

`{{example.interpretation}}`

{{example.note}}

## Authoring details

- **ID:** `{{skill.id}}`
- **Applies to:** {{applicability}}
- **Status:** {{status}} · {{review_status}}
- **Authorship:** {{provenance.authorship}}
- **Sources:** {{resolved source links}}
````

## Composition rules

- Use headings, short blocks and lists. Do not generate extra prose to fill gaps.
- Render the definition before optional notation and examples. In a browsable UI,
  notation and authoring details can later be collapsible without changing content.
- Show the shared explanation of notation once in the containing page or prompt:
  formulas help explain selected meanings; they are not rules that must fit every use.
- A compact assessment view selects ID, name, overview and boundary from these same
  fields. Experiments may add meaning or examples. No independent prompt summary.
- General assessment instructions belong to the enclosing prompt, not this template.
- Compose multiple skills at consistent heading depths beneath a document title.
- Preserve original language text and punctuation, including right-to-left text.
  Escape Markdown syntax where needed so examples remain text, not headings or HTML.
- Resolve citation keys against the bibliography; never invent a source link.
  Omit Sources when none are supplied. Missing referenced sources are errors.
- A complete prompt will also include selected language/variety guidance and the
  learner input. This template only composes the shared skill content.

## Review snapshots

- [Possession and relationships](previews/possession-relationships.md)
- [Past reference](previews/past-reference.md)

The snapshots include authoring details to make the review transparent. Later
assessment composition can omit that display metadata without changing definitions.
