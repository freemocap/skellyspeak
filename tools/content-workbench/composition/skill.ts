/** Pure draft-content composition. No runtime loading or provider calls. */
export type Skill = { skill: {id:string;name:string;overview:string;boundary:string} };
export type Guide = {
  skill_id:string; language:string; core:{overview:string;assessment:string};
  varieties:Record<string,{assessment:string;explanation:string;examples:{text:string;translation:string;context?:string}[]}>;
  coverage:string; review_status:string;
};
export type Assessment = {instructions:string;question:string;criteria:Record<string,string>};
export function compose(skill:Skill,guide:Guide,variety:string,assessment:Assessment){
 if(skill.skill.id!==guide.skill_id)throw Error('Guide targets a different skill');
 const local=guide.varieties[variety];
 if(!local)throw Error(`No authored coverage for ${guide.language} / ${variety}`);
 for(const text of [skill.skill.name,skill.skill.overview,skill.skill.boundary,guide.core.assessment,local.assessment,assessment.instructions,assessment.question])if(typeof text!=='string'||!text.trim())throw Error('Missing required content');
 const heading=`## ${skill.skill.name}\n${skill.skill.overview}\nBoundary: ${skill.skill.boundary}`;
 const instructions=[assessment.instructions,heading,guide.core.assessment,local.assessment,assessment.question].join('\n\n');
 const prompt={type:'choice',instructions,criteria:assessment.criteria};
 const markdown=[`# ${skill.skill.name}`,`${guide.language} · ${variety}`,skill.skill.overview,`**Boundary:** ${skill.skill.boundary}`,'## Shared language guidance',guide.core.overview,'## Selected variety',local.explanation,'## Examples',...local.examples.map(e=>[e.context?`**Context:** ${e.context}`:'',`> ${e.text}`,e.translation].filter(Boolean).join('\n\n')),'## Coverage',guide.coverage,`Review: ${guide.review_status}`].join('\n\n')+'\n';
 return{markdown,prompt};
}
