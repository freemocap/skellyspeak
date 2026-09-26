import {arms,quantile} from './statistics.ts';
export function transitions(cases:any[],receipts:any[],dimension='both',resamples=5000, repetitions=Math.max(...receipts.map(r=>r.repeat))){
 const ds=dimension==='both'?['evidence','expression']:[dimension];
 const clusters=[...new Set(cases.map(c=>c.cluster))];
 const index=new Map(receipts.map(r=>[`${r.caseId}/${r.arm}/${r.repeat}`,r]));
 return arms.filter(a=>a!=='B').map(arm=>{
 const groups=clusters.map(cluster=>{let total=0,changed=0,fixed=0,broken=0,invalid=0;
 for(const c of cases.filter(c=>c.cluster===cluster))for(let repeat=1;repeat<=repetitions;repeat++)for(const d of ds){
 const key=c.focal+'__'+d,a=index.get(`${c.id}/${arm}/${repeat}`)?.answers[key]?.choice,b=index.get(`${c.id}/B/${repeat}`)?.answers[key]?.choice;
 if(a===undefined||b===undefined){invalid++;continue;}total++;changed+=Number(a!==b);fixed+=Number(a===c.targets[c.focal][d]&&b!==c.targets[c.focal][d]);broken+=Number(a!==c.targets[c.focal][d]&&b===c.targets[c.focal][d]);
 }return{total,changed,fixed,broken,invalid};});
 const sum=(key:keyof typeof groups[number])=>groups.reduce((s,g)=>s+g[key],0);
 let state=2492026;const draws:number[]=[];
 for(let i=0;i<resamples;i++){let total=0,changed=0;for(let j=0;j<groups.length;j++){state=(Math.imul(state,1664525)+1013904223)>>>0;const g=groups[Math.floor(state/4294967296*groups.length)];total+=g.total;changed+=g.changed;}draws.push(changed/total);}
 return{arm,total:sum('total'),changed:sum('changed'),fixed:sum('fixed'),broken:sum('broken'),invalid:sum('invalid'),ci:[quantile(draws,.025),quantile(draws,.975)]};
 });
}
