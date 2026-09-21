import {cohort,trials,counts,roc} from './sdt.ts';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { loadSpanish } from './spanish-analysis.ts';
import { hash } from './plan.ts';
import { renderDocument } from '../explorer/document.ts';
const [directory, ...extra] = process.argv.slice(2);
if (!directory || (extra.length && extra.join() !== "--profiles-only"))
    throw Error('Usage: assessment/build.ts STUDY_DIRECTORY');
const data = loadSpanish(directory);
const unique = [...new Map(data.rows.filter(r => r.status === 'complete').map(r => [r.profileHash, r.vector])).entries()].sort(([a], [b]) => a.localeCompare(b));
const signature = hash(JSON.stringify(unique));
const profiles = { signature, hashes: unique.map(([h]) => h), vectors: unique.map(([, v]) => v) };
writeFileSync(`${directory}/profiles.json`, JSON.stringify(profiles));
if (extra[0] === "--profiles-only") { console.log(JSON.stringify({profiles: unique.length, signature})); process.exit(0); }
const path = `${directory}/projections.json`;
const projections = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
if (projections && projections.corpusSignature !== signature)
    throw Error('Projection corpus changed: explicitly recompute maps before rebuilding');
const bundle = await build({ entryPoints: ['tools/benchmarks/conversation-prompts/assessment/view.ts'], bundle: true, write: false, format: 'iife', minify: true, target: 'es2022' });
const original = readFileSync('tools/benchmarks/conversation-prompts/explorer/view.html', 'utf8');
const style = original.match(/<style>[\s\S]*?<\/style>/)?.[0];
if (!style)
    throw Error('Missing shared explorer foundations');
const template = readFileSync('tools/benchmarks/conversation-prompts/assessment/view.html', 'utf8').replace('<!--STYLE-->', () => style);
const readinessPath=`${directory}/readiness-report.json`;
const readiness=existsSync(readinessPath)?JSON.parse(readFileSync(readinessPath,'utf8')):null;
const dataset = { ...data, projections, readiness };
const html = renderDocument(template, dataset, bundle.outputFiles[0].text);
if (Buffer.byteLength(html) > 30000000)
    throw Error('Study dashboard exceeds 30 MB');
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/index.html`, html);
writeFileSync(`${directory}/analysis.json`, JSON.stringify(dataset));
console.log(JSON.stringify({ completed: data.rows.length, planned: data.planned, bytes: Buffer.byteLength(html), uniqueProfiles: unique.length, projections: projections?.projections.length ?? 0 }));

const sdtReport = (['attempt','full'] as const).flatMap(task=>[false,true].map(excludeCap=>{
 const c=cohort(data.rows,true,excludeCap,'');
 const t=trials(c.rows,task);
 return {task,excludeCap,matched:true,failed:c.failed,excludedValid:c.excludedValid,
   assessors:['sparse','chat','jev'].map(engine=>({engine,...counts(t.filter(x=>x.row.engine===engine))})),
   jevAuc:roc(t.filter(x=>x.row.engine==='jev')).auc};
}));
writeFileSync(`${directory}/sdt-report.json`,JSON.stringify({sourcePlanHash:data.planHash,referenceStatus:'provisional',aggregation:'pooled labeled trials; dependent observations; descriptive only',correction:'add 0.5 to all four cells for d-prime and criterion only',results:sdtReport},null,2));
