import type { TreeNode } from '../pages/skillTree'
import type { SkillJudgment, SkillRecord, SkillSnapshot } from './skills'
import { domainColors } from './skill-domains'

export function createSkillCatalog(catalog: TreeNode[]) {
  const nodes = new Map(catalog.map(node => [node.id, node]))
  if (nodes.size !== catalog.length) throw new Error('Duplicate skill identity')
  const node = (id: string): TreeNode => {
    const found = nodes.get(id)
    if (!found) throw new Error(`Unknown skill: ${id}`)
    return found
  }
  const paths = new Map<string, TreeNode[]>()
  const ancestry = (id: string, visiting = new Set<string>()): TreeNode[] => {
    const cached = paths.get(id)
    if (cached) return cached
    if (visiting.has(id)) throw new Error(`Cyclic skill ancestry: ${id}`)
    visiting.add(id)
    const item = node(id)
    const path = [...(item.parent ? ancestry(item.parent, visiting) : []), item]
    paths.set(id, path)
    return path
  }
  const domain = (id: string): TreeNode => {
    const found = ancestry(id).find(item => item.kind === 'domain')
    if (!found) throw new Error(`No domain for ${id}`)
    return found
  }
  const children = (id: string): TreeNode[] => catalog.filter(item => item.parent === id)
  const descendants = (id: string): string[] => catalog.filter(item => ancestry(item.id).some(parent => parent.id === id)).map(item => item.id)
  const painted = catalog.map(item => ({ ...item, color: item.kind === 'root' ? '#e8eef7' : domainColors(domain(item.id).id).bright }))
  return { node, ancestry, domain, children, descendants, nodes: painted, displayed: painted.filter(item => ancestry(item.id).length <= 3), mapAnchor: (id: string) => { const path = ancestry(id); return path[Math.min(2, path.length - 1)] }, scale: (id: string) => Math.pow(0.76, ancestry(id).length - 1) * 1.3 }
}
export type SkillCatalog = ReturnType<typeof createSkillCatalog>
export interface EvidenceEntry { record: SkillRecord; judgment: SkillJudgment; xp: number; state: string }
const indexes = new WeakMap<SkillSnapshot, ReturnType<typeof buildIndex>>()
function buildIndex(snapshot: SkillSnapshot) {
  const catalog = createSkillCatalog(snapshot.catalog)
  const excluded = new Set(snapshot.profile.choices.excluded_attempts)
  const credits = new Map(snapshot.profile.credits.map(credit => [`${credit.attempt_id}:${credit.skill_id}`, credit.xp]))
  const messages = new Map<string, SkillRecord[]>()
  const skills = new Map<string, EvidenceEntry[]>()
  const entries = new Map<string, EvidenceEntry>()
  for (const record of snapshot.records) {
    const key = JSON.stringify([record.chat_id, record.message_id])
    const records = messages.get(key) ?? []
    records.push(record)
    messages.set(key, records)
    for (const judgment of record.assessment?.judgments ?? []) {
      const state = record.catalog_version !== snapshot.catalog_version ? 'historical' : excluded.has(record.attempt_id) ? 'excluded' : record.status
      const entry = { record, judgment, state, xp: state === 'complete' ? credits.get(`${record.attempt_id}:${judgment.skill_id}`) ?? 0 : 0 }
      entries.set(`${record.attempt_id}:${judgment.skill_id}`, entry)
      if (record.catalog_version === snapshot.catalog_version) {
        const items = skills.get(judgment.skill_id) ?? []
        items.push(entry)
        skills.set(judgment.skill_id, items)
      }
    }
  }
  return { catalog, credits, excluded, messages, skills, entries, progress: new Map(snapshot.profile.skills.map(item => [item.skill_id, item])) }
}
export function skillIndex(snapshot: SkillSnapshot) {
  let index = indexes.get(snapshot)
  if (!index) { index = buildIndex(snapshot); indexes.set(snapshot, index) }
  return index
}
export function evidenceForSkill(snapshot: SkillSnapshot, id: string, chatId: string | null): EvidenceEntry[] {
  const index = skillIndex(snapshot)
  return index.catalog.descendants(id).flatMap(skill => index.skills.get(skill) ?? []).filter(entry => (chatId === null || entry.record.chat_id === chatId) && entry.judgment.outcome !== 'not_observed').sort((a, b) => b.record.at_secs - a.record.at_secs)
}

export function practiceSuggestions(snapshot: SkillSnapshot) {
  const index = skillIndex(snapshot)
  const focus = index.catalog.node(snapshot.profile.active_focus)
  const focusDomain = index.catalog.domain(focus.id).id
  const areas = index.catalog.nodes.filter(node => node.kind === 'domain').map(domain => {
    if (domain.id === focusDomain) return focus
    const skills = index.catalog.children(domain.id).filter(node => node.kind === 'skill')
    skills.sort((a, b) => index.progress.get(a.id)!.xp - index.progress.get(b.id)!.xp)
    if (!skills.length) throw new Error(`No practice skills in ${domain.id}`)
    return skills[0]
  })
  return { areas, suggested: [focus, ...areas.filter(node => node.id !== focus.id).sort((a, b) => index.progress.get(a.id)!.xp - index.progress.get(b.id)!.xp)].slice(0, 3) }
}
