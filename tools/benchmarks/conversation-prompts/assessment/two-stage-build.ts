import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {build} from 'esbuild';
import {renderDocument} from '../explorer/document.ts';
import {hash} from './plan.ts';
import {loadVariants} from './span-variants-analysis.ts';
import {loadTwoStage} from './two-stage-analysis.ts';
const [directory,mode]=process.argv.slice(2);if(!directory)throw Error('Expected study directory');
const plan=JSON.parse(readFileSync(directory+'/plan.json','utf8'));
const data=plan.variants||plan.studies?loadVariants(directory):loadTwoStage(directory);
const profiles=[...new Map(data.rows.filter(r=>r.status==='complete').map(r=>{
 const vector=data.plan.catalog.flatMap((c:any)=>[Number(r.predictions[c.id]==='demonstrated'),Number(r.predictions[c.id]==='partial'),Number(!['demonstrated','partial'].includes(r.predictions[c.id]))]);
 r.vector=vector;r.profileHash=hash(JSON.stringify(vector));return [r.profileHash,vector] as const;
})).entries()].sort(([a],[b])=>a.localeCompare(b));
const signature=hash(JSON.stringify(profiles));
writeFileSync(directory+'/profiles.json',JSON.stringify({signature,hashes:profiles.map(([h])=>h),vectors:profiles.map(([,v])=>v)}));
if(mode==='--profiles-only')process.exit(0);
let projections=null;
try {projections=JSON.parse(readFileSync(directory+'/projections.json','utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
if(projections&&projections.corpusSignature!==signature)throw Error('Recompute changed projections');
const bundle=await build({entryPoints:['tools/benchmarks/conversation-prompts/assessment/two-stage-view.ts'],bundle:true,write:false,format:'iife',minify:true,target:'es2022'});
const foundations=readFileSync('tools/benchmarks/conversation-prompts/explorer/view.html','utf8').match(/<style>[\s\S]*?<\/style>/)![0];
const template=readFileSync('tools/benchmarks/conversation-prompts/assessment/two-stage-view.html','utf8').replace('<!--STYLE-->',()=>foundations);
writeFileSync(directory+'/index.html',renderDocument(template,{...data,projections},bundle.outputFiles[0].text));
writeFileSync(directory+'/analysis.json',JSON.stringify(data));
const csv=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
if(data.complete&&!existsSync(directory+'/quote-candidates-review.csv'))writeFileSync(directory+'/quote-candidates-review.csv',['route,case,context,repeat,skill,source,chat_quote,jev_fast_quote,chat_supports_skill,jev_fast_supports_skill,reviewer,notes',...data.pairs.flatMap(p=>p.quotes.map(q=>[p.row.engine,p.row.caseId,p.row.context,p.row.repeat,q.skill,p.row.text,q.chatQuote,q.jevQuote,'','','',''].map(csv).join(',')))].join('\n'));
console.log(JSON.stringify({complete:data.complete,arms:data.arms,extractionCost:data.extractionKnownCost}));
