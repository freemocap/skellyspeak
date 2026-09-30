import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash } from './study.ts';

export function summarize(rows: any[]) {
  const costs = rows.map(r => r.metadata?.usage?.cost);
  const times = rows.map(r => r.elapsedMs).filter(Number.isFinite).sort((a, b) => a - b);
  const valid = rows.filter(r => r.status === 'complete' && r.validation?.valid === true).length;
  return { calls: rows.length, valid, knownCost: costs.filter(Number.isFinite).reduce((a, b) => a + b, 0),
    unknownCosts: costs.filter(c => !Number.isFinite(c)).length,
    costPerValid: valid && costs.every(Number.isFinite) ? costs.reduce((a, b) => a + b, 0) / valid : null,
    medianMs: times.length ? (times[Math.floor((times.length - 1) / 2)] + times[Math.floor(times.length / 2)]) / 2 : null,
    minMs: times[0] ?? null, maxMs: times.at(-1) ?? null };
}
const esc = (v: unknown) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const money = (v: number | null) => v === null ? 'unavailable' : `$${v.toFixed(6)}`;
export function planReport(directory: string) {
  const plan = JSON.parse(readFileSync(join(directory, 'plan.json'), 'utf8'));
  writeFileSync(join(directory, 'plan.html'), `<!doctype html><meta charset="utf-8"><title>Model comparison plan</title>
<style>body{font:16px system-ui;max-width:1100px;margin:32px auto;padding:16px;color:#20242b}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}details{border:1px solid #ccd1d8;padding:12px;margin:12px 0}summary{cursor:pointer}table{border-collapse:collapse}td,th{padding:8px;border:1px solid #ccd1d8}</style>
<h1>Model comparison plan</h1><p>${plan.cases.length} task cases × two models × two repetitions = ${plan.jobs.length} calls. Conservative reservation: ${money(plan.reservationUsd)}. No paid requests are made by this viewer.</p>
<p>Captured ${esc(plan.capturedAt)}. Private prompts below would be sent through the configured experiment endpoint using the local credential. Results remain private local files; the app database and model settings are unchanged.</p>
<p>Compare fixed inputs first: partner replies, glosses, coaching, and reply assistance. Alternate model order for paired timing. Retain costs, failures and native validation. Human review must assess meaning, correctness and usefulness. Two repetitions screen for problems; they cannot establish equivalence.</p>
<p>${plan.limitations.map(esc).join(' ')}</p>
<table><tr><th>Source</th><th>Scenario</th><th>Task</th><th>Language</th><th>Calls</th></tr>${plan.cases.map((c: any) => `<tr><td>${esc(c.origin ?? 'recorded')}</td><td>${esc(c.family ?? 'recorded context')}</td><td>${esc(c.kind)}</td><td>${esc(c.language)}</td><td>4</td></tr>`).join('')}</table>
${plan.cases.map((c: any) => `<details><summary>${esc(c.kind)} · ${esc(c.language)} · ${esc(c.family ?? 'recorded context')} · ${esc(c.encoding)} · exact input</summary><p>Conversation ${esc(c.conversation)}; turn ${esc(c.turn)}</p><p>Proposed review criteria (not a gold label): ${esc(c.review ?? 'Review meaning, correctness, task fit, and concrete harmful errors.')}</p><pre>${esc(JSON.stringify(c.payload, null, 2))}</pre></details>`).join('')}`);
}
export function report(directory: string) {
  const read = (name: string) => JSON.parse(readFileSync(join(directory, name), 'utf8'));
  const plan = read('plan.json');
  const validation = read('validation.json');
  const rows = readFileSync(join(directory, 'results.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(s => JSON.parse(s)).map(r => ({
    ...r, kind: plan.cases.find((c: any) => c.id === r.caseId).kind,
    language: plan.cases.find((c: any) => c.id === r.caseId).language,
    origin: plan.cases.find((c: any) => c.id === r.caseId).origin ?? 'recorded',
    family: plan.cases.find((c: any) => c.id === r.caseId).family ?? 'recorded',
    semanticCaseId: plan.cases.find((c: any) => c.id === r.caseId).semanticCaseId ?? r.caseId,
    validation: validation.cases.find((c: any) => c.id === r.id)?.validation,
  }));
  const groups = [...new Set<string>(rows.map(r => r.kind))].map(kind => ({ kind,
    standard: summarize(rows.filter(r => r.kind === kind && r.arm === 'standard')),
    fast: summarize(rows.filter(r => r.kind === kind && r.arm === 'fast')),
  }));
  const summary = { planned: plan.jobs.length, completed: rows.length,
    standard: summarize(rows.filter(r => r.arm === 'standard')), fast: summarize(rows.filter(r => r.arm === 'fast')), groups,
    strata: [...new Set<string>(rows.map(r => JSON.stringify([r.origin, r.language, r.family, r.kind])))].map(key => {
      const [origin, language, family, kind] = JSON.parse(key);
      const selected = rows.filter(r => r.origin === origin && r.language === language && r.family === family && r.kind === kind);
      return { origin, language, family, kind, semanticCases: new Set(selected.map(r => r.semanticCaseId)).size,
        standard: summarize(selected.filter(r => r.arm === 'standard')), fast: summarize(selected.filter(r => r.arm === 'fast')) };
    }) };
  writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2));
  const tableRows = groups.flatMap(g => ['standard', 'fast'].map(arm => {
    const s = g[arm as 'standard' | 'fast'];
    return `<tr><td>${esc(g.kind)}</td><td>${arm}</td><td>${s.valid}/${s.calls}</td><td>${s.medianMs}</td><td>${s.minMs}–${s.maxMs}</td><td>${money(s.knownCost)}</td><td>${s.unknownCosts}</td><td>${money(s.costPerValid)}</td></tr>`;
  })).join('');
  const review: string[] = ['pair,sample,meaning_0_2,correctness_0_2,task_fit_0_2,harmful_error,notes'];
  const key: string[] = ['sample,arm,receipt'];
  const pairs = plan.cases.map((c: any) => {
    const variants = rows.filter(r => r.caseId === c.id).sort((a, b) => hash(a.id).localeCompare(hash(b.id)));
    const blocks = variants.map((r, i) => {
      const sample = `${hash(c.id).slice(0, 8)}-${i + 1}`;
      review.push(`${hash(c.id).slice(0, 8)},${sample},,,,,`);
      key.push(`${sample},${r.arm},${r.id}`);
      return `<article><h3>Sample ${sample}</h3><pre>${esc(r.content)}</pre><details><summary>Reveal measurement and validation</summary><pre>${esc(JSON.stringify({ arm: r.arm, elapsedMs: r.elapsedMs, metadata: r.metadata, validation: r.validation }, null, 2))}</pre></details></article>`;
    }).join('');
    return `<section><h2>${esc(c.kind)} · ${esc(c.language)} · ${esc(c.origin ?? 'recorded')} · ${esc(c.family)}</h2><p>${esc(c.review)} ${esc(c.encoding)}. Reference criteria are provisional; standard output is not ground truth.</p><details><summary>Exact input and contract</summary><pre>${esc(JSON.stringify(c.payload, null, 2))}</pre></details><div class="pair">${blocks}</div></section>`;
  }).join('');
  writeFileSync(join(directory, 'review.csv'), review.join('\n') + '\n', { flag: 'wx' });
  writeFileSync(join(directory, 'review-key.csv'), key.join('\n') + '\n');
  writeFileSync(join(directory, 'report.html'), `<!doctype html><meta charset="utf-8"><title>Recorded model comparison</title><style>
body{font:16px system-ui;margin:32px;line-height:1.45;color:#20242b;background:#f5f6f8}table{border-collapse:collapse;background:white}td,th{padding:8px 12px;border:1px solid #ccd1d8;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px ui-monospace;max-height:600px;overflow:auto}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article{padding:16px;background:white;border:1px solid #ccd1d8}section{margin-top:32px}details{margin:12px 0}summary{cursor:pointer}h2{font-size:20px}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style>
<h1>Recorded model comparison</h1><p>Private local study. ${rows.length}/${plan.jobs.length} planned calls recorded. Known spend ${money(summary.standard.knownCost + summary.fast.knownCost)}; ${summary.standard.unknownCosts + summary.fast.unknownCosts} missing costs. Reservation ${money(plan.reservationUsd)}.</p>
<p>Two repetitions per case and model. Inputs are fixed; upstream alternative outputs are not propagated. Timings measure complete direct responses, not first-token latency or app end-to-end waits. Validation checks the native output contract; it does not establish semantic quality. Missing or failed calls remain visible. Different tasks can contain different languages and contexts.</p>
<details><summary>Show model measurements</summary><table><tr><th>Task</th><th>Arm</th><th>Native valid / calls</th><th>Median ms</th><th>Range ms</th><th>Known cost</th><th>Unknown costs</th><th>Cost / valid</th></tr>${tableRows}</table></details>
<p>Review the exact inputs and outputs before revealing arms. Score meaning preservation, linguistic correctness, and task fit from 0 (fails) to 2 (satisfies); record concrete harmful errors. The standard output is a comparator, not a gold answer. Glosses require source coverage and correct context-specific meaning; coaching requires defensible observations and repairs; replies require coherent, level-appropriate conversation; assistance requires usable alternatives and correct explanations.</p>${pairs}`);
  console.log(JSON.stringify(summary, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[3] === '--plan') planReport(process.argv[2]); else report(process.argv[2]);
}
