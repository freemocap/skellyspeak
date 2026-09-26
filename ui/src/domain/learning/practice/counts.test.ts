import {describe,it,expect} from 'vitest';
import {countPractice,type PracticeSubmission} from './counts';
const row=(id:string,text:string,parentId:string|null=null,skills:PracticeSubmission['skills']={past:'direct'}):PracticeSubmission=>({id,text,parentId,skills,attemptId:'attempt',languageId:'Arabic',varietyId:'Levantine'});
describe('experience and effort counts',()=>{
 it('counts two initial uses and two changed retries as four XP',()=>{
  const a=row('a','one'),b=row('b','two','a'),c=row('c','three','b'),d=row('d','three','c');
  const e={...row('e','four'),attemptId:'new'};
  const credits=countPractice([a,b,c,d,e]);
  expect(credits.map(c=>[c.experience,c.effort,c.xp])).toEqual([[1,0,1],[0,1,1],[0,1,1],[1,0,1]]);
 });
 it('awards retained skills effort broadly and newly introduced skills experience',()=>{
  const a=row('a','نص',null,{past:'contextual',possession:'direct'});
  const b=row('b','نص جديد','a',{past:'direct',possession:'contextual',quantity:'direct',future:'unclear'});
  expect(countPractice([a,b]).filter(c=>c.submissionId==='b').map(c=>[c.skillId,c.experience,c.effort])).toEqual([['past',0,1],['possession',0,1],['quantity',1,0]]);
 });
 it('replays duplicate deliveries once and rejects conflicting results',()=>{
  const a=row('a','原文');expect(countPractice([a,a])).toHaveLength(1);
  expect(()=>countPractice([a,{...a,text:'不同'}])).toThrow('Conflicting');
 });
 it('rejects stale revisions and cross-language chains',()=>{
  const a=row('a','one'),b=row('b','two','a');
  expect(()=>countPractice([a,b,row('c','three','a')])).toThrow('stale');
  expect(()=>countPractice([a,{...b,varietyId:'other'}])).toThrow('scope');
 });
 it('does not reward absent/unclear results or re-credit a removed and reintroduced skill',()=>{
  const a=row('a','one'),b=row('b','two','a',{past:'absent'}),c=row('c','three','b');
  expect(countPractice([a,b,c]).map(c=>[c.experience,c.effort])).toEqual([[1,0],[0,1]]);
  expect(countPractice([row('z','?',null,{past:'unclear'})])).toEqual([]);
 });
});
