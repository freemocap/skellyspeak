/** Current native prompt/schema baseline on the final Jev challenge, no new Jev calls. */
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {credential} from '../run.ts';
import {hash,models,reservation} from './plan.ts';
import {call,prices} from './transport.ts';
import type {JevPlan} from './jev-alone.ts';
import type {StudyPlan,StudyJob} from './spanish-study.ts';
const [mode,out,jevPath,nativePath]=process.argv.slice(2);
if(!out)throw Error('Usage: current-assessor.ts plan OUT JEV_STUDY NATIVE_EXPORT | live OUT');
if(mode==='plan'){
 const p:JevPlan=JSON.parse(readFileSync(jevPath+'/plan.json','utf8')),native=JSON.parse(readFileSync(nativePath,'utf8'));
 const jobs:StudyJob[]=p.jobs.filter(j=>j.arm==='original').map(j=>{
  const n=native.exports.find((n:any)=>n.caseId===j.sourceId&&n.context===j.context&&n.order==='normal');if(!n)throw Error('Missing current native export');
  const {criteria,...state}=JSON.parse(n.messages[1].content);
  const byId=(a:{id:string}[])=>[...a].sort((x,y)=>x.id.localeCompare(y.id));
  if(!isDeepStrictEqual(state,j.payload.state)||!isDeepStrictEqual(byId(criteria),byId(p.catalog.map(({id,criterion})=>({id,criterion})))))throw Error('Current native state/catalog differs from frozen Jev input');
  return {...j,id:`${j.sourceId}-r${j.repeat}-current`,engine:'sparse',prompt:'current',outputFormat:'native',payload:{...j.payload,model:models.sparse},request:{model:models.sparse,temperature:.7,reasoning:{enabled:false},max_tokens:2048,stream:false,provider:{only:['google-ai-studio'],allow_fallbacks:false,require_parameters:true},messages:n.messages,response_format:{type:'json_schema',json_schema:{name:'skill_assessment',strict:true,schema:n.schema}}}};
 });
 const plan:StudyPlan={...p,jobs,calls:jobs.length,nativeVersion:native.version,fixtureSha256:hash(JSON.stringify(jobs)),reservationUsd:jobs.reduce((n,j)=>n+reservation(j),0),sourceHashes:{...p.sourceHashes,'native/src/learning/coaching/skill_assessment.rs':hash(readFileSync('native/src/learning/coaching/skill_assessment.rs','utf8'))},choices:[...p.choices,'Current-system comparator added at user request after Jev inference. Same exact states and criterion definitions verified against fresh native Rust export; current native criterion order preserved (differs from Jev catalog order); max-four native schema, Gemini 2.5 Flash Lite fast-model reference configuration, temperature 0.7. Provider timing is measured in a later time block, not interleaved. Current configurable user model overrides are not inspected.']};
 if(plan.calls!==120||plan.reservationUsd>3)throw Error('Baseline plan exceeds expected scope');
 mkdirSync(out,{recursive:true});writeFileSync(out+'/plan.json',JSON.stringify(plan,null,2),{flag:'wx'});console.log(JSON.stringify({calls:plan.calls,reservationUsd:plan.reservationUsd}));
}else if(mode==='live'){
 const p:StudyPlan=JSON.parse(readFileSync(out+'/plan.json','utf8'));
 if(hash(JSON.stringify(p.jobs))!==p.fixtureSha256||p.calls!==120||p.reservationUsd>3||existsSync(out+'/run.json'))throw Error('Changed or already started baseline');
 const key=credential(),pricing=await prices('sparse');
 writeFileSync(out+'/run.json',JSON.stringify({startedAt:new Date().toISOString(),pricing,retries:0,concurrency:1,planHash:p.fixtureSha256},null,2),{flag:'wx'});
 writeFileSync(out+'/results.jsonl','',{flag:'wx'});
 for(const [i,j]of p.jobs.entries()){
  appendFileSync(out+'/attempts.jsonl',JSON.stringify({id:j.id,at:new Date().toISOString()})+'\n');
  const r=await call(j,key);appendFileSync(out+'/results.jsonl',JSON.stringify(r)+'\n');
  if((i+1)%10===0||r.status==='failed')console.log(`${i+1}/120 ${r.status} ${r.validation.join('; ')}`);
  if([400,401,402,403,404,413,422,429].includes(r.httpStatus??0))throw Error('Stopped on access/rate/API error; receipt retained');
 }
}else throw Error('Expected plan or live');
