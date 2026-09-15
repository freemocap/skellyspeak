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
| `features/settings/` | `access/`, `language/`, `workspace/`; composed by the settings dialog/modal |
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
