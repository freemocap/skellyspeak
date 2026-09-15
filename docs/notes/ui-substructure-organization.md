# UI responsibility subfolders — September 15, 2026

Status: approved proposal implemented and verified. This follows the
[UI top-level checkpoint](ui-top-level-organization.md). The maintained folder
map is in [ui/README.md](../../ui/README.md); [AGENTS.md](../../AGENTS.md) records
placement and dependency rules for future work.

## Implemented

The [completed move manifest](ui-substructure-moves.json) records 216 file moves.
It describes the pre-pass to post-pass mapping; do not rerun it on the new layout.

- `features/guided/` became `features/conversation/`, grouped by session, messages,
  composer, reading, coaching, partners, lessons, progress, and speech. The page
  component/file is now `ConversationPage`. Its implementation remains intact.
- Skills, settings, shared components, application windows/navigation, and shared
  state gained the approved responsibility subfolders. Activity/startup stayed flat.
- Conversation state, reading logic, language identity, and interface localization
  are distinct domain areas. Learning catalog, evidence, statistics and reward
  calculations are grouped under `domain/learning/`; animation geometry stays
  separate in `domain/rewards/`.
- Browser recording and playback lifecycle now live under `platform/audio/`.
  Skill-evidence commands moved under `platform/ipc/`; appearance and update
  integration gained their own folders.
- Styles now have foundations, shell, components, and feature folders. CSS rules
  and the exact import order are unchanged. Both style tools discover nested sheets;
  the checker also rejects omitted, missing and duplicate manifest imports.
- Imports, localization tooling paths, reachability checks and documentation were
  updated. Style-checker type checking is included in `npm run graph:check`.
  Its existing PostCSS ancestor loop received an explicit union type so it also
  handles the library's document-parent type without changing runtime behavior.

## Verification

- UI: all 105 test files and 654 tests passed, including dependency boundaries.
- TypeScript and production Vite build passed; seven locales and 826 messages per
  locale passed prebuild checks.
- Generated native contracts/catalog check passed without regenerating content.
- Style validation, style-tool TypeScript and graph-tool TypeScript checks passed.
- Import graph: zero unresolved references.
- Temporary nested-style fixtures: valid manifest accepted; omitted nested sheet,
  missing target and duplicate import rejected. Dead-style analysis found an
  unreferenced nested selector and retained a referenced selector.
- Compared all moved CSS against the pre-pass snapshot: rules are identical after
  excluding comments, and the manifest preserves the exact original ordering.
- All 216 destinations exist and original file paths are absent.
- Current documentation links and whitespace checks passed.

## Limits and remaining work

No native/server module reorganization, deployment, application launch, data reset,
version bump, commit or push occurred. The Vite large-chunk warning and existing
unused-source/style reports remain; source was not removed to silence them.
The dead-style report uses its existing text scanner, which can also count filename
extensions as class-like text; changing that scanner is separate from recursive
folder discovery.

`src/types.ts` and large components remain candidates for deliberate decomposition.
No type shapes or feature behavior were redesigned. Native folder planning can
follow review of this UI checkpoint.
