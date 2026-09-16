# UI — React and TypeScript

The interface shown inside the native application's webview. Application code
lives in `src/`; tests shared across features, development tools, and static files
have separate homes.

## Folder map

| Folder | Responsibility |
| --- | --- |
| [src/app/](src/app/) | Startup, windows, shell, and application composition |
| [src/features/](src/features/) | Product features and their local components and tests |
| [src/components/](src/components/) | Reusable interface elements and hooks |
| [src/state/](src/state/) | State shared across features |
| [src/domain/](src/domain/) | Product logic independent of React and Tauri |
| [src/platform/](src/platform/) | Native bridge, browser/device integration, and diagnostics |
| [src/styles/](src/styles/) | Shared styles and design tokens |
| [src/generated/](src/generated/) | Rust-generated contracts and construct catalog |
| [tests/](tests/) | Cross-cutting architecture checks, shared setup, and mocks |
| [public/](public/) | Files served directly, including fonts and icons |
| [assets/](assets/) | Authored artwork and source assets |
| [tools/](tools/) | UI style tools and development previews |

Feature-specific tests stay beside their implementation. `tests/setup.ts`
registers shared mocks explicitly. Application modules must not import test
infrastructure.

## Responsibility groups

| Area | Subfolders and ownership |
| --- | --- |
| `app/` | `shell/`, `windows/`, `navigation/`, `shortcuts/`; startup and composition remain at the root |
| `features/conversation/` | `session/`, `messages/`, `composer/`, `reading/`, `coaching/`, `partners/`, `lessons/`, `progress/`, `speech/`; composed by `ConversationPage.tsx` |
| `features/skills/` | `overview/`, `evidence/`, `learner/`; composed by `SkillsPage.tsx` |
| `features/settings/` | `access/`, `appearance/`, `language/`, `workspace/`; composed by the settings dialog/modal |
| `features/languages/` | In-app language browser and source/model inspection |
| `features/activity/`, `features/startup/` | Small cohesive groups, kept flat |
| `components/` | `controls/`, `dialogs/`, `feedback/`, `reading/`, `learning/`, `media/`, `localization/`, `layout/`, `persistence/` |
| `state/` | `navigation/`, `session/`, `settings/`, `learning/`; shared initialization at the root |
| `domain/` | `access/`, `audio/`, `input/`, `conversation/`, `reading/`, `language/`, `localization/`, `learning/`, `rewards/`, `update/` |
| `domain/learning/` | `catalog/`, `evidence/`, `statistics/`, `rewards/` |
| `platform/` | `ipc/`, `audio/`, `diagnostics/`, `appearance/`, `updates/` |
| `styles/` | `foundations/`, `shell/`, `components/`, `features/conversation/`, `features/settings/`, `features/skills/`; ordered by `index.css` |

Conversation's partners, coaching, lessons, and rewards still share its orchestration
and context; they are submodules of that feature. Place a component with its feature
unless it is shared across surfaces. Shared components may understand a domain but
must not import feature code or shared application state. Features remain independent
of one another; the app composes them. The architecture tests enforce these boundaries.

Keep pure conversation state and reading transformations separate from language
identity and interface localization. Translation dictionaries are in
`domain/localization/locales/`. Learning evidence and credit calculations belong
in `domain/learning/`; reward animation geometry belongs in `domain/rewards/`.
Browser recording and playback lifecycle belong in `platform/audio/`, and native
command adapters belong in `platform/ipc/`.

Keep the exact CSS cascade order in `styles/index.css`. Both style tools recurse
through the subfolders; validation rejects omitted, missing, or duplicate manifest
imports. Do not add ad hoc stylesheet imports to feature components.

This pass grouped existing modules without decomposing their implementations.
`src/types.ts` still mixes types from several areas; splitting it and the large
components is separate work. `src/vite-env.d.ts` provides frontend type declarations.

## Commands

From the repository root, `npm ci` installs the UI workspace and development tools.
Run `npm test` or `npm run build` there. `npm run dev` starts frontend assets only;
use `npm run macos:dev` on macOS or `npm run tauri -- dev` on other desktop platforms
for the native app. Tests can be selected with `npm test -- tests/architecture`.

`npm run styles:check`, `npm run styles:dead`, and `npm run styles:prune` invoke
this folder's style tools. The repository-wide import graph and move tool remain
under root `tools/` because they resolve references across layers.

Native commands and persistence belong to [native](../native/); the hosted API
belongs to [server](../server/). `src/generated/contracts.ts` and
`src/generated/skill-catalogs/catalog.json` are generated from Rust with
`npm run contracts`; check them with `npm run contracts:check`. Do not edit
these generated files by hand.

Working notes and verification reports belong in [docs/notes/](../docs/notes/).

## Shared style vocabulary

The reviewed explorer is in `docs/notes/style-guide/`. The real-component fixture
is `tools/style-preview.html` (open through `npm run dev`); it uses local sample
state, without native calls or persistence.

