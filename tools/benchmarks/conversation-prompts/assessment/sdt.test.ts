import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trials,counts,roc,z,cohort,type Trial} from './sdt.ts';
import type {Row} from './spanish-analysis.ts';
const row=(engine='jev',repeat=1):Row=>({id:`${engine}-${repeat}`,caseId:'case',engine,repeat,context:'alone',order:'normal',status:'complete',positiveTotal:2,
 reference:{a:'demonstrated',b:'partial',c:'not_observed'},predictions:{a:'demonstrated',b:'demonstrated',c:'unreported'},
 probabilities:{a:{demonstrated:.8,partial:.1},b:{demonstrated:.6,partial:.2},c:{demonstrated:.1,partial:.1}}}) as unknown as Row;
test('two tasks distinguish partial over-credit and keep unknown targets out',()=>{
 const r=row();r.predictions.extra='demonstrated';
 const a=counts(trials([r],'attempt')),f=counts(trials([r],'full'));
 assert.equal(a.hit,2);assert.equal(a.correctRejection,1);assert.equal(a.falseAlarm,0);
 assert.equal(f.hit,1);assert.equal(f.falseAlarm,1);assert.equal(f.correctRejection,1);
 assert.equal(a.targets,3);assert.equal(a.unreported,1);
 assert.equal(trials([{...r,status:'failed'}],'attempt').length,0);
});
test('normal quantiles and loglinear d prime have known values and finite extremes',()=>{
 assert.ok(Math.abs(z(.975)-1.95996398454)<.00001);
 assert.ok(Math.abs(z(.5))<.000001);
 const ts=Array.from({length:4},(_,i)=>({row:row(),skill:'a',outcome:(['hit','miss','falseAlarm','correctRejection'] as const)[i]} as Trial));
 assert.ok(Math.abs(counts(ts).dPrime!)<1e-8);assert.ok(Math.abs(counts(ts).criterion!)<1e-6);
 assert.ok(Number.isFinite(counts(trials([row()],'attempt')).dPrime));
 assert.equal(counts([]).dPrime,null);
 assert.equal(counts(trials([row()],'attempt').filter(t=>t.signal)).dPrime,null);
});
test('ROC groups tied scores, has endpoints, and agrees with known rank AUC',()=>{
 const ts=trials([row()],'full');const r=roc(ts);
 assert.equal(r.auc,1);assert.equal(r.points[0].hitRate,0);assert.equal(r.points.at(-1)!.hitRate,1);
 const ties=roc(ts.map(t=>({...t,score:.5})));assert.equal(ties.auc,.5);assert.equal(ties.points.length,2);
 assert.equal(roc([]).auc,null);
 assert.equal(counts(trials([row()],'full',.7)).hit,1);
 assert.equal(counts(trials([row()],'full',.7)).falseAlarm,0);
});
test('matched cohorts exclude a failed triplet, not just the failing assessor',()=>{
 const rows=['sparse','chat','jev'].flatMap(e=>[row(e,1),row(e,2)]);
 rows.find(r=>r.engine==='chat'&&r.repeat===2)!.status='failed';
 assert.equal(cohort(rows,true,false,'').rows.length,3);
 assert.equal(cohort(rows,true,false,'').excludedValid,2);
 assert.equal(cohort(rows,false,false,'').failed,1);
 assert.equal(cohort(rows,false,false,'before').rows.length,0);
});
