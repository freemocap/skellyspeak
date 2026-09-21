import {readFileSync} from 'node:fs';
import {loadTwoStage,type TwoStageData} from './two-stage-analysis.ts';
export function loadVariants(directory:string){
 const root=JSON.parse(readFileSync(directory+'/plan.json','utf8'));
 const original=loadTwoStage(root.parent);
 const entries:{id:string;directory:string}[]=root.studies??root.variants.map((id:string)=>({id,directory:directory+'/'+id}));
 const experiments:{id:string;data:TwoStageData}[]=entries.map(e=>({id:e.id,data:loadTwoStage(e.directory)}));
 const groups=[{id:'original',data:original},...experiments];
 const labels:Record<string,string>={chat_model:'Chat assessment (previous)',original:'Jev + original Fast'};
 for(const {id,data} of experiments)labels[id]=`Jev + ${data.plan.variant.prompt} · ${id.endsWith('standard')?'Standard':'Fast'}`;
 return {...original,labels,
  plan:{...original.plan,calls:root.calls,title:'Jev quote extraction: prompts × models',choices:[...experiments[0].data.plan.choices,...(root.choices??[]),`New calls: ${root.calls}. Conservative reservation: $${root.reservationUsd.toFixed(4)}. Original Jev + Fast and Chat are cached references.`,`Decision: require recovery of usable evidence relative to Chat (113/120 complete, 59/72 focal hits, 8/48 false alarms), inspect semantic support before adoption, and compare full pipeline speed/cost. Better quote formatting alone is insufficient. No automatic selection by a single composite score.`]},
  rows:[...original.rows.filter(r=>r.engine==='chat_model'),...groups.flatMap(({id,data})=>data.rows.filter((r)=>r.engine==='jev_fast').map((r)=>({...r,engine:id})))],
  pairs:groups.flatMap(({id,data})=>data.pairs.map((p)=>({...p,row:{...p.row,engine:id}}))),
  arms:[original.arms[0],...groups.map(({id,data})=>({...data.arms[1],engine:id}))],
  failures:groups.map(({id,data})=>({engine:id,counts:Object.entries(data.pairs.filter(p=>p.row.status==='failed').reduce((counts:Record<string,number>,p)=>{const reason=p.error?.message??p.error?.join?.('; ')??'First-stage or transport failure';counts[reason]=(counts[reason]??0)+1;return counts;},{}))})),
  complete:groups.every(g=>g.data.complete),
  extractionCalls:experiments.reduce((n:number,e:any)=>n+e.data.extractionCalls,0),
  extractionKnownCost:experiments.reduce((n:number,e:any)=>n+e.data.extractionKnownCost,0),
  extractionUnknownCosts:experiments.reduce((n:number,e:any)=>n+e.data.extractionUnknownCosts,0),
 };
}
