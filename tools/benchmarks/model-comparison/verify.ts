/** Verify frozen local suite artifacts without network or printing conversation text. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hash } from './study.ts';
import { scenarios } from './scenarios.ts';

const directory = process.argv[2];
if (!directory) throw Error('Usage: verify.ts SUITE_DIRECTORY');
const read = (file: string) => JSON.parse(readFileSync(join(directory, file), 'utf8'));
const suite = read('suite.json');
assert.equal(suite.fixtureHash, hash(scenarios()), 'Fixture source changed since generation');
let calls = 0;
for (const batch of suite.batches) {
  const { hash: expected, ...plan } = read(`${batch.name}/plan.json`);
  assert.equal(hash(plan), expected, 'Plan changed');
  assert.ok(plan.reservationUsd <= 5);
  assert.equal(plan.jobs.length, plan.cases.length * 4);
  assert.ok(plan.cases.every((c: any) => c.origin === (batch.name === 'recorded' ? 'recorded' : 'synthetic')));
  for (const c of plan.cases) {
    const jobs = plan.jobs.filter((j: any) => j.caseId === c.id);
    const withoutModel = ({ model, ...payload }: any) => payload;
    assert.ok(jobs.every((j: any) => hash(withoutModel(j.payload)) === hash(withoutModel(jobs[0].payload))));
  }
  assert.ok(!existsSync(join(directory, batch.name, 'run.json')), 'Verification expects an unexecuted suite');
  calls += plan.jobs.length;
}
assert.equal(calls, suite.totalCalls);
const synthetic = read('synthetic-native.json');
for (const variant of synthetic.cases.filter((c: any) => c.encoding === 'canonical_variant' && c.kind === 'persona_reply')) {
  const original = synthetic.cases.find((c: any) => c.scenarioId === variant.semanticCaseId && c.kind === variant.kind);
  // Only the deliberately varied current source may differ, not persona or earlier history.
  assert.equal(hash(original.messages.slice(0, -1)), hash(variant.messages.slice(0, -1)),
    `Canonical pair has unrelated context differences: ${variant.language}`);
}
console.log(JSON.stringify({ verified: true, batches: suite.batches.length, calls, paidCalls: 0 }));
