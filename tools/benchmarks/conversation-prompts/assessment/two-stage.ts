/** Paired extension of the frozen decision study, using production Rust exports. */
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {credential} from '../run.ts';
import {hash,models,reservation,type Job} from './plan.ts';
import {call,prices,type Receipt} from './transport.ts';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const lines=(path:string):Receipt[]=>readFileSync(path,'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
function native(path:string){
 const run=spawnSync('cargo',['test','--manifest-path','native/Cargo.toml','--lib','evidence_experiment','--','--ignored'],{env:{...process.env,SKELLY_EVIDENCE_EXPERIMENT:resolve(path)},encoding:'utf8'});
 if(run.status!==0)throw Error(run.stderr+'\n'+run.stdout);
 return read(path+'.native.json');
}
const sources=['native/src/learning/coaching/skill_evidence.rs','native/src/learning/coaching/assessment_adapter.rs','native/src/ai/transport/provider/payload.rs'];
const sourceHashes=()=>Object.fromEntries(sources.map(p=>[p,hash(readFileSync(p,'utf8'))]));
const [mode,out,previous]=process.argv.slice(2);
if(!out)throw Error('Usage: two-stage.ts plan OUT PREVIOUS_DECISION_STUDY | live OUT | replay OUT');
if(mode==='plan'){
 if(existsSync(out+'/run.json'))throw Error('Cannot change a started experiment');
 const p=read(previous+'/plan.json'),receipts=lines(previous+'/results.jsonl');
 if(hash(JSON.stringify(p.jobs))!==p.fixtureSha256)throw Error('Changed source study');
 const jobs=p.jobs.filter((j:any)=>j.arm==='original');
 if(jobs.length!==120)throw Error('Expected frozen 60-case/two-repeat comparison');
 mkdirSync(out,{recursive:true});
 const rows=jobs.filter((j:any)=>receipts.find(r=>r.id===j.id)?.status==='complete').map((j:any)=>{
  const receipt=receipts.find(r=>r.id===j.id);if(receipt?.status!=='complete')throw Error('Missing valid Jev receipt');
  return {id:j.id,state:j.payload.state,criteria:p.catalog.map(({id,criterion}:any)=>({id,criterion})),answers:Object.fromEntries(Object.entries(receipt.answers).map(([id,a])=>[id,{type:'choice',...a}])),model:receipt.metadata?.model,fastModel:models.sparse};
 });
 if(existsSync(out+'/native-input.json')){if(JSON.stringify(read(out+'/native-input.json'))!==JSON.stringify(rows))throw Error('Changed native inputs');}
 else writeFileSync(out+'/native-input.json',JSON.stringify(rows),{flag:'wx'});
 const exported=native(out+'/native-input.json');
 const requests=jobs.map((j:any)=>{
  const n=exported.rows.find((r:any)=>r.id===j.id);
  if(!n?.valid)return {...j,skipped:true,sourceFailed:true,native:n??null};
  return {...j,engine:'sparse',outputFormat:'spans',payload:{...j.payload,model:models.sparse},request:n.value.request?{...n.value.request,provider:{only:['google-ai-studio'],allow_fallbacks:false,require_parameters:true}}:undefined,skipped:n.value.skipped,native:n.value};
 });
 const plan={version:1,kind:'two-stage',previous,previousHash:p.fixtureSha256,catalog:p.catalog,cases:p.cases,fastModel:models.sparse,jobs:requests,sourceHashes:sourceHashes(),calls:requests.filter((j:any)=>!j.skipped).length,reservationUsd:requests.filter((j:any)=>!j.skipped).reduce((n:number,j:Job)=>n+reservation(j),0),choices:[
  '60 existing synthetic cases, two saved Jev repetitions each; same saved Chat model assessment comparator. No new Jev or baseline calls.',
  'Production Rust Jev thresholds, extractor prompts, schema and OpenRouter payload exported without reimplementation. Experiment provider is pinned to google-ai-studio, matching the baseline; app routing is unchanged. Every extractor output replayed through production Rust validation.',
  'Fast model is the original comparison reference Gemini 2.5 Flash Lite. This experiment does not read or change app model settings.',
  'Latency is saved Jev latency plus later measured extraction latency, not a contemporaneous end-to-end measurement. Historical baseline latency is a separate time block.',
  'Exact quote binding is mechanical validity, not semantic evidence quality. All focal labels remain provisional; semantic quote review remains explicitly unscored until reviewed.',
  'Failed pipelines remain in completion, spend and delivered-evidence denominators. Valid-only SDT is also shown. No independent-trial significance claims from repeated synthetic cases.'
 ]};
 if(plan.reservationUsd>3)throw Error('Exceeded $3 extraction ceiling');
 writeFileSync(out+'/plan.json',JSON.stringify({...plan,fixtureSha256:hash(JSON.stringify(requests))},null,2));
 console.log(JSON.stringify({calls:plan.calls,skipped:120-plan.calls,reservationUsd:plan.reservationUsd}));
}else if(mode==='live'){
 const p=read(out+'/plan.json');
 if(hash(JSON.stringify(p.jobs))!==p.fixtureSha256||JSON.stringify(sourceHashes())!==JSON.stringify(p.sourceHashes)||p.reservationUsd>3||existsSync(out+'/run.json'))throw Error('Changed or already started plan');
 const key=credential(),pricing=await prices('sparse');
 writeFileSync(out+'/run.json',JSON.stringify({startedAt:new Date().toISOString(),pricing,planHash:p.fixtureSha256,retries:0,concurrency:1}),{flag:'wx'});
 writeFileSync(out+'/results.jsonl','',{flag:'wx'});
 for(const [i,j] of p.jobs.entries()){
  if(j.skipped)continue;
  appendFileSync(out+'/attempts.jsonl',JSON.stringify({id:j.id,at:new Date().toISOString()})+'\n');
  const r=await call(j,key);appendFileSync(out+'/results.jsonl',JSON.stringify(r)+'\n');
  if((i+1)%10===0||r.status==='failed')console.log(`${i+1}/120 ${r.status}`);
  if([400,401,402,403,404,413,422,429].includes(r.httpStatus??0))throw Error('Stopped on access/rate/API error; receipts retained');
 }
}else if(mode==='replay'){
 const p=read(out+'/plan.json');if(JSON.stringify(sourceHashes())!==JSON.stringify(p.sourceHashes))throw Error('Production sources changed since plan; freeze a new experiment');
 const rows=read(out+'/native-input.json'),receipts=lines(out+'/results.jsonl');
 const replay=rows.filter((r:any)=>receipts.some(x=>x.id===r.id&&x.status==='complete')).map((r:any)=>{const c=receipts.find(x=>x.id===r.id)!;return {...r,extraction:c.nativeOutput,extractionModel:c.metadata?.model};});
 writeFileSync(out+'/replay.json',JSON.stringify(replay));
 const result=native(out+'/replay.json');console.log(JSON.stringify({replayed:result.rows.length,failed:result.rows.filter((r:any)=>!r.valid).length}));
}else throw Error('Expected plan, live or replay');
