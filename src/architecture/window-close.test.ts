import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { buildGraph, isTestFile } from '../../scripts/import-graph'

/// The window must always close. While the page listens for a close request, in any
/// form, Tauri holds the close and waits for the page to destroy the window itself,
/// which this app has no permission to do. No production module may listen for one.
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
const CLOSE_LISTENERS = /tauri:\/\/close-requested|WINDOW_CLOSE_REQUESTED|onCloseRequested/

it('nothing in the app listens for a window close request', () => {
  const graph = buildGraph(repositoryRoot)
  const production = graph.modules.filter(module => !isTestFile(module))
  expect(production.length).toBeGreaterThan(50)
  const offenders = production.filter(module => CLOSE_LISTENERS.test(readFileSync(repositoryRoot + module, 'utf8')))
  expect(offenders, 'these modules listen for a close request, which stops the window closing').toEqual([])
})
