import type {loadJev} from './jev-alone-analysis.ts';
import {cohort,trials,counts} from './sdt.ts';
import {summarize} from './metrics.ts';
export interface Gate {label:string;pass:boolean;actual:string;required:string}
export function evaluateDecision(data:ReturnType<typeof loadJev>){
 const a=data.acceptance;if(!a)throw Error('Missing frozen acceptance criteria');
 const c=cohort(data.rows,true,false,''),expected=data.planned/3;
 const coverage=c.rows.filter(r=>r.status==='complete').length/3/expected;
 const candidates=data.arms.map(arm=>{
  const rows=data.rows.filter(r=>r.engine===arm),stats=summarize(rows),gates:Gate[]=[];
  const add=(label:string,pass:boolean,actual:string,required:string)=>gates.push({label,pass,actual,required});
  add('Matched coverage',coverage>=.9,(coverage*100).toFixed(1)+'%','≥90%');
  for(const [name,rs]of [['Matched',c.rows.filter(r=>r.engine===arm)],['Available',rows]] as const)for(const task of ['attempt','full'] as const){
   const n=counts(trials(rs,task));
   add(`${name} ${task}: hit rate`,n.hitRate!==null&&n.hitRate>=a.hitRate,`${n.hit}/${n.positives}`,`≥${a.hitRate*100}%`);
   add(`${name} ${task}: false alarms`,n.falseAlarmRate!==null&&n.falseAlarmRate<=a.falseAlarmRate,`${n.falseAlarm}/${n.negatives}`,`≤${a.falseAlarmRate*100}%`);
  }
  for(const task of ['attempt','full'] as const){const n=counts(trials(rows.filter(r=>r.group==='source'),task));add(`Source control ${task}: false alarms`,n.negatives>0&&n.falseAlarm===a.sourceFalseAlarms,`${n.falseAlarm}/${n.negatives}`,'0');}
  add('Valid responses',stats.complete/expected>=a.validRate,`${stats.complete}/${expected}`,`≥${a.validRate*100}%`);
  add('p95 valid latency',stats.latencyP95!==null&&stats.latencyP95<=a.p95Ms,`${stats.latencyP95??'unknown'} ms`,`≤${a.p95Ms} ms`);
  add('Known cost / valid',stats.costPerComplete!==null&&stats.costPerComplete<=a.costPerValid,stats.costPerComplete===null?'unknown':'$'+stats.costPerComplete.toFixed(6),`≤$${a.costPerValid}`);
  add('Unknown billing',stats.missingCosts===0,String(stats.missingCosts),'0');
  const conflicts=rows.reduce((n,r)=>n+r.contradictions.length,0);
  add('All-skill decision contradictions',conflicts===a.decisionContradictions,String(conflicts),'0');
  return {arm,pass:gates.every(g=>g.pass),gates,stats};
 });
 return {status:!data.complete?'PENDING':candidates.some(c=>c.pass)?'GO':'NO-GO',scope:'Proceed with guarded Jev-only app implementation; not deployment approval.',coverage,candidates,planHash:data.planHash};
}
export type DecisionReport=ReturnType<typeof evaluateDecision>;
