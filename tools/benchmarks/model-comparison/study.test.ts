import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobsFor, reservation, hash } from './study.ts';
import { summarize } from './report.ts';

test('paired requests change only model and reverse order across repetitions', () => {
  const cases: any[] = [{ id: 'case', model: 'standard-selection', fastModel: 'fast-selection',
    payload: { model: 'standard-selection', messages: [{ role: 'user', content: 'é العربية 日本語' }],
      max_tokens: 2048, temperature: .7, response_format: { type: 'json_schema' } } }];
  const rate = { inputRate: .000001, outputRate: .000002 };
  const jobs = jobsFor(cases, 2, { standard: rate, fast: rate });
  assert.deepEqual(jobs.map(j => j.arm), ['standard', 'fast', 'fast', 'standard']);
  const { model: _, ...a } = jobs[0].payload;
  const { model: __, ...b } = jobs[1].payload;
  assert.deepEqual(a, b);
  assert.notEqual(hash(jobs), hash(jobs.slice(1)));
  assert.ok(reservation(jobs[0].payload, rate) >= 2048 * rate.outputRate);
});
test('failed and unvalidated calls are not counted as valid or free', () => {
  const result = summarize([
    { status: 'complete', elapsedMs: 10, validation: { valid: true }, metadata: { usage: { cost: .01 } } },
    { status: 'failed', elapsedMs: 30, metadata: { usage: { cost: .02 } } },
    { status: 'complete', elapsedMs: 50, metadata: { usage: {} } },
  ]);
  assert.equal(result.valid, 1);
  assert.equal(result.knownCost, .03);
  assert.equal(result.unknownCosts, 1);
  assert.equal(result.costPerValid, null);
  assert.equal(result.medianMs, 30);
  assert.equal(summarize([]).medianMs, null);
});
