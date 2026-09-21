import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchedPair} from './current-comparison.ts';
import {trials,counts} from './sdt.ts';
import type {Row} from './spanish-analysis.ts';
const row=(caseId:string,repeat:number,status='complete',prediction='demonstrated')=>({caseId,repeat,status,context:'alone',engine:'sparse',reference:{reason:'demonstrated'},predictions:{reason:prediction},probabilities:{}} as unknown as Row);
test('current comparison matches case, context and repetition, excluding failed counterparts',()=>{
 const current=[row('a',1),row('a',2),row('b',1),row('c',1,'failed')];
 const candidate=[row('a',1),row('a',2,'failed'),{...row('b',1),context:'before'} as Row,row('c',1)];
 const pair=matchedPair(current,candidate);
 assert.deepEqual(pair.current.map(r=>[r.caseId,r.repeat]),[['a',1]]);
 assert.deepEqual(pair.candidate.map(r=>[r.caseId,r.repeat]),[['a',1]]);
});
test('current omitted observations count as misses for credit, not measured negative probabilities',()=>{
 const omitted=row('a',1,'complete','unreported');
 const ts=trials([omitted],'full');assert.equal(ts[0].score,null);
 const m=counts(ts);assert.equal(m.miss,1);assert.equal(m.unreported,1);
});
