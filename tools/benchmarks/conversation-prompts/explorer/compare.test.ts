import test from 'node:test';
import assert from 'node:assert/strict';
import {ordering,summarize,type Row} from './compare.ts';
const row=(words:number,text:string,level='absolute_zero')=>({words,normalized:text,opening:text,charsPerWord:4,wordsPerSentence:words/2,level}) as Row;
test('length ordering counts ties as half and rejects missing comparisons',()=>{
 assert.equal(ordering([row(3,'a')],[row(4,'b')],'words'),1);
 assert.equal(ordering([row(3,'a')],[row(3,'b')],'words'),.5);
 assert.equal(ordering([row(5,'a')],[row(3,'b')],'words'),0);
 assert.ok(Number.isNaN(ordering([],[],'words')));
});
test('pair collisions and length compliance have separate denominators',()=>{
 const s=summarize([row(3,'same'),row(4,'same'),row(8,'different')],()=>.6);
 assert.ok(Math.abs(s.similarity-.6)<1e-12);
 assert.equal(s.duplicates,1/3);assert.equal(s.adherence,2/3);assert.equal(s.unique,2);
 assert.ok(Number.isNaN(summarize([row(3,'one')],()=>1).similarity));
});
