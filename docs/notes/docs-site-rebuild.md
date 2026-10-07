# Documentation-site rebuild

## Implemented scope — 7 October 2026

Rebuilt the static site's homepage, guide navigation and learner documentation
around the current app. Downloads retain their existing behavior. Former internal
plans and implementation descriptions now live under `docs-site-archive/`, with
explicit reference status; old site addresses remain as forwarding pages.
Coaching planning references in the working agreement now name the retained files.

The website has ten learner guides: first session, navigation/icons, Chat,
Practice, coaching, Progress, Skills, settings, troubleshooting and privacy/data.
The guide audit uses current UI/native/server source, not the old website as a
specification. Privacy implementation descriptions are corrected while retaining
the published policy's contact and retention commitments; this is not a legal or
live service-configuration audit.

## Source connection

Interactive examples are built separately by Vite under `ui/tools/docs-demo/`
and embedded by `docs/docs-site/src/components/UserDemo.tsx`. They use production
components and CSS with controlled sample state. These demonstrations run without
native IPC, AI requests, microphone access or durable learner data. Simulated
recordings and model results must remain clearly labeled.

Docs start/build regenerate the examples. CI installs root and site dependencies,
checks fixture types and builds the site. Deployment configuration has the same
build dependencies and source paths; no deployment is performed by this work.

Compilation catches incompatible component changes, not semantic changes in
product behavior. Review corresponding guides whenever the following owners change:

| Guide | Primary source owners under ui/src |
| --- | --- |
| First session/settings | features/startup; features/settings |
| Navigation | app/shell/TopBar.tsx; app/shell/Destinations.tsx; state/navigation |
| Chat/coach | features/conversation/composer; features/conversation/coaching; components/reading |
| Practice | features/drill |
| Progress/skills | features/skills; components/learning; domain/learning |
| Troubleshooting/privacy | platform/diagnostics plus native diagnostics/storage and server identity/accounting |

## Verification

Passed locally:

- `npm run check:fast` (16 validation regressions plus formatting, language,
  diagnostics, style and tooling checks).
- `npm run docs:test` (28 download tests, four offline UI interaction regressions,
  seven dependency-security regressions).
- `npm run docs:links` and site `typecheck`.
- `npm run build` (application TypeScript and Vite build).
- Site `build`, including demo/test TypeScript and Vite generation. Docusaurus
  validates the rendered site's internal links during the production build.

Browser review exercised the wordmark-to-Chat flow, draft/send simulation,
Practice start/stop and sample history, the Skills chart, and the embedded demo.
The navigation guide and Practice example were inspected at a 390px viewport;
the guide had no horizontal page overflow. Desktop rendering and browser error
logs were checked. The docs preview's clean-URL redirect initially sent explicit
`demos/index.html` URLs to the homepage; directory URLs now preserve the base path.
Selected example buttons also retain readable contrast while hovered.

Shared production chart controls changed during this work. The demo test caught
the old popover assumption, and instructions/tests were updated to the current
always-visible controls before rebuilding. Unrelated language-content and app
changes in the shared checkout are preserved.

Limits: examples simplify surrounding layouts and use fixed data; microphone,
audio, provider quality, account access and the native app were not exercised.
Prose still needs review when product behavior changes. Vite reports its existing
large-chunk advisory (demo JavaScript about 350KB compressed); fonts are bundled
from app assets with license/provenance files and load as needed. No hosted CI
result is claimed. No commit, push or deployment was requested or performed.
