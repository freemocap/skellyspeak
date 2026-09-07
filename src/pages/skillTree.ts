import { domainColors } from '../lib/skill-domains'
import catalog from '../../src-tauri/src/skills/catalog.json'
import legacy from '../../src-tauri/src/skills/catalog-v1.json'
import second from '../../src-tauri/src/skills/catalog-v2.json'
export type TreeLayout = 'radial' | 'down' | 'right' | 'left'
export type TreeNode = {
  id: string; parent: string | null; label: string; code: string
  kind: 'root' | 'domain' | 'skill'
  color: string; description: string; criterion: string
}
export const skillTree: TreeNode[] = (catalog as TreeNode[]).map(node => {
  let domain = node
  while (domain.kind === 'skill') {
    const parent = catalog.find(item => item.id === domain.parent)
    if (!parent) throw new Error(`Missing parent for ${domain.id}`)
    domain = parent as TreeNode
  }
  return { ...node, color: domain.kind === 'domain' ? domainColors(domain.id).bright : '#e8eef7' }
})
export function treeNode(id: string): TreeNode {
  const node = skillTree.find((item) => item.id === id)
  if (!node) throw new Error(`Unknown skill-tree node: ${id}`)
  return node
}
export function evidenceLabel(id: string, version: number): string {
  const definitions = version === 1 ? legacy : version === 2 ? second : version === 3 ? catalog : null
  const item = definitions?.find((node) => node.id === id)
  if (!item) throw new Error(`Unknown evidence rubric: ${version}/${id}`)
  return item.label
}
export function descendants(id: string): string[] {
  return [id, ...skillTree.filter((node) => node.parent === id).flatMap((node) => descendants(node.id))]
}
export function nodeDepth(node: TreeNode): number {
  return node.parent === null ? 0 : 1 + nodeDepth(treeNode(node.parent))
}
export const displayedTree = skillTree.filter((node) => nodeDepth(node) < 3)
export function mapAnchor(id: string): TreeNode {
  const node = treeNode(id)
  return nodeDepth(node) < 3 ? node : mapAnchor(node.parent!)
}
export function nodeScale(node: TreeNode): number {
  return Math.pow(0.76, nodeDepth(node)) * 1.3
}
export function ancestry(id: string): TreeNode[] {
  const node = treeNode(id)
  return [...(node.parent ? ancestry(node.parent) : []), node]
}
/** Ordered leaf spans keep variable-width branches separate in every layout. */
export function nodePosition(node: TreeNode, layout: TreeLayout, visible: TreeNode[] = skillTree): { x: number; y: number } {
  let leaf = 0
  const positions = new Map<string, { depth: number; breadth: number }>()
  const walk = (id: string, depth: number): number => {
    const children = visible.filter((n) => n.parent === id)
    const slots = children.map((child) => walk(child.id, depth + 1))
    const breadth = slots.length ? (slots[0] + slots[slots.length - 1]) / 2 : leaf++
    if (depth === 1) leaf += 0.6
    positions.set(id, { depth, breadth })
    return breadth
  }
  const center = walk('experience', 0)
  const point = positions.get(node.id)
  if (!point) throw new Error(`Node not in visible tree: ${node.id}`)
  if (layout === 'radial') {
    if (point.depth === 0) return { x: 0, y: 0 }
    const angle = (-90 + (point.breadth + 0.5) * 360 / leaf) * Math.PI / 180
    const radius = point.depth * Math.max(340, leaf * 38)
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
  }
  const breadth = (point.breadth - center) * (layout === 'down' ? 250 : 76)
  return layout === 'down' ? { x: breadth, y: point.depth * 180 } : { x: point.depth === 0 ? 0 : point.depth * 620 * (layout === 'left' ? -1 : 1), y: breadth }
}
