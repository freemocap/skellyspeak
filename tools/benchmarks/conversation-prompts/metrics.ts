import { readFileSync, writeFileSync } from 'node:fs';

const directory = process.argv[2];
if (!directory) throw Error('Usage: metrics.ts RESULTS_DIRECTORY');
const plan = JSON.parse(readFileSync(`${directory}/plan.json`, 'utf8'));
const rows = readFileSync(`${directory}/results.jsonl`, 'utf8').trim().split('\n').map(line => JSON.parse(line));
const groups: Record<string, any[]> = {};
for (const row of rows) {
  const job = plan.jobs.find((j: any) => j.id === row.id);
  if (!job) throw Error('Unknown trial');
  const count = [...new Intl.Segmenter(job.locale ?? 'es', { granularity: 'sentence' }).segment(row.content ?? '')].filter(x => x.segment.trim()).length;
  const sample = { ...row, ...job, sentenceCount: count, questionCount: (row.content?.match(/[?؟？]/gu) ?? []).length };
  for (const key of [job.variant, `${job.language ?? 'spanish'}/${job.variant}`]) (groups[key] ??= []).push(sample);
}
const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const summary = Object.fromEntries(Object.entries(groups).map(([group, samples]) => {
  const low = samples.filter(x => ['absolute_zero', 'beginner'].includes(x.level));
  const usages = samples.map(x => x.metadata.usage);
  const average = (field: string) => usages.reduce((n, u) => n + (u[field] ?? 0), 0) / usages.length;
  if (usages.some(u => ['prompt_tokens', 'completion_tokens', 'cost'].some(k => typeof u[k] !== 'number'))) throw Error('Missing numeric usage; do not assume zero');
  return [group, { calls: samples.length, completed: samples.filter(x => x.status === 'complete').length,
    costUsd: usages.reduce((n, u) => n + u.cost, 0), meanPromptTokens: average('prompt_tokens'),
    meanCompletionTokens: average('completion_tokens'), p50Ms: percentile(samples.map(x => x.elapsedMs), 0.5),
    p95Ms: percentile(samples.map(x => x.elapsedMs), 0.95),
    lowLevelSingleSentence: low.filter(x => x.sentenceCount === 1).length, lowLevelCount: low.length,
    multiQuestionTurns: samples.filter(x => x.questionCount > 1).length,
    // Do not label these readability, CEFR or quality scores.
    metricLimit: 'Punctuation counts are mechanical screens; latency is descriptive and unreplicated.',
  }];
}));
writeFileSync(`${directory}/metrics.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).filter(([k]) => !k.includes('/'))), null, 2));
