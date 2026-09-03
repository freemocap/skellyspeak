import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri expects a fixed dev port; failure to bind aborts `tauri dev`.
// TAURI_DEV_HOST is set by `tauri android dev` so the emulator can reach
// the dev server over the LAN — bind to it when present.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    watch: {
      // Building the docs site or the Rust core while `tauri dev` is running
      // used to trip a full page reload — which wipes the conversation,
      // since turns live only in memory. None of these feed the app bundle.
      ignored: [
        '**/skellyspeak-docs/**',
        '**/old/**',
        '**/src-tauri/target/**',
        '**/src-tauri/gen/**',
        '**/.build-artifacts/**',
      ],
    },
  },
  build: {
    target: 'es2022',
  },
  test: {
    // `old/` is an archive of earlier incarnations kept for reference only;
    // its test files are not part of this app.
    exclude: ['**/node_modules/**', '**/dist/**', 'old/**'],
    // Pure-function tests need no DOM; component tests do. Per-file
    // environments keep the fast majority fast — opt in with
    // `// @vitest-environment jsdom` at the top of a component test.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
