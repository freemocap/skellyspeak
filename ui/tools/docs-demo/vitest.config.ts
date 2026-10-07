import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['ui/tools/docs-demo/*.test.tsx'],
    setupFiles: ['ui/tests/setup.ts'],
  },
})
