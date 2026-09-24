# Content workbench

Standalone local developer tool for reading and editing authored source while
content design is still evolving. It does not import app/native contracts, invoke
Rust, build/deploy the app, or call AI services.

From the repository root:

```sh
npm run content:workbench
```

Open the localhost URL printed in the terminal. The server binds only to
`127.0.0.1` on an available port. Stop it with Ctrl+C. Node 24 is required.

## Panels and structured views

The header's Files, Document and Connections buttons independently hide/show the
three main panes. Drag the column dividers to allocate width; focus a divider and
use arrow keys for 10px steps or Shift+arrows for 50px steps. The document fills
the remaining space. Narrow windows retain these controls with horizontal scroll.

Each Connections section has its own disclosure heading and bottom resize grip.
Resize those vertically with a drag or arrow keys. Pane widths, visibility and
section sizes/open state are saved locally in the browser for that server origin.
Reset layout restores the default arrangement without changing your draft.

Read uses visibly nested, colored sections. Tree shows either YAML or JSON as
connected branches, with type/count labels, individual branch toggles, Expand all,
Collapse all and zoom. Scroll to explore wide trees. Both views display saved
content; changing views does not discard an unsaved source draft.

## Authoring flow

1. Browse the collapsible folder tree, which mirrors repository-relative disk
   paths. Search by filename, identifier or text, or filter a collection; matching
   files keep their parent folders, which open automatically during filtering.
2. Read YAML/JSON as expandable sections; Markdown notes have headings, emphasis
   and tables. The original source is always available in Edit source.
3. Use the outline and reference panels to navigate to fields/documents. Incoming
   references show other files that mention or refer to this document's IDs.
4. Edit source and select Save file. Files are saved as the exact entered text,
   preserving comments and Unicode; they are never serialized from the preview.
5. Refresh files after external edits or after adding files in VS Code. A save
   refuses a stale revision instead of overwriting an external edit. On conflict,
   copy your draft before reloading and reconcile the changes.

The collection includes `content/`, `references.bib` and
`docs/notes/language-guides-and-xp/`, including future draft subfolders. Generated
schemas and the bibliography are read-only. Hidden files, symlinks, paths outside
that collection and files above 1 MiB are excluded or rejected. Invalid YAML/JSON
syntax, duplicate YAML keys and parser warnings block saving; app semantic and
linguistic validation are separate. Unknown proposed draft fields are allowed.

Reference indexing covers IDs, citation keys, declared scalar/list reference
fields, language goal-material keys, scoped local/shared orthography and
romanization references, Markdown document links and schema comments. Exact ID
mentions are separately labeled; they are not authoritative runtime edges.
Unresolved means unresolved within this index, not necessarily invalid app
content. Multiple matching definitions remain visible instead of guessing one.
Inline Markdown is intentionally limited; raw HTML is displayed as text.

This first version edits existing files. It has no content generation, filesystem
create/delete/rename, automatic draft recovery, or runtime inheritance simulator.
The current guide schemas are browsable artifacts, not an approved design enforced
by this editor. The linked [working plan](../../docs/notes/language-guides-and-xp/README.md)
controls the planning sequence.

## Verification

```sh
npm run content:workbench:check
```

Runs TypeScript checks and temporary-fixture tests for reference resolution,
comment/Unicode preservation, stale-file rejection, syntax errors, path/symlink
boundaries, read-only documents, and same-origin/token-protected HTTP saves.
The HTTP suite requires permission to bind a local socket.

## Schema shape previews

For a document in `content/schemas/`, select **Schema shape** to inspect an
illustrative YAML instance and its field paths, types and required/optional
status. Local references expand; alternatives, recursive references and depth
limits are disclosed. Placeholders are explanatory, not valid completed content
or composed runtime prompts. See the
[composition plan](../../docs/notes/language-guides-and-xp/content-format-and-composition.md)
for the distinction between structure and actual outgoing prompt text.
