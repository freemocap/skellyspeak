import {appendFileSync,writeFileSync,readFileSync} from 'node:fs';
import {stringify,parseAllDocuments} from 'yaml';
import {credential,boundedJson,checkPrices,metadata} from '../../run.ts';
import {readYaml,hash} from './plan.ts';
export function decode(raw:any,questions:Record<string,any>){
 const answers:Record<string,any>={},errors:string[]=[];
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {answers,errors:['answers: expected object']};
 for(const [id,q]of Object.entries(questions)){
  const a=raw[id],labels=Object.keys(q.criteria).sort();
  if(!a||!Object.hasOwn(q.criteria,a.choice)||!a.probabilities||typeof a.probabilities!=='object'||Array.isArray(a.probabilities)||Object.keys(a.probabilities).sort().join('|')!==labels.join('|')){errors.push(id+': invalid labels');continue;}
  const values=Object.values<any>(a.probabilities);
  if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)||Math.abs(values.reduce((n,v)=>n+v,0)-1)>.025||a.probabilities[a.choice]+.001<Math.max(...values)||typeof a.confidence!=='number'||!Number.isFinite(a.confidence)||a.confidence<0||a.confidence>1){errors.push(id+': invalid distribution');continue;}
  answers[id]={choice:a.choice,probabilities:a.probabilities,confidence:a.confidence};
 }
 for(const id of Object.keys(raw))if(!Object.hasOwn(questions,id))errors.push('answers: unexpected ID');
 return {answers,errors};
}
export async function runStudy(expectedCalls=180, cap=1, retainInvalid=expectedCalls===2700){
 const out=process.argv[2],p=readYaml(out+'/plan.yaml');
 if(hash(p.jobs)!==p.hash||p.calls!==expectedCalls||p.reservation>cap||p.dollarCap!==cap)throw Error('Invalid frozen plan');
 const continuing=process.argv.includes('--continue');
 const previous=continuing?parseAllDocuments(readFileSync(out+'/receipts.yaml','utf8')).map(d=>{if(d.errors.length)throw Error('Invalid prior receipt');return d.toJS();}):[];
 const completed=new Set(previous.filter(r=>r.status==='complete'||(r.httpStatus===200&&typeof r.costUsd==='number')).map(r=>r.id));
 const key=credential();
 const priceResponse=await fetch('https://openrouter.ai/api/v1/models/typesafe/jev-1.13/endpoints',{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!priceResponse.ok)throw Error('Pricing request failed');const priceRaw=await boundedJson(priceResponse);
 const endpoints=priceRaw.data?.endpoints;if(!endpoints?.length)throw Error('Missing pricing');
 for(const e of endpoints)checkPrices(e.pricing,{inputRate:p.priceCeiling.prompt,outputRate:0});
 writeFileSync(out+(continuing?'/continuation-'+previous.length+'.yaml':'/run.yaml'),stringify({startedAt:new Date().toISOString(),planHash:p.hash,pricing:endpoints.map((e:any)=>({tag:e.tag,model_id:e.model_id,pricing:e.pricing})),retries:0}),{flag:'wx'});
 if(!continuing){writeFileSync(out+'/receipts.yaml','',{flag:'wx'});writeFileSync(out+'/attempts.yaml','',{flag:'wx'});}
 let spent=previous.reduce((n,r)=>n+(r.costUsd??p.jobs.find((j:any)=>j.id===r.id).reservation),0),done=completed.size;
 for(const job of p.jobs){
  if(completed.has(job.id))continue;
  if(spent+job.reservation>p.dollarCap)throw Error('Budget exhausted');
  appendFileSync(out+'/attempts.yaml','---\n'+stringify({id:job.id,at:new Date().toISOString()}));
  const t=performance.now();let receipt:any={id:job.id,caseId:job.caseId,arm:job.arm,repeat:job.repeat,status:'failed',answers:{},errors:[],requestedModel:p.model};
  try{
   const r=await fetch('https://openrouter.ai/api/alpha/decisions',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(60000)});
   receipt.httpStatus=r.status;
   receipt.headers=Object.fromEntries(['x-request-id','retry-after'].flatMap(k=>{const v=r.headers.get(k);return v&&/^[\w.:-]{1,160}$/.test(v)?[[k,v]]:[];}));
   const raw=await boundedJson(r);receipt.metadata=metadata(raw,[key]);
   for(const name of ['input_tokens','output_tokens'])if(typeof raw.usage?.[name]==='number')receipt.metadata.usage[name]=raw.usage[name];
   receipt.invalidAnswerMetadata=Object.fromEntries(Object.entries<any>(job.payload.questions).flatMap(([id,q])=>{
    const a=raw.answers?.[id];if(!a||typeof a!=='object')return [];
    return [[id,{choice:Object.hasOwn(q.criteria,a.choice)?a.choice:'[unrecognized label]',confidence:typeof a.confidence==='number'?a.confidence:null,probabilities:Object.fromEntries(Object.keys(q.criteria).flatMap(k=>typeof a.probabilities?.[k]==='number'?[[k,a.probabilities[k]]]:[]))}]];
   }));
   const decoded=decode(raw.answers,job.payload.questions);
   for(const id of Object.keys(decoded.answers))delete receipt.invalidAnswerMetadata[id];
   receipt.metadata.omittedFields=receipt.metadata.omittedFields.filter((f:string)=>!['usage.input_tokens','usage.output_tokens','answers'].includes(f));receipt.answers=decoded.answers;receipt.errors=decoded.errors;
   if(!r.ok||raw.error)receipt.errors.push('provider response failed');
   if(raw.model!==p.model&&!/^typesafe\/jev-1\.13-\d{8}$/.test(raw.model??''))receipt.errors.push('unexpected model');
   const cost=raw.usage?.cost;receipt.costUsd=typeof cost==='number'&&Number.isFinite(cost)&&cost>=0?cost:null;
   if(receipt.costUsd===null)receipt.errors.push('billing unavailable');else spent+=receipt.costUsd;
   if(!receipt.errors.length)receipt.status='complete';
  }catch(e){receipt.errors.push(e instanceof Error?e.name:'UnknownError');}
  receipt.elapsedMs=Math.round(performance.now()-t);appendFileSync(out+'/receipts.yaml','---\n'+stringify(receipt));done++;
  if(done%100===0||receipt.status!=='complete')console.log(JSON.stringify({completed:done,total:p.calls,spentUsd:spent,lastStatus:receipt.status,errors:receipt.errors}));
  if(receipt.status!=='complete'&&!(retainInvalid&&receipt.httpStatus===200&&typeof receipt.costUsd==='number'&&receipt.errors.every((e:string)=>e.includes(': invalid')||e.includes('unexpected ID'))))throw Error('Stopped after failure; receipt retained; no retry');
 }
 console.log(JSON.stringify({completed:done,spentUsd:spent}));
}
if(process.argv[1]?.endsWith('/skill-pilot/run.ts'))runStudy().catch(e=>{console.error(e.message);process.exitCode=1;});
