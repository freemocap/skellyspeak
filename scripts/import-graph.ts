import { readdirSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/// One resolved dependency edge, with paths relative to the repository root.
export interface Edge {
  from: string
  to: string
  /// The specifier exactly as written in `from`, before rewriting.
  spec: string
  kind: SpecifierKind
}

export type SpecifierKind = 'static' | 'dynamic' | 'mock' | 'url'

export interface Graph {
  /// Every file under the scanned directory, not only modules — asset
  /// resolution (`.json`, `.css`) needs these too.
  files: Set<string>
  directories: Set<string>
  modules: string[]
  edges: Edge[]
  importers: Map<string, Set<string>>
  /// Bare specifiers each module imports, e.g. `react`, `@tauri-apps/api/core`.
  /// These resolve to no file, so they are not edges; boundary rules read them.
  bareImports: Map<string, Set<string>>
  /// Relative specifiers that resolve to nothing. These are defects, so they are
  /// returned rather than ignored.
  unresolved: Edge[]
}

/// A relative specifier found in source, with the offsets needed to replace
/// exactly that string and nothing else.
export interface Specifier {
  spec: string
  kind: SpecifierKind
  start: number
  end: number
  /// False for bare package specifiers (`react`, `@tauri-apps/api/core`). They
  /// resolve to no file, but they still describe a dependency a boundary rule
  /// may ban, so they are recorded rather than dropped.
  relative: boolean
}

/// The directory the graph covers. `node_modules` is outside it, so the walk
/// never leaves application source.
export const SCAN_ROOT = 'src'

const STATIC = /\bfrom\s*(['"])([^'"]+)\1/g
const CALL = /\b(?:import|importActual|mock|unmock|doMock)\s*(?:<[^()]*>)?\s*\(\s*(['"])([^'"]+)\1/g
const URL_ARGUMENT = /\bnew\s+URL\s*\(\s*(['"])([^'"]+)\1/g

/// Every relative specifier in a source file: static and type-level `import`,
/// dynamic `import()`, `vi.mock`/`vi.importActual`, and
/// `new URL(..., import.meta.url)`.
///
/// The same extractor drives the reachability walk and the move codemod, so the
/// two cannot disagree about what an edge is. Offsets point at the specifier
/// text between the quotes, which is exactly what a codemod rewrites.
export function extractSpecifiers(source: string): Specifier[] {
  const found: Specifier[] = []
  const scan = (pattern: RegExp, kind: SpecifierKind): void => {
    for (const match of source.matchAll(pattern)) {
      const spec = match[2]
      // Only a relative URL names a file here; an absolute URL is an external
      // link and must never be treated as a rewritable path.
      if (kind === 'url' && !spec.startsWith('.')) continue
      // The match ends at the closing quote, so the specifier starts here.
      const end = (match.index ?? 0) + match[0].length - 1
      found.push({ spec, kind, start: end - spec.length, end, relative: spec.startsWith('.') })
    }
  }
  scan(STATIC, 'static')
  scan(CALL, 'dynamic')
  scan(URL_ARGUMENT, 'url')
  found.sort((a, b) => a.start - b.start)
  return found
}

/// The repository-relative path a specifier names, before extension probing.
/// A bundler query (`./x?raw`) names the file before the question mark.
export function normalizeSpecifier(from: string, spec: string): string {
  const joined = posix.normalize(posix.join(posix.dirname(from), spec.split('?')[0]))
  // `posix.normalize('./')` keeps its trailing slash, and a path that climbs out
  // of the repository normalizes to '.'. Both name the repository root, which is
  // the empty prefix in every other path this module produces.
  const trimmed = joined.replace(/\/+$/, '')
  return trimmed === '.' ? '' : trimmed
}

/// Resolve a relative specifier against the file list, trying the extensions
/// this project uses plus directory indexes. Returns null when nothing matches,
/// which the caller reports rather than swallowing.
export function resolveSpecifier(from: string, spec: string, files: Set<string>): string | null {
  if (!spec.startsWith('.')) return null
  const base = normalizeSpecifier(from, spec)
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.json`, `${base}.css`, `${base}/index.ts`, `${base}/index.tsx`]
  for (const candidate of candidates) if (files.has(candidate)) return candidate
  return null
}

export function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path)
}

export function isModule(path: string): boolean {
  return /\.tsx?$/.test(path)
}

/// Directories that are never application source. Excluding them keeps the walk
/// to a few thousand files and away from `node_modules` entirely.
const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.local', '.build-artifacts', 'old'])

export interface Tree {
  files: Set<string>
  directories: Set<string>
}

/// Everything in the repository except ignored directories, keyed relative to
/// the repository root so callers can talk about `src/lib/tauri.ts` directly.
///
/// The universe is the whole repository rather than `src` alone because source
/// does reference siblings — a test reads `src-tauri/capabilities/main.json` —
/// and a resolver that could not see those would silently fail to rewrite them.
///
/// Directories are collected as well as files because `new URL('../../',
/// import.meta.url)` is a legitimate reference to a directory, not a broken path.
export function listTree(repositoryRoot: string): Tree {
  const files = new Set<string>()
  const directories = new Set<string>()
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(repositoryRoot, relative), { withFileTypes: true })) {
      if (IGNORED.has(entry.name)) continue
      const next = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) { directories.add(next); walk(next) } else files.add(next)
    }
  }
  walk('')
  // The repository root itself is a directory a specifier can name.
  directories.add('')
  return { files, directories }
}

export function listFiles(repositoryRoot: string): Set<string> {
  return listTree(repositoryRoot).files
}

/// Read every module once. Callers that need both the source and its graph get
/// one consistent snapshot rather than two reads that can disagree.
export function readSources(repositoryRoot: string, modules: string[]): Map<string, string> {
  const sources = new Map<string, string>()
  for (const file of modules) sources.set(file, readFileSync(join(repositoryRoot, file), 'utf8'))
  return sources
}

export function buildGraph(repositoryRoot: string, scan: string = SCAN_ROOT): Graph {
  // Everything is resolvable; only the scan root is treated as application code.
  const { files, directories } = listTree(repositoryRoot)
  const modules = [...files].filter((file) => isModule(file) && file.startsWith(`${scan}/`)).sort()
  const read = readSources(repositoryRoot, modules)
  const edges: Edge[] = []
  const unresolved: Edge[] = []
  const importers = new Map<string, Set<string>>()
  const bareImports = new Map<string, Set<string>>()
  for (const [from, source] of read) {
    for (const { spec, kind, relative } of extractSpecifiers(source)) {
      if (!relative) {
        const bare = bareImports.get(from) ?? new Set<string>()
        bare.add(spec)
        bareImports.set(from, bare)
        continue
      }
      const to = resolveSpecifier(from, spec, files)
      if (!to) {
        // `new URL('../../', import.meta.url)` names a directory on purpose, so a
        // resolvable directory is not a defect. A file reference that resolves to
        // neither is.
        if (kind === 'url' && directories.has(normalizeSpecifier(from, spec))) continue
        unresolved.push({ from, to: spec, spec, kind })
        continue
      }
      edges.push({ from, to, spec, kind })
      const set = importers.get(to) ?? new Set<string>()
      set.add(from)
      importers.set(to, set)
    }
  }
  return { files, directories, modules, edges, importers, bareImports, unresolved }
}

export function reachable(graph: Graph, roots: string[]): Set<string> {
  const outgoing = new Map<string, string[]>()
  for (const edge of graph.edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to])
  const seen = new Set<string>()
  const pending = [...roots]
  while (pending.length) {
    const current = pending.pop() as string
    if (seen.has(current)) continue
    seen.add(current)
    pending.push(...(outgoing.get(current) ?? []))
  }
  return seen
}

/// Roots an application can actually start from. `src/test/setup.ts` is loaded
/// by vitest configuration rather than imported, so it is a root too.
export const PRODUCTION_ROOTS = ['src/main.tsx', 'src/test/setup.ts']

/// Production modules nothing reaches from a root. Test files are excluded: a
/// test importing a dead module must not keep that module alive.
export function unreachableModules(graph: Graph, roots: string[] = PRODUCTION_ROOTS): string[] {
  const live = reachable(graph, roots)
  return graph.modules.filter((file) => !isTestFile(file) && !live.has(file))
}

const isEntry = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) {
  const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
  const graph = buildGraph(repositoryRoot)
  const dead = unreachableModules(graph)
  console.log(`scanned ${graph.modules.length} modules, ${graph.edges.length} edges, ${graph.files.size} files`)
  console.log(`unresolved relative specifiers: ${graph.unresolved.length}`)
  for (const edge of graph.unresolved) console.log(`  ${edge.from} -> ${edge.spec}`)
  console.log(`production modules unreachable from ${PRODUCTION_ROOTS.join(', ')}: ${dead.length}`)
  for (const file of dead) console.log(`  ${file}`)
}
