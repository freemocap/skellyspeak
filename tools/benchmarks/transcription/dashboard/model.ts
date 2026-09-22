export type Judgment = 'faithful'|'usable'|'uncertain'|'changed'|'unreviewed';
export type Metric = 'message'|'faithful'|'cer';
export interface Review { resultId: string; takeId:string; reference:string; text:string; judgment:Judgment; reason:string; reviewer:string; basis:string }
export interface Sample {condition:string;resultId?:string;status:string;text:string;elapsedMs:number|null;cer:number|null;review?:Review}
export interface Row { takeId:string;number:number;phraseId:string;meaning:string;language:string;reference:string;variety:string;results:Sample[] }
export interface Dataset {generated:string;rows:Row[];conditions:{id:string;label:string}[];reviewed:string;rubric:Record<string,string>}
export const names:Record<string,string>={ar:'Arabic',es:'Spanish',zh:'Chinese',en:'English'};
export const labels:Record<string,string>={
 'whisper-large-v3-forced':'Whisper · supplied language','scribe-forced-verbatim':'Scribe · supplied · verbatim',
 'scribe-forced-clean':'Scribe · supplied · clean','whisper-large-v3-auto':'Whisper · auto language',
 'scribe-auto-verbatim':'Scribe · auto · verbatim','scribe-auto-clean':'Scribe · auto · clean'};
export const judgmentLabels:Record<Judgment,string>={faithful:'Faithful',usable:'Usable with changes',uncertain:'Uncertain',changed:'Changed / wrong language',unreviewed:'Not reviewed'};
export function tally(rows:Row[],id:string){
 const counts:Record<Judgment,number>={faithful:0,usable:0,uncertain:0,changed:0,unreviewed:0};
 const samples=rows.map(r=>r.results.find(s=>s.condition===id));
 for(const s of samples) counts[s?.review?.judgment??'unreviewed']++;
 const scores=samples.filter(s=>s?.status==='ok'&&s.cer!==null).map(s=>s!.cer!);
 return {...counts,n:rows.length,accepted:counts.faithful+counts.usable,cer:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null,
 failures:samples.filter(s=>s?.status==='error').length,missing:samples.filter(s=>!s||s.status==='missing').length};
}
export function value(rows:Row[],id:string,metric:Metric,balanced:boolean):number|null{
 if(!rows.length)return null;
 if(balanced){const vs=[...new Set(rows.map(r=>r.language))].map(l=>value(rows.filter(r=>r.language===l),id,metric,false));
 if(vs.some(v=>v===null))return null;return (vs as number[]).reduce((a,b)=>a+b,0)/vs.length;}
 const t=tally(rows,id);
 if(metric==='cer')return t.cer===null?null:100*t.cer;
 // Incomplete reviews cannot silently become a model ranking.
 if(t.unreviewed)return null;
 return 100*(metric==='message'?t.accepted:t.faithful)/t.n;
}
export function rank(data:Dataset,rows:Row[],metric:Metric,balanced:boolean){
 return data.conditions.map(c=>({id:c.id,value:value(rows,c.id,metric,balanced)})).sort((a,b)=>{
 if(a.value===null)return 1;if(b.value===null)return -1;return metric==='cer'?a.value-b.value:b.value-a.value;
 });
}
