import assert from 'node:assert/strict';
import {spanishHybridTrials,hybridPrompt} from './spanish-hybrid.ts';
import {spanishPrompt,levels} from './spanish-reset.ts';
import {measures} from './explorer/data.ts';
const trials=spanishHybridTrials();
assert.equal(trials.length,240);assert.equal(new Set(trials.map(t=>t.id)).size,240);
for(const level of levels)for(const variant of ['relationship','examples'] as const)assert.equal(hybridPrompt(variant,level),spanishPrompt(variant,level,null,true));
for(const variant of ['relationship-calibrated','examples-capability'] as const)for(const [i,level] of levels.entries()){
 const prompt=hybridPrompt(variant,level),examples=prompt.split('\n').filter(l=>l.startsWith('Mensaje: '));
 assert.equal(examples.length,3);
 for(const text of examples){const words=measures(text.slice(9)).words;assert.ok(words>=[3,6,13][i]&&words<=[5,11,23][i],text);}
}
for(const trial of trials.filter(t=>t.scenario==='persona')){
 const partner=trials.find(t=>t.id===trial.id.replace('-persona-','-no-persona-'))!;
 assert.equal(partner.messages[0].content,trial.messages[0].content.replace('Identity: Lucía, an adult in Valencia. ',''));
}
