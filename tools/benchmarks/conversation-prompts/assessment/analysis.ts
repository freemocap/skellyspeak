import {readFileSync} from 'node:fs';
import {hash,type Plan,type Job} from './plan.ts';
import type {Receipt} from './transport.ts';
export interface Observation {job:Job;receipt:Receipt}
export function metrics(observations:Observation[]) {
  const good=observations.filter(x=>x.receipt.status==='complete');
  const costs=observations.map(x=>x.receipt.metadata?.usage?.cost);
  const controls=good.filter(x=>x.job.condition==='partner-only');
  const controlErrors=controls.map(x=>Object.values(x.receipt.answers).filter(a=>a.choice!=='not_observed').length);
  const compare=(a:Observation,b:Observation)=>{
    const ids=Object.keys(a.receipt.answers);
    return {changed:ids.filter(id=>a.receipt.answers[id].choice!==b.receipt.answers[id].choice).length,total:ids.length,
      meanProbabilityChange:ids.reduce((s,id)=>s+Math.abs(a.receipt.answers[id].probabilities.demonstrated-b.receipt.answers[id].probabilities.demonstrated),0)/ids.length};
  };
  const pairs=(axis:'repeat'|'criteria'|'position'|'engine')=>good.flatMap(a=>{
    const j=a.job;
    if((axis==='repeat'&&j.repeat!==1)||(axis==='criteria'&&j.condition!=='learner')||
      (axis==='position'&&j.condition!=='evidence-first')||(axis==='engine'&&j.engine!=='jev'))return [];
    const b=good.find(b=>b.job.sourceId===j.sourceId&&
      b.job.engine===(axis==='engine'?'chat':j.engine)&&b.job.repeat===(axis==='repeat'?2:j.repeat)&&
      b.job.condition===(axis==='criteria'?'reverse-criteria':axis==='position'?'evidence-last':j.condition));
    return b?[{sourceId:j.sourceId,language:j.language,engine:j.engine,condition:j.condition,...compare(a,b)}]:[];
  });
  return {attempts:observations.length,completed:good.length,failed:observations.length-good.length,
    independentSourceTexts:new Set(good.map(x=>x.job.sourceTextHash)).size,
    knownCost:costs.filter(x=>typeof x==='number').reduce((s,x)=>s+x,0),missingCosts:costs.filter(x=>typeof x!=='number').length,
    controls:{requests:controls.length,decisions:controls.reduce((s,x)=>s+Object.keys(x.receipt.answers).length,0),
      nonAbsent:controlErrors.reduce((s,n)=>s+n,0),requestsWithAnyError:controlErrors.filter(n=>n>0).length},
    pairs:{repeat:pairs('repeat'),criteria:pairs('criteria'),position:pairs('position'),engine:pairs('engine')}};
}
export function readAssessments(directories:string[],sources:{id:string;textHash:string}[]) {
  const sourceLookup=new Map(sources.map(x=>[x.id,x.textHash]));
  const plans:Plan[]=[],observations:Observation[]=[];
  for(const dir of directories) {
    const p:Plan=JSON.parse(readFileSync(`${dir}/plan.json`,'utf8'));
    if(p.kind!=='skill-assessment'||hash(JSON.stringify(p.jobs))!==p.fixtureSha256)throw Error('Assessment plan hash mismatch');
    if(plans.length&&p.catalogHash!==plans[0].catalogHash)throw Error('Different assessment catalogs');
    const receipts:Receipt[]=readFileSync(`${dir}/results.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));
    if(new Set(receipts.map(x=>x.id)).size!==receipts.length)throw Error('Duplicate assessment receipts');
    for(const r of receipts) {
      const job=p.jobs.find(j=>j.id===r.id);
      if(!job||sourceLookup.get(job.sourceId)!==job.sourceTextHash)throw Error('Assessment source missing or changed');
      observations.push({job,receipt:r});
    }
    plans.push(p);
  }
  return {plans:plans.map(p=>({fixtureSha256:p.fixtureSha256,calls:p.calls,labelStatus:p.labelStatus,reservationUsd:p.reservationUsd})),
    skills:plans[0]?.catalog??[],observations,summary:metrics(observations),
    sourceIds:[...new Set(plans.flatMap(p=>p.jobs.map(j=>j.sourceId)))],
    planned:plans.reduce((s,p)=>s+p.calls,0)};
}
