import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { buildGraph, PRODUCTION_ROOTS, reachable } from '../../../tools/import-graph'

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const graph = buildGraph(repositoryRoot)

/// Modules that must be reachable for the walk to be believable. `SkillsPage`
/// is reached through `lazy(() => import(...))` and `LiveActivity` through a
/// static import inside an overlay, so both are the cases a walk that only
/// understands `import ... from` gets wrong. Asserting them is a guard on the
/// tool, not on the application.
const CRITICAL = [
  'ui/src/app/main.tsx',
  'ui/src/app/App.tsx',
  'ui/src/features/conversation/ConversationPage.tsx',
  'ui/src/features/skills/SkillsPage.tsx',
  'ui/src/features/activity/LiveActivity.tsx',
  'ui/src/features/activity/LogsOverlay.tsx',
  'ui/src/platform/ipc/tauri.ts',
  'ui/src/platform/diagnostics/faults.ts',
]

it('reaches the application from its entry points', () => {
  const live = reachable(graph, PRODUCTION_ROOTS)
  const missing = CRITICAL.filter((module) => !live.has(module))
  expect(missing, 'reachability walk lost these modules').toEqual([])
  expect(graph.unresolved, 'unresolvable relative imports').toEqual([])
  expect(graph.edges.some(edge => edge.from === 'ui/src/app/main.tsx' && edge.to === 'ui/src/styles/index.css'),
    'the startup stylesheet side-effect import must be part of the graph').toBe(true)
})
