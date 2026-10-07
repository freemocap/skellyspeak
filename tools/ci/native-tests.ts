import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const bundle = resolve(root, 'native/target/ci-tests')
const executable = resolve(bundle, process.platform === 'win32' ? 'tests.exe' : 'tests')

export function parseTests(output: string): string[] {
  const tests = output.split(/\r?\n/).filter(line => line.trim()).map(line => {
    if (!line.endsWith(': test')) throw new Error(`Unexpected native test listing: ${line}`)
    return line.slice(0, -6)
  })
  if (!tests.length || new Set(tests).size !== tests.length) throw new Error('Empty or duplicate native test inventory')
  return tests.sort()
}

/** Module ownership determines the groups, never durations or arbitrary buckets. */
export function partitionTests(tests: string[], modules: string): Record<string, string[]> {
  const roots = new Set([...modules.matchAll(/^(?:pub(?:\([^)]*\))? )?mod (\w+);$/gm)].map(match => match[1]))
  const groups: Record<string, string[]> = {}
  if (!tests.length || new Set(tests).size !== tests.length) throw new Error('Empty or duplicate native test inventory')
  for (const name of tests) {
    const domain = name.split('::')[0]
    if (!roots.has(domain)) throw new Error(`Native test has no declared module owner: ${name}`)
    const group = name.startsWith('storage::store::migrations::') ? 'storage-migrations' : domain
    ;(groups[group] ??= []).push(name)
  }
  return Object.fromEntries(Object.entries(groups).sort().map(([name, entries]) => [name, entries.sort()]))
}

/** Exact-name filters avoid accidental substring matches. Bound Windows argv size. */
export function batches(tests: string[], limit = 20_000): string[][] {
  const result: string[][] = []
  let batch: string[] = [], size = 0
  for (const name of tests) {
    if (name.length + 3 > limit) throw new Error('Native test name exceeds command limit')
    if (size + name.length + 3 > limit) { result.push(batch); batch = []; size = 0 }
    batch.push(name); size += name.length + 3
  }
  if (batch.length) result.push(batch)
  return result
}

function capture(command: string, args: string[], cwd = root): string {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 32 * 1024 * 1024 })
  if (result.error || result.signal || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.signal ?? result.status}`)
  return result.stdout
}

function inventory(): string[] { return parseTests(capture(executable, ['--list', '--format', 'terse'], resolve(root, 'native'))) }
function groups(tests: string[]) { return partitionTests(tests, readFileSync(resolve(root, 'native/src/lib.rs'), 'utf8').replaceAll('\r\n', '\n')) }
function digest(): string { return createHash('sha256').update(readFileSync(executable)).digest('hex') }
function commit(): string { return capture('git', ['rev-parse', 'HEAD']).trim() }

function prepare() {
  const output = capture('cargo', ['test', '--locked', '--manifest-path', 'native/Cargo.toml', '--lib', '--no-run', '--message-format=json-render-diagnostics'])
  const artifacts = output.trim().split(/\r?\n/).map(line => JSON.parse(line))
    .filter(record => record.reason === 'compiler-artifact' && record.profile?.test && record.target?.kind?.some((kind: string) => ['lib', 'rlib', 'cdylib', 'staticlib'].includes(kind)) && record.executable)
  if (artifacts.length !== 1) throw new Error(`Expected one native library test executable, got ${artifacts.length}`)
  mkdirSync(bundle, { recursive: true })
  copyFileSync(artifacts[0].executable, executable)
  const tests = inventory()
  const domains = groups(tests)
  writeFileSync(resolve(bundle, 'manifest.json'), JSON.stringify({ workspace: root, commit: commit(), sha256: digest(), tests }, null, 2) + '\n')
  for (const [domain, names] of Object.entries(domains)) console.log(`${domain}: ${names.length} tests (including any explicitly ignored tests)`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `domains=${JSON.stringify(Object.keys(domains))}\n`)
}

function run(domain: string) {
  const saved = JSON.parse(readFileSync(resolve(bundle, 'manifest.json'), 'utf8'))
  // Rust embeds CARGO_MANIFEST_DIR; every runner must check out the same source
  // at the same path so filesystem fixtures remain available to the executable.
  if (saved.workspace !== root || saved.commit !== commit() || saved.sha256 !== digest()) throw new Error('Native test artifact does not match this checkout')
  const tests = inventory()
  if (JSON.stringify(saved.tests) !== JSON.stringify(tests)) throw new Error('Native test inventory changed after compilation')
  const domains = groups(tests)
  const selected = domain === 'all' ? Object.keys(domains) : [domain]
  for (const name of selected) {
    if (!domains[name]?.length) throw new Error(`Unknown or empty native test domain: ${name}`)
    console.log(`Running native domain ${name}: ${domains[name].length} tests`)
    for (const batch of batches(domains[name])) {
      // Check libtest's selection too: a future CLI change cannot silently
      // turn an exact batch into zero tests, duplicate coverage or a full run.
      const actual = parseTests(capture(executable, ['--list', '--format', 'terse', '--exact', ...batch], resolve(root, 'native')))
      if (JSON.stringify(actual) !== JSON.stringify([...batch].sort())) throw new Error('Native test filter does not match its assigned domain')
      const result = spawnSync(executable, ['--exact', ...batch, '--test-threads=4'], { cwd: resolve(root, 'native'), stdio: 'inherit' })
      if (result.error || result.signal || result.status !== 0) throw new Error(`Native domain ${name} failed: ${result.error?.message ?? result.signal ?? result.status}`)
    }
  }
}

if (import.meta.main) {
  const [action, domain] = process.argv.slice(2)
  if (action === 'prepare' && !domain) prepare()
  else if (action === 'run' && domain) run(domain)
  else throw new Error('Usage: node tools/ci/native-tests.ts prepare | run <domain|all>')
}
