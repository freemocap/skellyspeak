import { readFileSync } from 'node:fs';
import type { Trial } from './validation.ts';

// Consume the real Rust builder's export, never a separately authored system prompt.
export function nativeTrials(path: string): { source: any; trials: Trial[] } {
  const source = JSON.parse(readFileSync(path, 'utf8'));
  if (!source.version || !source.contentHash || source.prompts?.length !== 30) throw Error('Expected the complete native prompt export');
  const trials: Trial[] = [];
  for (const p of source.prompts.filter((p: any) => p.opening)) {
    for (let repeat = 1; repeat <= 2; repeat++) trials.push({
      id: `${p.language}-${p.settings.difficulty}-opening-r${repeat}`, language: p.language,
      locale: { spanish: 'es', arabic: 'ar', mandarin: 'zh' }[p.language as string],
      variant: source.version, level: p.settings.difficulty, scenario: 'opening',
      messages: [{ role: 'system', content: p.openingAlternatives?.[repeat - 1] ?? p.system }],
    });
  }
  for (const language of ['spanish', 'arabic', 'mandarin']) for (const level of ['absolute_zero', 'beginner']) {
    const pair = source.prompts.filter((p: any) => p.language === language && p.settings.difficulty === level);
    if (pair.length !== 2) throw Error('Missing native opening/follow-up pair');
    const input = language === 'spanish' ? ['Sí.', 'No entiendo.'] : language === 'arabic' ? ['آه.', 'مش فاهم.'] : ['喜欢。', '我不懂。'];
    const dialogueId = `${language}-${level}-dialogue`;
    for (let turn = 0; turn < 3; turn++) trials.push({ id: `${dialogueId}-t${turn}`, dialogueId, turn,
      language, level, locale: { spanish: 'es', arabic: 'ar', mandarin: 'zh' }[language], variant: source.version,
      scenario: ['opening', 'brief-answer', 'confusion'][turn], messages: [
        { role: 'system', content: pair.find((p: any) => p.opening === (turn === 0)).system },
        ...turn === 0 ? [] : [{ role: 'user', content: input[turn - 1] }],
      ] });
  }
  return { source, trials };
}

// Necessary mechanical checks only. A reviewer must still assess whether the question
// is relevant, understandable at the level, and gives the learner an actual reply.
export function invitationFailures(text: string): string[] {
  const failures: string[] = [];
  const questions = (text.match(/[?؟？]/gu) ?? []).length;
  if (questions !== 1) failures.push(`Expected one question; found ${questions}`);
  if (/^(?:[¡!\s]*hola[!.\s]*)?(?:¿qué tal\??|¿cómo estás\??)$/iu.test(text.trim())) failures.push('Generic check-in');
  if (!text.trim()) failures.push('Empty response');
  return failures;
}
