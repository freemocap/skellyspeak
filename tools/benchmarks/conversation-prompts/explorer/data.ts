import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function readRuns(directories: string[]) {
  if (!directories.length || new Set(directories.map(x => basename(x))).size !== directories.length) throw Error('Supply distinct run directories');
  return directories.flatMap(directory => {
    const plan = JSON.parse(readFileSync(`${directory}/plan.json`, 'utf8'));
    const results = readFileSync(`${directory}/results.jsonl`, 'utf8').trim().split('\n').map(x => JSON.parse(x));
    if (new Set(results.map(x => x.id)).size !== plan.jobs.length || results.filter(x => x.status === 'complete').length !== plan.jobs.length) throw Error(`Incomplete or duplicate successful run: ${directory}`);
    const lookup = new Map(results.map(x => [x.id, x]));
    return plan.jobs.map((job: any) => {
      const result = lookup.get(job.id);
      if (!result || result.status !== 'complete' || !result.content?.trim()) throw Error(`Missing successful response: ${job.id}`);
      if (!['spanish','arabic','mandarin'].includes(job.language) || !['persona', 'no-persona'].includes(job.scenario) || job.messages.length !== 1) throw Error('Explorer expects supported-language independent persona/no-persona openings');
      return { id: `${basename(directory)}/${job.id}`, run: basename(directory), trial: job.id,
        language: job.language, locale: job.locale, level: job.level, prompt: job.variant, persona: job.scenario, text: result.content,
        textHash: hash(result.content), promptText: job.messages[0].content,
        model: plan.model, temperature: plan.temperature, topP: job.payload?.top_p ?? null, wording: job.variant.endsWith('instructions') ? (job.variant.endsWith('/ English instructions') ? 'English instructions' : 'Target-language instructions') : ['relationship-calibrated','examples-capability'].includes(job.variant) ? 'Hybrid generation' : job.messages[0].content.includes('Use varied grammatical structures and ways of opening a conversation.') ? 'Variety instruction' : 'Original prompts', planHash: plan.fixtureSha256,
        cost: typeof result.metadata?.usage?.cost === 'number' ? result.metadata.usage.cost : null,
        failedAttempts: results.filter(x => x.id === job.id && x.status !== 'complete').length, latencyMs: result.elapsedMs };
    });
  });
}
export function words(text: string, locale = 'es'): string[] { if(locale==='zh') return [...new Intl.Segmenter('zh',{granularity:'word'}).segment(text)].filter(x=>x.isWordLike).map(x=>x.segment);  return text.normalize('NFC').replace(/[\p{M}\u0640]/gu,'').toLocaleLowerCase(locale).match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? []; }
export function measures(text: string, locale = 'es') {
  const tokens = words(text, locale);
  const sentences = [...new Intl.Segmenter(locale, { granularity: 'sentence' }).segment(text)].map(x => words(x.segment, locale)).filter(x => x.length);
  return { words: tokens.length, charsPerWord: tokens.length ? tokens.reduce((s, x) => s + [...x].length, 0) / tokens.length : 0,
    wordsPerSentence: tokens.length / Math.max(1, sentences.length), sentences: sentences.length,
    first: tokens[0] ?? '', opening: tokens.slice(0, 2).join(' '), normalized: tokens.join(' ') };
}
export function unit(vector: number[]) {
  const norm = Math.hypot(...vector);
  if (!norm || !vector.every(Number.isFinite)) throw Error('Invalid embedding');
  return vector.map(x => x / norm);
}
export const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
// PCA on centered, unit-normalized embeddings. Deterministic power iteration;
// projection is fitted once on all responses (including repeated observations).
export function project(vectors: number[][]) {
  const n = vectors.length;
  if (n < 3 || vectors.some(v => v.length !== vectors[0].length)) throw Error('Incompatible vectors');
  const means = vectors[0].map((_, j) => vectors.reduce((s, v) => s + v[j], 0) / n);
  const centered = vectors.map(v => v.map((x, j) => x - means[j]));
  const gram = centered.map(a => centered.map(b => dot(a, b)));
  const trace = gram.reduce((s, row, i) => s + row[i], 0);
  const axes: number[][] = []; const values: number[] = [];
  for (let k = 0; k < 2; k++) {
    let v = unit(Array.from({ length: n }, (_, i) => Math.sin((i + 1) * (k + 1.31))));
    for (let iter = 0; iter < 600; iter++) {
      let next = gram.map(row => dot(row, v));
      for (const previous of axes) { const amount = dot(next, previous); next = next.map((x, i) => x - amount * previous[i]); }
      if (Math.hypot(...next) < 1e-12) throw Error('Degenerate PCA: insufficient independent variation');
      next = unit(next);
      const delta = Math.min(Math.hypot(...next.map((x, i) => x - v[i])), Math.hypot(...next.map((x, i) => x + v[i])));
      v = next;
      if (delta < 1e-10) break;
      if (iter === 599) throw Error('PCA did not converge');
    }
    const value = dot(v, gram.map(row => dot(row, v)));
    const pivot = v.reduce((best, x, i) => Math.abs(x) > Math.abs(v[best]) ? i : best, 0);
    if (v[pivot] < 0) v = v.map(x => -x);
    axes.push(v); values.push(value);
  }
  return { xy: vectors.map((_, i) => axes.map((v, k) => v[i] * Math.sqrt(Math.max(0, values[k])))), variance: values.map(x => x / trace) };
}
