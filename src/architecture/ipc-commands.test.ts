// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { buildGraph, isTestFile, isTestInfrastructure } from '../../scripts/import-graph'

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
const graph = buildGraph(repositoryRoot)

/// A literal command name passed to an IPC invoke. A wrapper that forwards a
/// variable — `invoke(cmd, args)` — names nothing and is not collected.
const INVOKE = /\b(?:nativeInvoke|invoke)\s*(?:<[^(]*?>)?\s*\(\s*(['"])([^'"]+)\1/g

/// The bare names `tauri::generate_handler!` registers, however they are
/// qualified. The list is the authority: a name absent from it cannot be called.
function registeredCommands(): Set<string> {
  const source = readFileSync(new URL('../../src-tauri/src/lib.rs', import.meta.url), 'utf8')
  const block = /tauri::generate_handler!\[([\s\S]*?)\]/.exec(source)
  if (!block) throw new Error('lib.rs declares no generate_handler! list')
  return new Set(block[1].split(',').map((entry) => entry.trim().split('::').pop()?.trim() ?? '').filter(Boolean))
}

it('every command the frontend invokes is registered natively', () => {
  const invoked = new Map<string, string[]>()
  for (const [module, source] of graph.sources) {
    if (isTestFile(module) || isTestInfrastructure(module)) continue
    const names = [...source.matchAll(INVOKE)].map((match) => match[2])
    if (names.length) invoked.set(module, names)
  }
  // A scan that finds almost nothing would pass for the wrong reason.
  expect(invoked.size, 'the invoke scan found no call sites').toBeGreaterThan(8)
  const known = registeredCommands()
  expect(known.size, 'lib.rs registered no commands').toBeGreaterThan(20)
  const missing = [...invoked].flatMap(([module, names]) => names.filter((name) => !known.has(name)).map((name) => `${module}: ${name}`))
  expect(missing.sort(), 'the frontend invokes a command the native side does not register').toEqual([])
})
