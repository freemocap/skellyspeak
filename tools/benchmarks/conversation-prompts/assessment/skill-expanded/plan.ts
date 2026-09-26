import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { makePlan as pilot, hash } from '../skill-pilot/plan.ts';
import { cases } from './cases.ts';
export function makePlan() {
    const old = pilot(), examples = cases(), jobs: any[] = [];
    const random = (() => { let s = 938174; return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; }; })();
    const shuffled = (xs: any[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    } return a; };
    const arabic: Record<string, string> = { possession_relationships: 'Arabic can express possession and relationships with attached pronouns, noun-to-noun constructions and expressions of belonging. Use the selected variety. Relationship forms also express kinship or use, not just ownership. Short answers can rely on the preceding question.', past_reference: 'Interpret Arabic past meaning from verb constructions, time expressions and context in the selected variety. Do not require MSA forms for Levantine. Ongoing activities can overlap past events. Quoted time words alone are not event-time evidence.' };
    for (let repeat = 1; repeat <= 5; repeat++)
        for (const [index, c] of shuffled(examples).entries())
            for (let offset = 0; offset < 5; offset++) {
                const arm = 'ABCDE'[(index + repeat + offset) % 5];
                const template = structuredClone(old.jobs.find((j: any) => j.arm === arm)!.payload);
                template.state = { language: c.language, variety: c.variety, currentLearnerMessage: c.input.learner, precedingExchange: c.input.preceding_partner ? [{ role: 'partner', content: c.input.preceding_partner }] : [] };
                if (c.language === 'Arabic')
                    for (const [id, q] of Object.entries<any>(template.questions)) {
                        const skill = id.split('__')[0];
                        // Keep shared definitions and meaning arms; replace only language-owned sections.
                        q.instructions = q.instructions.replace(/Spanish possessives[^]*?(?=\n\n)/, arabic.possession_relationships).replace(/Spanish past reference[^]*?(?=\n\n)/, arabic.past_reference);
                        if (arm === 'E') {
                            const start = skill === 'possession_relationships' ? 'Possessives describe relationships, not just ownership.' : 'A time expression such as anteayer';
                            const replacement = skill === 'possession_relationships' ? 'Attached pronouns can express possession or kinship: كتابك relates a book to you and أخونا expresses a family relationship. A noun construction such as حقيبة سامر identifies a relationship to Samer. Levantine تبع is another way to express belonging. Decide the relationship using context, not a presumed ownership meaning. A name can answer a whose question without repeating its construction.' : 'Time words such as أمس in MSA or مبارح in Levantine can establish past reference. Past verb forms can express completed events; كان constructions can also describe past states or ongoing activity. A weekday answer may rely on a preceding past question. Hypothetical or relative time needs context; do not treat every past-looking form as an actual completed event.';
                            const a = q.instructions.indexOf(start);
                            const b = q.instructions.indexOf('\n\n', a);
                            if (a < 0 || b < 0)
                                throw Error('Missing teaching section');
                            q.instructions = q.instructions.slice(0, a) + replacement + q.instructions.slice(b);
                        }
                        if (arm !== 'A' && q.instructions.includes('Spanish '))
                            throw Error('Wrong language guidance');
                    }
                const reservation = Object.values<any>(template.questions).reduce((n, q) => n + Buffer.byteLength(JSON.stringify(template.state)) + Buffer.byteLength(JSON.stringify(q)) + 4096, 0) * 0.000000042;
                jobs.push({ id: `${c.id}-${arm}-${repeat}`, caseId: c.id, cluster: c.cluster, arm, repeat, reservation, payload: template });
            }
    const reservation = jobs.reduce((n, j) => n + j.reservation, 0);
    if (jobs.length !== 2700 || reservation > 5)
        throw Error('Expanded run cap');
    return { status: 'exploratory', model: old.model, priceCeiling: old.priceCeiling, dollarCap: 5, reservation, calls: jobs.length, concurrency: 1, retries: 0, repetitions: 5, temperature: 'Not a documented parameter of the current DecisionsRequest schema; omitted.', cases: examples, jobs, hash: hash(jobs), resamplingUnit: 'Semantic scenario cluster; translations and related case variants stay together.', seed: 938174, analysis: 'Paired cluster bootstrap, 5000 resamples, 95% percentile intervals; also report repeat distributions and paired arm differences. Intervals conditional on this authored case collection, not all learners.', referenceStatus: 'Provisional AI-authored labels; contested rows flagged before inference; not held-out validation.' };
}
if (process.argv[1]?.endsWith('/skill-expanded/plan.ts')) {
    const out = process.argv[2], p = makePlan();
    mkdirSync(out, { recursive: true });
    writeFileSync(out + '/plan.yaml', stringify(p, { aliasDuplicateObjects: false }), { flag: 'wx' });
    console.log(JSON.stringify({ cases: p.cases.length, clusters: new Set(p.cases.map(c => c.cluster)).size, calls: p.calls, reservation: p.reservation, cap: p.dollarCap }));
}