| Need | Canonical basis |
| --- | --- |
| Text | `--type-meta` 11px, `--type-ui` 13px, `--type-body` 15px, `--type-title` 18px, `--type-reading` 20px, `--type-display` 24px |
| General surfaces | `--bg`, `--chrome`, `--sheet`, `--field`; text `--ink`, `--ink-2`, `--ink-3`; borders `--line`, `--line-soft` |
| Layout spacing | Ordered `--space-*` steps scale together using `--layout-scale` |
| Controls | `--control-height` selects 40px/32px; coarse pointers enforce 44px |
| Depth | `--surface-bg/shadow/glow`, `--input-shadow`, `--floating-shadow`, `--appearance-scrim` |
| Reading | Independent reading/script scale, word spacing, serif/script fonts and annotation roles |
| Status and learning | Distinct interaction, error, warning, success and domain fill/ink roles |

These roles describe different needs; equal current colors do not justify merging
status, learning or selected-state meanings. Retired `--text-*` size aliases and
shell/paper surface/text aliases should not return.

Shared rules live in `styles/components/{buttons,fields,panels,dialogs,popovers,
reading}.css`. Feature CSS owns composition and explicit feature variants.
`styles/shell/notices.css` owns fault/update notices; `styles/features/settings/
{forms,appearance}.css` owns Settings-specific controls. Apply depth within the
component base, rather than adding a global override sheet after all features.

Appearance settings are learner preferences, validated/defaulted in Rust and
applied by `platform/appearance/useAppearance.ts`. Reading preferences retain their
own provider. The complete app restyle remains an incremental effort; the current
status and detailed language/reward exploration follow-up are recorded in
[the checkpoint](../docs/notes/style-system-refactor.md).

### Conversation styling

`styles/features/conversation/` separates workspace/mobile layout, messages,
composer/recording, reply help, header/pickers, startup, reading evidence and
inline rewards into named sheets. Each remains in the ordered manifest.
Shared activity indicators and waveform framing are under `styles/components/`.

The `.msg` base is shared by stream bubbles and partner excerpts.
`.msg.chat-message` explicitly adds stream padding, width caps, focus borders and
corners. Excerpt layout remains under `.reaction-excerpt .msg` in persona styles.
The `.field.composer-input` variant uses body-size input typography, independent
of reading size, while retaining language script scale. Picker variants distinguish the compact `.learning-line`
from labeled `.conversation-languages` rows. Preserve these real differences;
avoid identical declarations in the base and variant.

### Coaching, progress and inspection styling

- Conversation owns `coaching-dock.css`, `explanations.css`, `coach.css` and
  `lesson.css` for dock geometry, explanations, coaching and lesson flow.
- `progress-map.css`, `progress-report.css` and `reward-presentation.css`
  separate maps, numeric reports and reward presentation.
- `features/skills/{learner-model,evidence}.css` owns learner tables and evidence.
- `features/conversation/speech-inspection.css` owns audio timeline inspection.
- Shared error details, YAML viewing and `inspection-action` controls live in
  `components/{errors,yaml-export,inspection-controls}.css`.

DetailDialog's `size="wide"` option gives YAML and learner reports the same wide
layout. The audio timeline retains its larger content-specific layout.
Inspection table-heading buttons intentionally override the common action base
with transparent backgrounds and no padding. Dock and floating reward cards
share their badge recipe, with explicit layout variants; their motion and
learning meaning remain separate from general surface depth.

### Settings and Skills composition

Settings styles separate `settings.css` (shell/navigation/scrolling/footer),
`access.css`, `audio.css`, `reset.css`, `forms.css` and `appearance.css`.
Joined route tabs and destructive reset confirmation are intentional variants.
Mobile shell rules own footer/scroll geometry; form rules own control spacing.

Skills styles separate `skills.css` (page, toolbar and list), `graph.css`
(nodes and scoped React Flow overrides), `inspector.css` and `review.css`.
Evidence and learner-model styles keep their existing feature owners.
The review inspector's recessed well remains distinct from the graph sheet.
Page-level font inheritance has low specificity so explicit control roles win.

### Style review tools

With `npm run dev` running, open `/tools/style-preview.html` for shared app
components or `/tools/detail-style-preview.html` for language and reward details.
Both use production CSS and sample data; they do not save workspace settings.
Experimental choices are labeled and scoped to the preview. Keep review-only
layout and controls under `ui/tools/`, and record decisions in `docs/notes/`.

Type-check these Vite-served tools separately from the application build:

```sh
npx tsc -p ui/tools/tsconfig.previews.json
```

### Conversation workspace review

The global target-language picker and header partner picker have separate scopes.
The voice composer, two-tab coach pane and responsive layout are documented in
[the UX rebuild note](../docs/notes/conversation-ux-rebuild.md).
Open `/tools/conversation-preview.html` through the existing development server
for a production-component layout fixture with sample data; it does not call AI,
record audio or save preferences.

Model selection has its own Settings section, owned by
`features/settings/models/SettingsModels.tsx`. Standard, Fast and Transcription
choices are shared across all access routes. `features/settings/access/` owns
route selection, credentials and endpoint configuration, with no model editor.
