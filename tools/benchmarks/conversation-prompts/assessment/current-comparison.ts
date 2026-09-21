import {readFileSync,existsSync} from 'node:fs';
import {loadSpanish,type Row} from './spanish-analysis.ts';
import type {loadJev} from './jev-alone-analysis.ts';
import {counts,trials,type Task} from './sdt.ts';
import {summarize} from './metrics.ts';
const key=(r:Row)=>`${r.caseId}/${r.context}/${r.repeat}`;
export function matchedPair(current:Row[],candidate:Row[]){
 const a=new Set(current.filter(r=>r.status==='complete').map(key)),b=new Set(candidate.filter(r=>r.status==='complete').map(key));
 return {current:current.filter(r=>r.status==='complete'&&b.has(key(r))),candidate:candidate.filter(r=>r.status==='complete'&&a.has(key(r)))};
}
export function compareCurrent(directory:string,jev:ReturnType<typeof loadJev>){
 const path=directory+'/current';if(!existsSync(path+'/plan.json'))return null;
 const baseline=loadSpanish(path),replayPath=path+'/replay.json.validated.json';
 const replay=existsSync(replayPath)?JSON.parse(readFileSync(replayPath,'utf8')):null;
 const current=baseline.rows.map(r=>{
  const validation=replay?.find((v:any)=>v.id===r.id);
  return validation&&!validation.valid?{...r,status:'failed',receipt:{...r.receipt,validation:[...r.receipt.validation,'Rust replay rejected native artifact']}}:r;
 });
 const sourceMetrics=(rows:Row[],task:Task)=>counts(trials(rows.filter(r=>r.group==='source'),task));
 const stats=summarize(current);
 const comparisons=jev.arms.map(arm=>{
  const candidate=jev.rows.filter(r=>r.engine===arm),pair=matchedPair(current,candidate);
  const tasks=(['attempt','full'] as const).map(task=>{
   const a=trials(pair.current,task),b=trials(pair.candidate,task);
   const paired=a.map(t=>{const other=b.find(s=>key(s.row)===key(t.row)&&s.skill===t.skill);if(!other)throw Error('Missing paired reference');if(other.signal!==t.signal)throw Error('Reference mismatch');return {id:other.row.id,currentId:t.row.id,caseId:t.row.caseId,skill:t.skill,current:t.outcome,candidate:other.outcome};});
   const correct=(o:string)=>o==='hit'||o==='correctRejection';
   return {task,current:counts(a),candidate:counts(b),currentAvailable:counts(trials(current,task)),candidateAvailable:counts(trials(candidate,task)),currentSource:sourceMetrics(current,task),candidateSource:sourceMetrics(candidate,task),wins:paired.filter(p=>!correct(p.current)&&correct(p.candidate)),losses:paired.filter(p=>correct(p.current)&&!correct(p.candidate)),bothWrong:paired.filter(p=>!correct(p.current)&&!correct(p.candidate))};
  });
  return {arm,paired:pair.current.length,currentExcluded:current.filter(r=>r.status==='complete').length-pair.current.length,candidateExcluded:candidate.filter(r=>r.status==='complete').length-pair.candidate.length,tasks,stats:summarize(candidate)};
 });
 return {complete:jev.complete&&baseline.complete&&Boolean(replay)&&current.filter(r=>r.receipt.nativeOutput!==undefined).every(r=>replay.some((v:any)=>v.id===r.id)),currentPlanHash:baseline.planHash,jevPlanHash:jev.planHash,currentModel:'google/gemini-2.5-flash-lite',replayComplete:Boolean(replay),current:stats,currentRows:current,currentRequests:baseline.requests,comparisons,totalKnownSpend:jev.summary.knownCost+stats.knownCost,totalUnknownCosts:jev.summary.missingCosts+stats.missingCosts};
}
export type CurrentComparison=NonNullable<ReturnType<typeof compareCurrent>>;
