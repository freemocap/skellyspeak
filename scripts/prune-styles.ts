import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'

/// Dead-CSS analysis, shared by the dead-code test and the prune command.
///
/// A class is reported only when it appears nowhere in source. Two kinds of name
/// are excluded explicitly: classes a dependency applies at runtime
/// (`react-flow__*`) and fragments the source composes into a name
/// (`s-${state}`), which never appear literally.
///
/// This module deliberately has no relative imports: the architecture tests
/// import it, so it is part of the main TypeScript program, which does not allow
/// `.ts` import extensions.

const LIBRARY_PREFIXES = ['react-flow__']

function sourceText(repositoryRoot: string, scan: string): string {
  const parts: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(repositoryRoot, dir), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const next = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(next)
      else if (/\.(ts|tsx)$/.test(entry.name)) parts.push(readFileSync(join(repositoryRoot, next), 'utf8'))
    }
  }
  walk(scan)
  return parts.join('\n')
}

/// Fragments the source builds a class name from at runtime.
function dynamicPrefixes(haystack: string): string[] {
  return [...haystack.matchAll(/[\'`"]([a-zA-Z][\w-]*-)\$\{/g)].map(m => m[1])
}

/// Structural views of the postcss tree. `postcss` is imported dynamically
/// inside the prune, so its types are not in scope here; these describe exactly
/// the nodes this module reads and touches.
interface NodeLike {
  type?: string
  name?: string
  params?: string
  prop?: string
  parent?: NodeLike
  clone?: () => NodeLike
}

interface RuleNode {
  selector: string
  parent?: NodeLike
  each: (callback: (node: NodeLike) => void) => void
  append: (node: NodeLike) => void
  remove: () => void
}

export interface DeadCss {
  /// Class names in the stylesheet that nothing in source references.
  unused: string[]
  /// Class names kept because a dependency owns them.
  library: string[]
  /// Class names kept because the source composes them at runtime.
  dynamic: string[]
}

export function analyseStyles(repositoryRoot: string, scan = 'src', stylesheet = 'src/styles.css'): DeadCss {
  const css = readFileSync(join(repositoryRoot, stylesheet), 'utf8')
  const haystack = sourceText(repositoryRoot, scan)
  const prefixes = dynamicPrefixes(haystack)
  const unused: string[] = []
  const library: string[] = []
  const dynamic: string[] = []
  for (const name of new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]))) {
    if (haystack.includes(name)) continue
    if (LIBRARY_PREFIXES.some(prefix => name.startsWith(prefix))) { library.push(name); continue }
    if (prefixes.some(prefix => name.startsWith(prefix))) { dynamic.push(name); continue }
    unused.push(name)
  }
  return { unused: unused.sort(), library: library.sort(), dynamic: dynamic.sort() }
}

/// Remove selector parts whose class can never match, and rules left empty.
async function prune(repositoryRoot: string, stylesheet: string): Promise<string> {
  const { default: postcss } = await import('postcss')
  const css = readFileSync(join(repositoryRoot, stylesheet), 'utf8')
  const haystack = sourceText(repositoryRoot, 'src')
  const prefixes = dynamicPrefixes(haystack)
  const dead = (name: string): boolean =>
    !haystack.includes(name) && !LIBRARY_PREFIXES.some(p => name.startsWith(p)) && !prefixes.some(p => name.startsWith(p))
  const parsed = postcss.parse(css, { from: stylesheet })
  let parts = 0
  let rules = 0
  parsed.walkRules((rule) => {
    const before = rule.selector.split(',').map(p => p.trim()).filter(Boolean)
    const kept = before.filter((part) => {
      const classes = [...part.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1])
      return classes.length === 0 || classes.every(name => !dead(name))
    })
    if (kept.length === 0) { rules++; rule.remove(); return }
    if (kept.length !== before.length) { parts += before.length - kept.length; rule.selector = kept.join(', ') }
  })

  // Dropping a part can leave a selector that another rule already uses. Merge
  // into the LATER rule: that is where the cascade already gave precedence, so
  // moving the earlier rule's remaining declarations there changes nothing, and
  // a property the later rule already sets keeps its winning value.
  const scopeOf = (rule: RuleNode): string => {
    const chain: string[] = []
    let node = rule.parent
    while (node && node.type !== 'root') {
      chain.unshift(`${node.name ?? ''} ${node.params ?? ''}`)
      node = node.parent
    }
    return chain.join(' / ')
  }
  const pairs: { earlier: RuleNode; later: RuleNode }[] = []
  const seen = new Map<string, RuleNode>()
  parsed.walkRules((rule) => {
    const node = rule as unknown as RuleNode
    const key = `${scopeOf(node)} | ${node.selector}`
    const earlier = seen.get(key)
    if (earlier === undefined) { seen.set(key, node); return }
    pairs.push({ earlier, later: node })
  })
  let merged = 0
  for (const { earlier, later } of pairs) {
    const mine = new Set<string>()
    later.each((decl) => { if (decl.type === 'decl' && decl.prop) mine.add(decl.prop) })
    earlier.each((decl) => {
      if (decl.type !== 'decl' || !decl.prop || mine.has(decl.prop) || !decl.clone) return
      later.append(decl.clone() as never)
    })
    earlier.remove()
    merged++
  }
  writeFileSync(join(repositoryRoot, stylesheet), parsed.toString())
  return `removed ${rules} rule(s) and ${parts} selector part(s); merged ${merged} duplicate selector(s)`
}

const isEntry = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) {
  const root = fileURLToPath(new URL('../', import.meta.url))
  if (process.argv.includes('--write')) {
    console.log(await prune(root, 'src/styles.css'))
  } else {
    const { unused, library, dynamic } = analyseStyles(root)
    console.log(`unused classes: ${unused.length} | kept as library-owned: ${library.length} | kept as runtime-composed: ${dynamic.length}`)
    if (unused.length) console.log(unused.join(' '))
  }
}
