/** Rebuild the private, self-contained interactive dashboard; no network calls. */
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import type {Dataset,Review} from './model.ts';
const output=process.argv[2];if(!output)throw Error('Provide the private dashboard directory');
const source=fileURLToPath(new URL('.',import.meta.url));
const data:Dataset=JSON.parse(readFileSync(join(output,'plot-data.json'),'utf8'));
const review=JSON.parse(readFileSync(join(output,'transcript-review.json'),'utf8')) as {reviewed:string;rubric:Record<string,string>;entries:Review[]};
const byId=new Map(review.entries.map(r=>[r.resultId,r]));
if(byId.size!==review.entries.length)throw Error('Duplicate review result IDs');
let linked=0;
for(const row of data.rows)for(const s of row.results){const r=s.resultId?byId.get(s.resultId):undefined;
 if(r){if(r.takeId!==row.takeId||r.reference!==row.reference||r.text!==s.text)throw Error(`Stale review: ${s.resultId}`);s.review=r;linked++;}}
data.reviewed=review.reviewed;data.rubric=review.rubric;
const js=(await build({entryPoints:[join(source,'client.ts')],bundle:true,write:false,format:'iife',target:'es2022'})).outputFiles[0].text;
const css=readFileSync(join(source,'style.css'),'utf8');
const json=JSON.stringify(data).replaceAll('<','\\u003c');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Transcription experiments — model comparison</title><style>${css}</style></head><body><div id="dashboard"></div><noscript>This dashboard requires JavaScript to compare models and inspect recordings.</noscript><script id="study-data" type="application/json">${json}</script><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`;
writeFileSync(join(output,'index.html.tmp'),html,{mode:0o600});renameSync(join(output,'index.html.tmp'),join(output,'index.html'));
console.log(`Dashboard built: ${linked} reviewed outputs, ${data.rows.length} recordings. ${resolve(output,'index.html')}`);
