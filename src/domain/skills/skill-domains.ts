import type { SkillSnapshot } from './skills'
import type { TreeNode } from './skillTree'

const colors: Record<string, { ink: string; bright: string; muted: string }> = {
  social: { ink: '#226568', bright: '#00b8ad', muted: 'color-mix(in srgb, #00b8ad 28%, #8997aa)' },
  statements: { ink: '#315ca0', bright: '#3e82f6', muted: 'color-mix(in srgb, #3e82f6 28%, #8997aa)' },
  descriptions: { ink: '#6649a1', bright: '#9258ed', muted: 'color-mix(in srgb, #9258ed 28%, #8997aa)' },
  questions: { ink: '#704976', bright: '#bf55da', muted: 'color-mix(in srgb, #bf55da 28%, #8997aa)' },
  opinions: { ink: '#3c666d', bright: '#149acb', muted: 'color-mix(in srgb, #149acb 28%, #8997aa)' },
  situating: { ink: '#286044', bright: '#16b875', muted: 'color-mix(in srgb, #16b875 28%, #8997aa)' },
}
export function domainColors(id: string) {
  const color = colors[id]
  if (!color) throw new Error(`Unknown skill domain ${id}`)
  return color
}
export function skillDomain(snapshot: SkillSnapshot, node: TreeNode): TreeNode {
  if (node.kind === 'domain') return node
  const parent = snapshot.catalog.find(item => item.id === node.parent)
  if (!parent) throw new Error(`Missing parent for ${node.id}`)
  return skillDomain(snapshot, parent)
}
