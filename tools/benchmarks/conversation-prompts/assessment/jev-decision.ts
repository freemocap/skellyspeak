/** Final frozen challenge; reuses the Jev-only runner and analysis. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {arms,questions,type JevJob,type JevPlan} from './jev-alone.ts';
import {hash,models,reservation} from './plan.ts';
import type {Case} from './spanish-study.ts';
export function decisionPlan():JevPlan{
 const prior:JevPlan=JSON.parse(readFileSync('docs/notes/conversation-prompts/jev-alone-2026-09-21/plan.json','utf8'));
 const path='tools/benchmarks/conversation-prompts/assessment/jev-decision-cases.json';
 const fixture=JSON.parse(readFileSync(path,'utf8'));
 const cases:Case[]=fixture.families.flatMap((f:any)=>f.cases.map(([kind,text,label,review,partner]:string[])=>({id:`decision-${f.skill}-${kind}`,group:kind.startsWith('full')?'full':kind,text,targets:{[f.skill]:label},review,...(partner?{partner}:{})})));
 const jobs:JevJob[]=[];
 for(let repeat=1;repeat<=2;repeat++)for(const [i,c]of cases.entries())for(let offset=0;offset<3;offset++){
  const arm=arms[(i+repeat+offset)%3],context=c.partner?'before':'alone';
  const state={currentLearnerMessage:c.text,input:{modality:'text',revision:false,scaffold:false,suggestion:false},precedingExchange:c.partner?[{role:'assistant',content:c.partner}]:[]};
  const payload={model:models.jev,state,questions:questions(arm,prior.catalog)};
  jobs.push({id:`${c.id}-r${repeat}-${arm}`,sourceId:c.id,sourceTextHash:hash(c.text),language:'spanish',level:c.group,prompt:arm,engine:'jev',arm,set:'new',condition:context,context,order:'normal',group:c.group,repeat,payload,request:payload});
 }
 const reservationUsd=jobs.reduce((s,j)=>s+reservation(j),0);
 if(cases.length!==60||jobs.length!==360||reservationUsd>10)throw Error('Unexpected final design');
 const operatingThresholds={original:{attempt:.5,full:.8},structured:{attempt:.5,full:.5},binary:{attempt:.5,full:.5}};
 const acceptance={hitRate:.95,falseAlarmRate:.05,sourceFalseAlarms:0,validRate:.99,p95Ms:750,costPerValid:.001,decisionContradictions:0};
 return {...prior,jobs,cases,calls:jobs.length,title:'Jev · final Go / No-Go challenge',description:'60 unseen messages × 3 Jev formulations × 2 repetitions = 360 calls. Twelve focal skills; paraphrases, imperfect grammar, partial meanings, lexical traps and partner-source controls.',operatingThresholds,acceptance,fixtureSha256:hash(JSON.stringify(jobs)),referenceHash:hash(JSON.stringify(cases)),reservationUsd,sourceHashes:Object.fromEntries([path,'tools/benchmarks/conversation-prompts/assessment/jev-decision.ts','tools/benchmarks/conversation-prompts/assessment/jev-alone.ts','tools/benchmarks/conversation-prompts/assessment/transport.ts'].map(p=>[p,hash(readFileSync(p,'utf8'))])),choices:[
 'Final decision scope: GO means proceed with guarded Jev-only app implementation; NO-GO means do not replace the current assessor with any tested configuration. This is an engineering screening decision, not approval to deploy or proof of population accuracy.',
 '60 new Spanish-target cases: 12 focal skills × two full demonstrations, one partial, one absent lexical/semantic trap, one source control. Three unchanged Jev formulations × two repetitions = 360 calls. Every call evaluates all 45 skills; only focal references are scored. No new model calls after this run for this decision.',
 'New cases use different constructions, nonstandard grammar with complete meaning, indirect modality, attribution, complex scope, and context contamination. Six skills extend beyond the previous six. Cases are authored and reviewed by the same agent, not independent human gold; disputed boundaries remain visible.',
 'Thresholds fixed from the PREVIOUS study: Original Choice uses evidence 0.50, full 0.80; Structured Choice and Noul use 0.50 for both. Original full 0.80 was chosen between previous negative maximum 0.78 and positive minimum 0.94. No final-set tuning, repaired answers, retries, or best-threshold selection.',
 'Acceptance gates chosen before inference: each binary task hit rate ≥95% and false-alarm rate ≤5%; zero focal source-control false alarms; ≥99% valid calls; p95 valid latency ≤750 ms; known total spend / valid assessment ≤$0.001 (≤$1 per 1,000); no unknown billing; zero full-yes/evidence-no decisions across all 45 skills.',
 'Quality gates must pass on both matched valid triples and each arm’s available valid calls. Require ≥90% matched coverage so failures cannot remove most hard examples. Budget/timing figures include scope and failure costs explicitly. These are pragmatic engineering tolerances, not user-approved universal accuracy standards.',
 'A candidate must pass every gate. If multiple pass, use Pareto comparison of errors, failures, speed and cost; no undisclosed combined score. If none pass, recommend NO-GO without moving the goalposts or automatically launching another experiment.',
 'Source control includes partner-only focal evidence, five English-only learner statements, and an English rubric-injection instruction. The target remains Spanish. Context is embedded within case families, not an independent factorial manipulation; no causal context-effect claim.',
 'SDT uses fixed operating points and exploratory ROC. Repetitions are dependent; 120 judgments per arm are 60 distinct cases. Cases/thresholds/policies are frozen before inference. Maps are freshly fitted to binary decision profiles and do not determine the Go/No-Go outcome.'
 ]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const out=process.argv[2];if(!out)throw Error('Usage: jev-decision.ts OUT');const p=decisionPlan();mkdirSync(out,{recursive:true});writeFileSync(out+'/plan.json',JSON.stringify(p,null,2),{flag:'wx'});writeFileSync(out+'/policy-hash.json',JSON.stringify({hash:hash(JSON.stringify({thresholds:p.operatingThresholds,acceptance:p.acceptance,choices:p.choices}))}));console.log(JSON.stringify({calls:p.calls,reservationUsd:p.reservationUsd}));}
