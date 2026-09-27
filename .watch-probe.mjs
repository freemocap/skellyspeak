// Temporary probe: does Vite's dev-server watcher crawl into the atomic-write
// staging directory that the DSH filesystem backend creates next to a file it
// rewrites? Run from `ui/` with:
//   $env:PROBE_IGNORE='current'; node ../.watch-probe.mjs
//   $env:PROBE_IGNORE='fixed';   node ../.watch-probe.mjs
// Inline config avoids esbuild bundling vite.config.ts (blocked in this sandbox).
import { createServer } from 'vite'
import { mkdirSync, openSync, writeSync, fsyncSync, closeSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const CURRENT = [
  '**/docs/docs-site/**',
  '**/old/**',
  '**/native/target/**',
  '**/native/gen/**',
  '**/.build-artifacts/**',
  '**/.local/**',
]
const STAGING = ['**/*.tmpdir', '**/*.tmpdir/**', '**/*.tmp']
const ignored =
  process.env.PROBE_IGNORE === 'fixed' ? [...CURRENT, ...STAGING]
  : process.env.PROBE_IGNORE === 'file' ? (await import(new URL('./ui/vite.config.ts', import.meta.url))).default.server.watch.ignored
  : CURRENT

const scratch = '.watch-probe'
const target = join(scratch, 'target.css')
mkdirSync(scratch, { recursive: true })

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { port: 1519, strictPort: false, watch: { ignored } },
})
await server.listen()

const seen = []
server.watcher.on('all', (event, path) => {
  if (path.includes('tmpdir') || path.includes(scratch)) seen.push(`${event} ${path.split(/[\\/]/).slice(-2).join('/')}`)
})
server.watcher.on('error', (error) => {
  seen.push(`WATCHER-ERROR ${error.code} ${error.path ? error.path.split(/[\\/]/).slice(-2).join('/') : ''}`)
})

const iterations = Number(process.env.PROBE_ITERATIONS ?? 40)
for (let index = 0; index < iterations; index += 1) {
  // Mirror @deepseek-ai/dsh-fs-local writeFileAtomic: a private staging dir in
  // the destination's own directory, a synced temp file inside it, then publish
  // by rename and remove the staging dir.
  const staging = join(scratch, `.target.css.${process.pid}.0000000${index}-0000-4000-8000-000000000000.tmpdir`)
  const temporary = join(staging, 'target.css.tmp')
  mkdirSync(staging)
  const handle = openSync(temporary, 'wx')
  writeSync(handle, `/* probe ${index} */\n`)
  fsyncSync(handle)
  await new Promise((resolve) => setTimeout(resolve, 15))
  closeSync(handle)
  renameSync(temporary, target)
  rmSync(staging, { recursive: true, force: true })
  await new Promise((resolve) => setTimeout(resolve, 10))
}

await new Promise((resolve) => setTimeout(resolve, 600))
console.log(`ignored=${process.env.PROBE_IGNORE ?? 'current'} staging-path watcher events: ${seen.length}`)
for (const line of seen.slice(0, 10)) console.log(`  ${line}`)
await server.close()
rmSync(scratch, { recursive: true, force: true })
