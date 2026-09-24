import {readFileSync,writeFileSync} from 'node:fs';
import {parseAllDocuments,stringify} from 'yaml';
import {readYaml} from './plan.ts';
const out=process.argv[2];const plan=readYaml(out+'/plan.yaml');
const docs=parseAllDocuments(readFileSync(out+'/receipts.yaml','utf8'));
const receipts=docs.map(d=>{if(d.errors.length||d.warnings.length)throw Error('Invalid receipt YAML');return d.toJS();});
if(new Set(receipts.map(r=>r.id)).size!==receipts.length)throw Error('Duplicate receipt');
const q=(values:number[],p:number)=>{const a=[...values].sort((x,y)=>x-y);return a.length?a[Math.max(0,Math.ceil(p*a.length)-1)]:null;};
const names:Record<string,string>={A:'Core',B:'Language',C:'Language + prose',D:'Language + notation',E:'Full guide'};
const observations=receipts.flatMap(r=>{const c=plan.cases.find((c:any)=>c.id===r.caseId);return Object.entries<any>(c.targets).flatMap(([skill,target])=>Object.entries(target).map(([dimension,expected])=>({caseId:c.id,arm:r.arm,repeat:r.repeat,skill,dimension,expected,predicted:r.answers[`${skill}__${dimension}`]?.choice??null,probabilities:r.answers[`${skill}__${dimension}`]?.probabilities??null,valid:r.status==='complete',focal:c.id.startsWith('past_')||['present_only','future_only','time_unresolved'].includes(c.id)?skill==='past_reference':skill==='possession_relationships'})));});
const arms=Object.entries(names).map(([arm,name])=>{
 const rs=receipts.filter(r=>r.arm===arm),os=observations.filter(o=>o.arm===arm);const cost=rs.every(r=>typeof r.costUsd==='number')?rs.reduce((n,r)=>n+r.costUsd,0):null;
 const agreement=(list:any[])=>({correct:list.filter(o=>o.valid&&o.expected===o.predicted).length,total:list.length});
 let changed=0,pairs=0;for(const o of os.filter(o=>o.repeat===1)){const other=os.find(v=>v.repeat===2&&v.caseId===o.caseId&&v.skill===o.skill&&v.dimension===o.dimension);if(other){pairs++;if(other.predicted!==o.predicted)changed++;}}
 return {arm,name,calls:rs.length,valid:rs.filter(r=>r.status==='complete').length,costUsd:cost,costPer1000:cost===null?null:cost/rs.length*1000,p50:q(rs.map(r=>r.elapsedMs),.5),p95:q(rs.map(r=>r.elapsedMs),.95),inputTokens:rs.reduce((n,r)=>n+(r.metadata?.usage?.input_tokens??0),0),all:agreement(os),focal:agreement(os.filter(o=>o.focal)),evidence:agreement(os.filter(o=>o.focal&&o.dimension==='evidence')),expression:agreement(os.filter(o=>o.focal&&o.dimension==='expression')),repeatChanges:changed,repeatPairs:pairs};
});
const report={status:receipts.length===plan.calls?'complete':'partial',planned:plan.calls,received:receipts.length,referenceStatus:plan.referenceStatus,limitations:plan.limitations,arms,cases:plan.cases.map((c:any)=>({id:c.id,input:c.input,targets:c.targets,review_note:c.review_note})),observations,receipts:receipts.map(r=>({caseId:r.caseId,arm:r.arm,repeat:r.repeat,status:r.status,elapsedMs:r.elapsedMs,costUsd:r.costUsd})),totalCost:receipts.every(r=>r.costUsd!==null)?receipts.reduce((n,r)=>n+r.costUsd,0):null};
writeFileSync(out+'/summary.yaml',stringify(report,{aliasDuplicateObjects:false}));
console.log(JSON.stringify({status:report.status,totalCost:report.totalCost,arms},null,2));
