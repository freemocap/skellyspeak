/** Offline expansion, export, and bounded plans. This command makes no network calls. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scenarios } from './scenarios.ts';
import { native, freezePlan, hash } from './study.ts';
import { planReport } from './report.ts';

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const save = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value, null, 2), { flag: 'wx' });
export function partition(cases: any[]) {
  const groups = new Map<string, any[]>();
  for (const c of cases) {
    if (!['recorded', 'synthetic'].includes(c.origin)) throw Error('Missing dataset provenance');
    const key = c.origin === 'recorded' ? 'recorded' : `synthetic-${c.language}`;
    const rows = groups.get(key) ?? [];
    groups.set(key, [...rows, c]);
  }
  return groups;
}
export function generate(directory: string, recordedPath: string, pricingPath: string) {
  const recorded = read(recordedPath);
  const { hash: pricingHash, ...pricing } = read(pricingPath);
  if (hash(pricing) !== pricingHash) throw Error('Pricing plan hash mismatch');
  const fixtures = scenarios();
  const createdAt = new Date().toISOString();
  const models = recorded.models;
  if (models.standard_model !== pricing.catalogs.standard.model || models.fast_model !== pricing.catalogs.fast.model)
    throw Error('Recorded selections differ from pricing snapshot');
  mkdirSync(directory, { recursive: true });
  save(join(directory, 'synthetic-input.json'), { mode: 'synthetic', capturedAt: createdAt, models, scenarios: fixtures });
  const synthetic = native(join(directory, 'synthetic-input.json'), join(directory, 'synthetic-native.json'));
  // Re-export recorded contracts with the same current source as the synthetic suite.
  save(join(directory, 'recorded-input.json'), { ...recorded, mode: 'export',
    cases: recorded.cases.map(({ payload, ...c }: any) => ({ ...c, origin: 'recorded' })) });
  const actual = native(join(directory, 'recorded-input.json'), join(directory, 'recorded-native.json'));
  const batches = [];
  for (const [name, cases] of partition([...actual.cases, ...synthetic.cases])) {
    const batch = join(directory, name);
    mkdirSync(batch);
    const exported = { mode: 'export', capturedAt: createdAt, models, cases };
    save(join(batch, 'capture.json'), { ...exported, cases: cases.map(({ payload, ...c }: any) => c) });
    save(join(batch, 'native.json'), exported);
    const plan = { ...freezePlan(exported, pricing.rates, pricing.catalogs),
      pricingSnapshotCreatedAt: pricing.createdAt, fixtureHash: hash(fixtures),
      provenance: { recordedCapturedAt: recorded.capturedAt, syntheticAuthorship: 'fictional authored fixtures',
        referenceQuality: 'Author-proposed review criteria; not independently reviewed gold labels' } };
    save(join(batch, 'plan.json'), { ...plan, hash: hash(plan) });
    planReport(batch);
    batches.push({ name, cases: cases.length, calls: plan.jobs.length, reservationUsd: plan.reservationUsd });
  }
  const manifest = { createdAt, fixtureHash: hash(fixtures), syntheticScenarios: fixtures.length,
    independentSemanticScenarios: new Set(fixtures.map(f => f.semanticCaseId)).size,
    syntheticRequests: synthetic.cases.length, recordedRequests: actual.cases.length,
    pricingSnapshotCreatedAt: pricing.createdAt, livePriceRecheckRequired: true, batches,
    totalCalls: batches.reduce((n, b) => n + b.calls, 0),
    totalReservationUsd: batches.reduce((n, b) => n + b.reservationUsd, 0),
    paidCallsMade: 0 };
  save(join(directory, 'suite.json'), manifest);
  writeFileSync(join(directory, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Expanded model comparison</title>
<style>body{font:16px system-ui;max-width:1100px;margin:32px auto;padding:16px;line-height:1.5}table{border-collapse:collapse}td,th{padding:9px;border:1px solid #ccc}a{color:#2456ad}</style>
<h1>Expanded model comparison</h1><p>${manifest.syntheticScenarios} synthetic exchanges (${manifest.independentSemanticScenarios} semantic scenarios), ${manifest.syntheticRequests} synthetic task requests, and ${manifest.recordedRequests} recorded requests. Two models × two repetitions: ${manifest.totalCalls} planned calls.</p>
<p>Offline preparation only. No paid calls made. Total reservation at the saved price snapshot: $${manifest.totalReservationUsd.toFixed(4)}. Every batch is separately bounded at $5; the full suite is larger than the original pilot and has not been run. Live execution rechecks prices.</p>
<p>Six languages × ten families: clear wording, deliberate form error, negation, clarification, topic change, ambiguous reference, goodbye, quoted instruction, speech transcript, and longer history. Canonically equivalent source variants are paired with their semantic originals, not treated as independent examples. Four difficulty settings are represented.</p>
<p>Fictional partner replies are fixed context for downstream tasks, not model outputs or gold answers. Review notes are provisional expectations, not certified linguistic labels. Timings will measure independent requests, not whole-app latency. Recorded and synthetic results must remain separately identifiable.</p>
<table><tr><th>Dataset</th><th>Requests</th><th>Calls</th><th>Reserved USD</th></tr>${batches.map(b => `<tr><td><a href="${b.name}/plan.html">${b.name}</a></td><td>${b.cases}</td><td>${b.calls}</td><td>${b.reservationUsd.toFixed(4)}</td></tr>`).join('')}</table>`, { flag: 'wx' });
  console.log(JSON.stringify(manifest, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory, recorded, pricing] = process.argv.slice(2);
  if (!directory || !recorded || !pricing) throw Error('Usage: generate.ts PRIVATE_DIRECTORY RECORDED_CAPTURE PRICING_PLAN');
  generate(directory, recorded, pricing);
}
