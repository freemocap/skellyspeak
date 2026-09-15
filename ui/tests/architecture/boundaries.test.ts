import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildGraph, isTestFile, type Graph } from '../../../tools/import-graph'

/// Structure is checked against the real import graph rather than by reading
/// files, so these rules cannot drift from what the bundler would resolve.
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const graph = buildGraph(repositoryRoot)

interface Violation {
  detail: string
}

interface Rule {
  /// What the rule protects, in one line.
  name: string
  find: (graph: Graph) => Violation[]
}

const under = (path: string, prefix: string): boolean => path.startsWith(prefix)

const edgesFrom = (graph: Graph, from: string[], to: string[]): Violation[] =>
  graph.edges
    .filter((edge) => from.some((p) => under(edge.from, p)) && to.some((p) => under(edge.to, p)))
    .map((edge) => ({ detail: `${edge.from} -> ${edge.to}` }))

const importsReact = (specs: Iterable<string>): boolean =>
  [...specs].some((spec) => spec === 'react' || spec === 'react-dom' || spec.startsWith('react/') || spec.startsWith('react-dom/'))

const importsTauri = (specs: Iterable<string>): boolean => [...specs].some((spec) => spec.startsWith('@tauri-apps/'))

const modulesUnder = (graph: Graph, prefix: string): string[] => graph.modules.filter((module) => under(module, prefix))

const rules: Rule[] = [
  {
    name: 'domain is pure: no React, no Tauri, no outer layer',
    find: (g) => modulesUnder(g, 'ui/src/domain/').flatMap((module) => {
      const found: Violation[] = []
      const bare = g.bareImports.get(module) ?? new Set<string>()
      if (importsReact(bare)) found.push({ detail: `${module} imports React` })
      if (importsTauri(bare)) found.push({ detail: `${module} imports Tauri` })
      found.push(...edgesFrom(g, [module], ['ui/src/components/', 'ui/src/features/', 'ui/src/app/', 'ui/src/state/', 'ui/src/platform/']))
      return found
    }),
  },
  {
    name: 'shared components do not reach up into features, the shell or state',
    find: (g) => edgesFrom(g, ['ui/src/components/'], ['ui/src/features/', 'ui/src/app/', 'ui/src/state/']),
  },
  {
    name: 'only platform touches Tauri',
    find: (g) => g.modules
      .filter((module) => !under(module, 'ui/src/platform/') && !isTestFile(module))
      .filter((module) => importsTauri(g.bareImports.get(module) ?? new Set<string>()))
      .map((module) => ({ detail: `${module} imports @tauri-apps/*` })),
  },
  {
    name: 'platform does not reach up into the layers above it',
    find: (g) => edgesFrom(g, ['ui/src/platform/'], ['ui/src/components/', 'ui/src/features/', 'ui/src/app/', 'ui/src/state/']),
  },
  {
    name: 'features do not reach up into the shell',
    find: (g) => edgesFrom(g, ['ui/src/features/'], ['ui/src/app/']),
  },
  {
    name: 'features are independent of one another',
    find: (g) => {
      const owner = (path: string): string | null => {
        const match = path.match(/^ui\/src\/features\/([^/]+)\//)
        return match ? match[1] : null
      }
      return g.edges
        .filter((edge) => {
          const from = owner(edge.from)
          const to = owner(edge.to)
          return from !== null && to !== null && from !== to
        })
        .map((edge) => ({ detail: `${edge.from} -> ${edge.to}` }))
    },
  },
  {
    name: 'components and domain do not depend on state',
    find: (g) => edgesFrom(g, ['ui/src/components/', 'ui/src/domain/'], ['ui/src/state/']),
  },
]

/// Violations that exist today and are scheduled for removal. Every entry names
/// the exact edge, so the list cannot hide a different problem, and the suite
/// fails if an entry stops being a violation — the list can only shrink.
const ALLOWED: Record<string, string[]> = {}

describe('module boundaries', () => {
  for (const rule of rules) {
    it(rule.name, () => {
      const allowed = new Set(ALLOWED[rule.name] ?? [])
      const found = rule.find(graph).map((violation) => violation.detail).sort()
      const introduced = found.filter((detail) => !allowed.has(detail))
      expect(introduced, `new violations of "${rule.name}"`).toEqual([])
    })
  }

  it('the allowance list contains no violation that has been fixed', () => {
    const stale: string[] = []
    for (const [name, entries] of Object.entries(ALLOWED)) {
      const rule = rules.find((candidate) => candidate.name === name)
      if (!rule) { stale.push(`${name}: no such rule`); continue }
      const found = new Set(rule.find(graph).map((violation) => violation.detail))
      for (const entry of entries) if (!found.has(entry)) stale.push(`${name}: ${entry}`)
    }
    expect(stale, 'remove these from ALLOWED').toEqual([])
  })

  it('every relative specifier resolves', () => {
    const broken = graph.unresolved.map((edge) => `${edge.from} -> ${edge.spec}`).sort()
    expect(broken, 'unresolvable relative imports').toEqual([])
  })
})
