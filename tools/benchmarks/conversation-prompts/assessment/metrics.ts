import type {Row} from './spanish-analysis.ts';
export const quantile = (a: number[], q: number) => { if (!a.length)
    return null; const sorted = [...a].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]; };
const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
export function summarize(rows: Row[]) {
    const good = rows.filter(r => r.status === 'complete'), costs = rows.map(r => r.cost).filter((c): c is number => c !== null);
    const grouped = new Map<string, Row[]>();
    for (const r of good)
        grouped.set(r.caseId, [...(grouped.get(r.caseId) ?? []), r]);
    const recall = [...grouped.values()].filter(g => g[0].positiveTotal > 0).map(g => sum(g.map(r => r.positiveHits)) / sum(g.map(r => r.positiveTotal)));
    const falseRates = [...grouped.values()].filter(g => g[0].negativeTotal > 0).map(g => sum(g.map(r => r.falseCredits)) / sum(g.map(r => r.negativeTotal)));
    return { requests: rows.length, complete: good.length, failed: rows.length - good.length, cases: grouped.size,
        positiveCases: recall.length, negativeCases: falseRates.length, macroRecall: recall.length ? sum(recall) / recall.length : null,
        macroFalseCredit: falseRates.length ? sum(falseRates) / falseRates.length : null,
        latencyP50: quantile(good.map(r => r.elapsedMs), .5), latencyP95: quantile(good.map(r => r.elapsedMs), .95),
        knownCost: sum(costs), missingCosts: rows.length - costs.length, costPerComplete: good.length ? sum(costs) / good.length : null };
}
