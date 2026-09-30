/** Read-only receipt analysis. Mechanical screens are not native validation or semantic scores. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { hash } from './study.ts';

const [out, ...directories] = process.argv.slice(2);
if (!out || !directories.length) throw Error('Usage: pilot-report.ts OUTPUT RUN_DIRECTORY [CONTINUATION_DIRECTORY]');
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const plan = read(join(directories[0], 'plan.json'));
const rows: any[] = [];
for (const directory of directories) {
  const { hash: expected, ...source } = read(join(directory, 'plan.json'));
  assert.equal(hash(source), expected);
  for (const line of readFileSync(join(directory, 'results.jsonl'), 'utf8').trim().split('\n').filter(Boolean)) {
    const row = JSON.parse(line);
    assert.ok(!rows.some(r => r.id === row.id), 'Duplicate receipt');
    const job = source.jobs.find((j: any) => j.id === row.id);
    const original = plan.jobs.find((j: any) => j.id === row.id);
    assert.ok(job && original && hash(job.payload) === hash(original.payload), 'Request changed');
    const c = plan.cases.find((c: any) => c.id === row.caseId);
    row.case = c;
    row.screens = [];
    if (row.status === 'complete' && c.payload.response_format) {
      try { row.parsed = JSON.parse(row.content); }
      catch { row.screens.push('invalid_json'); }
    }
    if (row.parsed && c.kind === 'persona_word_gloss') {
      const input = JSON.parse(c.messages.at(-1).content);
      const graphemes = input.graphemes;
      const spans = row.parsed.spans;
      if (Array.isArray(spans)) {
        row.glossCount = spans.filter((s: any) => s.kind === 'gloss').length;
        if (!row.glossCount) row.screens.push('no_word_meanings');
        const used = new Set<number>();
        for (const span of spans) {
          const a = graphemes.findIndex((g: any) => g.id === span.first);
          const b = graphemes.findIndex((g: any) => g.id === span.last);
          if (a < 0 || b < a) { row.screens.push('invalid_span_anchor'); continue; }
          for (let i = a; i <= b; i++) {
            if (used.has(i)) row.screens.push('overlapping_spans');
            used.add(i);
          }
          const text = graphemes.slice(a, b + 1).map((g: any) => g.text).join('');
          if (span.kind === 'literal' && /[\p{L}\p{N}]/u.test(text)) row.screens.push('word_characters_marked_literal');
        }
      }
    }
    row.screens = [...new Set(row.screens)];
    rows.push(row);
  }
}
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
};
const stats = (items: any[]) => ({ attempted: items.length, completed: items.filter(r => r.status === 'complete').length,
  failed: items.filter(r => r.status !== 'complete').length,
  medianSuccessfulMs: median(items.filter(r => r.status === 'complete').map(r => r.elapsedMs)),
  knownCost: items.reduce((n, r) => n + (Number.isFinite(r.metadata?.usage?.cost) ? r.metadata.usage.cost : 0), 0),
  unknownCosts: items.filter(r => !Number.isFinite(r.metadata?.usage?.cost)).length,
  screenFindings: items.filter(r => r.screens.length).map(r => ({ id: r.id, issues: r.screens })) });
const groups = [...new Set<string>(plan.cases.map((c: any) => c.kind))].map(kind => {
  const selected = rows.filter(r => r.case.kind === kind);
  const pairs = selected.filter(r => r.arm === 'standard' && r.status === 'complete').flatMap(standard => {
    const fast = selected.find(r => r.caseId === standard.caseId && r.repetition === standard.repetition && r.arm === 'fast' && r.status === 'complete');
    return fast ? [{ standard, fast }] : [];
  });
  const pairedCost = (arm: 'standard' | 'fast') => pairs.reduce((n, p) => n + p[arm].metadata.usage.cost, 0);
  return { kind, standard: stats(selected.filter(r => r.arm === 'standard')), fast: stats(selected.filter(r => r.arm === 'fast')),
    matchedPairs: pairs.length, medianPairedTimeRatio: median(pairs.map(p => p.fast.elapsedMs / p.standard.elapsedMs)),
    pairedCostRatio: pairs.length && pairs.every(p => ['standard', 'fast'].every(a => Number.isFinite(p[a as 'standard' | 'fast'].metadata?.usage?.cost))) ? pairedCost('fast') / pairedCost('standard') : null };
});
const summary = { planned: plan.jobs.length, ...stats(rows), groups,
  validation: 'Native replay unavailable because concurrent language configuration edits prevent its registry from loading. Mechanical screens are independent, limited checks.' };
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
const esc = (v: unknown) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const pct = (ratio: number | null) => ratio === null ? 'unavailable' : `${((1 - ratio) * 100).toFixed(1)}%`;
writeFileSync(join(out, 'report.html'), `<!doctype html><meta charset="utf-8"><title>Initial model comparison results</title>
<style>body{font:16px system-ui;line-height:1.5;margin:32px;color:#20242b;background:#f7f8fa}table{border-collapse:collapse}td,th{padding:10px;border:1px solid #ccd0d8;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px ui-monospace}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article{padding:16px;background:white;border:1px solid #ccd0d8}summary{cursor:pointer}section{margin-top:32px}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style>
<h1>Initial standard / fast comparison</h1><p>${summary.completed} completed, ${summary.failed} failed, ${summary.planned - summary.attempted} unattempted. Known billed cost: $${summary.knownCost.toFixed(6)}. ${summary.unknownCosts} unknown costs; these are not treated as free calls.</p>
<p>Synthetic Spanish, Arabic and Mandarin; four tasks, one context per task/language, two repetitions. Identical inputs within every pair. Two rate-limited calls are preserved without retry; continuations used five-second then ten-second gaps. Waiting between requests is excluded from response durations. Native validation is unavailable; the screens below do not establish app acceptance.</p>
<table><tr><th>Task</th><th>Standard median ms</th><th>Fast median ms</th><th>Matched pairs</th><th>Median paired time reduction</th><th>Paired cost reduction</th></tr>${groups.map(g => `<tr><td>${esc(g.kind)}</td><td>${g.standard.medianSuccessfulMs}</td><td>${g.fast.medianSuccessfulMs}</td><td>${g.matchedPairs}</td><td>${pct(g.medianPairedTimeRatio)}</td><td>${pct(g.pairedCostRatio)}</td></tr>`).join('')}</table>
<p>These measure whole direct-provider requests, not app first-token or end-to-end latency. Small samples and related repetitions cannot establish equivalence. Open the actual outputs below; a transport-complete response can still be malformed or unhelpful.</p>
${plan.cases.map((c: any) => `<section><h2>${esc(c.kind)} · ${esc(c.language)} · ${esc(c.family)}</h2><details><summary>Exact input and output contract</summary><pre>${esc(JSON.stringify(c.payload, null, 2))}</pre></details><div class="pair">${rows.filter(r => r.caseId === c.id).sort((a, b) => a.repetition - b.repetition || b.arm.localeCompare(a.arm)).map(r => `<article><h3>${esc(r.arm)} · repetition ${r.repetition + 1}</h3><p>${r.elapsedMs} ms · cost ${r.metadata?.usage?.cost ?? 'unknown'} · ${esc(r.status)}</p><p>Mechanical screens: ${esc(r.screens.join(', ') || 'no findings; semantic quality not determined')}</p><pre>${esc(r.content ?? 'No completion received.')}</pre><details><summary>Receipt</summary><pre>${esc(JSON.stringify({ ...r, case: undefined, parsed: undefined, content: undefined }, null, 2))}</pre></details></article>`).join('')}</div></section>`).join('')}`);
console.log(JSON.stringify(summary, null, 2));
