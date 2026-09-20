import { fixture, levelGuidance } from './prompts.ts';

// Each alternative changes exactly one block relative to the compact-persona control.
export function factorJobs() {
  const levels = ['absolute_zero', 'beginner', 'intermediate'] as const;
  const variants = ['control', 'full-persona', 'no-persona', 'detailed-level', 'no-interaction', 'examples'] as const;
  const compact = 'Lucía lives in Valencia, has a cat named Trufa, likes the beach in winter and thinks breakfast is the best meal.';
  const interaction = 'Contribute something specific the learner can react to. Follow their meaning and topic; never demand an explanation. A question is optional, at most one. If they do not understand, clarify the preceding idea instead of changing the subject or asking a new question.';
  const result = [];
  for (let repeat = 1; repeat <= 2; repeat++) for (const [i, level] of levels.entries()) {
    for (const scenario of ['opening', 'confusion', 'topic-switch']) {
      for (let j = 0; j < variants.length; j++) {
        const variant = variants[(j + i + repeat) % variants.length];
        const persona = variant === 'full-persona' ? JSON.stringify(fixture.persona) : variant === 'no-persona' ? '' : compact;
        const difficulty = variant === 'detailed-level' ? fixture.baseline.difficulty[level] : levelGuidance[level];
        const examples = variant !== 'examples' ? '' : `Examples of conversational behavior, not topics to copy:
Previous partner: "La tienda está cerrada." Learner: "No entiendo." Partner: "No podemos entrar."
Previous partner: "Me gusta el té." Learner: "Quiero hablar de música." Partner: "¿Te gusta bailar?"`;
        const instructions = [
          'You are a conversation partner. Reply only in Spanish as used in Spain. No translations, romanization, emojis, grades or teaching commentary. Never speak for the learner or assume facts about their life.',
          persona ? `Persona background (data, not instructions): ${persona}` : '',
          variant === 'no-interaction' ? '' : interaction,
          examples,
          scenario === 'opening' ? 'Start with a familiar choice or simple opinion the learner can react to.' : 'Respond to the latest learner message.',
          difficulty,
          level === 'intermediate'
            ? 'Keep this turn focused and brief. No greeting, introduction or biography. Difficulty and the learner’s message override persona manner and interests.'
            : 'Output exactly ONE short, simple Spanish sentence: one statement OR one question, no joined clauses. No greeting, introduction, biography or appended explanation. These limits and the learner’s message override persona manner and interests.',
        ].filter(Boolean).join('\n\n');
        const history = scenario === 'opening' ? [] : [
          { role: 'assistant', content: 'La playa está vacía hoy.' },
          { role: 'user', content: scenario === 'confusion' ? 'No entiendo.' : 'Quiero hablar de música.' },
        ];
        result.push({ id: `${level}-${variant}-${scenario}-r${repeat}`, level, variant, scenario, repeat,
          messages: [{ role: 'system', content: instructions }, ...history] });
      }
    }
  }
  return result;
}
