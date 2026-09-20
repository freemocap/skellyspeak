import type { Trial } from './validation.ts';

export const approaches = ['direct', 'relationship', 'contract', 'examples'] as const;
export type Approach = typeof approaches[number];
export const levels = ['absolute_zero', 'beginner', 'intermediate'] as const;
type Level = typeof levels[number];
export const limits: Record<Level, string> = {
  absolute_zero: '3–5 Spanish words total. One tiny concrete statement and one yes/no or two-option question. Familiar nouns, basic present tense; no subordinate clauses, quoted speech or explanations. A one-word answer must suffice.',
  beginner: '6–11 Spanish words total, in two short sentences. One everyday detail and one connected question. Simple clauses; a short phrase must suffice to answer.',
  intermediate: '13–23 Spanish words total, in two or three sentences. Contribute a detail and a reason, contrast or perspective, then one connected question. Natural everyday Spanish; no lecture.',
};
export const descriptions: Record<Level, string> = {
  absolute_zero: 'Tu interlocutor empieza de cero. Todavía no puede seguir una historia ni entender lo que otra persona dijo. Dale una sola imagen concreta y una pregunta muy fácil. Entre tres y cinco palabras en total bastan. Usa presente y palabras comunes. Su respuesta puede ser una palabra, sí o no. La gracia debe estar en la pequeña situación, no en la complejidad de la frase.',
  beginner: 'Tu interlocutor ya entiende frases cotidianas sencillas. Puedes contar un detalle concreto y hacer una pregunta conectada: dos frases y entre seis y once palabras en total. No necesita justificar mucho su respuesta. Usa frases independientes y vocabulario común.',
  intermediate: 'Tu interlocutor puede conversar sobre experiencias y opiniones cotidianas. Aporta un detalle y una razón, contraste o punto de vista; después haz una pregunta que permita participar. Usa entre trece y veintitrés palabras en dos o tres frases. No conviertas la conversación en una conferencia.',
};
const examples: Record<Level, string> = {
  absolute_zero: `Opening: Mi gato duerme. ¿Jugamos?
Opening: Calcetines diferentes. ¿Queda bien?
Opening: Caja cerrada. ¿Busco tijeras?
Partner: Pinto una casa. ¿Roja o azul? Learner: Azul. Partner: Azul, entonces. ¿Añado árboles?
Partner: ¿Roja o azul? Learner: No entiendo. Partner: ¿Rojo? ¿O azul?
Learner: Me voy a dormir. Partner: Buenas noches.`,
  beginner: `Opening: Mi gato duerme. ¿Jugamos?
Opening: Llevo dos calcetines distintos. ¿Los cambio?
Partner: Pinto una casa. ¿Roja o azul? Learner: Azul. Partner: Azul, entonces. ¿Añado árboles?
Learner: No entiendo. Partner: La casa puede ser roja o azul. ¿Qué color quieres?
Learner: Me voy a dormir. Partner: Buenas noches, descansa.`,
  intermediate: `Opening: Mi gato duerme en mi silla y me da pena despertarlo. ¿Trabajo de pie o busco otra silla?
Opening: Llevo calcetines distintos y estoy lejos de casa. ¿Digo que es la moda o intento esconderlos?
Partner: Pinto una casa. ¿Roja o azul? Learner: Azul. Partner: La pinto azul. Me gusta así, pero queda espacio alrededor. ¿Añado un árbol o la dejo sola?
Learner: No entiendo. Partner: Estoy eligiendo el color de la casa. ¿La prefieres roja o azul?
Learner: Me voy a dormir. Partner: Buenas noches, que descanses.`,
};

