export const arms = ['A', 'B', 'C', 'D', 'E'];
export const names = ['Core', 'Language', 'Language + prose', 'Language + notation', 'Full guide specimen'];
export function quantile(xs: number[], p: number) { const a = [...xs].sort((x, y) => x - y); if (!a.length)
    throw Error('Empty distribution'); const i = (a.length - 1) * p, k = Math.floor(i); return a[k] + (a[Math.min(k + 1, a.length - 1)] - a[k]) * (i - k); }
export const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
export function summarize(cases: any[], receipts: any[], dimension = 'both', resamples = 5000, adjusted=false, selectedArms=arms, selectedNames=names) {
    const arms=selectedArms, names=selectedNames;
    const ids = new Set(cases.map(c => c.id)), rs = receipts.filter(r => ids.has(r.caseId));
    const metrics = arms.map(arm => {
        const selected = rs.filter(r => r.arm === arm);
        const rows = cases.map(c => {
            const cr = selected.filter(r => r.caseId === c.id);
            const ds = dimension === 'both' ? ['evidence', 'expression'] : [dimension];
            const accuracy = mean(cr.flatMap(r => ds.map(d => Number(r.answers[c.focal + '__' + d]?.choice === c.targets[c.focal][d]))));
            let changes = 0, pairs = 0, drift = 0;
            for (const d of ds)
                for (let i = 0; i < cr.length; i++)
                    for (let j = i + 1; j < cr.length; j++) {
                        const a = cr[i].answers[c.focal + '__' + d], b = cr[j].answers[c.focal + '__' + d];
                        if (!a || !b)
                            continue;
                        pairs++;
                        changes += Number(a.choice !== b.choice);
                        drift += Object.keys(a.probabilities).reduce((n, k) => n + Math.abs(a.probabilities[k] - b.probabilities[k]), 0) / 2;
                    }
            return { cluster: c.cluster, accuracy, cost: mean(cr.map(r => r.costUsd)) * 1000, changes, pairs, drift };
        });
        return { arm, name: names[arms.indexOf(arm)], rows, accuracy: mean(rows.map(r => r.accuracy)), cost: mean(rows.map(r => r.cost)), latencies: selected.map(r => r.elapsedMs), change: rows.reduce((s, r) => s + r.changes, 0) / rows.reduce((s, r) => s + r.pairs, 0), drift: rows.reduce((s, r) => s + r.drift, 0) / rows.reduce((s, r) => s + r.pairs, 0), ci: [] as number[], deltaCI: [] as number[], costCI: [] as number[], changeCI: [] as number[], driftCI: [] as number[] };
    });
    const clusters = [...new Set(cases.map(c => c.cluster))];
    const aggregated = metrics.map(m => clusters.map(c => { const rows = m.rows.filter(r => r.cluster === c); return [rows.length, rows.reduce((s, r) => s + r.accuracy, 0), rows.reduce((s, r) => s + r.cost, 0), rows.reduce((s, r) => s + r.changes, 0), rows.reduce((s, r) => s + r.pairs, 0), rows.reduce((s, r) => s + r.drift, 0)]; }));
    let state = 938174;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const draws = arms.map(() => ({ a: [] as number[], d: [] as number[], c: [] as number[], r: [] as number[], v: [] as number[] }));
    for (let b = 0; b < resamples; b++) {
        const counts = new Array(clusters.length).fill(0);
        for (let i = 0; i < clusters.length; i++)
            counts[Math.floor(random() * clusters.length)]++;
        const scores = aggregated.map(rows => { let n = 0, a = 0, c = 0, changes = 0, pairs = 0, drift = 0; rows.forEach((r, i) => { n += r[0] * counts[i]; a += r[1] * counts[i]; c += r[2] * counts[i]; changes += r[3] * counts[i]; pairs += r[4] * counts[i]; drift += r[5] * counts[i]; }); return [a / n, c / n, changes / pairs, drift / pairs]; });
        scores.forEach((s, i) => { draws[i].a.push(s[0]); draws[i].c.push(s[1]); draws[i].d.push(s[0] - scores[1][0]); draws[i].r.push(s[2]); draws[i].v.push(s[3]); });
    }
    metrics.forEach((m, i) => { m.ci = [quantile(draws[i].a, .025), quantile(draws[i].a, .975)]; m.deltaCI = [quantile(draws[i].d, adjusted?.025/(arms.length-1):.025), quantile(draws[i].d, adjusted?1-.025/(arms.length-1):.975)]; m.costCI = [quantile(draws[i].c, .025), quantile(draws[i].c, .975)]; m.changeCI = [quantile(draws[i].r, .025), quantile(draws[i].r, .975)]; m.driftCI = [quantile(draws[i].v, .025), quantile(draws[i].v, .975)]; });
    return { metrics, clusters: clusters.length, cases: cases.length, calls: rs.filter(r=>arms.includes(r.arm)).length };
}
