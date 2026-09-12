import type { SkillProgress, SkillSnapshot } from './skills'
import { skillDomain } from './skill-domains'
import type { TreeNode } from './skillTree'

export interface DomainStatistics {
  node: TreeNode
  xp: number
  unassisted: number
  assisted: number
  stars: number
  practiced: number
  skills: SkillProgress[]
}

/** Descriptive counts from the saved credit projection, never an ability estimate. */
export function practiceStatistics(snapshot: SkillSnapshot) {
  if (snapshot.profile.choices.target !== snapshot.target || snapshot.profile.choices.learner_id !== snapshot.learner_id || snapshot.records.some(record => record.target !== snapshot.target || record.learner_id !== snapshot.learner_id)) throw new Error('Practice evidence belongs to another language or learner')
  if (snapshot.profile.rules_version !== 1) throw new Error('Unsupported practice scoring rules')
  const domains: DomainStatistics[] = snapshot.catalog.filter(node => node.kind === 'domain').map(node => ({ node, xp: 0, unassisted: 0, assisted: 0, stars: 0, practiced: 0, skills: [] }))
  const seen = new Set<string>()
  for (const progress of snapshot.profile.skills) {
    const node = snapshot.catalog.find(item => item.id === progress.skill_id && item.kind === 'skill')
    if (!node || seen.has(progress.skill_id)) throw new Error(`Invalid progress skill ${progress.skill_id}`)
    seen.add(progress.skill_id)
    for (const count of [progress.xp, progress.successes, progress.assisted]) {
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid practice count')
    }
    const domain = domains.find(item => item.node.id === skillDomain(snapshot, node).id)
    if (!domain) throw new Error(`Missing domain for ${node.id}`)
    domain.xp += progress.xp
    domain.unassisted += progress.successes
    domain.assisted += progress.assisted
    domain.stars += Number(progress.star)
    domain.practiced += Number(progress.successes + progress.assisted > 0)
    domain.skills.push(progress)
  }
  const sum = (field: 'xp' | 'unassisted' | 'assisted' | 'stars' | 'practiced') => domains.reduce((total, domain) => total + domain[field], 0)
  if (sum('xp') !== snapshot.profile.xp) throw new Error('Domain XP does not reconcile with profile XP')
  const messages = new Set<string>()
  const creditKeys = new Set<string>()
  for (const credit of snapshot.profile.credits) {
    const record = snapshot.records.find(item => item.attempt_id === credit.attempt_id)
    const key = JSON.stringify([credit.attempt_id, credit.skill_id])
    if (!record || !seen.has(credit.skill_id) || creditKeys.has(key)) throw new Error('Invalid practice credit provenance')
    const assisted = record.input.suggestion || record.input.scaffold || record.input.revision
    if (record.status !== 'complete' || record.catalog_version !== snapshot.catalog_version || snapshot.profile.choices.excluded_attempts.includes(record.attempt_id) || !record.assessment?.judgments.some(judgment => judgment.skill_id === credit.skill_id && judgment.outcome === 'demonstrated') || credit.xp !== (assisted ? 2 : 10)) throw new Error('Practice credit does not match eligible source evidence')
    creditKeys.add(key)
    messages.add(JSON.stringify([record.chat_id, record.message_id]))
  }
  if (snapshot.profile.credits.reduce((total, credit) => total + credit.xp, 0) !== snapshot.profile.xp) throw new Error('Credit ledger does not reconcile with profile XP')
  const statuses = { complete: 0, pending: 0, failed: 0, superseded: 0 }
  for (const record of snapshot.records) statuses[record.status] += 1
  return { domains, unassisted: sum('unassisted'), assisted: sum('assisted'), stars: sum('stars'), practiced: sum('practiced'), contributingMessages: messages.size, statuses }
}
