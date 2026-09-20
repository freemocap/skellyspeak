import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = process.argv[2];
if (!directory) throw Error('Usage: review.ts RESULTS_DIRECTORY');
const plan = JSON.parse(readFileSync(`${directory}/plan.json`, 'utf8'));
const rows = readFileSync(`${directory}/results.jsonl`, 'utf8').trim().split('\n').map(line => JSON.parse(line));
const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const grouped: Record<string, any[]> = {};
const blind = [], key = [];
let knownCost = 0, missingCost = 0;
for (const row of rows) {
  const job = plan.jobs.find((x: any) => x.id === row.id);
  if (!job) throw Error('Result has no matching planned request');
  const content = row.content ?? '';
  const segments = new Intl.Segmenter(job.locale ?? 'es', { granularity: 'sentence' });
  const sentences = [...segments.segment(content)].filter(x => x.segment.trim()).length;
  const cost = row.metadata?.usage?.cost;
  if (typeof cost === 'number') knownCost += cost; else missingCost++;
  const id = createHash('sha256').update(row.id).digest('hex').slice(0, 12);
  const group = `${job.language ? `${job.language} / ` : ''}${job.level} / ${job.scenario}`;
  (grouped[group] ??= []).push({ ...row, variant: job.variant, repeat: job.repeat, sentences,
    context: (row.requestMessages ?? job.messages).slice(1) });
  blind.push([id, job.language ?? 'spanish', job.level, job.scenario, JSON.stringify((row.requestMessages ?? job.messages).slice(1)), content, sentences, '', '', '', '', '']);
  key.push([id, row.id]);
}
blind.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
writeFileSync(`${directory}/blind-review.csv`, [
  ['sample_id', 'language', 'level', 'scenario', 'history', 'response', 'sentence_count_heuristic',
    'difficulty_fit_0_2', 'reply_opportunity_0_2', 'responsiveness_0_2', 'persona_consistency_0_2_or_na', 'notes'], ...blind,
].map(row => row.map(csv).join(',')).join('\n') + '\n');
writeFileSync(`${directory}/blind-key.csv`, [['sample_id', 'job_id'], ...key].map(row => row.map(csv).join(',')).join('\n') + '\n');
const text = [`# Saved model outputs\n\nGenerated comparison; not a model-quality score. Sentence counts are a punctuation heuristic.\n\nCompleted ${rows.filter(x => x.status === 'complete').length}/${plan.calls} planned calls. Provider-reported cost: $${knownCost.toFixed(8)} across ${rows.length - missingCost} calls; ${missingCost} missing cost records. Reservation: $${plan.reservationUsd.toFixed(6)}.\n`];
for (const [name, samples] of Object.entries(grouped)) {
  text.push(`## ${name}\n`);
  for (const row of samples) {
    const context = row.context.slice(-2).map((m: any) => `> ${m.role === 'user' ? 'Learner' : 'Previous partner'}: ${m.content.replaceAll('\n', '\n> ')}`).join('\n>\n');
    text.push(`### ${row.variant}${row.repeat ? ` / repeat ${row.repeat}` : ''}\n\nSample: ${row.id}\n\n${context ? `${context}\n\n` : ''}${row.content ?? '[No content]'}\n\nSentence-count heuristic: ${row.sentences}. Status: ${row.status}.\n`);
  }
}
writeFileSync(`${directory}/samples.md`, text.join('\n'));
console.log(JSON.stringify({ completed: rows.length, planned: plan.calls, reportedCostUsd: knownCost, missingCost }));
