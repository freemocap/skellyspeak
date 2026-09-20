import { nativeTrials } from './native.ts';
import type { Trial } from './validation.ts';

/** Repeated identical requests expose concentration; fixed histories probe meaning.
 * These are human-readable review cases, not a semantic scoring algorithm. */
export function engagementTrials(path: string) {
  const { source } = nativeTrials(path);
  const trials: Trial[] = [];
  for (const p of source.prompts.filter((p: any) => p.opening)) {
    const repeats = p.language === 'arabic'
      ? p.settings.difficulty === 'absolute_zero' ? 8 : p.settings.difficulty === 'beginner' ? 4 : 2
      : ['absolute_zero', 'beginner', 'advanced'].includes(p.settings.difficulty) ? 2 : 0;
    for (let i = 1; i <= repeats; i++) trials.push({
      id: `${p.language}-${p.settings.difficulty}-opening-r${i}`,
      language: p.language, level: p.settings.difficulty,
      locale: { arabic: 'ar', spanish: 'es', mandarin: 'zh' }[p.language as string],
      variant: source.version, scenario: 'opening', messages: [{ role: 'system', content: p.openingAlternatives?.[i - 1] ?? p.system }],
    });
  }
  const cases = [
    { id: 'choice', partner: 'بدي أرسم باب. أحمر ولا أزرق؟', learner: 'أزرق.', intent: 'Use blue in the drawing; contribute a next detail, not another unrelated preference.' },
    { id: 'rejection', partner: 'بدي أرسم باب. أحمر ولا أزرق؟', learner: 'ما بحب الرسم.', intent: 'Accept dislike; open an accessible different activity without pushing drawing.' },
    { id: 'confusion', partner: 'بدي أرسم باب. أحمر ولا أزرق؟', learner: 'مش فاهم.', intent: 'Simplify the door-color decision without choosing for the learner.' },
    { id: 'reciprocal', partner: 'بتحب الموسيقى؟', learner: 'آه، وإنت؟', intent: 'Answer about yourself and develop music without asking the answered question again.' },
    { id: 'disclosure', partner: 'بدك نطبخ اليوم؟', learner: 'أنا تعبان.', intent: 'Respond to tiredness; do not carry on a food questionnaire.' },
    { id: 'topic-change', partner: 'بتحب القهوة؟', learner: 'بدي أحكي عن القطط.', intent: 'Start a concrete cat conversation without returning to drinks.' },
    { id: 'dead-end-history', partner: 'بتحب القهوة؟', learner: 'آه.', intent: 'Continue beyond coffee/tea/milk preference polling.', previous: [
      { role: 'assistant', content: 'بتحب الشاي؟' }, { role: 'user', content: 'آه.' },
    ] },
    { id: 'ending', partner: 'بدك نسمع موسيقى؟', learner: 'لا، بدي أنام. تصبح على خير.', intent: 'Respect the ending; no follow-up question.' },
  ];
  const reply = source.prompts.find((p: any) => p.language === 'arabic' && p.settings.difficulty === 'absolute_zero' && !p.opening);
  for (const c of cases) trials.push({ id: `arabic-absolute_zero-${c.id}`, language: 'arabic', locale: 'ar',
    level: 'absolute_zero', variant: source.version, scenario: c.id,
    // Intent is review metadata only, never sent to the partner model.
    ...{ reviewIntent: c.intent },
    messages: [{ role: 'system', content: reply.system }, ...c.previous ?? [],
      { role: 'assistant', content: c.partner }, { role: 'user', content: c.learner }],
  });
  return { source, trials };
}

/** Compare the two lowest levels with the same persona and starting situation. */
export function levelPairTrials(path: string) {
  const { source } = nativeTrials(path);
  const trials: Trial[] = [];
  for (const language of ['arabic', 'spanish', 'mandarin']) {
    for (let i = 0; i < 4; i++) for (const level of ['absolute_zero', 'beginner']) {
      const p = source.prompts.find((p: any) => p.language === language && p.settings.difficulty === level && p.opening);
      trials.push({ id: `${language}-pair${i}-${level}`, language, level,
        locale: { arabic: 'ar', spanish: 'es', mandarin: 'zh' }[language],
        variant: source.version, scenario: 'opening', messages: [{ role: 'system', content: p.openingAlternatives?.[i] ?? p.system }] });
    }
  }
  return { source, trials };
}
