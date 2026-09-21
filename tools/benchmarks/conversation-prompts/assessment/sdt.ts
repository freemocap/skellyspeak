import type {Row} from './spanish-analysis.ts';
export type Task = 'attempt' | 'full';
export type Outcome = 'hit' | 'miss' | 'falseAlarm' | 'correctRejection';
export interface Trial {row:Row; skill:string; signal:boolean; yes:boolean; score:number|null; outcome:Outcome}
export const outcome=(signal:boolean,yes:boolean):Outcome=>signal?(yes?'hit':'miss'):(yes?'falseAlarm':'correctRejection');
export function trials(rows:Row[],task:Task,threshold?:number):Trial[]{
    return rows.filter(r=>r.status==='complete').flatMap(row=>Object.entries(row.reference).flatMap(([skill,label])=>{
        if(!['demonstrated','partial','not_observed','not_demonstrated'].includes(label))return [];
        const signal=label==='demonstrated'||(task==='attempt'&&label==='partial');
        const p=row.probabilities[skill];
        const raw=row.evidenceScores?.[skill]?.[task] ?? (p?p.demonstrated+(task==='attempt'?p.partial:0):null);
        if(raw!==null&&(!Number.isFinite(raw)||raw<0||raw>1))throw Error('Evidence score outside [0,1]');
        const score=raw;
        const judgment=row.predictions[skill];
        if(!judgment)throw Error('Complete assessment has missing skill judgment');
        const yes=(row.evidenceScores!==undefined || threshold!==undefined&&row.engine==='jev')?
            (score===null?(()=>{throw Error('Missing Jev score');})():score>=(threshold??row.operatingThresholds?.[task]??.5)):
            judgment==='demonstrated'||(task==='attempt'&&judgment==='partial');
        return [{row,skill,signal,yes,score,outcome:outcome(signal,yes)}];
    }));
}
// Numerical inverse normal via bisection of a standard normal CDF approximation.
// Sufficient for display precision; numerical values tested against known quantiles.
export function z(p:number):number {
    if(!(p>0&&p<1))throw Error('Normal quantile requires 0 < p < 1');
    const cdf=(x:number)=>{
        const t=1/(1+.2316419*Math.abs(x));
        const tail=Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
        return x<0?tail:1-tail;
    };
    let lo=-10,hi=10;
    for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(cdf(mid)<p)lo=mid;else hi=mid;}
    return (lo+hi)/2;
}
export function counts(ts:Trial[]){
    const c={hit:0,miss:0,falseAlarm:0,correctRejection:0};
    for(const t of ts)c[t.outcome]++;
    const positives=c.hit+c.miss,negatives=c.falseAlarm+c.correctRejection;
    const hitRate=positives?c.hit/positives:null,falseAlarmRate=negatives?c.falseAlarm/negatives:null;
    // Log-linear correction applied to ALL four cells. [@hautus1995]
    const h=(c.hit+.5)/(positives+1),f=(c.falseAlarm+.5)/(negatives+1);
    return {...c,positives,negatives,hitRate,falseAlarmRate,
        dPrime:positives&&negatives?z(h)-z(f):null,
        criterion:positives&&negatives?-.5*(z(h)+z(f)):null,
        cases:new Set(ts.map(t=>t.row.caseId)).size,
        targets:new Set(ts.map(t=>`${t.row.caseId}/${t.skill}`)).size,
        uncertain:ts.filter(t=>t.row.predictions[t.skill]==='uncertain').length,
        unreported:ts.filter(t=>t.row.predictions[t.skill]==='unreported').length};
}
export function roc(ts:Trial[]){
    if(ts.some(t=>t.score===null))throw Error('ROC requires numeric scores');
    const thresholds=[Infinity,...new Set(ts.map(t=>t.score!))].sort((a,b)=>b-a);
    const points=thresholds.map(threshold=>({threshold,...counts(ts.map(t=>({...t,outcome:outcome(t.signal,t.score!>=threshold)})))}));
    let auc:number|null=points[0]?.positives&&points[0]?.negatives?0:null;
    if(auc!==null)for(let i=1;i<points.length;i++)auc+=(points[i].falseAlarmRate!-points[i-1].falseAlarmRate!)*(points[i].hitRate!+points[i-1].hitRate!)/2;
    return {points,auc};
}
export function cohort(rows:Row[],matched:boolean,excludeCap:boolean,context:string){
    const eligible=rows.filter(r=>(!excludeCap||r.positiveTotal<=4&&r.caseId!=='clear-many')&&(!context||r.context===context));
    const groups=new Map<string,Set<string>>();
    for(const r of eligible)if(r.status==='complete'){
        const key=`${r.caseId}/${r.context}/${r.order}/${r.repeat}`;
        if(!groups.has(key))groups.set(key,new Set());groups.get(key)!.add(r.engine);
    }
    const included=eligible.filter(r=>!matched||groups.get(`${r.caseId}/${r.context}/${r.order}/${r.repeat}`)?.size===3);
    return {rows:included,failed:eligible.filter(r=>r.status!=='complete').length,
        excludedValid:eligible.filter(r=>r.status==='complete').length-included.filter(r=>r.status==='complete').length};
}
