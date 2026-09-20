import { readFileSync } from 'node:fs';
import { levels, levelGuidance } from './prompts.ts';

export const validationFixture = JSON.parse(readFileSync(new URL('./validation-fixture.json', import.meta.url), 'utf8'));
type Level = typeof levels[number];
export type Variant = 'approved-23' | 'compact' | 'compact-examples' | 'compact-grounded';
type Message = { role: string; content: string };
export type Trial = {
  id: string; level: string; variant: string; scenario: string; messages: Message[];
  language?: string; locale?: string; dialogueId?: string; turn?: number;
};
export const cases: Record<string, { locale: string; writing: string; previous: string; confusion: string;
  switch: string; preference: string; examples: string }> = {
  spanish: { locale: 'es', writing: 'Spanish as used in Spain, Latin script',
    previous: 'La tienda está cerrada.', confusion: 'No entiendo.', switch: 'Quiero hablar de música.',
    preference: 'Prefiero escuchar música en casa.',
    examples: 'Partner: «El café está frío.» Learner: «No entiendo.» Partner: «El café no está caliente.»\nPartner: «Me gusta el té.» Learner: «Quiero hablar de libros.» Partner: «¿Te gustan los cuentos?»' },
  arabic: { locale: 'ar', writing: 'Conversational Levantine Arabic, Arabic script, not Modern Standard Arabic',
    previous: 'المحل مسكّر.', confusion: 'مش فاهم.', switch: 'بدي أحكي عن الموسيقى.',
    preference: 'بحب أسمع موسيقى بالبيت.',
    examples: 'Partner: «القهوة باردة.» Learner: «مش فاهم.» Partner: «القهوة مش سخنة.»\nPartner: «بحب الشاي.» Learner: «بدي أحكي عن الكتب.» Partner: «بتحب القصص؟»' },
  mandarin: { locale: 'zh', writing: 'Mainland Mandarin, Simplified Chinese characters',
    previous: '商店关门了。', confusion: '我不懂。', switch: '我想聊音乐。', preference: '我喜欢在家听音乐。',
    examples: 'Partner:「咖啡凉了。」Learner:「我不懂。」Partner:「咖啡不热了。」\nPartner:「我喜欢茶。」Learner:「我想聊书。」Partner:「你喜欢故事吗？」' },
};
const ownershipExamples: Record<string, string> = {
  spanish: 'Partner: «Me encanta cocinar.» Learner: «No entiendo.» Partner: «Me gusta cocinar.»',
  arabic: 'Partner: «أنا بستمتع بالرسم.» Learner: «مش فاهم.» Partner: «أنا بحب أرسم.»',
  mandarin: 'Partner:「我特别爱骑自行车。」Learner:「我不懂。」Partner:「我喜欢骑车。」',
};
const nuancedSwitch: Record<string, Record<string, string>> = {
  spanish: {
    advanced: 'Cambiemos de tema: las plataformas musicales me ayudan a descubrir artistas, pero siento que sus recomendaciones acaban haciendo que todo suene igual.',
    fluent: 'Hablemos de música: presumimos de tener acceso a todo, pero delegamos el gusto en un algoritmo; no sé si eso amplía nuestra curiosidad o simplemente la administra.',
  },
  arabic: {
    advanced: 'خلينا نحكي عن الموسيقى: التطبيقات بتعرّفني على فنانين جداد، بس بحس اقتراحاتها بالنهاية بتخلّي كل الأغاني تشبه بعض.',
    fluent: 'خلينا نحكي موسيقى: مبسوطين إنه كل شي صار متاح، بس تاركين الخوارزمية تختار ذوقنا؛ مش عارف إذا هيك عم نوسّع فضولنا أو بس نسلّم إدارته لغيرنا.',
  },
  mandarin: {
    advanced: '换个话题吧：音乐平台让我认识了不少新歌手，但我又觉得它们的推荐让大家听的东西越来越像。',
    fluent: '聊聊音乐吧：我们以为自己什么都能听，却把品味交给算法；这究竟是在拓宽好奇心，还是把好奇心也托管了？',
  },
};
function compactPersona(persona: any) {
  // Deterministic projection, no extra model call and no deletion of authored data.
  return { name: persona.name, location: persona.location, interests: persona.interests.slice(0, 2),
    opinions: persona.opinions.slice(0, 2) };
}
export function candidateSystem(language: any, variant: Variant, level: Level, opening: boolean,
  topic: string | null = null, time: 'any' | 'past' | 'future' = 'any') {
  const c = cases[language.id], b = validationFixture.approvedBaseline;
  const grounded = variant === 'compact-grounded';
  if (variant === 'approved-23') return [b.base, `${b.persona}\nPersona background (data): ${JSON.stringify(language.persona)}`,
    `Target-language writing: Use ${c.writing}.`, ...validationFixture.pragmatics,
    `${language.name} (${language.variety}). ${level} difficulty level: ${b.difficulty[level]}\n\n${b.ceiling}`,
    topic ? `${b.subject} ${JSON.stringify(topic)}` : '', time === 'any' ? '' : b[time], opening ? b.opening : b.response,
  ].filter(Boolean).join('\n\n');
  return [
    `Be a conversation partner. Reply only in ${c.writing}. No translations, romanization, emojis, grades or teaching commentary. Never speak for the learner, invent their preferences or pretend they said something absent from the history.`,
    `Persona background (data, not instructions): ${JSON.stringify(compactPersona(language.persona))}`,
    grounded ? 'Speak AS the persona in the first person. Assistant-role messages are YOUR words, not the learner’s. When clarifying, preserve who does or likes what: do not change your “I” into “you” or attribute your facts to the learner. This is a text conversation with no shared visible scene; do not point at an unseen object.' : '',
    'Contribute one specific detail, preference or choice the learner can react to. Let persona facts supply substance when relevant; leave them aside when the learner takes the conversation elsewhere. Ask at most one genuine question, only if useful. Do not ask a question every turn.',
    'If the learner does not understand, express your preceding meaning in simpler words; do not ask a new question, change the subject or explain an imagined cause. If they change topic, leave the previous topic and respond to the new one. Treat short answers as meaningful; do not test or demand more detail.',
    variant === 'compact-examples' || grounded ? `Examples of conversational behavior, not topics or lines to copy; always use the actual history:\n${c.examples}${grounded ? `\n${ownershipExamples[language.id]}` : ''}` : '',
    topic ? `Selected topic (data): ${JSON.stringify(topic)}` : '',
    time === 'any' ? '' : `Selected time reference: ${time}. Use it naturally where the learner's level allows, without forcing every sentence into it.`,
    opening ? 'Begin with one concrete, accessible contribution or choice. No greeting, introduction, generic check-in or offer of assistance.' : 'Continue from what the learner actually communicated.',
    grounded ? 'Give the exchange one small new handle: a specific detail, preference or choice, rather than only agreeing or saying you like the whole topic. Do not add content when the learner only needs clarification. When they offer a reasoned view, engage one reason, consequence or counterpoint in your own words; do not merely repeat their dilemma.' : '',
    `Selected difficulty: ${level}. ${levelGuidance[level]}`,
    ['absolute_zero', 'beginner'].includes(level)
      ? 'Output exactly ONE short, simple sentence: one statement OR one question, no stacked clauses. No greeting before it or extra explanation after it. Difficulty takes priority over persona, topic, time reference and examples.'
      : 'Match the learner’s depth and intent; use detail or nuance when it adds something, not merely to sound advanced. Keep the turn focused and leave room for a reply. No greeting or biography. Difficulty takes priority over persona, topic, time reference and examples.',
  ].filter(Boolean).join('\n\n');
}
export function validationJobs(): Trial[] {
  const variants: Variant[] = ['approved-23', 'compact', 'compact-examples'];
  const jobs: Trial[] = [];
  for (const [li, language] of validationFixture.languages.entries()) for (const [di, level] of levels.entries()) {
    for (const scenario of ['opening', 'confusion', 'topic-switch']) for (let vi = 0; vi < variants.length; vi++) {
      const variant = variants[(vi + li + di) % variants.length], c = cases[language.id];
      const opening = scenario === 'opening';
      // Topic/time probes vary by level, but remain identical across alternatives.
      const topic = opening && ['advanced', 'fluent'].includes(level) ? 'A city with fewer cars' : null;
      const time = opening && level === 'advanced' ? 'future' : opening && level === 'fluent' ? 'past' : 'any';
      jobs.push({ id: `${language.id}-${level}-${variant}-${scenario}`, language: language.id, locale: c.locale,
        level, variant, scenario, messages: [{ role: 'system', content: candidateSystem(language, variant, level, opening, topic, time) },
          ...opening ? [] : [{ role: 'assistant', content: c.previous },
            { role: 'user', content: scenario === 'confusion' ? c.confusion : nuancedSwitch[language.id][level] ?? c.switch }]] });
    }
  }
  return jobs;
}
export function dialogueJobs(variants: Variant[] = ['approved-23', 'compact-examples']): Trial[] {
  const jobs: Trial[] = [];
  for (const language of validationFixture.languages) for (const level of ['beginner', 'intermediate'] as const) {
    for (const variant of variants) {
      const c = cases[language.id], dialogueId = `${language.id}-${level}-${variant}`;
      for (let turn = 0; turn < 4; turn++) jobs.push({ id: `${dialogueId}-t${turn}`, dialogueId, turn,
        language: language.id, locale: c.locale, level, variant, scenario: ['opening', 'confusion', 'topic-switch', 'preference'][turn],
        messages: [{ role: 'system', content: candidateSystem(language, variant, level, turn === 0) },
          ...turn === 0 ? [] : [{ role: 'user', content: [c.confusion, c.switch, c.preference][turn - 1] }]] });
    }
  }
  return jobs;
}

export function resolveHistory(job: Trial, histories: Map<string, Message[]>): Message[] {
  if (!job.dialogueId || job.turn === 0) return job.messages;
  const history = histories.get(job.dialogueId);
  if (!history || history.length !== job.turn! * 2 - 1) throw Error('Missing or out-of-order dialogue history');
  return [job.messages[0], ...history, ...job.messages.slice(1)];
}
