import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { buildGraph, PRODUCTION_ROOTS, reachable, unreachableModules, unusedExports } from '../../scripts/import-graph'
import { analyseStyles } from '../../scripts/prune-styles'

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
const graph = buildGraph(repositoryRoot)

/// Modules that must be reachable for the walk to be believable. `SkillsPage`
/// is reached through `lazy(() => import(...))` and `LiveActivity` through a
/// static import inside an overlay, so both are the cases a walk that only
/// understands `import ... from` gets wrong. Asserting them is a guard on the
/// tool, not on the application.
const CRITICAL = [
  'src/main.tsx',
  'src/App.tsx',
  'src/features/guided/GuidedPage.tsx',
  'src/features/skills/SkillsPage.tsx',
  'src/features/activity/LiveActivity.tsx',
  'src/features/activity/LogsOverlay.tsx',
  'src/platform/ipc/tauri.ts',
  'src/platform/diagnostics/faults.ts',
]

it('reaches the application from its entry points', () => {
  const live = reachable(graph, PRODUCTION_ROOTS)
  const missing = CRITICAL.filter((module) => !live.has(module))
  expect(missing, 'reachability walk lost these modules').toEqual([])
  expect(graph.unresolved, 'unresolvable relative imports').toEqual([])
})

/// Warning only, by decision: unreachable production code is worth knowing about
/// but a reorganization deletes it in deliberate batches, and failing here would
/// block a legitimate intermediate state. The list should be empty; when it is
/// not, the offender is named below.
it('warns about production modules no entry point reaches', () => {
  const unreachable = unreachableModules(graph)
  if (unreachable.length) {
    console.warn(`${unreachable.length} production module(s) unreachable from ${PRODUCTION_ROOTS.join(', ')}:\n` +
      unreachable.map((module) => `  ${module}`).join('\n'))
  }
  // The walk itself is asserted above; this test exists to report, and reports
  // through the console rather than by failing.
})

/// Warning only, for a stronger reason than the module list: an export may be a
/// seam kept for a caller that has not landed yet. The list should be empty; when
/// it is not, the offender is named below.
it('warns about exports no other module mentions', () => {
  const unused = unusedExports(graph)
  if (unused.length) {
    console.warn(unused.length + " export(s) no other module mentions:\n" +
      unused.map((item) => "  " + item.module + ": " + item.name).join("\n"))
  }
})

/// Warning only, for the same reason. `npm run styles:dead` reports the same
/// list, and `npm run styles:prune` removes them.
it('warns about stylesheet classes no source file references', () => {
  const { unused } = analyseStyles(repositoryRoot)
  if (unused.length) {
    console.warn(`${unused.length} stylesheet class(es) appear nowhere in src:\n  ${unused.join('\n  ')}`)
  }
})
