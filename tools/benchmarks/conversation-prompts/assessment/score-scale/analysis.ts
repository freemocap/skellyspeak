import {quantile} from '../skill-expanded/dashboard/statistics.ts';
export const normalized=(label:string,arm:string):number|null=>label?.startsWith('score_')?(Number(label.slice(6))-(arm==='narrow'?1:0))/(arm==='narrow'?4:10):null;
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export function interval(rows:{cluster:string,value:number}[]){
 if(!rows.length)return null;
 const clusters=[...new Set(rows.map(r=>r.cluster))];let seed=92624;const draws:number[]=[];
 for(let b=0;b<5000;b++){const sample:number[]=[];for(let i=0;i<clusters.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const c=clusters[Math.floor(seed/4294967296*clusters.length)];sample.push(...rows.filter(r=>r.cluster===c).map(r=>r.value));}draws.push(mean(sample)!);}
 return [quantile(draws,.025),quantile(draws,.975)];
}
export function analyze(cases:any[],receipts:any[],dimension='grammar'){
 const ids=new Set(cases.map(c=>c.id)),rs=receipts.filter(r=>ids.has(r.caseId));
 const metrics=['narrow','wide','reaction'].map(arm=>{
 const q=arm==='reaction'?'understanding':dimension;
 const cr=rs.filter(r=>r.arm===arm);
 const rows=cases.map(c=>{
 const rr=cr.filter(r=>r.caseId===c.id),expected=c.expected[q];
 const matches=rr.map(r=>{const a=r.answers[q];if(!a)return 0;if(arm==='reaction')return Number(expected.includes(a.choice));const v=normalized(a.choice,arm);return Number(expected===null?a.choice==='insufficient_evidence':v!==null&&v>=expected[0]&&v<=expected[1]);});
 return{cluster:c.cluster,value:mean(matches)??0};
 });
 const numericPairs=cases.flatMap(c=>{const rr=cr.filter(r=>r.caseId===c.id).sort((a,b)=>a.repeat-b.repeat);if(arm==='reaction')return [];const vs=rr.map(r=>normalized(r.answers[q]?.choice,arm));return vs.length===2&&vs.every(v=>v!==null)?[{cluster:c.cluster,value:Math.abs(vs[0]!-vs[1]!)}]:[];});
 const changed=cases.flatMap(c=>{const rr=cr.filter(r=>r.caseId===c.id);const choices=rr.map(r=>r.answers[q]?.choice);return choices.length===2&&choices.every(Boolean)?[{cluster:c.cluster,value:Number(choices[0]!==choices[1])}]:[];});
 const distribution:Record<string,number>={};for(const r of cr){const choice=r.answers[q]?.choice??'invalid';distribution[choice]=(distribution[choice]??0)+1;}
 return{arm,cases:cases.length,calls:cr.length,referenceAgreement:mean(rows.map(r=>r.value)),ci:interval(rows),invalid:cr.filter(r=>!r.answers[q]).length,distribution,repeatChanged:mean(changed.map(r=>r.value)),repeatCI:interval(changed),numericPairCount:numericPairs.length,repeatDistance:mean(numericPairs.map(r=>r.value)),repeatDistanceCI:interval(numericPairs),medianMs:quantile(cr.map(r=>r.elapsedMs),.5),p95Ms:quantile(cr.map(r=>r.elapsedMs),.95),cost:cr.reduce((n,r)=>n+(r.costUsd??0),0)/cr.length};
 });
 const differences=cases.flatMap(c=>{
 const means=['narrow','wide'].map(arm=>{const rr=rs.filter(r=>r.caseId===c.id&&r.arm===arm);const vs=rr.map(r=>normalized(r.answers[dimension]?.choice,arm));return vs.length===2&&vs.every(v=>v!==null)?mean(vs as number[]):null;});
 return means.every(v=>v!==null)?[{cluster:c.cluster,value:means[1]!-means[0]!}]:[];
 });
 return{cases:cases.length,clusters:new Set(cases.map(c=>c.cluster)).size,metrics,numericComparisonCases:differences.length,meanScoreDifference:mean(differences.map(r=>r.value)),scoreDifferenceCI:interval(differences)};
}
