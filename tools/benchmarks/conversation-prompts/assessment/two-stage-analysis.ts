import {readFileSync,existsSync} from 'node:fs';
import {hash} from './plan.ts';
import {loadJev} from './jev-alone-analysis.ts';
import {loadSpanish,quality,type Row} from './spanish-analysis.ts';
import {counts,trials} from './sdt.ts';
import {summarize,quantile} from './metrics.ts';
import type {Receipt} from './transport.ts';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const receipts=(p:string):Receipt[]=>existsSync(p)?readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s)):[];
export function totalCost(first:number|null,second:number|null,skipped:boolean){return first===null||!skipped&&second===null?null:first+(skipped?0:second!);}
export function quoteOverlap(source:string,a:string,b:string):number|null {
 const x=source.indexOf(a),y=source.indexOf(b);
 if(!a||!b||x<0||y<0)return null;
 const intersection=Math.max(0,Math.min(x+a.length,y+b.length)-Math.max(x,y));
 return intersection/(a.length+b.length-intersection);
}
const positive=(outcome:string)=>['demonstrated','partial'].includes(outcome);
const key=(r:Row)=>`${r.caseId}/${r.context}/${r.repeat}`;
export function delivered(rows:Row[],task:'attempt'|'full'){
 return counts(trials(rows.filter(r=>r.status!=='pending').map(r=>({...r,status:'complete',probabilities:{},evidenceScores:undefined,predictions:r.status==='complete'?r.predictions:Object.fromEntries(Object.keys(r.reference).map(id=>[id,'unreported']))})),task));
}
export function loadTwoStage(directory:string){
 const plan=read(directory+'/plan.json');if(hash(JSON.stringify(plan.jobs))!==plan.fixtureSha256)throw Error('Changed two-stage plan');
 const jev=loadJev(plan.previous),baseline=loadSpanish(plan.previous+'/current');
 if(jev.planHash!==plan.previousHash)throw Error('Changed Jev parent plan');
 const extraction=receipts(directory+'/results.jsonl');
 if(new Set(extraction.map(r=>r.id)).size!==extraction.length||extraction.some(r=>!plan.jobs.some((j:any)=>j.id===r.id&&!j.skipped)))throw Error('Unplanned or duplicate extraction');
 const replay=existsSync(directory+'/replay.json.native.json')?read(directory+'/replay.json.native.json').rows:[];
 const nativeBaseline=existsSync(directory+'/baseline-replay.json.validated.json')?read(directory+'/baseline-replay.json.validated.json'):[];
 const oldRows=baseline.rows.map(r=>{
  const validation=nativeBaseline.find((v:any)=>v.id===r.id);
  return {...r,engine:'chat_model',status:r.status!=='complete'?'failed':!validation?'pending':validation.valid?'complete':'failed'};
 });
 const rows:Row[]=plan.jobs.map((job:any)=>{
  const first=jev.rows.find(r=>r.id===job.id)!;if(!first)throw Error('Missing original Jev row');
  const second=extraction.find(r=>r.id===job.id),checked=replay.find((r:any)=>r.id===job.id);
  const status=job.sourceFailed?'failed':job.skipped?'complete':!second?'pending':second.status!=='complete'?'failed':!checked?'pending':checked.valid?'complete':'failed';
  const value=job.skipped?job.native?.validated:checked?.value?.validated;
  const predictions:Record<string,string>=Object.fromEntries(plan.catalog.map((c:any)=>[c.id,value?.items?.find((i:any)=>i.construct===c.id)?.outcome??'unreported']));
  return {...first,engine:'jev_fast',status,predictions,probabilities:{},evidenceScores:undefined,elapsedMs:first.elapsedMs+(second?.elapsedMs??0),cost:totalCost(first.cost,second?.metadata?.usage?.cost??null,job.skipped),...quality(first.reference,predictions,status==='complete'),receipt:second??first.receipt};
 });
 const pairs=rows.map(r=>{
  const old=oldRows.find(b=>key(b)===key(r));if(!old||old.text!==r.text)throw Error('Missing or mismatched baseline pair');
  const checked=replay.find((v:any)=>v.id===r.id);
  const newItems=(checked?.value?.validated?.items??plan.jobs.find((j:any)=>j.id===r.id)?.native?.validated?.items??[]).filter((i:any)=>positive(i.outcome));
  const job=plan.jobs.find((j:any)=>j.id===r.id);
  const decisions=(job?.native?.decisions?.items??job?.native?.validated?.items??[]).filter((i:any)=>positive(i.outcome));
  const raw=(extraction.find(e=>e.id===r.id)?.nativeOutput as any)?.items??[];
  const oldItems=old.receipt.sparseItems??[];
  const skills=[...new Set([...decisions.map((i:any)=>i.construct),...raw.map((i:any)=>i.construct),...oldItems.map(i=>i.construct)])] as string[];
  const quotes=skills.map(skill=>{
   const a=oldItems.find(i=>i.construct===skill),b=newItems.find((i:any)=>i.construct===skill),candidate=raw.find((i:any)=>i.construct===skill);
   return {skill,chatQuote:a?.quote??null,jevQuote:b?.quote??candidate?.quote??null,jevPublished:r.status==='complete',candidateCount:raw.filter((i:any)=>i.construct===skill).length,chatOutcome:a?.outcome??'unreported',jevOutcome:decisions.find((i:any)=>i.construct===skill)?.outcome??'not_implicated',overlap:a&&b?quoteOverlap(r.text,a.quote,b.quote):null};
  });
  return {row:r,baseline:old,quotes,changed:Object.keys(r.reference).some(s=>positive(r.predictions[s])!==positive(old.predictions[s])||(r.predictions[s]==='demonstrated')!==(old.predictions[s]==='demonstrated')),error:checked?.error??r.receipt.validation,request:plan.jobs.find((j:any)=>j.id===r.id)?.request??null,receipt:extraction.find(e=>e.id===r.id)??null};
 });
 const arms=[oldRows,rows].map(group=>({engine:group[0].engine,summary:summarize(group),latencyAllP50:quantile(group.filter(r=>r.status!=='pending').map(r=>r.elapsedMs),.5),latencyAllP95:quantile(group.filter(r=>r.status!=='pending').map(r=>r.elapsedMs),.95),pending:group.filter(r=>r.status==='pending').length,validOnly:{attempt:counts(trials(group,'attempt')),full:counts(trials(group,'full'))},delivered:{attempt:delivered(group,'attempt'),full:delivered(group,'full')}}));
 return {plan,pairs,rows:[...oldRows,...rows],arms,complete:rows.every(r=>r.status!=='pending')&&oldRows.every(r=>r.status!=='pending'),extractionCalls:extraction.length,extractionKnownCost:extraction.reduce((n,r)=>n+(r.metadata?.usage?.cost??0),0),extractionUnknownCosts:extraction.filter(r=>typeof r.metadata?.usage?.cost!=='number').length,reviewedSemanticQuotes:0};
}
export type TwoStageData=ReturnType<typeof loadTwoStage>;
