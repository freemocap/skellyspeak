export type Row = {id:string;run:string;trial:string;prompt:string;level:string;persona:string;text:string;words:number;charsPerWord:number;wordsPerSentence:number;first:string;opening:string;normalized:string;vectorIndex:number;promptIndex:number;x:number;y:number;temperature:number;topP:number|null;wording:string;[key:string]:any};
export const levels=['absolute_zero','beginner','intermediate'];
export const prompts=['direct','relationship','contract','examples','relationship-calibrated','examples-capability'];
export const bounds:Record<string,number[]>={absolute_zero:[3,5],beginner:[6,11],intermediate:[13,23]};
export const names:Record<string,string>={'relationship-calibrated':'Prompt 5 · Relationship + examples','examples-capability':'Prompt 6 · Examples + capability',direct:'Prompt 1 · Direct',relationship:'Prompt 2 · Relationship',contract:'Prompt 3 · Contract',examples:'Prompt 4 · Examples',absolute_zero:'Absolute Zero',beginner:'Beginner',intermediate:'Intermediate',persona:'Persona','no-persona':'No persona'};
export const name=(x:string)=>names[x]??x;
export const config=(r:Row)=>`${r.round?r.round+' · ':''}${r.wording} · T ${r.temperature} · p ${r.topP??'default'} · ${name(r.persona)}`;
export const mean=(a:number[])=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
export function ordering(low:Row[],high:Row[],measure:string){
 if(!low.length||!high.length)return NaN;
 return mean(low.flatMap(a=>high.map(b=>b[measure]>a[measure]?1:b[measure]===a[measure]?.5:0)));
}
export function summarize(rows:Row[],cos:(a:Row,b:Row)=>number){
 const pairs:number[]=[];let exactPairs=0,openingPairs=0;
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  pairs.push(cos(rows[i],rows[j]));exactPairs+=Number(rows[i].normalized===rows[j].normalized);openingPairs+=Number(rows[i].opening===rows[j].opening);
 }
 return {n:rows.length,words:mean(rows.map(r=>r.words)),complexity:mean(rows.map(r=>r.wordsPerSentence)),letters:mean(rows.map(r=>r.charsPerWord)),
  adherence:mean(rows.map(r=>Number(r.words>=bounds[r.level][0]&&r.words<=bounds[r.level][1]))),
  similarity:mean(pairs),duplicates:pairs.length?exactPairs/pairs.length:NaN,openings:pairs.length?openingPairs/pairs.length:NaN,
  unique:new Set(rows.map(r=>r.normalized)).size};
}
export function groups(rows:Row[]){
 const map=new Map<string,Row[]>();
 for(const r of rows){const k=[r.run,r.prompt,r.persona].join('|');map.set(k,[...(map.get(k)??[]),r]);}
 return [...map.values()].sort((a,b)=>prompts.indexOf(a[0].prompt)-prompts.indexOf(b[0].prompt)||a[0].wording.localeCompare(b[0].wording)||a[0].temperature-b[0].temperature||a[0].persona.localeCompare(b[0].persona));
}
