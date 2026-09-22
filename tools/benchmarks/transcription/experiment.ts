import type { Language, Phrase } from './corpus.ts';
export type Provider = 'elevenlabs' | 'groq' | 'openai';
export interface Condition { id: string; provider: Provider; model: string; mode: 'forced' | 'auto'; cleaned: boolean; label: string }
export const conditions: Condition[] = [
  ...(['forced', 'auto'] as const).flatMap(mode => [false, true].map(cleaned => ({
    id: `scribe-${mode}-${cleaned ? 'clean' : 'verbatim'}`, provider: 'elevenlabs' as const, model: 'scribe_v2', mode, cleaned,
    label: `Scribe v2 · ${mode} language · ${cleaned ? 'cleaned (app setting)' : 'verbatim'}`,
  }))),
  ...(['whisper-large-v3', 'whisper-large-v3-turbo'] as const).flatMap(model => (['forced', 'auto'] as const).map(mode => ({
    id: `${model}-${mode}`, provider: 'groq' as const, model, mode, cleaned: false, label: `Groq ${model} · ${mode} language`,
  }))),
  ...(['whisper-1', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe'] as const).flatMap(model => (['forced', 'auto'] as const).map(mode => ({
    id: `${model}-${mode}`, provider: 'openai' as const, model, mode, cleaned: false, label: `OpenAI ${model} · ${mode} language`,
  }))),
];
export interface Take {
  id: string; created: string; removedAt?: string; phrase: Phrase; sha256: string; duration: number; rms: number; peak: number; clippedFraction: number;
  capture: Record<string, unknown>; reference: string; notes: string;
}
export interface Result {
  id: string; takeId: string; condition: Condition; created: string; elapsedMs: number; audioSha256: string;
  status: 'ok' | 'error'; text?: string; error?: string; metadata: Record<string, unknown>;
}
export function normalize(text: string, language: Language): string {
  let value = text.normalize('NFC').toLocaleLowerCase(language);
  if (language === 'ar') value = value.replace(/[\u0640\u064b-\u065f\u0670]/g, '');
  return value.replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function distance(a: string[], b: string[]): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    previous = next;
  }
  return previous[b.length];
}
export function score(reference: string, hypothesis: string, language: Language) {
  const a = normalize(reference, language), b = normalize(hypothesis, language);
  const chars = [...a.replace(/\s/g, '')], words = a.split(' ').filter(Boolean);
  return { cer: chars.length ? distance(chars, [...b.replace(/\s/g, '')]) / chars.length : null,
    wer: language === 'zh' || !words.length ? null : distance(words, b.split(' ').filter(Boolean)) / words.length };
}
