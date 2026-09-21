import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { call } from './transport.ts';
import type { Job } from './plan.ts';
const corpus = JSON.parse(readFileSync('tools/benchmarks/conversation-prompts/assessment/spanish-cases.json', 'utf8'));
test('twelve references have balanced families and provisional targeted labels', () => {
    assert.equal(corpus.cases.length, 12);
    for (const group of ['clear', 'partial', 'absent', 'partner-only'])
        assert.equal(corpus.cases.filter((c: any) => c.group === group).length, 3);
    assert.ok(Object.keys(corpus.cases.find((c: any) => c.id === 'clear-many').targets).length > 4);
    assert.ok(corpus.cases.filter((c: any) => c.group === 'partial').every((c: any) => c.review.includes('Provisional')));
});
test('native sparse omission remains unreported and quotes bind to current source', async () => {
    const job: Job = { id: 'native', sourceId: 'x', sourceTextHash: 'x', language: 'spanish', level: 'clear', prompt: 'native', engine: 'sparse', condition: 'alone/normal', repeat: 1, outputFormat: 'native',
        payload: { model: 'google/gemini-2.5-flash-lite', state: { currentLearnerMessage: 'Gracias.' }, questions: { courtesy: { type: 'choice', instructions: 'Thanks', criteria: {} } } }, request: { model: 'google/gemini-2.5-flash-lite' } };
    const response = (content: unknown) => (async () => new Response(JSON.stringify({ model: job.payload.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }], usage: { cost: .01 } }))) as typeof fetch;
    const empty = await call(job, 'SECRET', response({ items: [] }));
    assert.equal(empty.status, 'complete');
    assert.deepEqual(empty.answers, {});
    assert.deepEqual(empty.sparseItems, []);
    const wrong = await call(job, 'SECRET', response({ items: [{ construct: 'courtesy', quote: 'partner words', outcome: 'demonstrated', rationale: 'Not learner evidence.' }] }));
    assert.equal(wrong.status, 'failed');
    assert.equal(wrong.metadata?.usage.cost, .01);
});
import { quality, summarize, quantile, type Row } from './spanish-analysis.ts';
test('scoring separates missed positives, false credit, partial labels and unknown targets', () => {
    const q = quality({ a: 'demonstrated', b: 'partial', c: 'not_observed' }, { a: 'unreported', b: 'demonstrated', c: 'partial', unknown: 'demonstrated' }, true);
    assert.deepEqual(q, { positiveTotal: 2, positiveHits: 1, negativeTotal: 1, falseCredits: 1, exact: 0, scored: 3 });
    assert.equal(quality({ a: 'not_observed' }, { a: 'unreported' }, true).exact, 1);
    assert.equal(quality({ a: 'demonstrated' }, {}, false).scored, 0);
});
test('case-macro summaries do not weight repeated or many-target cases as independent cases', () => {
    const row = (caseId: string, hits: number, total: number, cost: number | null, status = 'complete') => ({ caseId, status, positiveHits: hits, positiveTotal: total, negativeTotal: 0, falseCredits: 0, elapsedMs: 100, cost }) as Row;
    const s = summarize([row('one', 1, 1, .1), row('one', 1, 1, .1), row('many', 0, 9, .2), row('failed', 0, 0, null, 'failed')]);
    assert.equal(s.macroRecall, .5);
    assert.equal(s.complete, 3);
    assert.equal(s.failed, 1);
    assert.equal(s.missingCosts, 1);
    assert.equal(s.knownCost, .4);
    assert.equal(s.costPerComplete, .4 / 3);
    assert.equal(s.positiveCases, 2);
    assert.equal(quantile([], .5), null);
    assert.equal(quantile([400, 100, 200, 300], .5), 200);
});
