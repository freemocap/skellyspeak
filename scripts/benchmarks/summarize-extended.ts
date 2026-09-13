import { readFileSync, writeFileSync } from 'node:fs';
const dir='workflow/benchmarks/model-routing';
const rows=readFileSync(`${dir}/extended-results.jsonl`,'utf8').trim().split('\n').map(s=>JSON.parse(s));
if(rows.length!==384)throw Error('Incomplete run');
const key=(r:any)=>`${r.fixture}|${r.requestedModel??r.model}|${r.trial}`;
if(new Set(rows.map(key)).size!==rows.length)throw Error('Duplicate result');
const native=new Map(readFileSync(`${dir}/extended-native-validation.jsonl`,'utf8').trim().split('\n').map(s=>{const r=JSON.parse(s);return [key(r),r.outcome] as const;}));
const quantile=(a:number[],q:number)=>{a.sort((x,y)=>x-y);return a.length?a[Math.ceil(q*a.length)-1]:null;};
const summary:any[]=[];
for(const model of [...new Set(rows.map(r=>r.requestedModel))])for(const task of [...new Set(rows.filter(r=>r.requestedModel===model).map(r=>r.task))]){
 const rr=rows.filter(r=>r.requestedModel===model&&r.task===task);
 const valid=rr.filter(r=>{if(r.errors.length)return false;if(task==='native-gloss'){if(!native.has(key(r)))throw Error('Missing native validation');return native.get(key(r)).accepted;}return true;});
 const cost=rr.reduce((s,r)=>s+(r.reportedCostUsd??r.estimatedCostUsd??0),0);
 const usefulGloss = task === "native-gloss" ? valid.filter(r=>native.get(key(r)).coverage === "Complete" && native.get(key(r)).glossCount > 0) : null;
 summary.push({completeNonemptyGlosses:usefulGloss?.length,usdPer1000CompleteNonemptyGlosses:usefulGloss?.length?cost/usefulGloss.length*1000:null,model,task,attempts:rr.length,mechanicallyValid:valid.length,medianMs:quantile(valid.map(r=>r.elapsedMs),.5),p90Ms:quantile(valid.map(r=>r.elapsedMs),.9),knownCostUsd:cost,unmeteredAttempts:rr.filter(r=>r.reportedCostUsd===undefined&&r.estimatedCostUsd===undefined).length,usdPer1000MechanicallyValid:valid.length?cost/valid.length*1000:null,failures:rr.filter(r=>!valid.includes(r)).map(r=>({fixture:r.fixture,trial:r.trial,errors:r.errors,native:native.get(key(r))}))});
}
writeFileSync(`${dir}/extended-summary.json`,JSON.stringify(summary,null,2));
for(const s of summary)console.log(`${s.model} ${s.task} ${s.mechanicallyValid}/${s.attempts} median=${s.medianMs} p90=${s.p90Ms} $/1k=${s.usdPer1000MechanicallyValid?.toFixed(4)} unmetered=${s.unmeteredAttempts}`);
console.log('totalKnownUsd',rows.reduce((s,r)=>s+(r.reportedCostUsd??r.estimatedCostUsd??0),0));
