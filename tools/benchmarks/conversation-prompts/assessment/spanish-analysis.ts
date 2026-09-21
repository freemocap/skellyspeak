import {summarize} from './metrics.ts';
export {summarize,quantile} from './metrics.ts';
import { readFileSync, existsSync } from 'node:fs';
import { hash } from './plan.ts';
import type { StudyPlan, StudyJob, Case } from './spanish-study.ts';
import type { Receipt } from './transport.ts';
export interface Row {
    operatingThresholds?: {attempt:number;full:number};
    evidenceScores?: Record<string,{attempt:number;full:number}>;
    id: string;
    caseId: string;
    engine: string;
    context: string;
    order: string;
    group: string;
    repeat: number;
    status: string;
    elapsedMs: number;
    cost: number | null;
    predictions: Record<string, string>;
    probabilities: Record<string, Record<string, number>>;
    reference: Record<string, string>;
    positiveTotal: number;
    positiveHits: number;
    negativeTotal: number;
    falseCredits: number;
    exact: number;
    scored: number;
    requestIndex: number;
    receipt: Receipt;
    profileHash: string;
    text: string;
    vector: number[];
}
const positive = (s: string) => s === 'demonstrated' || s === 'partial';
export function reference(test: Case, p: StudyPlan): Record<string, string> { return test.targets === 'all_absent' ? Object.fromEntries(p.catalog.map(s => [s.id, 'not_observed'])) : test.targets; }
export function predictions(job: StudyJob, r: Receipt, p: StudyPlan) {
    if (r.status !== 'complete')
        return {};
    if (job.outputFormat === 'native')
        return Object.fromEntries(p.catalog.map(s => {
            const items = r.sparseItems?.filter(x => x.construct === s.id) ?? [];
            return [s.id, items.some(x => x.outcome === 'partial') ? 'partial' : items[0]?.outcome ?? 'unreported'];
        }));
    return job.engine === 'chat' ? r.labels ?? {} : Object.fromEntries(Object.entries(r.answers).map(([id, a]) => [id, a.choice]));
}
export function quality(expected: Record<string, string>, actual: Record<string, string>, complete: boolean) {
    let positiveTotal = 0, positiveHits = 0, negativeTotal = 0, falseCredits = 0, exact = 0;
    for (const [id, want] of Object.entries(expected)) {
        if (positive(want)) {
            positiveTotal++;
            if (positive(actual[id]))
                positiveHits++;
        }
        if (want === 'not_observed') {
            negativeTotal++;
            if (positive(actual[id]))
                falseCredits++;
        }
        if (actual[id] === want || (want === 'not_observed' && actual[id] === 'unreported'))
            exact++;
    }
    return { positiveTotal: complete ? positiveTotal : 0, positiveHits, negativeTotal: complete ? negativeTotal : 0, falseCredits, exact, scored: complete ? Object.keys(expected).length : 0 };
}
export function loadSpanish(directory: string) {
    const p: StudyPlan = JSON.parse(readFileSync(`${directory}/plan.json`, 'utf8'));
    if (p.kind !== 'spanish-factorial' || hash(JSON.stringify(p.jobs)) !== p.fixtureSha256)
        throw Error('Frozen study changed');
    const receipts: Receipt[] = existsSync(`${directory}/results.jsonl`) ? readFileSync(`${directory}/results.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map(x => JSON.parse(x)) : [];
    if (new Set(receipts.map(r => r.id)).size !== receipts.length)
        throw Error('Duplicate receipts');
    const callsPath=`${directory}/calls.jsonl`;
    const billed=existsSync(callsPath)?readFileSync(callsPath,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)):null;
    const requestMap = new Map<string, number>(), requests: unknown[] = [];
    const rows: Row[] = receipts.map(r => {
        const j = p.jobs.find(j => j.id === r.id);
        if (!j)
            throw Error('Unplanned receipt');
        const test = p.cases.find(c => c.id === j.sourceId)!;
        const expected = reference(test, p), actual = predictions(j, r, p), q = quality(expected, actual, r.status === 'complete');
        const actualRequest=['screening','empty_shortlist'].includes(r.validationStage)?{notDispatched:true,reason:r.validationStage,template:j.request}:(r as any).executedRequest??j.request;
        const key = hash(JSON.stringify(actualRequest));
        if (!requestMap.has(key)) {
            requestMap.set(key, requests.length);
            requests.push(actualRequest);
        }
        // Shared reporting geometry: each skill is [demonstrated, partial, neither reported].
        // The third coordinate does NOT claim the skill was absent or not known by the learner.
        const vector = p.catalog.flatMap(s => [Number(actual[s.id] === 'demonstrated'), Number(actual[s.id] === 'partial'), Number(!positive(actual[s.id]))]);
        let cost=typeof r.metadata?.usage?.cost==='number'?r.metadata.usage.cost:null;
        if(r.validationStage==='screening'&&billed&&!billed.some(c=>c.id===r.id)){const screen=billed.find(c=>c.id===r.metadata?.pipeline?.screenReceipt);if(typeof screen?.metadata?.usage?.cost==='number'){cost=screen.metadata.usage.cost;r.metadata!.analysisBilling='Known screen cost only; calls log confirms no extraction was dispatched. Original aggregate receipt cost was null.';}}
        return { id: r.id, caseId: j.sourceId, engine: j.engine, context: j.context, order: j.order, group: j.group, repeat: j.repeat, status: r.status,
            elapsedMs: r.elapsedMs, cost,
            predictions: actual, reference: expected, probabilities: Object.fromEntries(Object.entries(r.answers).map(([id, a]) => [id, a.probabilities])), ...q,
            requestIndex: requestMap.get(key)!, receipt: r, profileHash: hash(JSON.stringify(vector)), text: test.text, vector };
    });
    const conditions = ['sparse', 'chat', 'jev'].flatMap(engine => [...new Set(p.jobs.map(j=>j.context))].flatMap(context => [...new Set(p.jobs.map(j=>j.order))].map(order => ({ engine, context, order,
        ...summarize(rows.filter(r => r.engine === engine && r.context === context && r.order === order)) }))));
    const pairs = rows.filter(r => r.status === 'complete' && r.order === 'normal').flatMap(a => {
        const b = rows.find(r => r.status === 'complete' && r.caseId === a.caseId && r.engine === a.engine && r.context === a.context && r.repeat === a.repeat && r.order === 'reversed');
        return b ? [{ id: a.id, engine: a.engine, caseId: a.caseId, context: a.context, repeat: a.repeat,
                changed: p.catalog.filter(s => a.predictions[s.id] !== b.predictions[s.id]).length }] : [];
    });
    const contextPairs = rows.filter(r => r.status === 'complete' && r.context === 'before').flatMap(a => {
        const b = rows.find(r => r.status === 'complete' && r.caseId === a.caseId && r.engine === a.engine && r.order === a.order && r.repeat === a.repeat && r.context === 'after');
        return b ? [{ id: a.id, engine: a.engine, caseId: a.caseId, changed: p.catalog.filter(s => a.predictions[s.id] !== b.predictions[s.id]).length }] : [];
    });
    const repeatPairs = rows.filter(r => r.status === 'complete').flatMap(a => rows.filter(b => b.status === 'complete' && b.caseId === a.caseId && b.engine === a.engine && b.order === a.order && b.context === a.context && b.repeat > a.repeat)
        .map(b => ({ id: a.id, engine: a.engine, caseId: a.caseId, changed: p.catalog.filter(s => a.predictions[s.id] !== b.predictions[s.id]).length })));
    return { title:(p as any).title,description:(p as any).description,assessorNames:(p as any).assessorNames, actualSpend:billed?billed.reduce((sum,r)=>sum+(r.metadata?.usage?.cost??0),0):null, actualCalls:billed?.length??null, unknownCallCosts:billed?.filter(r=>typeof r.metadata?.usage?.cost!=='number').length??null, version: 1, directory, planHash: p.fixtureSha256, choices: p.choices, cases: p.cases, catalog: p.catalog, nativeVersion: p.nativeVersion,
        planned: p.calls, reservationUsd: p.reservationUsd, rows, requests, conditions, summary: summarize(rows), orderPairs: pairs, contextPairs, repeatPairs,
        overall: ['sparse', 'chat', 'jev'].map(engine => ({ engine, ...summarize(rows.filter(r => r.engine === engine)) })),
        complete: receipts.length === p.calls };
}
