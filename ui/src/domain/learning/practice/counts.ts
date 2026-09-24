/** First-version practice policy. Input observations must already be validated.
 * Pure replay: no inference, success score, assistance discount or persistence.
 */
export type Presence = 'absent' | 'contextual' | 'direct' | 'unclear';
export type PracticeSubmission = {
  id: string;
  attemptId: string;
  languageId: string;
  varietyId: string;
  parentId: string | null;
  text: string;
  skills: Record<string, Presence>;
};
export type PracticeCredit = {
  submissionId: string;
  attemptId: string;
  languageId: string;
  varietyId: string;
  skillId: string;
  experience: number;
  effort: number;
  xp: number;
};
const canonical = (s: PracticeSubmission) => JSON.stringify([
  s.attemptId, s.languageId, s.varietyId, s.parentId, s.text,
  Object.entries(s.skills).sort(([a], [b]) => a.localeCompare(b)),
]);
/** Chronological submissions for one learner. A revision chain stays in one scope.
 * Duplicate deliveries replay once; conflicting duplicates fail explicitly.
 * Changed text earns effort for all previously encountered skills still present.
 */
export function countPractice(submissions: readonly PracticeSubmission[]): PracticeCredit[] {
  const seen = new Map<string, string>();
  const chains = new Map<string, {last: PracticeSubmission; skills: Set<string>}>();
  const credits: PracticeCredit[] = [];
  for (const s of submissions) {
    if (![s.id,s.attemptId,s.languageId,s.varietyId].every(v=>typeof v==='string'&&v.length>0)
      || typeof s.text !== 'string' || !s.skills || typeof s.skills !== 'object'
      || Array.isArray(s.skills)
      || Object.entries(s.skills).some(([id,p])=>!id||!['absent','contextual','direct','unclear'].includes(p))) {
      throw Error('Invalid practice submission');
    }
    const identity=canonical(s), old=seen.get(s.id);
    if (old!==undefined) {
      if (old!==identity) throw Error('Conflicting submission identity');
      continue;
    }
    const chain=chains.get(s.attemptId);
    if (chain ? s.parentId!==chain.last.id : s.parentId!==null) throw Error('Missing or stale revision parent');
    if (chain && (s.languageId!==chain.last.languageId||s.varietyId!==chain.last.varietyId)) throw Error('Revision changed language scope');
    const encountered=chain?.skills??new Set<string>();
    const changed=!chain||s.text!==chain.last.text;
    if (changed) for (const [skillId,presence] of Object.entries(s.skills)) {
      if (presence!=='direct'&&presence!=='contextual') continue;
      const experience=encountered.has(skillId)?0:1;
      credits.push({submissionId:s.id,attemptId:s.attemptId,languageId:s.languageId,varietyId:s.varietyId,skillId,experience,effort:1-experience,xp:1});
      encountered.add(skillId);
    }
    seen.set(s.id,identity);
    chains.set(s.attemptId,{last:s,skills:encountered});
  }
  return credits;
}
