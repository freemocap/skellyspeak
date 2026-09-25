import {readFileSync,writeFileSync} from 'node:fs';
import {parse,stringify} from 'yaml';
import {compose} from './skill.ts';
import {countPractice,type PracticeSubmission} from '../../../ui/src/domain/learning/practice/counts.ts';
const root=new URL('../../../docs/notes/language-guides-and-xp/drafts/',import.meta.url);
const read=(p:string)=>parse(readFileSync(new URL(p,root),'utf8'));
const parts=['# Content and practice checkpoint','Generated from draft YAML and the tested practice counter. No model calls or app integration.'];
for(const [skill,guide,variety]of [['past-reference','arabic-past','Levantine'],['possession-relationships','spanish-possession','Mexico']]){
 const r=compose(read(`skills/${skill}.yaml`),read(`languages/${guide}.yaml`),variety,read('assessment-presence.yaml'));
 parts.push(r.markdown,'## Assessor question (YAML)','```yaml\n'+stringify(r.prompt)+'```');
}
const inputs:PracticeSubmission[]=[
 {id:'1',attemptId:'a',parentId:null,text:'مبارح رحت عالسوق.',skills:{past_reference:'direct'},languageId:'Arabic',varietyId:'Levantine'},
 {id:'2',attemptId:'a',parentId:'1',text:'مبارح رحت عالسوق مع أختي.',skills:{past_reference:'direct',possession_relationships:'direct'},languageId:'Arabic',varietyId:'Levantine'},
 {id:'3',attemptId:'a',parentId:'2',text:'مبارح رحت عالسوق مع أختي وبعدين رجعنا.',skills:{past_reference:'direct',possession_relationships:'direct'},languageId:'Arabic',varietyId:'Levantine'},
 {id:'4',attemptId:'a',parentId:'3',text:'مبارح رحت عالسوق مع أختي وبعدين رجعنا.',skills:{past_reference:'direct',possession_relationships:'direct'},languageId:'Arabic',varietyId:'Levantine'},
];
parts.push('## Worked history','Presence labels below are authored fixtures, not Jev results. The second revision earns effort for both retained skills under the agreed broad rule. The unchanged resend earns nothing.','```yaml\n'+stringify({submissions:inputs,credits:countPractice(inputs)})+'```');
writeFileSync(new URL('composition-and-counts.md',root),parts.join('\n\n')+'\n');
