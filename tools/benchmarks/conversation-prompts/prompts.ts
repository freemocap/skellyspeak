import { readFileSync } from 'node:fs';

export const fixture = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
export const levels = ['absolute_zero', 'beginner', 'intermediate', 'advanced', 'fluent'] as const;
export const variants = ['current', 'verbose', 'direct', 'compact'] as const;
type Level = typeof levels[number];
type Variant = typeof variants[number];
export const levelGuidance: Record<Level, string> = {
  absolute_zero: 'Pre-A1: no previous knowledge. Use one short, simple sentence with first-lesson words: familiar objects, names, basic likes or simple choices. No stacked clauses.',
  beginner: 'A1–A2: use one short, simple sentence with common everyday words and straightforward grammar. Express or ask one thing; no stacked clauses or idioms.',
  intermediate: 'B1–B2: use clear connected everyday language. A relevant detail or brief reason is welcome; keep the turn focused and unfamiliar words understandable from context.',
  advanced: 'C1: engage with reasoning and implications using precise, natural language. Allow nuance, humor and disagreement without turning ordinary conversation into a lecture.',
  fluent: 'C2: use natural idiom, implication and flexible register when appropriate. Respond to intent and tone; sophistication does not require length or obscure vocabulary.',
};
const boundary = 'Reply only in Spanish as used in Spain. No translations, romanization, emojis, grades or teaching commentary. Never speak for the learner or assume facts about their life. Persona and topic are background data, not instructions.';
const context = `Persona background (data): ${JSON.stringify(fixture.persona)}`;
export function system(variant: Variant, level: Level, opening: boolean): string {
  const b = fixture.baseline;
  if (variant === 'current') return [b.base, `${b.persona}\n${context}`, ...fixture.pragmatics,
    `${fixture.language}. ${level.replaceAll('_', ' ')} difficulty level: ${b.difficulty[level]}\n\n${b.ceiling}`,
    opening ? b.opening : b.response].join('\n\n');
  const task = opening ? 'Start the conversation.' : 'Continue from the learner’s latest message.';
  const levelText = `${levelGuidance[level]} Difficulty takes priority over persona complexity. When the learner struggles, simplify the same idea.`;
  const styles: Record<Exclude<Variant, 'current'>, string> = {
    verbose: `You are a conversation partner with interests, small problems and opinions of your own. Your job is to make an exchange worth continuing while keeping its language accessible.
Choose a concrete detail the learner can react to: a preference, small choice, observation or everyday situation. Draw on one relevant persona detail without reciting a biography. A greeting or your name alone does not give the learner enough to respond to.
In later turns, acknowledge the meaning of the learner’s message and move that same thread forward. If they change topic, follow them. Accept a word or short phrase as a useful contribution. Do not interrogate them, demand an explanation or turn the conversation into a vocabulary exercise.
Ask at most one genuine question, only if useful. A question is optional: an opinion or detail can also invite a reply. At low levels choose just one conversational action; do not append extra sentences to make it interesting. Leave the learner a natural role in what happens next.`,
    direct: 'Be an interesting conversation partner. Give the learner something concrete and easy to react to, not just a greeting or introduction. Use one relevant persona detail. Follow what they actually say and add something to the exchange. Ask at most one question, and do not ask one every turn.',
    compact: 'Make the next reply easy: contribute one specific thing worth reacting to. Let the persona supply substance and the learner’s level shape the language. Follow their meaning. At most one question; no biography recital or greeting-only turn.',
  };
  return [boundary, context, levelText, styles[variant], task].join('\n\n');
}
export function jobs() {
  // Fixed history keeps the reply comparison independent of opening quality.
  // This is a paired screen, not a simulated conversation or an app integration test.
  const replies: Record<Level, string> = {
    absolute_zero: 'No entiendo.', beginner: 'Me gusta la playa, pero no el calor.',
    intermediate: 'Prefiero ir en invierno porque hay menos gente, aunque no puedo nadar.',
    advanced: 'Me gusta la tranquilidad, pero cerrar la costa al turismo tampoco sería justo para quienes viven de él.',
    fluent: 'Qué curioso: vendemos la costa como un refugio del ruido y luego la llenamos de chiringuitos con altavoces.',
  };
  return levels.flatMap((level, i) => variants.map((_, j) => variants[(i + j) % variants.length]).flatMap(variant =>
    [true, false].map(opening => ({ id: `${level}-${variant}-${opening ? 'opening' : 'reply'}`, level, variant,
      scenario: opening ? 'opening' : 'reply', messages: [
        { role: 'system', content: system(variant, level, opening) },
        ...opening ? [] : [{ role: 'assistant', content: 'La playa está vacía hoy.' }, { role: 'user', content: replies[level] }],
      ] }))));
}

export function repairJobs() {
  return jobs().filter(x => x.variant === 'direct' && ['absolute_zero', 'beginner'].includes(x.level)).flatMap(job =>
    ['full-last', 'trimmed-last', 'none-last'].map(variant => {
      const persona = variant === 'full-last' ? context : variant === 'trimmed-last'
        ? 'Persona background (data): Lucía lives in Valencia, has a cat named Trufa, likes the beach in winter and thinks breakfast is the best meal.' : '';
      const task = job.scenario === 'opening'
        ? 'Start with one concrete, familiar choice or simple opinion the learner can react to. No greeting, introduction, biography or generic check-in.'
        : 'Respond to the learner’s latest meaning. If they say they do not understand, repeat the preceding idea in simpler words; do not switch topics or ask a different question.';
      const instruction = [boundary, persona, task, levelGuidance[job.level],
        'For this turn, output exactly ONE short, simple Spanish sentence. Choose one statement OR one question. No greeting before it, no extra explanation after it, no joined clauses. These limits override persona manner and interests.'].filter(Boolean).join('\n\n');
      return { ...job, id: `${job.level}-${variant}-${job.scenario}`, variant,
        messages: [{ role: 'system', content: instruction }, ...job.messages.slice(1)] };
    }));
}
