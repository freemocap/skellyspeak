import {spanishPrompt,levels,limits,descriptions} from './spanish-reset.ts';
import type {Trial} from './validation.ts';
export const variants=['relationship','examples','relationship-calibrated','examples-capability'] as const;
const demonstrations={
 absolute_zero:['Tengo hambre. ¿Cocino?','Compro flores. ¿Rojas?','Llueve. ¿Llevo paraguas?'],
 beginner:['Tengo hambre y poco tiempo. ¿Cocino algo rápido?','Compro flores para mi madre. ¿Rojas o blancas?','Llueve un poco. ¿Salgo ahora o espero?'],
 intermediate:['Tengo hambre, pero hoy no me apetece cocinar mucho. Puedo hacer sopa o una tortilla. ¿Cuál elegirías tú?',
 'Quiero regalarle flores a mi madre, pero ella prefiere las plantas que duran. ¿Busco una maceta en lugar de un ramo?',
 'Está lloviendo y quería salir a caminar. Puedo esperar un rato, aunque quizá llueva más después. ¿Tú qué harías?']
};
export function hybridPrompt(variant:typeof variants[number],level:typeof levels[number]){
 if(variant==='relationship'||variant==='examples')return spanishPrompt(variant,level,null,true);
 const examples=demonstrations[level].map(s=>'Mensaje: '+s).join('\n');
 const calibration=`Estas muestras calibran la forma y la dificultad, no una lista de temas. Elige otra situación cotidiana y otra manera natural de plantearla. Varía la estructura gramatical, la situación y el tipo de participación que ofreces sin aumentar la dificultad.
La pregunta debe tener sentido con la información del propio mensaje. La otra persona puede aconsejarte o reaccionar por escrito desde otro lugar. Su respuesta debe permitirte continuar de forma concreta.
DEMOSTRACIONES DEL NIVEL:
${examples}`;
 if(variant==='relationship-calibrated')return spanishPrompt('relationship',level,null,true)+'\n'+calibration;
 const context=spanishPrompt('examples',level,null,true).split('\n').slice(0,2).join('\n');
 return `${context}
Escribe como una persona adulta conversando por mensajes. Aporta algo de tu vida cotidiana y dale a la otra persona una forma fácil y relevante de participar. El interés viene de la situación y de lo que su respuesta cambia.
CAPACIDAD DEL INTERLOCUTOR:
${descriptions[level]}
${calibration}
Si la conversación continúa, usa lo que responde: acepta su elección, contesta sus preguntas y sigue un cambio de tema. Si no entiende, simplifica la misma idea; si se despide, despídete.
Write the first partner message. Level ${level}: ${limits[level]}
Empieza directamente con el mensaje. Incluye una pregunta conectada y comprensible.`;
}
export function spanishHybridTrials():Trial[]{
 const trials:Trial[]=[];
 for(let repeat=1;repeat<=10;repeat++)for(const [li,level] of levels.entries())for(let vi=0;vi<variants.length;vi++)for(let pi=0;pi<2;pi++){
  const variant=variants[(vi+repeat+li)%variants.length],persona=(pi+repeat)%2===0,scenario=persona?'persona':'no-persona';
  const full=hybridPrompt(variant,level);
  trials.push({id:`${variant}-${level}-${scenario}-r${repeat}`,language:'spanish',locale:'es',level,variant,scenario,
   messages:[{role:'system',content:persona?full:full.replace('Identity: Lucía, an adult in Valencia. ','')}]});
 }
 return trials;
}
