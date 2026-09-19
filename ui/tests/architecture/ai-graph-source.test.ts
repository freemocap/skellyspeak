// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

/// The AI View must stay a view of `turn_plan.rs`. These checks forbid a second
/// definition of the graph without forbidding ordinary integration code.
const root = fileURLToPath(new URL('../../../', import.meta.url))
const plan = readFileSync(join(root, 'native/src/conversations/turn_plan.rs'), 'utf8')
const kinds = [...new Set([...plan.matchAll(/kind:\s*"([a-z_]+)"/g)].map(match => match[1]))]

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sources(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}
const ui = join(root, 'ui/src')
const kindLiteral = new RegExp(`['"\`](${kinds.join('|')})['"\`]`, 'g')

it('reads the plan it guards', () => {
  expect(kinds).toContain('persona_reply')
  expect(kinds.length).toBeGreaterThan(8)
})

it('keeps the AI View, its summary and its hydration kind-agnostic', () => {
  const agnostic = [...sources(join(ui, 'features/activity')), join(ui, 'domain/conversation/activity-summary.ts'), join(ui, 'components/feedback/ActivitySummary.tsx')]
  const found = agnostic.flatMap(path => [...readFileSync(path, 'utf8').matchAll(kindLiteral)].map(match => `${path.slice(root.length)}: ${match[1]}`))
  expect(found).toEqual([])
})

/// The one sanctioned place that names which operations are replies. Everything
/// else asks it; nothing else may list kinds.
const REPLY_IDENTITY = join(ui, 'domain/conversation/reply-state.ts')

it('declares no collection of operation kinds or dependency relations anywhere in the UI', () => {
  const found: string[] = []
  for (const path of sources(ui)) {
    if (path === REPLY_IDENTITY) continue
    const text = readFileSync(path, 'utf8')
    for (const literal of text.matchAll(/[[{][^[\]{}]*[\]}]/g)) {
      const named = new Set([...literal[0].matchAll(kindLiteral)].map(match => match[1]))
      if (named.size >= 2) found.push(`${path.slice(root.length)}: ${[...named].join(', ')}`)
    }
    if (/\bdependencies\s*:\s*\[\s*['"]/.test(text)) found.push(`${path.slice(root.length)}: dependencies literal`)
  }
  expect(found).toEqual([])
})
