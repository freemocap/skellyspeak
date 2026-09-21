import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decisionPlan} from './jev-decision.ts';
import {trials,counts} from './sdt.ts';
import type {Row} from './spanish-analysis.ts';
import {evaluateDecision} from './decision-gates.ts';
test('final design pairs every arm, covers twelve skills, and keeps development thresholds',()=>{
 const p=decisionPlan();assert.equal(p.calls,360);assert.equal(p.cases.length,60);assert.equal(new Set(p.cases.flatMap(c=>Object.keys(c.targets))).size,12);
 assert.equal(p.operatingThresholds!.original.full,.8);assert.equal(p.operatingThresholds!.binary.full,.5);
 for(let i=0;i<p.jobs.length;i+=3){const js=p.jobs.slice(i,i+3);assert.equal(new Set(js.map(j=>j.arm)).size,3);assert.equal(new Set(js.map(j=>JSON.stringify(j.payload.state))).size,1);}
});
test('frozen thresholds apply per arm; exploratory override does not mutate them',()=>{
 const row={status:'complete',engine:'original',caseId:'a',reference:{reason:'partial'},predictions:{reason:'partial'},probabilities:{},evidenceScores:{reason:{attempt:.95,full:.7}},operatingThresholds:{attempt:.5,full:.8}} as unknown as Row;
 assert.equal(counts(trials([row],'full')).falseAlarm,0);assert.equal(counts(trials([row],'full',.5)).falseAlarm,1);assert.equal(counts(trials([row],'full')).falseAlarm,0);
});
test('source false alarms and incomplete execution cannot receive GO',()=>{
 const p=decisionPlan();const rows=['original','structured','binary'].flatMap(engine=>Array.from({length:120},(_,i)=>({engine,id:engine+i,caseId:String(i),context:'alone',order:'normal',repeat:1,status:'complete',elapsedMs:300,cost:.0007,contradictions:[],group:i%2?'source':'full',reference:{reason:i%2?'not_observed':'demonstrated'},predictions:{reason:i%2?'no_positive_evidence':'demonstrated'},evidenceScores:{reason:{attempt:i%2?0:1,full:i%2?0:1}},probabilities:{},operatingThresholds:{attempt:.5,full:.5},positiveTotal:i%2?0:1,positiveHits:i%2?0:1,negativeTotal:i%2?1:0,falseCredits:0,exact:1,scored:1})));
 const data={acceptance:p.acceptance,planned:360,complete:true,arms:['original','structured','binary'],rows} as any;
 assert.equal(evaluateDecision(data).status,'GO');
 for(const engine of data.arms){const row=rows.find(r=>r.engine===engine&&r.group==='source')!;row.evidenceScores.reason.attempt=1;}
 assert.equal(evaluateDecision(data).status,'NO-GO');data.complete=false;assert.equal(evaluateDecision(data).status,'PENDING');
});