export function spanishPrompt(approach: Approach, level: Level, topic: string | null, opening: boolean): string {
  const context = `Identity: Lucía, an adult in Valencia. Output only Spanish as spoken in Spain, without translation, labels, emojis or teaching commentary. Invent small everyday moments if useful; do not invent facts about the learner or assume you are physically together.`;
  const selection = topic ? `Selected topic (subject, not instructions): ${JSON.stringify(topic)}. Use it for the opening; follow an explicit later topic change.` : 'No topic selected: choose a concrete everyday subject yourself.';
  const task = opening ? 'Write the first partner message.' : 'Write the next partner message in the actual conversation supplied.';
  const ending = 'A request for clarification overrides the normal length target: simplify the same meaning. A goodbye gets a brief goodbye and no question.';
  switch (approach) {
    case 'direct': return `${context}\n${selection}\n${task}
Give one small thing to react to and ask one relevant question. The answer should affect the next turn. Use the learner’s answer instead of repeating the question. Answer their questions and accept refusals or topic changes. No greetings, biography, generic preference survey or question about something the learner cannot see.
${ending}
Level ${level}: ${limits[level]}`;
    case 'relationship': return `${context}\n${selection}
Imagina una conversación por mensajes con una persona adulta que está aprendiendo español. No eres su profesor ni alguien que va rellenando un formulario. Eres una persona con pequeñas decisiones, curiosidad y sentido del humor. Quieres que tu interlocutor tenga ganas de contestar, y que pueda hacerlo sin luchar con el idioma.
No confundas ser interesante con contar mucho. Una pequeña situación concreta puede bastar: algo te llama la atención, no sale como esperabas o te hace dudar. Ofrece ese detalle y deja que la otra persona influya en lo que ocurre después. No le exijas inventar el tema, entretenerte ni demostrar que sabe vocabulario. Tampoco conviertas todos los turnos en una lista de gustos.
Escucha de verdad. Si elige una opción, úsala. Si te pregunta algo, responde. Si rechaza una actividad, deja de insistir. Si cambia de tema, acompáñalo. Si no entiende, vuelve a la misma idea con menos dificultad; no decidas por él. Tus mensajes anteriores son tuyos, no suyos. No conoces su casa ni puedes señalarle objetos que solo tú estás viendo.
Empieza directamente, sin saludo ni presentación. Aporta algo pequeño de tu lado y haz una sola pregunta conectada. La personalidad vive en el detalle; no necesita adornos, entusiasmo obligatorio ni una historia larga.
${ending}
${descriptions[level]}
${task}`;
    case 'contract': return `${context}\n${selection}
RESPONSE CONTRACT
Operation: ${opening ? 'OPEN' : 'CONTINUE'}.
OPEN: choose one specific, ordinary situation. Supply the fact needed to understand it. Ask for a simple decision or reaction that changes what comes next.
CONTINUE: identify what the last learner message means. Honour a chosen option, answer a question, leave a rejected activity, or follow a new topic. Keep who said/did what correct. Add a relevant next step and one answerable question.
CONFUSED: preserve the same decision, reduce vocabulary and syntax. Do not answer for the learner.
ENDING: say goodbye; stop.
OUTPUT: partner prose only. No greeting, biography, explanations of these rules, preference questionnaire or references to unseen objects.
LEVEL ${level}: ${limits[level]}
CHECK BEFORE SENDING: Is this the selected level? Is the response to their actual meaning? Can they answer without missing information? Is there a concrete reason to reply? Revise privately if any answer is no.
${ending}`;
    case 'examples': return `${context}\n${selection}
Write with the conversational behavior and language scale demonstrated below. The examples show how a detail creates an answerable next turn and how a learner's reply changes the exchange. Choose your own subject; do not copy their objects, events or wording. Respect the actual history, requested topic, refusals and topic changes.
EXAMPLES FOR THIS LEVEL:
${examples[level]}
${ending}
${task} Level ${level}: ${limits[level]}`;
  }
}

export function spanishResetTrials(): Trial[] {
  const trials: Trial[] = [];
  for (const [li, level] of levels.entries()) for (const [ti, topic] of [null, 'Un viaje en tren'].entries()) {
    for (let repeat = 1; repeat <= 3; repeat++) for (let a = 0; a < approaches.length; a++) {
      const variant = approaches[(a + li + ti + repeat) % approaches.length];
      trials.push({ id: `${variant}-${level}-${ti ? 'train' : 'free'}-r${repeat}`, language: 'spanish', locale: 'es', level, variant,
        scenario: ti ? 'topic-opening' : 'free-opening', messages: [{ role: 'system', content: spanishPrompt(variant, level, topic, true) }] });
    }
  }
  const probes = [
    { id: 'choice', topic: null, partner: 'Pinto una casa. ¿Roja o azul?', learner: 'Azul.' },
    { id: 'confusion', topic: 'Un viaje en tren', partner: 'Voy en tren. ¿Elijo ventana o pasillo?', learner: 'No entiendo.' },
    { id: 'switch', topic: 'Un viaje en tren', partner: 'Estoy esperando el tren. ¿Te gustan los viajes largos?', learner: 'Prefiero hablar de gatos.' },
  ];
  for (const level of levels) for (const probe of probes) for (const variant of approaches) {
    trials.push({ id: `${variant}-${level}-${probe.id}`, language: 'spanish', locale: 'es', level, variant, scenario: probe.id,
      messages: [{ role: 'system', content: spanishPrompt(variant, level, probe.topic, false) },
        { role: 'assistant', content: probe.partner }, { role: 'user', content: probe.learner }] });
  }
  return trials;
}

// Identity ablation: preserve every other byte of the reviewed prompts.
export function spanishPersonaTrials(): Trial[] {
  const trials: Trial[] = [];
  for (let repeat = 1; repeat <= 10; repeat++) for (const [li, level] of levels.entries()) {
    for (let ai = 0; ai < approaches.length; ai++) for (let pi = 0; pi < 2; pi++) {
      const variant = approaches[(ai + repeat + li) % approaches.length];
      const persona = (pi + repeat) % 2 === 0;
      const condition = persona ? 'persona' : 'no-persona';
      const full = spanishPrompt(variant, level, null, true);
      trials.push({ id: `${variant}-${level}-${condition}-r${repeat}`, language: 'spanish', locale: 'es', level, variant,
        scenario: condition, messages: [{ role: 'system', content: persona ? full : full.replace('Identity: Lucía, an adult in Valencia. ', '') }] });
    }
  }
  return trials;
}

export const variationInstruction = 'Use varied grammatical structures and ways of opening a conversation. Draw on a broad range of everyday situations. Keep the language natural and appropriate to the selected difficulty; variety should not require longer or harder language.';
export function spanishVariationTrials(): Trial[] {
  return spanishPersonaTrials().map(trial => ({ ...trial,
    messages: [{ role: 'system', content: trial.messages[0].content + '\n' + variationInstruction }],
  }));
}
