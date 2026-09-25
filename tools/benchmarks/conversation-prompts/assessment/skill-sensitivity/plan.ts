import {mkdirSync,writeFileSync} from 'node:fs';
import {stringify} from 'yaml';
import {makePlan as pilot,readYaml,hash,instruction} from '../skill-pilot/plan.ts';
import {cases} from '../skill-expanded/cases.ts';
export function makePlan(){
 const previous=pilot(), baseline=previous.jobs.find(j=>j.arm==='B')!.payload;
 const strategies=readYaml(new URL('./strategies.yaml',import.meta.url).pathname);
 const measurement=readYaml('docs/notes/language-guides-and-xp/drafts/experiments/measurement.yaml');
 const examples=cases().filter(c=>c.language==='Spanish'),jobs:any[]=[];
 let state=2492026;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let repeat=1;repeat<=5;repeat++){
 const shuffled=[...examples];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 for(const [index,c] of shuffled.entries())for(let offset=0;offset<5;offset++){
 const arm='ABCDE'[(index+repeat+offset)%5],payload=structuredClone(baseline);
 payload.state={language:c.language,variety:c.variety,currentLearnerMessage:c.input.learner,precedingExchange:c.input.preceding_partner?[{role:'partner',content:c.input.preceding_partner}]:[]};
 if(arm!=='B')for(const [id,q]of Object.entries<any>(payload.questions)){
 const [skill,dimension]=id.split('__');q.instructions=`${instruction}\n\n${strategies[arm][skill]}\n\n${measurement.questions[dimension].prompt}`;
 }
 const reservation=Object.values<any>(payload.questions).reduce((n,q)=>n+Buffer.byteLength(JSON.stringify(payload.state))+Buffer.byteLength(JSON.stringify(q))+4096,0)*.000000042;
 jobs.push({id:`${c.id}-${arm}-${repeat}`,caseId:c.id,cluster:c.cluster,arm,repeat,reservation,payload});
 }}
 const reservation=jobs.reduce((n,j)=>n+j.reservation,0);if(jobs.length!==900||reservation>2)throw Error('Study bounds exceeded');
 return {model:previous.model,calls:900,cases:examples,jobs,hash:hash(jobs),dollarCap:2,reservation,priceCeiling:previous.priceCeiling,seed:2492026,repetitions:5,armNames:['Minimal','Baseline','Rules','Examples','Misleading control'],study:{title:'Spanish assessment: prompt sensitivity',subtitle:'Four deliberately different strategies and a concurrent baseline. Test whether the descriptions affect Jev before optimizing their wording.',design:['36 existing Spanish (Mexico) cases; 31 related-scenario clusters. Two skills and four judgments per request.','Five conditions × five repetitions = 900 measured requests. A minimal; B previous language baseline; C operational rules; D contrasting examples; E deliberately wrong definitions.','Only skill-description text changes. Shared assessment instructions, question wording, criteria, state shape and label sets stay fixed. No factorial mix-and-match.','Case order is randomized each repetition, with rotating condition order. Baseline B is rerun concurrently. Historical responses are not pooled.','Primary contrasts: each condition versus B. Also inspect label changes even where reference agreement is unchanged. The misleading control tests instruction sensitivity, not pedagogical quality.','Same provisional references and disputed flags as the preceding study. No reference edits. Strategies were authored after prior results, so this is development-set sensitivity, not held-out validation.','5,000 paired scenario-cluster bootstrap resamples and 95% percentile intervals. Repeats and related rows remain together. Intervals are exploratory, not multiplicity-adjusted.','No temperature setting; reuse the documented Decisions API defaults. $2 hard cap with live pricing verification. Transport/billing/model errors stop the run; invalid judgments are recorded without retry.'],limitations:['More explicit descriptions are candidate improvements, not a presumption that they are better. The misleading control intentionally contradicts the target meaning while preserving general assessment instructions.','A response to misleading guidance establishes sensitivity to content, not that additional guide prose improves assessment. Lack of reference-agreement change can conceal changed labels; inspect the transition report.','Five repetitions characterize common variability, not rare failure rates. Reused cases and AI-authored labels limit accuracy claims.','Costs are USD per 1,000 four-judgment requests. Per-request cost is a thousandth of the chart value. No app XP changes or bulk guide generation.']}};
}
if(process.argv[1]?.endsWith('/skill-sensitivity/plan.ts')){const p=makePlan(),out=process.argv[2];mkdirSync(out,{recursive:true});writeFileSync(out+'/plan.yaml',stringify(p,{aliasDuplicateObjects:false}),{flag:'wx'});console.log(JSON.stringify({calls:p.calls,cap:p.dollarCap,reservation:p.reservation}));}
