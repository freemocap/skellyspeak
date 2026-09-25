import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlan } from './plan.ts';
import { summarize, arms } from './dashboard/statistics.ts';
test('expanded frozen experiment balances every language, case, arm and repetition without reference leakage', () => {
    const p = makePlan();
    assert.equal(p.cases.length, 108);
    assert.equal(p.calls, 2700);
    assert.equal(new Set(p.cases.map(c => c.cluster)).size, 31);
    assert.equal(new Set(p.jobs.map(j => j.id)).size, 2700);
    for (const c of p.cases)
        for (const a of arms)
            assert.equal(p.jobs.filter(j => j.caseId === c.id && j.arm === a).length, 5);
    for (const j of p.jobs) {
        assert.ok(!Object.hasOwn(j.payload, 'temperature'));
        assert.ok(!Object.hasOwn(j.payload.state, 'targets'));
        assert.ok(!Object.hasOwn(j.payload.state, 'review_note'));
        if (j.payload.state.language === 'Arabic')
            assert.ok(!JSON.stringify(j.payload).includes('Spanish'));
    }
});
function fixture() {
    const cases = Array.from({ length: 10 }, (_, i) => ({ id: String(i), cluster: String(Math.floor(i / 2)), focal: 'x', targets: { x: { evidence: 'yes', expression: 'yes' } } }));
    const receipts = cases.flatMap((c, i) => arms.flatMap(arm => [1, 2, 3, 4, 5].map(repeat => ({ caseId: c.id, arm, repeat, costUsd: .01, elapsedMs: 100, answers: Object.fromEntries(['evidence', 'expression'].map(d => ['x__' + d, { choice: i < 6 ? 'yes' : 'no', probabilities: { yes: i < 6 ? 1 : 0, no: i < 6 ? 0 : 1 } }])) }))));
    return { cases, receipts };
}
test('paired bootstrap preserves exact equality and repeated copies do not narrow scenario intervals', () => {
    const { cases, receipts } = fixture();
    const a = summarize(cases, receipts, 'both', 1000), b = summarize(cases, receipts.filter(r => r.repeat === 1), 'both', 1000);
    assert.equal(a.metrics[0].accuracy, .6);
    assert.ok(a.metrics[0].ci[0] < .6);
    assert.ok(a.metrics[0].ci[1] > .6);
    for (let i = 0; i < 5; i++) {
        assert.deepEqual(a.metrics[i].deltaCI, [0, 0]);
        assert.deepEqual(a.metrics[i].ci, b.metrics[i].ci);
        assert.equal(a.metrics[i].change, 0);
    }
});
test('missing validated answer stays in agreement denominator and does not crash repeat comparison', () => {
    const { cases, receipts } = fixture();
    delete (receipts[0].answers as any).x__evidence;
    const a = summarize(cases, receipts, 'both', 100);
    assert.ok(Math.abs(a.metrics[0].accuracy - .59) < 1e-12);
    assert.ok(Number.isFinite(a.metrics[0].change));
});
