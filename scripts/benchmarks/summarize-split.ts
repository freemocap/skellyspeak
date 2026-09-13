import { readFileSync, writeFileSync } from 'node:fs';
const directory = 'workflow/benchmarks/model-routing';
const rows = readFileSync(`${directory}/split-results.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const native = readFileSync(`${directory}/split-native-validation.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const key = (r: any) => `${r.trial}/${r.group}/${r.variant}/${r.fixture}`;
if (rows.length !== 78 || native.length !== 78) throw new Error('Incomplete experiment; do not report completion metrics');
if (new Set(rows.map(key)).size !== rows.length || new Set(native.map(key)).size !== native.length) throw new Error('Duplicate result identity');
const validated = new Map(native.map(r => [key(r), r.outcome]));
const groups = [...new Set(rows.map(r => `${r.trial}/${r.group}/${r.variant}`))].map(id => {
  const results = rows.filter(r => `${r.trial}/${r.group}/${r.variant}` === id);
  const expectedParts = results[0].variant === 'whole' ? 1 : 4;
  if (results.length !== expectedParts) throw new Error('Missing result parts');
  const good = results.filter(r => {
    const outcome = validated.get(key(r));
    if (!outcome) throw new Error(`Missing native validation: ${key(r)}`);
    return outcome.accepted && outcome.coverage === 'Complete' && outcome.glossCount > 0;
  });
  const first = results.find(r => r.part === '0' || r.part === 'whole');
  return { trial: results[0].trial, language: results[0].group, variant: results[0].variant,
    expectedParts, validParts: good.length,
    firstValidatedPieceMs: good.length ? Math.min(...good.map(r => r.readyAfterMs)) : null,
    firstInOrderPieceMs: first && good.includes(first) ? first.readyAfterMs : null,
    allValidatedMs: good.length === results.length ? Math.max(...good.map(r => r.readyAfterMs)) : null,
    allSettledMs: Math.max(...results.map(r => r.readyAfterMs)),
    inputTokens: results.reduce((n, r) => n + (r.usage?.prompt_tokens ?? 0), 0),
    outputTokens: results.reduce((n, r) => n + (r.usage?.completion_tokens ?? 0), 0),
    estimatedCostUsd: results.reduce((n, r) => n + (r.estimatedCostUsd ?? 0), 0),
    unmetered: results.filter(r => !r.usage).length };
});
const median = (values: number[]) => {
  values.sort((a,b) => a-b); const middle = Math.floor(values.length / 2);
  return values.length ? values.length % 2 ? values[middle] : (values[middle-1]+values[middle])/2 : null;
};
const summary = ['whole','split-1','split-2','split-4'].map(variant => {
  const subset = groups.filter(g => g.variant === variant);
  const med = (field: 'firstValidatedPieceMs'|'firstInOrderPieceMs'|'allValidatedMs'|'allSettledMs') => median(subset.map(g => g[field]).filter((v): v is number => v !== null));
  return { variant, conditions: subset.length, allValid: subset.filter(g => g.allValidatedMs !== null).length,
    medianFirstPieceMs: med('firstValidatedPieceMs'), medianFirstInOrderMs: med('firstInOrderPieceMs'),
    medianAllValidatedMs: med('allValidatedMs'), medianAllSettledMs: med('allSettledMs'),
    inputTokens: subset.reduce((n,g) => n+g.inputTokens,0), outputTokens: subset.reduce((n,g) => n+g.outputTokens,0),
    estimatedCostUsd: subset.reduce((n,g) => n+g.estimatedCostUsd,0), unmetered: subset.reduce((n,g) => n+g.unmetered,0) };
});
writeFileSync(`${directory}/split-summary.json`, JSON.stringify({ groups, summary }, null, 2));
console.log(JSON.stringify(summary, null, 2));
