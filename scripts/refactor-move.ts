import { mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, writeFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractSpecifiers, listTree, normalizeSpecifier, resolveSpecifier } from './import-graph.ts'

/// Move a set of files and rewrite every reference to them.
///
/// Usage:
///   node scripts/refactor-move.ts moves.json            # report only
///   node scripts/refactor-move.ts moves.json --write    # apply
///
/// Pass `--write` to `node` directly. `npm run move -- <map> --write` silently
/// drops the flag — npm consumes it — and would report a move it never made, so
/// the mode is printed before anything else.
///
/// `moves.json` maps a current path to its new path, both relative to the
/// repository root:
///   { "src/lib/speech.ts": "src/domain/audio/speech.ts" }
///
/// The rewrite covers every form the resolver understands — static and
/// type-level `import`, dynamic `import()`, `vi.mock`/`vi.importActual`, and
/// `new URL(..., import.meta.url)` — because it reuses the same extractor the
/// reachability walk uses. A codemod that disagreed with the graph about what an
/// edge is would leave silent breakage behind.
///
/// A dry run is the default: review the report, then pass `--write`.

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))

interface Change {
  file: string
  before: string
  after: string
}

function relativeSpecifier(fromFile: string, toFile: string, template: string): string {
  const query = template.includes('?') ? template.slice(template.indexOf('?')) : ''
  const named = template.split('?')[0]
  // A template that spelled out an extension keeps one; a template that relied
  // on resolution must not gain one.
  const explicit = /\.[a-z0-9]+$/i.test(named)
  const directory = posix.dirname(fromFile)
  // A template that spelled an extension keeps that exact path. A template that
  // relied on resolution must keep relying on it: bundler resolution rejects an
  // explicit `.ts` extension, and a directory index must stay a directory.
  const target = explicit
    ? toFile
    : /\/index\.tsx?$/.test(toFile) ? posix.dirname(toFile) : toFile.replace(/\.[a-z0-9]+$/i, '')
  const relative = posix.relative(directory, target)
  const prefixed = relative.startsWith('.') ? relative : `./${relative}`
  return prefixed + query
}

function loadMoves(path: string): Map<string, string> {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('The move map must be a JSON object of path -> path.')
  const moves = new Map<string, string>()
  for (const [from, to] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof to !== 'string') throw new Error(`Destination for ${from} must be a string.`)
    moves.set(from, to)
  }
  return moves
}

function validate(moves: Map<string, string>, files: Set<string>, directories: Set<string>): void {
  const problems: string[] = []
  const destinations = new Set<string>()
  for (const [from, to] of moves) {
    if (!files.has(from)) problems.push(`source does not exist: ${from}`)
    if (destinations.has(to)) problems.push(`two files would land on ${to}`)
    destinations.add(to)
    if (files.has(to) && !moves.has(to)) problems.push(`destination already exists and is not itself moving: ${to}`)
    if (directories.has(to)) problems.push(`destination is a directory: ${to}`)
  }
  if (problems.length) throw new Error(`Refusing to run:\n  ${problems.join('\n  ')}`)
}

function plan(moves: Map<string, string>, files: Set<string>): { changes: Change[]; contents: Map<string, string> } {
  const changes: Change[] = []
  const contents = new Map<string, string>()
  for (const file of [...files].filter((candidate) => /\.tsx?$/.test(candidate))) {
    const source = readFileSync(join(repositoryRoot, file), 'utf8')
    const after = moves.get(file) ?? file
    let rewritten = source
    // Descending offsets keep every later offset valid while replacing.
    const specifiers = extractSpecifiers(source).filter((specifier) => specifier.relative).sort((a, b) => b.start - a.start)
    for (const specifier of specifiers) {
      const target = resolveSpecifier(file, specifier.spec, files)
      if (!target) continue
      const targetMoves = moves.has(target)
      if (after === file && !targetMoves) continue
      const replacement = relativeSpecifier(after, moves.get(target) ?? target, specifier.spec)
      if (replacement === specifier.spec) continue
      rewritten = rewritten.slice(0, specifier.start) + replacement + rewritten.slice(specifier.end)
      changes.push({ file, before: specifier.spec, after: replacement })
    }
    if (rewritten !== source) contents.set(file, rewritten)
  }
  return { changes, contents }
}

function emptyDirectories(directories: Set<string>): string[] {
  return [...directories]
    .filter((directory) => directory !== '' && !directory.startsWith('node_modules'))
    .sort((a, b) => b.length - a.length)
    .filter((directory) => {
      try { readdirSync(join(repositoryRoot, directory)); return false } catch { return true }
    })
}

const [mapPath, ...flags] = process.argv.slice(2)
if (!mapPath) throw new Error('Usage: node scripts/refactor-move.ts <moves.json> [--write]')
const write = flags.includes('--write')
const moves = loadMoves(mapPath)
const { files, directories } = listTree(repositoryRoot)
validate(moves, files, directories)
const { changes, contents } = plan(moves, files)

console.log(`mode: ${write ? 'APPLY' : 'REPORT ONLY (pass --write to apply)'}`)
console.log(`${moves.size} file(s) to move, ${changes.length} specifier(s) to rewrite in ${contents.size} file(s)`)
for (const [from, to] of moves) console.log(`  move  ${from}\n     -> ${to}`)
for (const change of changes) console.log(`  edit  ${change.file}: ${change.before} -> ${change.after}`)

if (!write) {
  console.log('\nreport only; re-run with --write to apply')
} else {
  for (const [file, source] of contents) writeFileSync(join(repositoryRoot, file), source)
  for (const [from, to] of moves) {
    mkdirSync(dirname(join(repositoryRoot, to)), { recursive: true })
    renameSync(join(repositoryRoot, from), join(repositoryRoot, to))
  }
  console.log(`\napplied: ${contents.size} file(s) rewritten, ${moves.size} moved`)
  const left = emptyDirectories(directories)
  for (const directory of left) {
    try { rmdirSync(join(repositoryRoot, directory)); console.log(`  removed empty directory ${directory}`) }
    catch { console.log(`  left in place (not empty): ${directory}`) }
  }
}
