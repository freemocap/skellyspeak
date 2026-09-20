import { candidateSystem, cases, validationFixture, type Trial } from './validation.ts';

const inputs: Record<string, { owned: string; partner: string; preference: string; argument: string }> = {
  spanish: { owned: 'Me gustan los libros.', partner: 'Me gusta escuchar música en directo.',
    preference: 'Prefiero escuchar música en casa.',
    argument: 'Hablemos del trabajo: defender una semana más corta solo porque aumenta la productividad me parece una trampa; ¿no debería tener valor el tiempo libre aunque no produzcamos más?' },
  arabic: { owned: 'أنا بحب أمشي الصبح.', partner: 'بحب أسمع موسيقى بالحفلات.',
    preference: 'بفضّل أسمع موسيقى بالبيت.',
    argument: 'خلينا نحكي عن الشغل: إذا بدنا نقلّل أيام الدوام بس لأنه هيك الإنتاجية بتزيد، بحس عم نلف بنفس الدائرة؛ مش لازم يكون لوقتنا الحر قيمة حتى لو ما أنتجنا أكتر؟' },
  mandarin: { owned: '我喜欢喝茶。', partner: '我喜欢听现场音乐。', preference: '我更喜欢在家听音乐。',
    argument: '聊聊工作吧：如果支持缩短工作周只是因为能提高生产率，这不还是同一套逻辑吗？即使不多生产，自由时间难道就不值得拥有？' },
};
export function revisionJobs(): Trial[] {
  const jobs: Trial[] = [];
  for (let repeat = 1; repeat <= 2; repeat++) for (const [li, language] of validationFixture.languages.entries()) {
    const c = cases[language.id], input = inputs[language.id];
    for (const scenario of ['opening', 'owned-confusion', 'preference', 'argument']) {
      const level = scenario === 'opening' ? 'absolute_zero' : scenario === 'argument' ? 'fluent' : 'beginner';
      const history = scenario === 'opening' ? [] : [
        { role: 'assistant', content: scenario === 'owned-confusion' ? input.owned : input.partner },
        { role: 'user', content: scenario === 'owned-confusion' ? c.confusion : scenario === 'preference' ? input.preference : input.argument },
      ];
      const variants = ['compact-examples', 'compact-grounded'] as const;
      for (let j = 0; j < 2; j++) {
        const variant = variants[(j + repeat + li) % 2];
        jobs.push({ id: `${language.id}-${level}-${variant}-${scenario}-r${repeat}`, language: language.id, locale: c.locale,
          level, variant, scenario, messages: [{ role: 'system', content: candidateSystem(language, variant, level, scenario === 'opening') }, ...history] });
      }
    }
  }
  return jobs;
}
