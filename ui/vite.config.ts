import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Tauri expects a fixed dev port; failure to bind aborts `tauri dev`.
// TAURI_DEV_HOST is set by `tauri android dev` so the device can reach
// the dev server over the LAN — bind to it when present. Otherwise bind the
// exact address of `build.devUrl` in tauri.conf.json: "localhost" resolves to
// IPv6 ::1 on Windows, where `tauri dev` waits on 127.0.0.1 forever.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || '127.0.0.1',
    watch: {
      // These directories do not feed the frontend bundle. Ignoring them
      // prevents unrelated builds from reloading the active webview.
      ignored: [
        '**/docs/website/**',
        '**/old/**',
        '**/native/target/**',
        '**/native/gen/**',
        '**/.build-artifacts/**',
        '**/.local/**',
      ],
    },
  },
  build: {
    target: 'es2022',
  },
  test: {
    // `old/` is an archive of earlier incarnations kept for reference only;
    // its test files are not part of this app. `tools/` and
    // `docs/website/` are separate projects with their own commands
    // (`npm run logs:test`, `npm run docs:test`); excluding them here keeps
    // this suite to the app, so a missing install in another project cannot
    // fail it.
    exclude: ['**/node_modules/**', '**/dist/**', 'old/**', 'tools/**', 'docs/website/**'],
    // Pure-function tests need no DOM; component tests do. Per-file
    // environments keep the fast majority fast — opt in with
    // `// @vitest-environment jsdom` at the top of a component test.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
