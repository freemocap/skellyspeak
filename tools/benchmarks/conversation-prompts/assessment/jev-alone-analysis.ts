import {readFileSync,existsSync} from 'node:fs';
import {hash} from './plan.ts';
import {arms,names,type JevPlan} from './jev-alone.ts';
import {summarize,type Row} from './spanish-analysis.ts';
import {cohort,trials,counts,roc} from './sdt.ts';
import type {Receipt} from './transport.ts';
export interface JevRow extends Row {set:string;evidenceScores:Record<string,{attempt:number;full:number}>;contradictions:string[];orderViolations:string[]}
export function loadJev(directory:string){
 const p:JevPlan=JSON.parse(readFileSync(directory+'/plan.json','utf8'));
 if(p.studyType!=='jev-alone'||hash(JSON.stringify(p.jobs))!==p.fixtureSha256||hash(JSON.stringify(p.cases))!==p.referenceHash)throw Error('Frozen study changed');
 if(p.acceptance){const policy=JSON.parse(readFileSync(directory+'/policy-hash.json','utf8'));if(policy.hash!==hash(JSON.stringify({thresholds:p.operatingThresholds,acceptance:p.acceptance,choices:p.choices})))throw Error('Frozen decision policy changed');}
 const receipts:Receipt[]=existsSync(directory+'/results.jsonl')?readFileSync(directory+'/results.jsonl','utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)):[];
 if(new Set(receipts.map(r=>r.id)).size!==receipts.length)throw Error('Duplicate receipt');
 const requestMap=new Map<string,number>(),requests:unknown[]=[];
 const requestIndexes=p.jobs.map(j=>{const k=hash(JSON.stringify(j.request));if(!requestMap.has(k)){requestMap.set(k,requests.length);requests.push(j.request);}return requestMap.get(k)!;});
 const rows:JevRow[]=receipts.map(r=>{
  const j=p.jobs.find(j=>j.id===r.id);if(!j)throw Error('Unplanned receipt');
  const operatingThresholds=p.operatingThresholds?.[j.arm]??{attempt:.5,full:.5};
  const c=p.cases.find(c=>c.id===j.sourceId)!;
  if(c.targets==='all_absent')throw Error('Expected focal references');
  const evidenceScores:JevRow['evidenceScores']={},predictions:Record<string,string>={},contradictions:string[]=[],orderViolations:string[]=[];
  if(r.status==='complete')for(const s of p.catalog){
   const scores=j.arm==='binary'?{attempt:r.nouls![s.id+'__evidence'],full:r.nouls![s.id+'__full']}:{attempt:r.answers[s.id].probabilities.demonstrated+r.answers[s.id].probabilities.partial,full:r.answers[s.id].probabilities.demonstrated};
   if(Object.values(scores).some(x=>!Number.isFinite(x)||x<0||x>1))throw Error('Invalid evidence probability');
   evidenceScores[s.id]=scores;
   const a=scores.attempt>=operatingThresholds.attempt,f=scores.full>=operatingThresholds.full;
   if(f&&!a)contradictions.push(s.id);
   if(scores.full>scores.attempt+.001)orderViolations.push(s.id);
   predictions[s.id]=f&&!a?'contradictory':f?'demonstrated':a?'partial':'no_positive_evidence';
  }
  const vector=p.catalog.flatMap(s=>[Number(evidenceScores[s.id]?.attempt>=operatingThresholds.attempt),Number(!(evidenceScores[s.id]?.attempt>=operatingThresholds.attempt)),Number(evidenceScores[s.id]?.full>=operatingThresholds.full),Number(!(evidenceScores[s.id]?.full>=operatingThresholds.full))]);
  const q={positiveTotal:0,positiveHits:0,negativeTotal:0,falseCredits:0,exact:0,scored:0};
  if(r.status==='complete')for(const [id,expected] of Object.entries(c.targets)){
   const positive=['demonstrated','partial'].includes(expected),some=evidenceScores[id].attempt>=operatingThresholds.attempt,full=evidenceScores[id].full>=operatingThresholds.full;
   q.scored++;if(positive){q.positiveTotal++;q.positiveHits+=Number(some);}else{q.negativeTotal++;q.falseCredits+=Number(some);}
   q.exact+=Number(some===positive&&full===(expected==='demonstrated'));
  }
  return {operatingThresholds,id:r.id,caseId:c.id,engine:j.arm,set:j.set,context:j.context,order:j.order,group:j.group,repeat:j.repeat,status:r.status,elapsedMs:r.elapsedMs,cost:typeof r.metadata?.usage?.cost==='number'?r.metadata.usage.cost:null,predictions,probabilities:Object.fromEntries(Object.entries(r.answers).map(([id,a])=>[id,a.probabilities])),reference:c.targets,...q,requestIndex:requestIndexes[p.jobs.indexOf(j)],receipt:r,profileHash:hash(JSON.stringify(vector)),text:c.text,vector,evidenceScores,contradictions,orderViolations};
 });
 const reports=['all','earlier','new'].flatMap(set=>(['attempt','full'] as const).flatMap(task=>[true,false].map(matched=>{
  const c=cohort(rows.filter(r=>set==='all'||r.set===set),matched,false,'');const ts=trials(c.rows,task);
  return {set,task,matched,failed:c.failed,excludedValid:c.excludedValid,arms:arms.map(arm=>({arm,...counts(ts.filter(t=>t.row.engine===arm)),auc:roc(ts.filter(t=>t.row.engine===arm)).auc}))};
 })));
 return {operatingThresholds:p.operatingThresholds,acceptance:p.acceptance,title:p.title,description:p.description,names,arms,catalog:p.catalog,cases:p.cases,choices:p.choices,planHash:p.fixtureSha256,reservationUsd:p.reservationUsd,planned:p.calls,requests,rows,reports,summary:summarize(rows),overall:arms.map(arm=>({arm,...summarize(rows.filter(r=>r.engine===arm))})),complete:receipts.length===p.calls};
}
