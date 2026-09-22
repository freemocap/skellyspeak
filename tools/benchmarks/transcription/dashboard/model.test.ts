import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tally,value,type Row} from './model.ts';
const row=(language:string,judgment?:'faithful'|'usable'|'uncertain'|'changed'):Row=>({takeId:'t',number:1,phraseId:'p',meaning:'meaning',language,reference:'target',variety:language,results:[{condition:'c',status:'ok',text:'output',elapsedMs:50,cer:.4,review:judgment?{resultId:'r',takeId:'t',reference:'target',text:'output',judgment,reason:'review',reviewer:'assistant',basis:'intended text'}:undefined}]});
test('reviewed utility is independent of raw text distance; uncertainty remains explicit',()=>{
 const rows=[row('ar','faithful'),row('ar','usable'),row('ar','uncertain'),row('ar','changed')];
 assert.equal(tally(rows,'c').accepted,2);assert.equal(tally(rows,'c').uncertain,1);
 assert.equal(value(rows,'c','message',false),50);assert.equal(value(rows,'c','faithful',false),25);assert.equal(value(rows,'c','cer',false),40);
});
test('equal-language weighting avoids the larger language dominating',()=>{
 const rows=[row('ar','changed'),row('ar','changed'),row('es','faithful')];
 assert.equal(value(rows,'c','message',true),50);assert.ok(Math.abs(value(rows,'c','message',false)!-100/3)<1e-10);
});
test('unreviewed outputs do not silently become a ranked failure',()=>{
 assert.equal(value([row('ar')],'c','message',false),null);
 assert.equal(tally([row('ar')],'c').unreviewed,1);
});
