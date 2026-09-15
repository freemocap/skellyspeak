# UI — React and TypeScript

The interface shown inside the native application's webview. This folder owns
frontend source (`src/`), static files (`public/`), artwork (`assets/`), mocks,
Vite/TypeScript configuration, and the frontend dependency manifest.

From the repository root, `npm ci` installs the UI workspace and development tools.
Run `npm test` or `npm run build` there. `npm run dev` starts frontend assets only;
use `npm run macos:dev` on macOS or `npm run tauri -- dev` on other desktop platforms
for the native app.

Internal source organization is unchanged in this pass. Native commands and
persistence belong to [native](../native/); the hosted API belongs to [server](../server/).
`src/contracts.ts` and the construct catalog are generated from Rust with
`npm run contracts`; check them with `npm run contracts:check`.
