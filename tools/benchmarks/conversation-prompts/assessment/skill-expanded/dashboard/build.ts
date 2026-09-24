import {resolve} from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseAllDocuments, stringify } from 'yaml';
import { build } from 'esbuild';
import { readYaml } from '../../skill-pilot/plan.ts';
import {normalizeJoint}from'./normalize.ts';
import {transitions}from'./transitions.ts';
import { summarize, names, arms } from './statistics.ts';
const out = process.argv[2], plan = readYaml(out + '/plan.yaml');
const allReceipts = parseAllDocuments(readFileSync(out + '/receipts.yaml', 'utf8')).map(d => { if (d.errors.length || d.warnings.length)
    throw Error('Receipt YAML invalid'); return d.toJS(); });
const receipts = allReceipts.filter(r => r.httpStatus === 200 && typeof r.costUsd === 'number').map(r=>plan.jointArms?.includes(r.arm)?normalizeJoint(r):r);
if (receipts.length !== plan.calls || new Set(receipts.map(r => r.id)).size !== plan.calls)
    throw Error('Study incomplete; do not present partial data as completed');
if (receipts.some(r => !plan.jobs.some((j: any) => j.id === r.id)))
    throw Error('Unknown receipt');
if(plan.armIds)arms.splice(0,arms.length,...plan.armIds);
if(plan.armNames)names.splice(0,names.length,...plan.armNames);
const discussion=existsSync(out+'/discussion.yaml')?readYaml(out+'/discussion.yaml'):null;
const audit=existsSync(out+'/repeat-audit.yaml')?readYaml(out+'/repeat-audit.yaml'):null;
let historical:any=null;
if(plan.study?.multilingual){const prior=resolve(out,'../jev-strategies-2026-09-24');const previous=readYaml(prior+'/plan.yaml');const cases=previous.cases.filter((c:any)=>c.partition==='fresh');const ids=new Set(cases.map((c:any)=>c.id));const rs=parseAllDocuments(readFileSync(prior+'/receipts.yaml','utf8')).map(d=>{if(d.errors.length||d.warnings.length)throw Error('Invalid historical receipt');return d.toJS();}).filter(r=>ids.has(r.caseId)&&r.httpStatus===200&&typeof r.costUsd==='number').map(r=>previous.jointArms.includes(r.arm)?normalizeJoint(r):r);historical={cases,receipts:rs.map(r=>({caseId:r.caseId,arm:r.arm,repeat:r.repeat,answers:r.answers,costUsd:r.costUsd,elapsedMs:r.elapsedMs}))};}
const data = { historical,repetitions:plan.repetitions??5,controlArms:plan.controlArms??[],strategiesByLanguage:plan.study?.multilingual?Object.fromEntries([...new Set<string>(plan.cases.map((c:any)=>c.languageCode))].map(code=>[code,Object.fromEntries(arms.map(a=>[a,plan.jobs.find((j:any)=>j.arm===a&&j.caseId.startsWith(code+'/')).payload.questions]))])):null, audit:audit?{groups:audit.groups,completeValidGroups:audit.completeValidGroups,choiceChangedGroups:audit.choiceChangedGroups,focalChoiceChangedGroups:audit.focalChoiceChangedGroups,probabilityChangedGroups:audit.probabilityChangedGroups,byArm:audit.byArm}:null,study:plan.study,armIds:plan.armIds,armNames:plan.armNames,discussion,strategies:plan.study?Object.fromEntries(arms.map(a=>[a,plan.jobs.find((j:any)=>j.arm===a).payload.questions])):null,failures:allReceipts.filter(r=>!(r.httpStatus===200&&typeof r.costUsd==='number')).length,cases: plan.cases, receipts: receipts.map(r => ({ caseId: r.caseId, arm: r.arm, repeat: r.repeat, elapsedMs: r.elapsedMs, costUsd: r.costUsd, answers: r.answers, rawAnswers:r.rawAnswers, status: r.status, errors: r.errors, model: r.metadata?.model })), invalidResponses: receipts.filter(r => r.status !== 'complete').length, totalCost: receipts.reduce((n, r) => n + r.costUsd, 0), model: [...new Set(receipts.map(r => r.metadata?.model))], planHash: plan.hash };
const controlArms=plan.controlArms??[];
const controlNames=arms.map((a,i)=>({a,n:names[i]})).filter(x=>controlArms.includes(x.a));
for(let i=arms.length-1;i>=0;i--)if(controlArms.includes(arms[i])){arms.splice(i,1);names.splice(i,1);}
const summary = summarize(data.cases, data.receipts,'both',5000,Boolean(plan.study?.adjusted));
const primary=plan.study?.adjusted?summarize(data.cases.filter((c:any)=>plan.study?.multilingual||c.partition==='fresh'&&!c.contested),data.receipts,'both',5000,true):null;
const byLanguage=plan.study?.multilingual?Object.fromEntries(['es','ar','zh'].map(code=>[code,summarize(data.cases.filter((c:any)=>c.languageCode===code),data.receipts,'both',5000,true).metrics.map(({rows,latencies,...m})=>m)])):undefined;
writeFileSync(out + '/summary.yaml', stringify({ controls:controlArms.length?summarize(data.cases,data.receipts,'both',5000,false,[...controlArms,'B'],[...controlNames.map(x=>x.n),'Baseline']).metrics.filter(m=>controlArms.includes(m.arm)).map(({rows,latencies,...m})=>m):undefined,byLanguage, primary:primary?{cases:primary.cases,clusters:primary.clusters,arms:primary.metrics.map(({rows,latencies,...m})=>m)}:undefined,calls: receipts.length, cases: plan.cases.length, clusters: summary.clusters, totalCost: data.totalCost,transitions:plan.study?transitions(data.cases,data.receipts):undefined, arms: summary.metrics.map(({ rows, latencies, ...m }) => m) }, { aliasDuplicateObjects: false }));
const source = new URL('./client.ts', import.meta.url).pathname;
const js = await build({ entryPoints: [source], bundle: true, write: false, format: 'iife', target: 'es2022' });
const template = readFileSync(new URL('./page.html', import.meta.url), 'utf8');
const html = template.replace('/* STUDY_DATA */', () => JSON.stringify(data).replace(/</g, '\\u003c')).replace('/* APPLICATION */', () => js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
writeFileSync(out + '/index.html', html);
console.log(JSON.stringify({ cost: data.totalCost, calls: receipts.length, clusters: summary.clusters, arms: summary.metrics.map(({ rows, latencies, ...m }) => m) }, null, 2));
