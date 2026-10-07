import { fileURLToPath } from 'node:url'
import { readdirSync, readFileSync } from 'node:fs'
import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  resolve: { alias: [{ find: /^\/fonts\//, replacement: `${normalizePath(fileURLToPath(new URL('../../public/fonts/', import.meta.url)))}/` }] },
  plugins: [react(), {
    name: 'docs-font-provenance',
    generateBundle() {
      const fonts = new URL('../../public/fonts/', import.meta.url)
      for (const name of readdirSync(fonts).filter(name => /\.(txt|md|json)$/.test(name))) {
        this.emitFile({ type: 'asset', fileName: `fonts/${name}`, source: readFileSync(new URL(name, fonts), 'utf8') })
      }
    },
  }],
  build: {
    target: 'es2022',
    outDir: fileURLToPath(new URL('../../../docs/docs-site/static/demos', import.meta.url)),
    emptyOutDir: true,
  },
})
