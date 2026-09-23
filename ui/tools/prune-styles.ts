import postcss from 'postcss'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'

/// Dead-CSS analysis, shared by the dead-code test and the prune command.
///
/// A class is reported only when it appears nowhere in source. Two kinds of name
/// are excluded explicitly: classes a dependency applies at runtime
/// (`react-flow*`) and fragments the source composes into a name
/// (`s-${state}`), which never appear literally.
///
/// This module deliberately has no relative imports: the architecture tests
/// import it, so it is part of the main TypeScript program, which does not allow
/// `.ts` import extensions.

/// Vendor class prefixes a dependency applies at runtime. Bare `react-flow` is
/// included, not only `react-flow__`: the skill map scopes the container itself.
const LIBRARY_PREFIXES = ['react-flow']

/// Everywhere a class in these sheets can legitimately be used. The application
/// is not the only consumer: the preview harnesses under `ui/tools` render real
/// components, and `features/admin.css` is built for the server admin panel,
/// whose markup and script live with the server. A root missing from this list
/// makes live styles look dead, which is how a prune deletes working styling.
const SOURCE_ROOTS = ['ui/src', 'ui/tools', 'server/app/diagnostics/admin_assets']

/// Every stylesheet in the stylesheet root, so a new sheet is analysed without
/// being listed here; `npm run styles:check` fails if the manifest misses one.
function sheetFiles(repositoryRoot: string, stylesheet: string): string[] {
  const target = join(repositoryRoot, stylesheet)
  if (!statSync(target).isDirectory()) return [target]
  return readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry =>
    entry.isDirectory() ? sheetFiles(repositoryRoot, join(stylesheet, entry.name))
      : entry.name.endsWith('.css') ? [join(target, entry.name)] : [])
}

function sourceText(repositoryRoot: string, roots: string[]): string {
  const parts: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(repositoryRoot, dir), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const next = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(next)
      else if (/\.(ts|tsx|html|js)$/.test(entry.name)) parts.push(readFileSync(join(repositoryRoot, next), 'utf8'))
    }
  }
  for (const root of roots) {
    try { walk(root) } catch { /* A consumer that is not checked out here cannot be scanned. */ }
  }
  return parts.join('\n')
}

/// Fragments the source builds a class name from at runtime. The fragment can
/// open the string or follow another class inside it (`heat heat-${level}`), so
/// whitespace counts as a start just as a quote does.
function dynamicPrefixes(haystack: string): string[] {
  return [...haystack.matchAll(/(?:[\'`"]|\s)([a-zA-Z][\w-]*-)\$\{/g)].map(m => m[1])
}

/// Whole-identifier test, so a short class such as `lg` is not "found" inside
/// `dialog`. The identifier boundary keeps the report honest in both
/// directions: no false "still used" and no false "dead".
function references(haystack: string, name: string, cache: Map<string, RegExp>): boolean {
  let pattern = cache.get(name)
  if (pattern === undefined) {
    pattern = new RegExp(`(^|[^\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w-]|$)`)
    cache.set(name, pattern)
  }
  return pattern.test(haystack)
}

// Inspect selectors only: URLs, comments and declaration values are not classes.
// Quoted attribute values are deliberately ignored. Escaped selectors require
// a full selector parser and are kept conservatively by the write operation.
function classes(selector: string): string[] {
  const unquoted = selector.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '')
  return [...unquoted.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(match => match[1])
}

export interface DeadCss {
  /// Class names in the stylesheet that nothing in source references.
  unused: string[]
  /// Class names kept because a dependency owns them.
  library: string[]
  /// Class names kept because the source composes them at runtime.
  dynamic: string[]
}

export function analyseStyles(repositoryRoot: string, scan: string[] = SOURCE_ROOTS, stylesheet = 'ui/src/styles'): DeadCss {
  const names = new Set<string>()
  for (const file of sheetFiles(repositoryRoot, stylesheet)) {
    postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => {
      for (const name of classes(rule.selector)) names.add(name)
    })
  }
  const haystack = sourceText(repositoryRoot, scan)
  const prefixes = dynamicPrefixes(haystack)
  const cache = new Map<string, RegExp>()
  const unused: string[] = []
  const library: string[] = []
  const dynamic: string[] = []
  for (const name of names) {
    if (references(haystack, name, cache)) continue
    if (LIBRARY_PREFIXES.some(prefix => name.startsWith(prefix))) { library.push(name); continue }
    if (prefixes.some(prefix => name.startsWith(prefix))) { dynamic.push(name); continue }
    unused.push(name)
  }
  return { unused: unused.sort(), library: library.sort(), dynamic: dynamic.sort() }
}

/// Remove selector parts whose class can never match, and rules left empty.
/// Nothing is written until every sheet has been processed, so a refusal leaves
/// the stylesheets untouched.
export async function prune(repositoryRoot: string, stylesheet = 'ui/src/styles'): Promise<string> {
  // The same roots the report uses: a prune must never delete a class the
  // report would have called live.
  const haystack = sourceText(repositoryRoot, SOURCE_ROOTS)
  const prefixes = dynamicPrefixes(haystack)
  const cache = new Map<string, RegExp>()
  const dead = (name: string): boolean =>
    !references(haystack, name, cache) && !LIBRARY_PREFIXES.some(p => name.startsWith(p)) && !prefixes.some(p => name.startsWith(p))
  let parts = 0
  let rules = 0
  const sheets = sheetFiles(repositoryRoot, stylesheet).map(file => ({ file, parsed: postcss.parse(readFileSync(file, 'utf8'), { from: file }) }))
  for (const { parsed } of sheets) {
    parsed.walkRules((rule) => {
      // Pseudo-class alternatives/negation and escapes need semantic analysis.
      // A missing class inside :not() or :is() does not make a selector dead.
      if (/[()\\]/.test(rule.selector)) return
      const before = rule.selectors
      const kept = before.filter((part) => {
        const names = classes(part)
        return names.every(name => !dead(name))
      })
      if (kept.length === 0) { rules++; rule.remove(); return }
      if (kept.length !== before.length) { parts += before.length - kept.length; rule.selector = kept.join(', ') }
    })
  }

  // Never relocate declarations across intervening rules. Duplicate selectors
  // require a deliberate owner/cascade review, even within a single sheet.
  const seen = new Set<string>()
  for (const { file, parsed } of sheets) {
    parsed.walkRules(rule => {
      const chain: string[] = []
      let parent = rule.parent
      while (parent && parent.type !== 'root') {
        chain.unshift(parent.toString().split('{')[0].trim())
        parent = parent.parent
      }
      const key = chain.join('/') + '|' + rule.selector
      if (seen.has(key)) throw new Error(file + ': duplicate selector ' + rule.selector + '; no files written; review cascade manually')
      seen.add(key)
    })
  }
  for (const { file, parsed } of sheets) writeFileSync(file, parsed.toString())
  return `removed ${rules} rule(s) and ${parts} selector part(s)`
}

const isEntry = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  if (process.argv.includes('--write')) {
    console.log(await prune(root, 'ui/src/styles'))
  } else {
    const { unused, library, dynamic } = analyseStyles(root)
    console.log(`unused classes: ${unused.length} | kept as library-owned: ${library.length} | kept as runtime-composed: ${dynamic.length}`)
    if (unused.length) console.log(unused.join(' '))
  }
}
