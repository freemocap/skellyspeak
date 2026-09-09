import type { SkillSnapshot } from './skills'
import type { TreeNode } from '../pages/skillTree'

const colors: Record<string, { ink: string; bright: string }> = {
  reference: { ink: '#a32b44', bright: '#c52e50' },
  properties: { ink: '#924300', bright: '#be6318' },
  events: { ink: '#735800', bright: '#ad890a' },
  time: { ink: '#286044', bright: '#14865a' },
  space: { ink: '#00636b', bright: '#008b98' },
  operators: { ink: '#3559a2', bright: '#416ed0' },
  connections: { ink: '#75469a', bright: '#9753bd' },
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
