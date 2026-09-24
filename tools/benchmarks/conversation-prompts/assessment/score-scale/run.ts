import{readFileSync,writeFileSync,appendFileSync}from'node:fs';import{stringify}from'yaml';
import{readYaml,hash}from'../skill-pilot/plan.ts';import{decode}from'../skill-pilot/run.ts';import{credential,boundedJson,checkPrices}from'../../run.ts';import{selectedModel}from'./plan.ts';
const out=process.argv[2],p=readYaml(out+'/plan.yaml'),model=selectedModel();
if(hash(p.jobs)!==p.hash||hash(model)!==p.modelIdentityHash||p.calls!==216||p.reservation>1||p.dollarCap!==1)throw Error('Frozen plan invalid');
// Reuse the existing service locations without duplicating service identities in artifacts.
const transport=readFileSync(new URL('../skill-pilot/run.ts',import.meta.url),'utf8');
const urls=[...transport.matchAll(/fetch\('(https:[^']+)'/g)].map(m=>m[1]);if(urls.length!==2)throw Error('Transport location contract changed');
const key=credential();const r=await fetch(urls[0],{redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Price check failed');const pricing=await boundedJson(r);const endpoints=pricing.data?.endpoints;if(!endpoints?.length)throw Error('Missing price');for(const e of endpoints)checkPrices(e.pricing,{inputRate:p.priceCeiling,outputRate:0});
writeFileSync(out+'/run.yaml',stringify({startedAt:new Date().toISOString(),planHash:p.hash,modelIdentityHash:p.modelIdentityHash,prices:endpoints.map((e:any)=>e.pricing),retries:0}),{flag:'wx'});
writeFileSync(out+'/receipts.yaml','',{flag:'wx'});writeFileSync(out+'/attempts.yaml','',{flag:'wx'});let spent=0;
for(const [i,j]of p.jobs.entries()){
 if(spent+j.reservation>1)throw Error('Budget exhausted');const payload={...j.payload,model};appendFileSync(out+'/attempts.yaml','---\n'+stringify({id:j.id,at:new Date().toISOString(),requestHash:hash(payload)}));
 const start=performance.now();const receipt:any={id:j.id,caseId:j.caseId,arm:j.arm,repeat:j.repeat,answers:{},errors:[],status:'failed'};
 try{const response=await fetch(urls[1],{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});receipt.httpStatus=response.status;const raw=await boundedJson(response);receipt.actualModelIdentityHash=hash(raw.model??null);receipt.actualModelMatchesSelection=raw.model===model||(typeof raw.model==='string'&&raw.model.startsWith(model+'-')&&/^\d{8}$/.test(raw.model.slice(model.length+1)));const decoded=decode(raw.answers,j.payload.questions);receipt.answers=decoded.answers;receipt.errors=decoded.errors;
 receipt.invalidAnswers=Object.fromEntries(Object.entries<any>(j.payload.questions).filter(([id])=>!Object.hasOwn(decoded.answers,id)).map(([id,q])=>[id,{choice:Object.hasOwn(q.criteria,raw.answers?.[id]?.choice)?raw.answers[id].choice:null,probabilities:Object.fromEntries(Object.keys(q.criteria).flatMap(k=>typeof raw.answers?.[id]?.probabilities?.[k]==='number'?[[k,raw.answers[id].probabilities[k]]]:[]))}]));
 receipt.usage=Object.fromEntries(['cost','input_tokens','output_tokens','prompt_tokens','completion_tokens'].flatMap(k=>typeof raw.usage?.[k]==='number'?[[k,raw.usage[k]]]:[]));receipt.costUsd=Number.isFinite(raw.usage?.cost)&&raw.usage.cost>=0?raw.usage.cost:null;
 receipt.requestId=response.headers.get('x-request-id');receipt.retryAfter=response.headers.get('retry-after');receipt.providerErrorCode=typeof raw.error?.code==='number'?raw.error.code:null;receipt.omittedResponseContent=true;
 if(!response.ok||raw.error)receipt.errors.push('Provider response failure');if(!receipt.actualModelMatchesSelection)receipt.errors.push('Model identity mismatch');if(receipt.costUsd===null)receipt.errors.push('Missing billing');else spent+=receipt.costUsd;if(!receipt.errors.length)receipt.status='complete';
 }catch(error){receipt.errors.push(error instanceof Error?error.name:'UnknownError');}
 receipt.elapsedMs=Math.round(performance.now()-start);appendFileSync(out+'/receipts.yaml','---\n'+stringify(receipt));
 if((i+1)%36===0||receipt.status!=='complete')console.log(JSON.stringify({completed:i+1,total:p.calls,spent,status:receipt.status}));
 if(receipt.status!=='complete'&&!(receipt.httpStatus===200&&receipt.costUsd!==null&&receipt.errors.every((e:string)=>e.includes(': invalid')||e.includes('unexpected ID'))))throw Error('Stopped; receipt retained; no retry');
}
console.log(JSON.stringify({complete:true,calls:p.calls,costUsd:spent}));
