import { defineConfig } from 'vitest/config'

// The docs site is a separate project with its own dependencies
// (`npm ci --prefix docs/website`), driven from the root project the same
// way `tools/` is driven by `npm run logs:test`. Its tests are pure Node and
// must not inherit the app's jsdom environment or `ui/tests/setup.ts`, so they
// run under this config rather than the root `vite.config.ts`, which excludes
// them. CI installs the docs dependencies before running `npm run docs:test`.
export default defineConfig({
  root: 'docs/website',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
